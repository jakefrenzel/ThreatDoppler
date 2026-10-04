import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchSnapshotFile, liveSnapshotUrl, overlayLive } from '@/data/live';
import { sampleSnapshot } from '@/data/sample';
import type { SnapshotFile } from '@/data/types';

const file: SnapshotFile = {
  schemaVersion: 1,
  generatedAt: '2026-10-04T17:20:00Z',
  partial: true,
  sources: { kev: '2026-10-04T17:07:12Z', epss: null },
  snapshot: {
    model: '0.1',
    updatedAt: '2026-10-04T17:20:00Z',
    index: { value: 41.5, delta24h: -2, delta7d: 3.5, ci: 6.1 },
    trend30: [40, 41.5],
    vectors: [{ id: 'exploitation', weight: 0.25, score: 41.5, delta24h: -2 }],
  },
};

const respond = (status: number, body: unknown) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: status < 400, status, json: async () => body } as Response);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('live snapshot', () => {
  it('builds the public Storage URL', () => {
    expect(liveSnapshotUrl('https://abc.supabase.co/')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/snapshot/v1/latest.json',
    );
  });

  it('lays real fields and sub-indices over the sample', () => {
    const merged = overlayLive(sampleSnapshot, file.snapshot);
    expect(merged.index).toEqual(file.snapshot.index);
    expect(merged.model).toBe('0.1');
    expect(merged.vectors.map((v) => v.id)).toEqual(sampleSnapshot.vectors.map((v) => v.id));
    expect(merged.vectors.find((v) => v.id === 'exploitation')?.score).toBe(41.5);
    expect(merged.vectors.find((v) => v.id === 'ransomware')).toEqual(sampleSnapshot.vectors[0]);
    expect(merged.sectors).toBe(sampleSnapshot.sectors);
  });

  it('returns a file it understands', async () => {
    respond(200, file);
    await expect(fetchSnapshotFile('https://x')).resolves.toEqual(file);
  });

  it('rejects an HTTP error', async () => {
    respond(404, {});
    await expect(fetchSnapshotFile('https://x')).rejects.toThrow('404');
  });

  it('rejects a schema version it does not know', async () => {
    respond(200, { ...file, schemaVersion: 2 });
    await expect(fetchSnapshotFile('https://x')).rejects.toThrow('schemaVersion 2');
  });
});
