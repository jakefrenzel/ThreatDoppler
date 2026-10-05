// Expo push service: sending messages and reading receipts. Optional EXPO_ACCESS_TOKEN (function
// secret) is sent when set, for Expo's "enhanced push security".

const SEND = "https://exp.host/--/api/v2/push/send";
const RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo's limits per request. */
export const SEND_BATCH = 100;
export const RECEIPT_BATCH = 1000;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** A ticket or receipt: ok, or an error with Expo's code (e.g. DeviceNotRegistered). */
export interface PushResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function headers(): Record<string, string> {
  const token = Deno.env.get("EXPO_ACCESS_TOKEN");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function post(url: string, body: unknown): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    // Expo asks for backoff on 429 and 5xx.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
      continue;
    }
    const json = await res.json().catch(() => null) as { data?: unknown; errors?: { message: string }[] } | null;
    if (!res.ok || !json) throw new Error(`Expo push ${res.status}: ${json?.errors?.map((e) => e.message).join("; ") ?? "no body"}`);
    return json.data;
  }
}

const toResult = (t: { status?: string; id?: string; message?: string; details?: { error?: string } }): PushResult =>
  t.status === "ok" ? { ok: true, id: t.id } : { ok: false, error: t.details?.error ?? t.message ?? "error" };

/** Sends up to SEND_BATCH messages; returns one ticket per message, in order. */
export async function sendPush(messages: PushMessage[]): Promise<PushResult[]> {
  const data = await post(SEND, messages.map((m) => ({ ...m, sound: "default", channelId: "alerts" })));
  return (data as Parameters<typeof toResult>[0][]).map(toResult);
}

/** Receipts for up to RECEIPT_BATCH ticket ids. Ids Expo doesn't know yet are left out. */
export async function readReceipts(ids: string[]): Promise<Map<string, PushResult>> {
  const data = await post(RECEIPTS, { ids }) as Record<string, Parameters<typeof toResult>[0]>;
  return new Map(Object.entries(data ?? {}).map(([id, r]) => [id, toResult(r)]));
}
