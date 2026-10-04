import type { Snapshot, SnapshotFile } from './types';
import { isSnapshot } from './validate';

/** The newest file version this build understands. */
export const SCHEMA_VERSION = 1;
const TIMEOUT_MS = 10_000;

/**
 * Why a fetch failed. `offline`: the request never got an answer (no connection, or it timed
 * out). `service`: the service answered, but with an error or data this build can't use.
 */
export class SnapshotError extends Error {
  constructor(
    readonly kind: 'offline' | 'service',
    message: string,
  ) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export interface LiveConfig {
  url: string;
  publishableKey: string;
}

export const liveSnapshotUrl = (supabaseUrl: string) =>
  `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/snapshot/v1/latest.json`;

const rpcUrl = (supabaseUrl: string) => `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_snapshot`;

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    throw new SnapshotError('offline', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new SnapshotError('service', `Snapshot request failed with ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new SnapshotError('service', 'Snapshot response is not JSON');
  }
}

function unwrap(body: unknown): Snapshot {
  const file = body as Partial<SnapshotFile> | null;
  if (!file || file.schemaVersion !== SCHEMA_VERSION) {
    throw new SnapshotError('service', `Unsupported snapshot file (schemaVersion ${String(file?.schemaVersion)})`);
  }
  if (!isSnapshot(file.snapshot)) throw new SnapshotError('service', 'Snapshot file has an unexpected shape');
  return file.snapshot;
}

/**
 * Reads the published snapshot from Storage (a CDN-cached file). If that fails for any reason
 * other than being offline, asks the database for the same file through get_snapshot().
 */
export async function fetchLiveSnapshot({ url, publishableKey }: LiveConfig): Promise<Snapshot> {
  try {
    return unwrap(await request(liveSnapshotUrl(url)));
  } catch (e) {
    if (e instanceof SnapshotError && e.kind === 'offline') throw e;
    const body = await request(rpcUrl(url), {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (body === null) throw new SnapshotError('service', 'No snapshot published yet');
    return unwrap(body);
  }
}
