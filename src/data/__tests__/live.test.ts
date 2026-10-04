import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchLiveSnapshot, liveSnapshotUrl, SnapshotError } from '@/data/live';
import { sampleSnapshot } from '@/data/sample';
import type { SnapshotFile } from '@/data/types';
import { isSnapshot } from '@/data/validate';

const config = { url: 'https://abc.supabase.co', publishableKey: 'sb_publishable_test' };
const file: SnapshotFile = { schemaVersion: 1, generatedAt: '2026-10-04T17:20:00Z', snapshot: sampleSnapshot };

type Reply = { status: number; body: unknown } | Error;
/** Answers each fetch in turn and records the URLs asked for. */
function replies(...answers: Reply[]) {
  const urls: string[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    urls.push(String(input));
    const next = answers.shift();
    if (!next) throw new Error('unexpected fetch');
    if (next instanceof Error) throw next;
    return { ok: next.status < 400, status: next.status, json: async () => next.body } as Response;
  });
  return urls;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('snapshot shape check', () => {
  it('accepts the sample snapshot, including after a JSON round trip (the cache)', () => {
    expect(isSnapshot(sampleSnapshot)).toBe(true);
    expect(isSnapshot(clone(sampleSnapshot))).toBe(true);
  });

  it('rejects missing fields, wrong types and unknown ids', () => {
    const { index: _index, ...noIndex } = clone(sampleSnapshot);
    expect(isSnapshot(noIndex)).toBe(false);
    expect(isSnapshot({ ...clone(sampleSnapshot), trend30: ['72'] })).toBe(false);
    const unknownVector = clone(sampleSnapshot);
    (unknownVector.vectors[0] as { id: string }).id = 'malware';
    expect(isSnapshot(unknownVector)).toBe(false);
    const unknownType = clone(sampleSnapshot);
    (unknownType.events[0] as { type: string }).type = 'worm';
    expect(isSnapshot(unknownType)).toBe(false);
    expect(isSnapshot({ ...clone(sampleSnapshot), history: sampleSnapshot.history.filter((h) => h.key !== '30D') })).toBe(false);
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot('snapshot')).toBe(false);
  });
});

describe('live snapshot', () => {
  it('builds the public Storage URL', () => {
    expect(liveSnapshotUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co/storage/v1/object/public/snapshot/v1/latest.json');
  });

  it('reads the Storage file', async () => {
    const urls = replies({ status: 200, body: file });
    await expect(fetchLiveSnapshot(config)).resolves.toEqual(sampleSnapshot);
    expect(urls).toHaveLength(1);
  });

  it('falls back to get_snapshot() when Storage fails', async () => {
    const urls = replies({ status: 404, body: {} }, { status: 200, body: file });
    await expect(fetchLiveSnapshot(config)).resolves.toEqual(sampleSnapshot);
    expect(urls[1]).toBe('https://abc.supabase.co/rest/v1/rpc/get_snapshot');
  });

  it('falls back when the Storage file has a bad shape', async () => {
    const bad = { ...file, snapshot: { ...clone(sampleSnapshot), vectors: 'none' } };
    replies({ status: 200, body: bad }, { status: 200, body: file });
    await expect(fetchLiveSnapshot(config)).resolves.toEqual(sampleSnapshot);
  });

  it('reports offline without trying the fallback when the network fails', async () => {
    const urls = replies(new TypeError('Network request failed'));
    await expect(fetchLiveSnapshot(config)).rejects.toMatchObject({ kind: 'offline' });
    expect(urls).toHaveLength(1);
  });

  it('reports a service problem when both fail with an answer', async () => {
    replies({ status: 500, body: {} }, { status: 503, body: {} });
    const error = await fetchLiveSnapshot(config).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SnapshotError);
    expect(error).toMatchObject({ kind: 'service' });
  });

  it('reports a service problem for a schema version it does not know, or nothing published', async () => {
    replies({ status: 200, body: { ...file, schemaVersion: 2 } }, { status: 200, body: { ...file, schemaVersion: 2 } });
    await expect(fetchLiveSnapshot(config)).rejects.toMatchObject({ kind: 'service' });
    replies({ status: 404, body: {} }, { status: 200, body: null });
    await expect(fetchLiveSnapshot(config)).rejects.toThrow('No snapshot published yet');
  });
});
