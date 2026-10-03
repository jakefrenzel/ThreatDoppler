# Handoff: ThreatDoppler (iOS app, v1)

## Overview
ThreatDoppler is a mobile app that reports global cyber threat levels in the style of a weather forecast. It produces one **index from 0 to 100**, split into five bands (Low → Severe), with breakdowns by threat type, sector and region. It also has a 7-day forecast, a live event feed, a year of history and alert rules.

The app is for SOC analysts, CISOs, executives, students and the general public. Every user sees the same layout and the same data. In onboarding, each user picks a **wording level** (Plain, Standard or Technical), and that choice only changes the labels and short descriptions.

## About the design files
The files in this bundle are **design references created in HTML**. They show how the app should look and behave, but they are not production code to copy. The task is to **recreate these designs in the target codebase** (SwiftUI, React Native, etc.) using its existing patterns. If there is no codebase yet, choose a suitable framework; native SwiftUI is the natural fit for an iOS-first app.

Open `ThreatDoppler Final.dc.html` in a browser to see all nineteen screens and the app icon. It needs `support.js` and `ios-frame.jsx` in the same folder. `ios-frame.jsx` only draws the iPhone bezel and status bar for presentation, so don't port it.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and copy are final. Recreate them exactly. All data is fictional sample data.

## Screens
Every screen is 402 × 874 pt (iPhone 16 Pro class) and fits without scrolling. Content starts at y = 54 (below the status bar). Unless noted otherwise, screens are a vertical flex column with **10 pt gap** and **14 pt horizontal margin** on cards. Headers have 20 pt horizontal padding.

| # | Screen | Source in HTML |
|---|---|---|
| 00 | Splash | `#s00` |
| — | App icon and wordmark | `#icon` |
| 01 | Onboarding · Role and wording | `#s01` |
| 02 | Onboarding · Scope (sectors, regions) | `#s02` |
| 02a | Onboarding · Alert defaults | `#s02a` |
| 02b | Onboarding · Notifications | `#s02b` |
| 03 | Now (home) · Technical wording | `#s03` |
| 04 | Now (home) · Plain wording | `#s04` |
| 05 | Forecast | `#s05` |
| 06 | Feed | `#s06` |
| 07 | Alerts | `#s07` |
| 08 | Threat detail (modal sheet) | `#s08` |
| 09 | Sectors breakdown | `#s09` |
| 10 | History | `#s10` |
| 11 | Settings | `#s11` |
| 12 | New rule (sheet) | `#s12` |
| 13a | Now · Loading | `#s13a` |
| 13b | Feed · Offline | `#s13b` |
| 13c | Alerts · Notifications off | `#s13c` |
| 13d | Feed · Empty | `#s13d` |

### Shared components
- **Screen background ("sky"):** `radial-gradient(130% 50% at 50% -8%, rgba(255,107,53,.26), transparent 62%)` over `#110E0D`.
- **Header:** a mono eyebrow (JetBrains Mono 11 / 400, letter-spacing .04em, `--mute`) above a title (Space Grotesk 22 / 600, letter-spacing −.02em). Right side has a pill (padding 8 × 14, radius 20, bg `--card2`, 13 / 500), for example a "Global ▾" scope picker. Detail screens use a 36 pt circular back button instead (bg `--card2`, chevron 18 pt, stroke 2.5).
- **Metric tile:** padding 8–9 × 10–12, radius 16–18, bg `--card`, 1 pt border `--line`. The label is mono 9–10 pt `--mute`, uppercase. The value is 16–26 pt / 600; numeric deltas use mono. **Highlighted tile:** bg `--emberSoft`, border `rgba(255,107,53,.4)`, label in `--ember`.
- **Card:** radius 24, bg `--card`, border `--line`, padding 10–12 × 14. Card header row: mono 10 pt, letter-spacing .05em, `--mute`, with the label on the left and context on the right (`justify-content: space-between`).
- **Table rows:** CSS grid with fixed column widths (see each screen in the HTML). Rows have 6–9 pt vertical padding, and every row except the first has a 1 pt `--line` top border.
- **Score bar:** 4 pt tall, radius 2, track `rgba(255,244,235,.08)`, filled to score% in the band colour.
- **Tab bar (floating pill):** absolute position, 16 pt from left and right, 30 pt from the bottom; height 64, padding 6, radius 32. bg `rgba(36,29,26,.8)` + `backdrop-filter: blur(20px)`, border `--line`, shadow `0 14px 34px rgba(0,0,0,.5)`. Four equal tabs: **Now · Forecast · Feed · Alerts**. Each tab is a 20 pt stroke icon (Lucide-style, stroke 2) above an 11 pt label. Active tab: bg `--emberSoft`, radius 26, colour `--ember`, weight 600. Inactive: `--mute`, weight 500.
- **Primary button:** height 56, radius 28, bg `--ember`, text `#1A0E09` 17 / 600, with a 38 pt circular arrow well (`rgba(26,14,9,.15)`) on the right.
- **Selectable row (onboarding):** height 44, radius 14, padding 0 12. A radio is an 18 pt circle. Off: bg `--card`, border `--line`, radio 1.5 pt `--dim` border. On: bg `--emberSoft`, border `rgba(255,107,53,.45)`, radio filled `--ember` with a 12 pt check in `#1A0E09`.
- **Segmented control:** container padding 4, radius 21, bg `--card`, border `--line`; segments 34 pt high, radius 17, 13 pt. Selected segment: bg `--ink`, text `--bg`, weight 600.
- **Toggle:** 42 × 26, radius 13, padding 3, 20 pt white knob with shadow `0 2px 6px rgba(0,0,0,.3)`. On: `--ember`. Off: `rgba(255,244,235,.16)`.

### Brand · app icon, wordmark, splash
- **Name:** ThreatDoppler, written as one word. The wordmark is Space Grotesk at −.03em, with "Threat" 400 in `--mute` and "Doppler" 600 in `--ink` and no space between them.
- **Home-screen name:** "ThreatDoppler" (CFBundleDisplayName). It is 13 characters; check it on the smallest supported device and make sure it is not cut off under the icon.
- **Mark** (100 × 100 grid, radar scope): a ring at r33 with a 7 pt `--ember` stroke, and an arm from the centre (50,50) to (72,28), 45° clockwise from 12 o'clock, also 7 pt `--ember` with a round cap. Behind the arm sits a sweep trail: a disc filling the inside of the ring (inset 18%) with `conic-gradient(from 45deg, transparent 0deg 250deg, rgba(255,107,53,.6) 360deg)`, so it is brightest at the arm and fades out counter-clockwise. No blips.
- **Sizes:** use the same mark at every size, including notification icons.
- **App icon:** a flat `#110e0d` background, with the mark filling 80% of the icon. Export the iOS icon set from a 1024 master; iOS applies the corner mask. When exporting to PNG, render the conic trail as a raster.
- **00 Splash:** a flat `#110e0d` background. Mark 140 pt, 20 pt gap, wordmark 32 pt. Tagline "SCANNING TODAY'S THREATS" in mono 11, .08em, `--mute`, 56 pt from the bottom. Show it until the first index loads, then go to 01 (first launch) or Now. Optional motion: rotate the arm and trail together clockwise, one turn per 2 s, while loading.

### 01 Onboarding · Role and wording
- Background `radial-gradient(90% 40% at 85% 8%, rgba(255,107,53,.32), transparent 70%)` over `#110E0D`.
- Progress indicator for 4 steps: the active step is a 22 × 6 bar in `--ember`, the rest are 6 × 6 dots in `--dim`. "Skip" is on the right (14 / 500, `--mute`).
- Eyebrow: "STEP 1 OF 4 · ABOUT YOU" (mono 11, .08em, `--ember`). H1: "Who are you?" (30 / 600, line-height 1.08, −.03em). Body: "Pick your role and how you want things worded. The data and screens are the same for everyone." (14, line-height 1.45, `--mute`).
- **ROLE · PICK ONE:** a 2-column grid of selectable rows (6 pt gap): SOC analyst, Student, Executive, IT / developer, Small business, Just curious. Single select.
- **WORDING · CHANGE ANY TIME:** a segmented control with Plain / Standard / Technical. The role choice must not preselect or suggest a wording level; the user chooses it.
- Preview card: a two-column table headed TECHNICAL | PLAIN that shows how terms change (see the wording map below).
- Continue button pinned to the bottom, with 44 pt bottom padding.

### 02 Onboarding · Scope
- Same chrome as 01. "STEP 2 OF 4 · SCOPE", H1 "Set your scope", body copy is as shown in the HTML.
- SECTORS (3 OF 10 · TODAY): a 2-column grid of 10 selectable rows, each showing today's sector score in mono 11 on the right. Multi select.
- REGIONS (2 OF 5): wrapping pills, 34 pt high, radius 17, padding 0 14. Selected: bg `--ember`, text `#1A0E09`.
- Bottom card: "Your index today" with **76** (22 / 600) and "HIGH · +4 VS GLOBAL" (mono 11, `--ember`). Below it, the Continue button.

### 02a Onboarding · Alert defaults
- Same chrome as 01, three progress bars filled. "STEP 3 OF 4 · ALERTS", H1 "When should we tell you?".
- Shown in Plain wording, since that was picked in 01. All labels follow the wording map.
- ALERT ME WHEN THE INDEX IS · PICK ONE: three full-width selectable rows, single select. Each has an 8 pt band dot and a mono 11 hint on the right: Severe only (85+ · ~1 a month), High or worse (75+ · ~4 a month, default), Any level change (~12 a month). The choice sets the global threshold on 07.
- ALSO TELL ME ABOUT: a card of toggle rows (same pattern as 07). Sub-lines are mono 9 and reflect step 2 picks. Jumps in your sectors (on), Flaws attackers are using now (on), Morning summary 07:00 (off), Quiet hours 22:00–06:30, Severe still comes through (on).
- Bottom card "Expected alerts" shows a live monthly estimate from the current choices. Continue below.

### 02b Onboarding · Notifications
- Same chrome, all four bars filled. "STEP 4 OF 4 · NOTIFICATIONS", H1 "Allow notifications?".
- PREVIEW: two lock-screen style notifications (radius 22, bg `--card2`, 38 pt app icon radius 10). Copy is generated from the user's wording level and scope.
- YOU'LL GET: a summary of the rules from 02a with monthly counts, plus the quiet-hours line.
- Primary button "Allow notifications" triggers the iOS permission prompt, then goes to Now. "Not now" (44 pt, `--mute`) goes to Now with push off; rules are kept and can be enabled from 07.
- Only request OS permission from this button, never on launch.

### 03 / 04 Now (home)
Top to bottom:
1. Header.
2. A 4-tile row (grid 1.4fr 1fr 1fr 1fr, 6 gap): INDEX **72.4** (26 / 600, highlighted), Δ24H +6.1, Δ7D +11.3, 90% CI ±4.2.
3. 30-day trend card: an area chart 344 × 90 drawn with an Ember line (2 pt) and a gradient fill (Ember .45 → 0). It has dashed reference lines at 70 and 50, axis labels in mono 9, and an end dot (r 4, `--ink`).
4. Threat-type table with columns `1fr 34px 70px 44px`: VECTOR, WT, SCORE (number + bar), Δ24H. Six rows: Ransomware, Exploitation, Supply chain, Phishing, DDoS, Insider / other.
5. Five region tiles (N. AM, APAC, EUROPE, MEA, LATAM), each with a band dot and score (17 / 600).
6. Two latest events (time · text · impact).
7. Tab bar (Now active).

04 is the same screen with Plain labels.

### 05 Forecast
Header "Forecast" with eyebrow "GLOBAL · 7 DAYS · MODEL 3.2". Below it:
- Summary tiles: PEAK · MON 81 (highlighted), LOW · THU 68, MEAN 74.1, and one more as shown in the HTML.
- Range table: DAY, LO, a 90% range bar (gradient segment plus a 12 pt point marker in `--ink` with a 2 pt `--bg` ring), HI, point value, Δ.
- "Vector outlook" heatmap: 5 threat types × 7 days. Cells are 24 pt high, radius 7, coloured by band, with values in mono 10 / 600.

### 06 Feed
- Header "Live feed" with a "Live · 6 new" pill (`--emberSoft`, with a pulsing dot).
- 24h mix card: a stacked 10 pt bar and a legend.
- Filter chips (All selected = `--ink` bg).
- Event list rows: time | type (coloured dot + mono 9 label), title (13 / 500, single line with ellipsis), source meta (mono 9, `--dim`) | impact (mono 12 / 600).

### 07 Alerts
- Header with a "+ New rule" button in `--ember`.
- Global threshold card: value 75 (34 / 600) and "High". It has a heat-gradient slider track (8 pt) with a 24 pt knob, plus a marker at the current value (72).
- Rule list with toggles.
- Channel tiles: Push, Email, Slack.
- Recent deliveries list, with quiet hours in the card header.

### 08 Threat detail (sheet)
- A modal sheet with a 34 pt top radius on `#070605`. The sheet background is `#171311` with an ember radial glow. It has a grab handle (40 × 5) and a close button (34 pt).
- Tag chips. Title 24 / 600.
- 3 × 2 stat tiles: Index impact, Scanning IPs, Exposed, Patched, Confirmed victims, EPSS.
- 12h-bin bar chart (14 bars, coloured by band), "Targeted" sector chips, an IOC list with copy icons, and an Actions checklist.

### 09 Sectors breakdown
- Back button, title "Breakdown", and a Sectors/Regions segmented control.
- Three summary tiles: Hottest, Your average, Cooling.
- Table with columns `1fr 56px 28px 30px 30px`: sector name + top vector (mono 9), 7-day sparkline (56 × 18), NOW, 24H, 7D. Sectors the user follows show a 6 pt Ember dot.

### 10 History
- Back button, title, and a 30D / 90D / 1Y / 5Y segmented control (1Y selected).
- 52-week chart (346 × 150): a band-gradient line, a dashed 4-week moving average, reference lines at 85/70/50, a callout pill on the peak ("88 · 14 MAR"), and month labels.
- Stat tiles: Average, Median, Std dev, Percentile (highlighted), High, Low, and more as shown in the HTML.
- Time-in-band stacked bar, plus the top 3 peaks list.

## Wording levels
Wording levels change **copy only**. Layout and data stay the same. Keep the strings in a lookup keyed by level.

| Technical | Plain |
|---|---|
| MODEL 3.2 · 09:40 UTC | FRI 02 OCT · UPDATED 09:40 |
| INDEX | LEVEL · HIGH |
| Δ24H | 1 DAY |
| Δ7D | 1 WEEK |
| 90% CI | ± RANGE |
| 30-DAY TREND / MIN · MAX · σ | LAST 30 DAYS / LOWEST · HIGHEST |
| VECTOR / WT / SCORE | THREAT TYPE / SHARE / LEVEL |
| IOC | Attack clue |
| EPSS 0.94 | Very likely to be used |
| "14 new leak-site victims, 6 healthcare" | "14 more organisations hit by ransomware, 6 hospitals" |
| "Edge VPN scanning up 38% in 6h" | "Attacks on office VPNs up 38% this morning" |

**Standard** is not mocked. Suggested behaviour: Technical labels, with event text written in Plain. Confirm this with design.

### 11 Settings
- Opened from a 36 pt round button with a sliders icon, to the right of the "Global" picker on Now (03/04). It is a push, and the tab bar is hidden.
- Back button (36 pt circle) with an eyebrow showing the current role and wording, and an H1 "Settings" at 22 / 600.
- Groups (mono 10 labels, cards with radius 20 and 44 pt rows, chevrons in `--dim`):
  - **Profile:** Role (opens the role list from 01), and Wording as an inline segmented control that applies immediately.
  - **Scope:** Sectors and Regions (open the pickers from 02), plus a "Show my index" toggle.
  - **Notifications:** a Push toggle that mirrors iOS permission (see 13c), Alert rules (opens 07) and Quiet hours.
  - **About:** How the index works, Data sources and method, and Redo setup (reruns 01 to 02b with the current values).
- Footer showing the app and model version in mono 10, `--dim`.

### 12 New rule (sheet)
- Opened from "New rule" on 07. Same sheet chrome as 08. Header: Cancel, "New rule", and an ember Save pill.
- ALERT ME ABOUT: a segmented control with Index / Sector / Region / Attack type. The fields below change with the type.
- Target picker (sectors, regions or attack types) as multi-select pills. It is hidden for Index.
- WHEN IT: Goes above / Jumps in 1 day.
- Value card: a threshold slider on the heat bar (same as 07), a marker for today's value, the band name in its band colour, and a back-test line: "Would have alerted you N times in the last 30 days".
- SEND TO: Push / Email / Slack tiles with a check state. Channels that aren't connected are shown off, and tapping one starts setup.
- Save adds the rule to the top of the list on 07. Save is disabled until a target and at least one channel are set.

### 13 States
- **13a Loading:** skeletons that match the layout of each card (radius, height), drawn in `rgba(255,244,235,.08)`. The eyebrow reads "UPDATING…". Use the same approach on every tab. Show cached data instead whenever it exists.
- **13b Offline:** keep the cached content at 55% opacity. Below the header, show a banner with an icon, "You're offline", the time of the saved data and a Retry pill. The Live pill becomes a grey "Offline".
- **13c Notifications off:** shown on Alerts when iOS permission is denied or wasn't granted (for example after "Not now" in 02b). An ember-soft banner reads "Turn on", which opens iOS Settings for the app. The Push tile shows Off / Blocked in iOS.
- **13d Empty:** when a filter returns no events, a centred card shows the 64 pt radar mark, a one-line title, a short explanation and a way out ("Show all sectors"). Use the same pattern on any list.

## Interactions and navigation
- Launch shows 00, then onboarding on first run or Now after that. Onboarding goes 01 → 02 → 02a → 02b → Now. Skip goes straight to Now with default settings.
- Tab bar: Now, Forecast, Feed, Alerts.
- Now: tapping the threat-type table or a region tile opens 09; tapping the 30-day trend opens 10; tapping an event opens 08.
- Feed: tapping an event opens 08 as a sheet (swipe down or ✕ to close).
- Now: the sliders button opens 11 Settings. Alerts: "New rule" opens 12 as a sheet.
- Settings (11) lets the user change role, wording level, sectors, regions and notifications after onboarding.
- Motion: see the Motion section.

## Motion
Keep motion short and functional. Honour **Reduce Motion**: when it is on, swap every movement below for a 150 ms cross-fade and stop all loops.

| Element | Motion | Timing |
|---|---|---|
| Screen push (09, 10, 11) | iOS default push | system |
| Sheets (08, 12) | iOS default sheet, with a drag-to-dismiss grabber | system |
| 00 Splash | the radar arm and trail rotate together clockwise; hand off to the first screen with a 200 ms fade | 2 s per turn, linear, loop until data is ready |
| Index dial on Now | the arc fills from 0 to the value and the number counts up, once per launch or refresh | 700 ms, ease-out (cubic-bezier(.2,.8,.2,1)) |
| Score bars, heat bar thumb | grow or slide to the value on first appear | 400 ms ease-out, 30 ms stagger per row |
| Live dot (06) | the ring pulses: scale 1 → 1.8, opacity .25 → 0 | 1.6 s ease-out loop |
| New feed events | slide down 8 pt and fade in at the top of the list; the "6 new" count ticks | 250 ms ease-out |
| Wording change (01, 11) | cross-fade the changed strings only; the layout does not move | 180 ms |
| Selectable rows, pills, segments, toggles | background and border colour transition; toggle knob slides | 150 ms ease-out |
| Primary button press | scale to .97 with a light haptic | 100 ms |
| 13a Skeletons | a shimmer sweeps left to right at 6% white | 1.4 s linear loop |
| 13b/13c Banners | slide down from under the header | 250 ms ease-out |
| Pull to refresh (Now, Feed) | the radar mark spins in place of the system spinner | same as splash |

Haptics: light on primary actions and toggles, success when a rule is saved, warning when the index crosses into a new band while the app is open.

## Accessibility
**Text size (Dynamic Type)**
- Screens are dense and fit without scrolling at the default size. That rule only holds at the default size: from xLarge upward, every screen must be allowed to scroll.
- Scale body, row labels and buttons with Dynamic Type. Mono data labels (9–11 pt) scale too, with a minimum of 11 pt at accessibility sizes.
- At AX1 and above, 2-column grids (01 roles, 02 sectors) become 1 column, 4-tile rows on Now become 2 × 2, and tables (05, 09) drop secondary columns. Keep the score and band columns.
- Never truncate the index value, band name or alert text. Truncation is only allowed for event titles in lists, and the full title must be on the detail screen.

**VoiceOver**
- Index dial: read as one element, for example "Global cyber index 72, High, up 4 in 1 day". Use the current wording level for the spoken label too.
- Charts (30-day trend, history, forecast): read as one element with a summary ("30-day trend, from 64 to 72, peak 81 on 14 September"), and offer an audio graph (`AXChartDescriptor`) for detail.
- Heat-map cells and score bars: read as "Ransomware, Monday, 84, High".
- Toggles, segments and selectable rows use the native traits (switch, button, selected). The radio and check shapes are decorative.
- Settings button on Now: label "Settings". Radar mark and decorative SVGs are hidden.
- Banners in 13b/13c are announced when they appear.

**Colour and contrast**
- Never use colour alone for a band: always show the band name or the number next to the colour (already the case in the designs; keep it).
- Checked on `#110E0D`: `--ink` 17:1, `--mute` about 7.4:1, `--ember` about 6.8:1, `#1A0E09` on Ember about 6.6:1. All pass.
- `--dim` (#6F6660) is about 3.4:1, which fails for body text. Use it only for decorative chevrons, separators and very low-priority footers. Mono meta lines that carry information should use `--mute`.
- `--b5` text on dark is about 4.6:1 (passes, just). In heat-map cells, use `#1A0E09` text on every band including Severe; white on `#E8364A` fails at small sizes.
- Support Increase Contrast: raise `--line` to .2 alpha, `--card` to .09, and swap `--dim` text for `--mute`.

**Touch targets**
- The minimum is 44 × 44 pt. Header buttons are drawn at 36 pt, so extend their hit area to 44. Pills (34 pt) and segments (28–34 pt) also need hit areas padded to 44 pt high.

## State
- `role`: one of 6 values. `wordingLevel`: plain, standard or technical. `sectors[]`, `regions[]`.
- `alertRules[]` (label, type, channels, enabled), `globalThreshold` (number), channel connections, quiet hours.
- Data from the backend:
  - **index:** value, band, Δ24h, Δ7d, CI.
  - **vectors[]:** name, weight, score, Δ24h.
  - **regions[]**.
  - **sectors[]:** score, Δ24h, Δ7d, 7-day series, top vector.
  - **forecast[7]:** lo, hi, point, Δ.
  - **vectorForecast[5][7]**.
  - **events[]:** time, type, title, source, impact.
  - **history:** weekly series, stats, time in band, peaks.
  - **threat detail:** tags, stats, 12h bins, targeted sectors, IOCs, actions.

## Design tokens
**Colour**
- `--bg` #110E0D · page #0A0807 · sheet #171311 / backdrop #070605
- `--card` rgba(255,244,235,.055) · `--card2` rgba(255,244,235,.10) · `--line` rgba(255,244,235,.10)
- `--ink` #F6EFE8 · `--mute` #A99F97 · `--dim` #6F6660
- `--ember` #FF6B35 · `--emberSoft` rgba(255,107,53,.16) · ink-on-ember #1A0E09
- Tab bar: rgba(36,29,26,.8)

**Bands** (thresholds used throughout)
- Low 0–24: #7F9C86
- Guarded 25–49: #CDB97E
- Elevated 50–69: #F2A65A
- High 70–84: #FF6B35
- Severe 85–100: #E8364A

Heat gradient: `linear-gradient(90deg,#7F9C86 0%,#CDB97E 25%,#F2A65A 50%,#FF6B35 70%,#E8364A 88%)`.

**Type**
- Space Grotesk 400/500/600 for UI and numbers.
- JetBrains Mono 400/500/600 for labels, timestamps, deltas and IOCs.
- Scale: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 22, 24, 26, 30, 34.
- Mono labels are uppercase with letter-spacing .04–.08em.

**Radius:** 7 (heat cells) · 12–14 (chips, rows) · 16–18 (tiles) · 24 (cards) · 28–32 (buttons, tab bar) · 34 (sheet).

**Spacing:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20.

**Shadow:** tab bar `0 14px 34px rgba(0,0,0,.5)` · slider knob `0 0 0 4px rgba(255,107,53,.35), 0 4px 12px rgba(0,0,0,.5)`.

## Assets
- No images. The app icon and radar mark are built from vector shapes plus a CSS conic gradient (see Brand). For the iOS app icon set, export a 1024 PNG master.
- Icons are inline SVG in the Lucide style (24 grid, stroke 2, round caps and joins): activity, calendar, rss, bell, chevron, x, check, copy, plus, arrow-right. Use Lucide or SF Symbols equivalents.
- Fonts come from Google Fonts.

## Files
- `ThreatDoppler Final.dc.html`: all nineteen final screens and the app icon. Static markup is in the body, and sample data and chart path generation are in the script at the bottom (`renderVals`).
- `ios-frame.jsx`: the presentation-only iPhone bezel.
- `support.js`: the runtime needed to open the HTML file.
