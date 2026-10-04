// One-off backfill for sources whose history isn't in their live feed (step 5 of
// docs/backend-plan.md). Writes SQL to stdout or --out; apply it with
//   npx supabase db query --linked -f <file>
// Nothing large is written to disk: archives are streamed.
//
//   node scripts/backfill/index.mjs --only epss,osv --from 2021-10-01 --out backfill.sql
//
// EPSS: walks the daily CSV archive and counts CVEs whose score rose above 0.5 each day, the same
//   rule as finish_epss(). Days after a missing file or a model change get no count.
// OSV: streams each ecosystem's all.zip, counts MAL- records by published day (withdrawn ones
//   excluded), and also loads the last 30 days' records into malicious_packages, which the live
//   ingest-osv function keeps up to date from then on.
import { createWriteStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { Unzip, UnzipInflate } from 'fflate';

const USER_AGENT = 'ThreatDoppler-backfill/1.0 (+https://github.com/jakefrenzel/ThreatDoppler)';
const DAY_MS = 86_400_000;
const OSV_ECOSYSTEMS = ['npm', 'PyPI', 'RubyGems', 'NuGet', 'crates.io', 'Go', 'Maven', 'Packagist', 'VSCode'];
// Days the live tables own. OSV signal days inside this window are recounted from
// malicious_packages by compute_scores(), so the backfill leaves them alone.
const OSV_LIVE_DAYS = 14;
const OSV_KEEP_DAYS = 30;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]]);
    return pairs;
  }, []),
);
const only = new Set((args.only ?? 'epss,osv').split(','));
const from = args.from ?? '2021-10-01';
const out = args.out ? createWriteStream(args.out) : process.stdout;
const log = (...m) => console.error(new Date().toISOString().slice(11, 19), ...m);

const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(Date.parse(day) + n * DAY_MS));
const today = isoDay(new Date());
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

function insert(table, columns, rows, conflict) {
  for (let i = 0; i < rows.length; i += 1000) {
    const values = rows.slice(i, i + 1000).map((r) => `(${r.map(q).join(', ')})`).join(',\n  ');
    out.write(`insert into public.${table} (${columns.join(', ')}) values\n  ${values}\n${conflict};\n\n`);
  }
}

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      // S3 answers 403 rather than 404 for a file that doesn't exist.
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res;
    } catch (e) {
      if (attempt >= 4) throw e;
      log(`retry ${attempt}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

// ---- EPSS ----

async function epssDay(day) {
  const res = await get(`https://epss.empiricalsecurity.com/epss_scores-${day}.csv.gz`);
  if (!res) return null;
  const lines = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
  // Files before Feb 2022 have no model header; they're all the first model.
  let model = 'v2021';
  const scores = new Map();
  for await (const line of lines) {
    if (line.startsWith('#')) {
      model = /model_version:([^,]+)/.exec(line)?.[1] ?? model;
      continue;
    }
    if (line.startsWith('cve,') || !line) continue;
    const [cve, epss] = line.split(',');
    scores.set(cve, Number(epss));
  }
  return { model, scores };
}

async function backfillEpss() {
  const days = [];
  for (let d = addDays(from, -1); d <= today; d = addDays(d, 1)) days.push(d);
  // Download a few days ahead while the current one is processed; they must be read in order.
  const ahead = 4;
  const pending = days.slice(0, ahead).map(epssDay);
  const daily = [];
  const signals = [];
  let prev = null;
  for (let i = 0; i < days.length; i++) {
    if (i + ahead < days.length) pending.push(epssDay(days[i + ahead]));
    const file = await pending[i];
    pending[i] = null;
    const day = days[i];
    if (!file) {
      log(`epss ${day}: no file`);
      prev = null;
      continue;
    }
    let above = 0;
    let tracked = 0;
    let crossings = 0;
    for (const [cve, score] of file.scores) {
      if (score > 0.1) tracked++;
      if (score > 0.5) {
        above++;
        const before = prev?.scores.get(cve);
        if (before === undefined || before <= 0.5) crossings++;
      }
    }
    const comparable = prev && prev.day === addDays(day, -1) && prev.model === file.model;
    if (day >= from) {
      daily.push([day, file.model, file.scores.size, tracked, above, comparable ? crossings : null]);
      if (comparable) signals.push(['epss_crossings', day, crossings]);
    }
    if (i % 30 === 0 || !comparable) log(`epss ${day}: ${file.scores.size} scored, ${comparable ? crossings : 'no'} crossings (${file.model})`);
    prev = { day, model: file.model, scores: file.scores };
  }
  out.write('-- EPSS: daily figures and crossings\n');
  insert('epss_daily', ['score_date', 'model_version', 'scored', 'tracked', 'above_05', 'crossings'], daily,
    'on conflict (score_date) do update set model_version = excluded.model_version, scored = excluded.scored, ' +
    'tracked = excluded.tracked, above_05 = excluded.above_05, crossings = excluded.crossings');
  insert('signals_daily', ['signal', 'day', 'value'], signals, 'on conflict (signal, day) do update set value = excluded.value');
}

// ---- OSV ----

async function osvEcosystem(ecosystem, counts, recent) {
  const res = await get(`https://osv-vulnerabilities.storage.googleapis.com/${encodeURIComponent(ecosystem)}/all.zip`);
  if (!res) return log(`osv ${ecosystem}: no all.zip`);
  const keepFrom = addDays(today, -OSV_KEEP_DAYS);
  let records = 0;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    if (!/(^|\/)MAL-[^/]+\.json$/.test(file.name)) return; // skip everything else without inflating
    const chunks = [];
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      chunks.push(chunk);
      if (!final) return;
      const record = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (record.withdrawn || !record.published) return;
      const day = record.published.slice(0, 10);
      records++;
      counts.set(day, (counts.get(day) ?? 0) + 1);
      if (day >= keepFrom) recent.push([record.id, ecosystem, day, false]);
    };
    file.start();
  };
  for await (const chunk of res.body) unzip.push(chunk);
  unzip.push(new Uint8Array(0), true);
  log(`osv ${ecosystem}: ${records} malicious-package records`);
}

async function backfillOsv() {
  const counts = new Map();
  const recent = [];
  for (const ecosystem of OSV_ECOSYSTEMS) await osvEcosystem(ecosystem, counts, recent);

  // Every day from `from`, including days with none, up to where the live window starts.
  const liveFrom = addDays(today, -OSV_LIVE_DAYS);
  const signals = [];
  for (let d = from; d < liveFrom; d = addDays(d, 1)) signals.push(['osv_malicious', d, counts.get(d) ?? 0]);
  out.write('-- OSV: malicious packages per published day, and the last 30 days of records\n');
  insert('signals_daily', ['signal', 'day', 'value'], signals, 'on conflict (signal, day) do update set value = excluded.value');
  insert('malicious_packages', ['id', 'ecosystem', 'published', 'withdrawn'], recent, 'on conflict (id) do nothing');
}

out.write(`-- Generated by scripts/backfill/index.mjs on ${new Date().toISOString()} (from ${from})\n\n`);
if (only.has('epss')) await backfillEpss();
if (only.has('osv')) await backfillOsv();
if (out !== process.stdout) out.end();
log('done');
