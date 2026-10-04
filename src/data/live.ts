import type { Snapshot, SnapshotFile } from './types';

/** The newest file version this build understands. */
export const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 10_000;

export const liveSnapshotUrl = (supabaseUrl: string) =>
  `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/snapshot/v1/latest.json`;

/** Fetches the published snapshot file. Throws on a network error, a timeout or an unknown version. */
export async function fetchSnapshotFile(url: string): Promise<SnapshotFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Snapshot request failed with ${res.status}`);
    const file = (await res.json()) as SnapshotFile;
    if (file?.schemaVersion !== SCHEMA_VERSION || typeof file.snapshot !== 'object' || !file.snapshot) {
      throw new Error(`Unsupported snapshot file (schemaVersion ${String(file?.schemaVersion)})`);
    }
    return file;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Development only, while the backend computes part of the snapshot: real fields replace the
 * sample ones, and real sub-index scores replace the sample scores with the same id.
 */
export function overlayLive(base: Snapshot, live: Partial<Snapshot>): Snapshot {
  const vectors = base.vectors.map((v) => live.vectors?.find((l) => l.id === v.id) ?? v);
  return { ...base, ...live, vectors };
}
