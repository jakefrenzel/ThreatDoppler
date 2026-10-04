# Backend plan: milestone 1 (live data)

Status: draft, 2026-10-03. Facts about feeds and Supabase were checked on that date; anything marked
*unverified* still needs confirming.

## Goal

Replace the sample data with real data. Milestone 1 delivers the read-only snapshot the app already
consumes (`Snapshot` in `src/data/types.ts`): the index, the six attack-type scores, sector and region
scores, a 7-day forecast, the live event feed with detail pages, and up to five years of history. Every
user sees the same data, so there are no accounts.

Out of scope until later milestones: push alerts (milestone 2), email/Slack delivery, quiet hours and
digests (milestone 3). Until then the Alerts tab keeps working locally, and the "Recent deliveries" card
is hidden rather than showing sample deliveries.

Constraints: free hosting (Supabase free tier), data licences that allow a small public app that may be
monetised later, and a method honest enough to explain on the About screens.

## Decisions (agreed 2026-10-03)

1. **Non-commercial data (DDoS and phishing): use Cloudflare Radar while the app is free.** There is
   no free, commercially licensed DDoS source, and phishing is nearly as bad (see Sources). Radar
   (CC BY-NC 4.0) covers DDoS, with credit, while the app has no ads, purchases or subscriptions.
   Email Cloudflare for an exception now, and in any case before monetising (see "Before monetising"
   below).
   *Changed 2026-10-04:* phishing also comes from Radar (its email security series), not
   Phishing.Database (see Rejected).
2. **Ask ransomware.live for written permission.** It is the only free source with a sector and
   country for each ransomware victim. Its terms are stricter than "non-commercial": the free API is
   personal-use only, and re-serving its data is banned, so even a free public app needs written
   approval. Don't ingest it until approval arrives. Until then, sector and region scores are modelled
   estimates (see Method).
3. **Weights: keep the design's.** Ransomware .30, exploitation .25, phishing .15, supply chain .10,
   DDoS .10, insider/other .10. When a sub-index has no data, its weight is spread over the others in
   proportion.
4. **Add a `breach` event type.** HIBP breaches don't fit the current `EventType` values (ransomware,
   exploit, ddos, phishing, supply), so add `breach`, with a catalog entry and colour.
5. **Backend code lives in this public repo; backups don't.** Secrets never go in the repo. Database
   backups go to a separate private repo.

## Before monetising

"Non-commercial" (CC BY-NC) means not primarily intended for commercial advantage or monetary
compensation. A free app with no ads, purchases or subscriptions fits, and so does a portfolio piece.
App Store distribution and the developer fee don't change that. The first ad, paid tier, subscription,
sponsorship or business promotion does. Go through this list **before** that ships, because permission
can't cover data already served.

- [ ] **Cloudflare Radar (CC BY-NC 4.0):** written permission for commercial use, or remove the Radar
      ingestion. Without Radar, DDoS and phishing show "No data yet" and their weight is spread over the others, and
      Radar-based sector/region adjustments fall back to the VCDB baselines.
- [ ] **ransomware.live** (if it's in use by then): check that the written approval covers commercial
      use, not just a free app.
- [ ] **Every other source:** re-read its current terms (they change; abuse.ch did). Confirm each still
      allows commercial use and that the credits screen matches what each one requires. Sources: KEV,
      EPSS, RansomLook, OSV, HIBP, VCDB.
- [ ] **VCDB (CC BY-SA 4.0):** if any VCDB-derived data is redistributed (for example published
      baselines or an export), it must carry CC BY-SA.
- [ ] **No new non-commercial sources** have been added since this list was written. Search the
      ingest functions and the credits screen.
- [ ] **Privacy and store listings:** update the privacy policy and the App Store / Play Store data
      disclosures for whatever the monetisation adds (ad SDKs, purchase or analytics data).
- [ ] **If real money is involved:** a short check of the source terms with someone who does licensing.

## Sources

Chosen for milestone 1. All are free, small daily or hourly pulls.

| Source | Feeds | Licence | History | Notes |
|---|---|---|---|---|
| CISA KEV (JSON feed) | Exploitation; ransomware (via `knownRansomwareCampaignUse`) | CC0, no attribution needed (don't use the CISA logo) | Nov 2021 onwards | Has vendor/product but no sector, so sector comes from a hand-made map |
| FIRST EPSS (daily CSV, GitHub archive) | Exploitation, and an early signal for the forecast | Free, attribution requested | Apr 2021 onwards | Use the CSVs, not the API ("for lookup, not bulk access"). Model changes on 2022-02, 2023-03 and 2025-03 shift scores, so normalise around them |
| RansomLook API | Ransomware | CC BY 4.0, attribution required | 2021 onwards | No sector or country. Store **daily counts per group only**; never store or show victim names |
| OpenSSF malicious-packages / OSV (`MAL-` ids) | Supply chain | Apache-2.0 | Full history | Most active free supply-chain signal |
| Have I Been Pwned breaches | Insider/other; breach events | CC BY 4.0, visible link to haveibeenpwned.com wherever shown | 2013 onwards | No key needed for the breach list, but a user-agent is required |
| VERIS Community DB (VCDB) | Insider share; sector and country baselines | CC BY-SA 4.0 | 2013 onwards | Lags and is irregular, so it's used for baselines, not live movement. ShareAlike applies to derived data we redistribute |
| Cloudflare Radar | DDoS (layer 3/7); phishing (email security); sector and region of attacks | CC BY-NC 4.0: credit required, non-commercial only (see "Before monetising") | Daily values for up to about 91 days per request, so longer ranges are fetched in windows | Free API token. Rate-limits bursts (429), so requests are spaced out. Attack series only come normalised (MIN0_MAX, a pure scale); email series are real percentages |

**Rejected:**
- **abuse.ch** (URLhaus, ThreatFox, MalwareBazaar): needs a key, and free use is now not-for-profit only.
- **OpenPhish Community:** no commercial use and no display to third parties.
- **Phishing.Database** (dropped 2026-10-04): only 10–60 new domains a day, git history only from Dec
  2024, "new today" files frozen since Dec 2025, and multi-week gaps when the maintainer is away, which
  would read as quiet periods.
- **PhishTank:** new registrations are closed.
- **AlienVault OTX:** non-commercial only.
- **GreyNoise Community:** too few lookups to be useful.
- **Shadowserver:** no API, and no scraping allowed.
- **ransomwatch:** archived in March 2026.
- **NVD:** not needed if we use KEV and EPSS.

## Method

The method has to be simple enough to explain on "How the index works" and stable enough that the
bands mean something.

**Signals.** Each signal is one daily value (a count, or for Radar a volume or share). A sub-index has
one or more signals:
- Exploitation: KEV additions; CVEs whose EPSS score rose above 0.5.
- Ransomware: RansomLook posts; KEV additions marked as used in ransomware campaigns.
- Supply chain: new malicious packages in OSV.
- Insider/other: HIBP breaches added, each weighted by ln(1 + accounts affected). Spam lists,
  fabricated, retired, malware and stealer-log entries don't count. (VCDB's insider share was meant as a
  baseline here, but VCDB has almost no incidents after 2021, so it's only used for sector and region
  baselines in step 6.)
- DDoS: Cloudflare Radar layer 3/4 and layer 7 attack volume.
- Phishing: the share of all email Cloudflare Radar flags as malicious, and the share that's malicious
  and harvests credentials.

**Scores (0–100).** Only complete UTC days are scored; a day still in progress always looks quiet,
so the app shows the latest complete day.
1. **Level.** A signal's level on a day is an exponentially weighted total of its last 35 days: each
   day counts half as much as one 5 days newer. (A plain 7-day total made scores fall off a cliff a
   week after any spike, when it left the window. Tested on the last year, the 5-day half-life cut the
   average daily move of a signal's rank from 5.2 to 4.6 points, and the 95th percentile from 24 to
   14. A 3-day half-life was jumpier; 7 days reacted too slowly.)
2. **Rank.** The level is ranked against that signal's own previous two years (a midrank, so ties count
   half). A signal needs 28 days of history before it counts, and a gap in it leaves the next 35 days
   unranked. EPSS crossings aren't counted on the day the EPSS model changes (that moves every score
   at once) or when the previous day's file is missing. Signals are ranked separately rather than
   added, because their scales differ: about one KEV addition a day against dozens of EPSS crossings,
   so a sum would just be EPSS.
3. **Sub-index.** The mean of its signals' ranks is the sub-index's raw value. That raw value is ranked
   against the sub-index's own previous two years (at least 90 days) and **calibrated** onto the
   scale so the bands match the design: Low is the quietest ~3% of days, Guarded the next ~21%,
   Elevated ~50%, High ~21% and Severe the busiest ~5%. (Calibrated 2026-10-04: as plain percentiles,
   sub-indices were Severe on 7–35% of days. After calibration, 3–10% over the last two years; rising
   trends such as 2025's supply-chain surge still show as High or Severe.)

**Index.** The weighted mean (decision 3) of each sub-index's latest score from the last 2 days; older
than that, a sub-index is stale and its weight is spread over the others. That raw value is ranked
against the index's own previous two years and calibrated the same way. Over the last two years: Low
4%, Guarded 28%, Elevated 48%, High 17%, Severe 4%, moving 4.8 points a day on average. The 24-hour
and 7-day changes are plain differences. The "90% CI" figure is the 90% spread of the index's
day-to-day noise around its 28-day trend.

**Sectors and regions.** These are modelled. A sector's score is the six global sub-index scores,
weighted by the decision 3 weights times the sector's "lift" for each attack type: how much more or
less often that type shows up in the sector's VCDB incidents than in all of them (shrunk towards 1 for
small samples, clipped to 0.5–2). `scripts/vcdb` computes the lifts from about 5,400 incidents since
2010, pooled because VCDB has few after 2021, with MOVEit left out (one campaign entered as ~750
incidents). Regions work the same way, using VCDB victim regions. Like the index, an area's weighted
mean is ranked against its own two years and calibrated. Each sector or region's "top threat" is the
attack type that contributes most to its score. The app labels these views "modelled estimate".
*Not done yet* (as of 2026-10-04): sector-specific adjustments, such as KEV vendor/product mapped to a
sector (medical devices → health, industrial control systems → energy/manufacturing), Radar attacks by
industry and target location, and ransomware.live sectors (once approved, decision 2). Until then
areas mostly follow the global scores, differing only through their mix.

**Forecast.**
- The index and each sub-index get a damped-trend forecast (Gardner–McKenzie) for the next 7 days,
  fitted by grid search on the last year's one-step errors.
- The ranges are the 90% band of that model's own errors at each horizon over the last 180 forecast
  origins.
- The index is forecast directly rather than combined from the sub-index forecasts: calibration makes
  the index a non-linear function of them, and a direct forecast's errors are measured the same way.
- Backtested over the last year (each origin using only earlier errors), the 90% ranges contained the
  actual value 88% of the time for the index and 86–95% for the sub-indices. The fitted models are
  close to "tomorrow looks like today", so ranges are wide (index MAE about 11 points over 7 days).
- "MAE 7D" is the average error of the last 30 days of logged index forecasts against what actually
  happened. Forecasts are logged in `forecasts` once a day, so it's real, not claimed; until 30 have
  come due, the backtest's MAE is shown.
- EPSS as an early signal for exploitation is a later improvement.

**History.**
- Daily index values from October 2021, when all the core sources are available. That gives close to
  the full five years.
- 30D and 90D use daily values. 1Y uses weekly averages and 5Y monthly averages, matching the app's
  existing ranges.
- "Peaks" are the three biggest highs, at least 5 (30D), 10 (90D), 30 (1Y) or 90 (5Y) days apart.
  Until events exist (step 7), each is labelled with the sub-index that contributed most that day;
  then it'll be the largest event that week.
- Time-in-band and the other stats are computed from the same series.

**Events (last 24 hours).** Generated by rules:

| Event | Rule | Type |
|---|---|---|
| KEV addition | Each new KEV entry | `exploit`, or `ransomware` if the KEV entry is flagged as used in ransomware campaigns |
| Ransomware surge | A group posts N or more victims in 24 hours | `ransomware` (shows counts, never names) |
| Malicious package wave | N or more malicious packages in one ecosystem in 24 hours | `supply` |
| New breach | Each HIBP breach added | `breach` (decision 4) |
| DDoS spike | Radar layer 7 volume far above its 28-day normal | `ddos` |

**Impact and wording.**
- An event's impact is its share of its sub-index's change, times that sub-index's weight.
- Technical and Plain text come from wording templates for each event kind. Example for a KEV
  addition: Technical "CISA adds CVE-2026-1234 (Ivanti EPMM) to KEV · EPSS 0.94", Plain "Attackers
  are using a flaw in Ivanti EPMM".
- The detail page uses fields from the source. For KEV that means the required action, due date, EPSS
  score, ransomware use and affected product. There are no IOC lists (IP addresses or domains), because
  no commercially licensed IOC feed is available.

## Architecture (Supabase)

```
pg_cron (Supabase Cron) ──► ingest-* edge functions ──► raw tables (private)
                                                             │
render-snapshot ──► compute_scores() SQL ──► signals / scores / index / events tables (private)
                                                             │
pg_cron hourly ──► render-snapshot edge function ──► snapshot/v1/latest.json in a public Storage bucket
                                                             │                (Cache-Control 300)
                                              snapshots table ──► get_snapshot() RPC (fallback, keep-alive)
App ──► fetch latest.json (fall back to the RPC) ──► existing SnapshotProvider cache and offline handling
```

- **Scheduling.**
  - Supabase Cron (`pg_cron` + `pg_net`) calls each function.
  - The calls send a **secret key** (`sb_secret_…`) stored in Vault, in the `apikey` header.
  - Functions are set to `verify_jwt = false` and check that key with `withSupabase({ auth: 'secret' })`.
  - Don't copy the docs' example that sends the publishable key: it would let anyone trigger ingestion.
- **Ingest functions.**
  - One function per source, run hourly. EPSS and VCDB run daily.
  - Each one returns straight away and does its work in `EdgeRuntime.waitUntil`, because `pg_net` gives
    up after 2 s by default.
  - Large files are streamed and inserted in batches of 500–1000 rows, so they stay inside the free
    tier's 2 s of CPU and 256 MB per call.
  - The heavy aggregation happens in SQL.
  - If a feed regularly gets near the CPU limit, move that one to a GitHub Actions job.
- **Storage budget (500 MB database).**
  - Store aggregates, not raw feeds.
  - EPSS is about 380k rows per day, so only the latest scores of CVEs that are on KEV or above 0.1
    are kept (about 17k rows, replaced daily), plus daily summary figures. Parsing the whole file
    takes about 250 ms.
  - RansomLook is stored as group/day counts only.
  - Raw rows are pruned after 30 days.
  - A `source_runs` table records every run, and the database size is checked from it.
- **Serving.**
  - The render function builds the snapshot using the app's own `Snapshot` type. That file
    (`src/data/types.ts`) has no imports, so the function can import it directly when deployed with
    `--use-api`.
  - The snapshot is uploaded with a 300 s cache.
  - CDN hits use the separate 5 GB cached-egress quota and no function calls. 5,000 app opens a day
    is about 2.3 GB a month.
  - The JSON gets a `schemaVersion` field, so old app builds can recognise a change they don't
    understand.
- **Freshness.** The snapshot includes, for each source, when it last succeeded. If a source is stale
  for more than 2 days, its sub-index is marked low confidence rather than silently frozen.

**Tables (all in `public`, RLS on, no anon grants except `get_snapshot`):**
- `source_runs`
- Raw data, pruned after 30 days: `kev_entries`, `epss_tracked`, `ransom_counts_daily`,
  `malicious_packages`, `breaches`, `vcdb_baselines`, `radar_daily`, `phish_counts_daily`
- Derived, kept indefinitely: `signals_daily`, `scores_daily`, `index_daily`, `area_scores_daily`,
  `forecasts`, `events`, `snapshots` (the last 30 days)

**Security.**
- The publishable key (`sb_publishable_…`) is the only key in the app, via
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It's safe to ship by design.
- The secret key lives only in Vault and GitHub secrets.
- From 2026-10-30, new tables aren't exposed to the API automatically. Every grant is written
  explicitly in a migration, and the default grants to `anon`/`authenticated` are revoked.
- No victim names are stored. Outbound fetches only go to the listed source hosts.

**Operations.**
- **Two free projects:** `threatdoppler-dev` and `threatdoppler-prod`. Develop against the dev project
  from Windows without Docker: write migrations by hand, `db push`, and `functions deploy --use-api`.
  Docker Desktop is only needed for running functions locally.
- **Nightly GitHub Actions job:**
  - `supabase db dump` (roles, schema and data) as plain SQL at fixed paths, pushed to a **private**
    backup repo. Git stores each night as a diff, and its history is the list of backups. Only
    derived tables matter; raw data can be fetched again, so large raw tables can be left out of the
    data dump with `-x`.
  - In the same job, a keep-alive call to `get_snapshot`. Free projects pause after about a week with
    no database activity, and it's unclear whether cron jobs count.
- **Deployment:** manual from the CLI at first. Later, a workflow on push to `main`
  (`supabase link`, `db push`, `functions deploy --use-api`).
- **Backfill:** KEV and HIBP need none (their feeds hold everything). RansomLook and Radar backfill
  through their own functions (`{"from": "2021-10-01"}` and `{"days": 730}` in the request body).
  EPSS and OSV use `scripts/backfill/index.mjs`, which streams the EPSS daily archive (about 3 GB) and
  OSV's per-ecosystem zips (about 260 MB) and writes SQL, applied with
  `npx supabase db query --linked -f <file>`. It ran locally on 2026-10-04; a GitHub Actions workflow
  can wrap it later. Then `select public.compute_scores('2021-01-01')` recomputes everything (about a
  minute).

## Repo changes

- `supabase/`: `config.toml`, `migrations/`, `functions/<name>/index.ts` with one `deno.json` each,
  and `functions/_shared/`.
- Add the Supabase CLI as a dev dependency.
- `docs/backend-plan.md`: this file.
- `scripts/backfill/`: the backfill script (Node).
- Exclude `supabase/functions` from the root `tsconfig.json`, ESLint and Jest, because Deno globals and
  `npm:` imports would break them. Add a `deno check` step to CI.
- `.github/workflows/backup.yml` (nightly). Later, `deploy.yml`.

## App changes

- `src/data/api.ts`:
  - Fetch the snapshot URL, falling back to the RPC.
  - 10 s timeout.
  - **Check the shape** of the data before using it, for network and cache alike (the audit's main
    open item).
  - Tell "offline" apart from "the service had a problem".
  - Keep the sample data behind a flag for development and tests.
- Env vars: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **About → Data sources:** replace the "Sample data" card with the real sources and their required
  attributions (KEV, EPSS, RansomLook, OSV, HIBP, VCDB, Cloudflare Radar). This is a licence requirement,
  not optional.
- **About → How the index works:** describe the method above, including "sector and region views are
  modelled estimates".
- Breakdown screen: a small "Modelled" note until real sector/region data exists.
- Add the `breach` event type (decision 4). Hide "Recent deliveries" until milestone 3.
- Sub-indices with no data show "No data yet" instead of a number.

## Order of work

Each step ends with something checkable.

1. **Setup (you):** Supabase account and two projects, keys, GitHub secrets, a private backup repo,
   and the licence emails (Cloudflare, ransomware.live).
2. **Scaffolding:** `supabase/` folder, first migration (`source_runs` and grants), CI changes
   (`deno check`, exclusions), backup workflow. *Check:* migration applied on dev, nightly backup
   lands in the private repo.
3. **Exploitation end to end:** KEV and EPSS ingestion, scores, index, `render-snapshot` with only
   that sub-index, and the app reading it behind a dev flag. *Check:* the app shows a real exploitation
   score.
4. **Remaining sources:** RansomLook, OSV, HIBP, Radar for DDoS and phishing (decision 1). VCDB moves to step 6.
   *Check:* all sub-indices have scores, and `source_runs` is clean for 48 hours.
5. **Backfill and history:** the backfill workflow, then history ranges, peaks and band calibration.
   *Check:* the 5-year chart looks plausible, and Severe is rare.
6. **Sectors, regions and forecast:** VCDB baselines, KEV sector map, damped-trend forecasts, logged
   MAE. *Check:* the forecast's 90% ranges contain the actual value about 90% of the time on backfilled
   data.
7. **Events and wording:** event rules, Technical/Plain templates, detail pages.
8. **App switch-over:** shape checking, error/offline split, attribution and method screens, "Modelled"
   labels, `breach` type. *Check:* tests for the shape check and fallbacks, then a device check.
9. **Production:** apply everything to the prod project, point the release build at it, and watch it
   for a week.

## Risks

- **Credibility.** An index is an opinion. Publish the method, label the modelled parts, and show
  confidence when sources are stale.
- **Sources change their terms.** This already happened with abuse.ch. Keep each source behind one
  ingest function and one row in the attribution list, so it can be swapped.
- **Free-tier limits.** Main risks: 500 MB database (store aggregates), pausing (keep-alive), no
  backups (nightly dump), 2 s CPU per call (streaming, or a GitHub Actions fallback). Going over a
  quota can make the project read-only or return HTTP 402 until the next billing cycle.
- **Sector and region accuracy.** Without ransomware.live or Radar, these mostly follow the global
  attack-type scores. That's a reason to pursue decision 2, and to label the views honestly.
