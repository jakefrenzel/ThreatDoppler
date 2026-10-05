# Push plan: milestone 2 (push alerts)

Status: agreed 2026-10-05. Facts about Expo were checked on that date against the SDK 57 docs.

## Goal

Turn the alert rules the app already has (Alerts tab, New rule, onboarding picks) into real push
notifications, sent from the backend when a rule's condition is met. Today the rules live only on the
phone and nothing is sent.

Out of scope: email and Slack delivery, and email digests (milestone 3). Accounts: there are none, so
a device is identified by its Expo push token.

## What exists

- **Rules** (`src/state/store.ts`, `AlertRule`): kinds `index` (above a threshold, or band change),
  `sector` / `region` / `vector` (above a threshold, or a 24-hour jump), `vuln` (exploited flaws, CVSS
  floor), `digest` (daily or weekly). Each has channels (push, email, Slack) and can be turned off.
- **Quiet hours** (start and end, on or off) and the onboarding "extras".
- **Permission flow** (`src/lib/notifications.ts`): asked only from an explicit action, with the OS
  state re-read on foreground.
- **"Recent deliveries"** card on Alerts, hidden while the snapshot has none.

## Expo facts (SDK 57)

- `getExpoPushTokenAsync({ projectId })` needs the EAS project ID (`extra.eas.projectId`, written by
  `eas init`). It calls Expo's servers, so it needs try/catch and a retry.
- **iOS:** remote push still works in Expo Go, so it can be tested now with a free Expo account.
  **Android:** push was removed from Expo Go in SDK 53, so Android needs a development build.
- Release builds need push credentials: an APNs key (paid Apple Developer account) and FCM V1 (free
  Firebase project), both stored in EAS.
- Sending: `POST https://exp.host/--/api/v2/push/send`, up to 100 messages per request, 600 per second
  per project. Receipts (`/getReceipts`, up to 1,000 ids) should be checked about 15 minutes later.
  `DeviceNotRegistered` means stop sending to that token. Optional "enhanced push security" adds an
  access token header.
- Taps: `addNotificationResponseReceivedListener` / `useLastNotificationResponse`.

## Decisions (agreed 2026-10-05)

1. **Anonymous devices.** The app registers its push token with its rules, quiet hours, time zone and
   wording level. No sign-in. Turning push off, or uninstalling, removes the device.
2. **Exploited-flaw rule:** no source gives CVSS, so the rule becomes "a flaw is added to CISA's
   exploited list and is likely to be used": EPSS 0.5 or higher, or marked as used by ransomware. A
   few a week.
3. **Quiet hours** hold alerts and deliver them as one summary when quiet hours end. Severe crossings
   (85+) still come through.
4. **Morning summary by push** is included in this milestone (the onboarding "morning" extra), since
   it's the same machinery. Weekly summaries and email stay in milestone 3.
5. **A cap of 6 pushes per device per day**; past that, alerts are bundled into one.

## Architecture

```
app ──register_device(token, rules, quiet hours, tz, wording)──► devices (+ rules as JSON)
compute_scores (:15) ─► render-snapshot (:20) ─► send-alerts (:25) ─► Expo push API ─► phones
                                                    │ deliveries (tickets)
check-receipts (every 30 min) ◄──────────────────────┘ disables DeviceNotRegistered tokens
app ──get_deliveries(token)──► "Recent deliveries" on Alerts
```

**Tables** (RLS on; only the RPCs below are reachable with the publishable key):
- `devices`: token (unique), platform, time zone, wording, quiet hours, rules (JSON), created,
  last seen, disabled.
- `alert_state`: per device and rule, what last fired (so a threshold fires on crossing, not every hour).
- `deliveries`: per device, when, which rule, title and body, Expo ticket and receipt status. Kept 30
  days.

**RPCs** (anon-callable, security definer, validated: known kinds and ids, sizes capped):
`register_device`, `unregister_device`, `get_deliveries`. The push token acts as the device's key;
it's only ever on that device and our database.

**send-alerts** (edge function, hourly at :25, after render):
- Scores change once a day (complete UTC days), so threshold, band and jump rules are checked against
  the latest complete day versus the day before. They fire on a crossing, at most once per day each.
- Exploited-flaw rules check KEV events since the last run.
- Morning summary at 07:00 in the device's time zone (hourly runs, so 07:00–07:59).
- Quiet hours and the daily cap are applied, then messages are worded (Technical or Plain, matching
  the app) and sent in batches of 100. Each carries a deep link (event, sector or Now).
- **check-receipts** (every 30 minutes): reads receipts, marks deliveries, and disables tokens that
  report `DeviceNotRegistered`.

## App changes

- After push permission is granted: get the Expo push token, then register. Re-sync (debounced)
  whenever rules, quiet hours, wording or sectors change, and on launch. Unregister when push is turned
  off in the app.
- Handle taps: open the event, the sector or region on Breakdown, or Now.
- "Recent deliveries" reads this device's deliveries from `get_deliveries`.
- Exploited-flaw rule wording and its filter (decision 2), in New rule and onboarding.
- Android notification channel, ready for the development build.

## Setup (you)

- **Now:** a free Expo account; `npx eas-cli@latest login` and `npx eas-cli@latest init` (adds the
  project ID to `app.json`). Optionally an Expo access token for enhanced push security, stored as a
  Supabase function secret.
- **Later, for Android and releases:** an EAS development build; APNs key (Apple Developer, $99/year)
  and FCM V1 credentials uploaded to EAS.

## Privacy

Push tokens and alert rules are stored server-side, tied to no account or name. Deleted on
unregister; devices not seen for 90 days are removed. The privacy policy and store data disclosures
must mention this before release.

## Order of work

1. **Setup (you):** Expo account, `eas init`.
2. **Backend tables and RPCs**, with tests that the publishable key can only use the three RPCs.
   *Check:* register and unregister a test device from the CLI.
3. **App registration:** token, register, sync, unregister. *Check:* your phone appears in `devices`
   with its rules.
4. **send-alerts and check-receipts**, plus a test rule that fires. *Check:* a push arrives on your
   phone in Expo Go, and its receipt is recorded.
5. **Rule semantics** (crossings, jumps, band changes, KEV, morning summary, quiet hours, daily cap),
   each with Deno tests. *Check:* a week of real alerts on prod looks sensible.
6. **Taps and Recent deliveries.** *Check:* tapping each kind of alert opens the right screen.
7. **Android and release** (with EAS builds, when you're ready to ship).

## Risks

- **Noise.** Too many pushes and people turn them off. Crossings, the daily cap and quiet hours are
  the guard; tune with real data in step 5.
- **Expo Go on iOS only** until a development build exists; Android can't be tested before step 7.
- **Token abuse.** Anyone with the publishable key can register junk tokens. Expo rejects invalid
  tokens, and receipts disable them; registrations can be rate-limited if it happens.
