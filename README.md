# ThreatDoppler

Global cyber threat levels reported like a weather forecast: one index from 0 to 100 in five bands, with breakdowns by threat type, sector and region, a 7-day forecast, a live event feed, a year of history and alert rules.

React Native app built with Expo (SDK 57) and Expo Router. iOS-first; Android and web also build.

## Running it

```bash
npm install
npm start          # Expo dev server (press i for the iOS simulator)
npm run ios        # same, opening iOS directly
npm run web        # browser preview, handy for layout checks
```

If Expo Go is missing a native module the app needs, make a development build with `npx expo run:ios` or `eas build --profile development`.

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Layout

```
src/
  app/                  Routes (Expo Router). Every file here is a screen.
    index.tsx           00 Splash
    onboarding/         01 role, 02 scope, 02a alerts, 02b notifications
    (tabs)/             Now (with 09 breakdown, 10 history), Forecast, Feed, Alerts
    settings/           11 Settings and its sub-pages
    threat/[id].tsx     08 Threat detail (modal sheet)
    new-rule.tsx        12 New rule (modal sheet)
  components/           Shared UI: text, radar mark, cards, tiles, controls, charts, tab bar, states
  copy/wording.ts       Plain / Standard / Technical copy lookup
  data/                 Types, catalog names, sample data, snapshot provider (fetch, cache, offline)
  lib/                  Alert logic, chart paths, formatting, notifications, haptics, accessibility hooks
  state/store.ts        Persisted user preferences and alert rules (zustand + AsyncStorage)
  theme/                Design tokens and the Increase Contrast palette
```

## How it maps to the design handoff

- All nineteen screens and the four states (13a loading, 13b offline, 13c notifications off, 13d empty) are implemented, plus the icon set generated from the radar mark.
- Wording levels change copy only, never layout or data. Standard uses Technical labels with Plain event text, as the README suggests. Plain strings that the handoff's wording map doesn't cover are suggestions in `src/copy/wording.ts` and need design sign-off.
- Notification permission is only requested from the 02b button, the Alerts banner or the Settings switch, never on launch.
- Reduce Motion stops every loop and movement; Increase Contrast swaps in the high-contrast palette; tables and grids collapse at accessibility text sizes; every screen scrolls when text is larger than the default.

## Sample data and stubs

There is no backend yet. `src/data/api.ts` returns the handoff's sample data after a short delay, and the snapshot is cached so the offline state has something to show. Until the service exists:

- Email and Slack "setup" connects a sample destination.
- Only two events have full threat reports; the others get a summary built from the event.
- History ranges other than 1Y and 30D use generated series.

## Design handoff

`design_handoff_threatdoppler/` holds the HTML design reference. Per `design_note.md`, remove it from the repo and its history once it is no longer needed.
