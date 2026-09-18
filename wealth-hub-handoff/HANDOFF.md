# Wealth Hub: design handoff

This folder is everything needed to rebuild Wealth Hub in its new identity. The design source of truth is the brand file on claude.ai; this is its buildable extract.

**Read this whole file before writing code.** Then start with Phase 0, which changes nothing.

## What Wealth Hub is

A personal finance app for one household. It connects banks, brokers, pensions and hardware wallets read-only, adds property and debts by hand, and shows one ledger in one currency (CHF). On top of that it ranks things worth improving ("Grow"), each with its evidence, assumptions and risks. It never moves money and never asks for a seed phrase. It is educational analysis, not financial advice, and the copy must never say otherwise.

The existing app is a working web dashboard with hand-written chart math and no charting library. **Keep that approach.** Do not add a chart library. `reference/code/charts.js` is a dependency-free kit in the same spirit.

Targets: the web app first, then native SwiftUI apps for iOS and macOS.

## The identity in one paragraph

Classical antiquity on a clean modern layout. Marble ground, white cards with generous corners, one blue (ultramarine), gold used once per screen, Instrument Serif for titles and DM Sans for everything that is read or counted. Pictures are classical scenes drawn as a blue dot screen. The logo is an engraved temple. Rounded icons on everything that can be tapped, named or counted.

## Hard rules

1. **One blue, one gold.** Ultramarine is the action and the chart line. Gold marks only the figure that matters on a screen (a saving, today's point on the chart). Never two gold things competing.
2. **Green and red carry meaning only.** Green is gain or healthy. Red is owed, cost, loss, risk or broken. Always paired with an arrow or icon, never colour alone. Neither is ever decorative.
3. **Serif speaks, sans counts.** Instrument Serif: screen titles, the wordmark, big statements. Never bold, never all caps. DM Sans: everything else. Every figure uses `font-variant-numeric: tabular-nums`, weight 600, tracking -0.04em at display sizes.
4. **Cards are for things you can act on. Rows are for things you read down.** Account, opportunity: card. Label and value: hairline row.
5. **Every row starts with a token** (see Tokens below) and every button, field, status and line of evidence carries an icon.
6. **Every suggestion states its reason starting with "Because", and its risks in the same size type as its upside.**
7. **No exclamation marks, no urgency, no streaks, no confetti.** Plain, exact, unexcited.
8. **Figures never decorate.** No placeholder charts, no rounded-up totals in the real app.
9. **Nothing chooses light or dark by hand.** Surfaces declare their ground; everything inside follows (tokens, charts, logo).

## Tokens

`tokens/tokens.css` (web), `tokens/tokens.json` (neutral), `tokens/Tokens.swift` (SwiftUI). Light is the default. A dark surface sets `data-ground="dark"` once and every token flips, including the two logo switches `--wh-l` and `--wh-d`. System dark mode should set `data-ground="dark"` on the root.

Radii step with size: 999 for controls, 28 for cards, 16 for fields, 14 for list items, 32% for token tiles. Touch targets never under 44 px. Shadows only in light mode; dark mode uses a 1 px ring.

## The logo

`assets/logo/` holds eight SVGs: four weights by size, each in a light and a dark cut.

| file | lines | use when the mark is |
|---|---|---|
| `wh-l3-l-*` | 62 | 260 px wide and up |
| `wh-l3-m-*` | 46 | 110 to 259 px |
| `wh-l3-s-*` | 24 | 48 to 109 px |
| `wh-l3-xs-*` | 15 | under 48 px |

- Aspect is fixed: height = width x 0.8.
- **The dark cut is not a recolour.** On light grounds the engraved lines are the shadows (ultramarine). On dark grounds the lines are the light (marble), so the temple is lit from the same side in both. The roof is gold in both.
- **Build one `Mark` component with a single `width` prop and no variant prop.** It picks the weight from its width and the cut from the ground. On web: render both `<img>`s and let `display: var(--wh-l)` / `var(--wh-d)` choose. In SwiftUI: see `MarkView` in `Tokens.swift`.
- No tile, outline or container behind it. It sits directly on the ground.
- **Beside the wordmark, the mark's height equals the wordmark's font size.** Alone in a header row, it matches the height of the control beside it (34 px next to the status pill on iPhone).
- Wordmark: "Wealth Hub" in Instrument Serif, sentence case.

### The living mark (hover)

`reference/code/living-mark.js` engraves the temple live from `temple-lightmap.txt`, so the line direction can turn. Default effect is **pivot**: on hover every line swings together from horizontal to vertical and back on leave. Other effects are in the module (`dots`, `bloom`, `follow`). Tap toggles on touch, Enter toggles on keyboard, reduced motion snaps without animating. Use it only where the mark is at least 64 px: launch screen, sign-in, website header, Mac sidebar. Everywhere else use the static SVGs.

## Icons and tokens

Icons: **Material Symbols Rounded**, weight 400, outlined at rest, filled when active or inside a token. 24 px grid, never under 16 px, colour inherits from text. The full map (navigation, asset classes, accounts and debts, activity, Grow, evidence lines, status, actions) is in `reference/screens/Icons.html`.

A **token** is the rounded tile that starts every row. Three kinds, in fallback order:
1. **Logo token**: the real logo in its brand colour, on a tile filled with that colour at 13% with a 30% ring, plus a small class badge on the corner. Logos load at run time by ticker, ISIN or domain. For the design, Simple Icons (CC0) covered Apple, Bitcoin, Ethereum, Revolut, Netflix, Spotify, YouTube, iCloud, Claude, Notion. Banks and fund houses are not in any open set: wire a logo service (Brandfetch, Logo.dev or the broker feed) behind an interface.
2. **Monogram token**: same tile, initials in the brand colour. Used for UBS, IBKR, Ledger, Vanguard, iShares, Pillar 3a, Swisscom until a logo resolves.
3. **Class token**: tinted tile with a filled icon, for things with no brand (flat, pension, mortgage, car loan).

The layout must not shift between the three. See `reference/screens/Tokens.html`.

## Charts

Two registers. **Big charts are smooth and rounded. Mini charts are pixel.** Code for all six is in `reference/code/charts.js`, styles in `charts.css`.

| chart | form | where |
|---|---|---|
| `areaChart` | smooth rounded ultramarine line, dot-screen fill that thins downward, breathing gold point on today, glow on hover | net worth on every overview |
| `cashflow` | rounded paired bars (green in, red out), ultramarine position line, forecast at lower strength on a marble band | Cash flow |
| `sparkline` | stepped pixels, red only if it ends lower | holdings rows |
| `meter` | twenty slim upright bars, partial bar at lower opacity | every percentage: sector, country, currency, spending, subscription kind |
| `tessera` | one hundred bevelled tiles filled column by column | allocation |
| `creepBars` | tile stacks that deepen over time, latest in gold | subscription total over 12 months |

No pies, no legends where a label will do, dotted grids, no axes.

## Screens

Static markup for every screen is in `reference/screens/` (exported from the design tool: read them for structure, spacing, copy and exact inline styles; image URLs starting `/_blob/` will not resolve, map them to `assets/`). All numbers come from `fixtures/demo-data.json`, which is internally consistent. Use it as the seed and the test fixture.

**Navigation.** iPhone: five tabs (Overview, Holdings, Exposure, Cash flow, Grow) in a floating white pill; the active tab opens into an ultramarine pill with its name. Subscriptions opens from Cash flow. Connect opens from the plus on Overview. Mac: sidebar with ten sections (Overview, Holdings, Exposure, Cash flow, Subscriptions, Grow, Performance, Activity, Connections, Planning), active item is an ultramarine pill, the dot-screen picture sits at the foot with the sync status. Web: the same sections in a pill of navigation under a top bar.

| screen | what it must do |
|---|---|
| Welcome / Sign-in | dot-screen picture, "Everything you own, minus everything you owe.", read-only and no-seed-phrase promises, passkey first |
| Overview | net worth on a marble plate over the picture (iPhone) or in a white card (Mac, web), area chart with range control, You own / You owe, the one top Grow card in ultramarine with the saving in gold, accounts with freshness |
| Holdings | tessera allocation with legend, rows with token, name, sparkline, value, change |
| Exposure | look-through of every fund: sector, country, currency as meters, plus one plain-language insight |
| Cash flow | In / Out / Kept, the cashflow chart with forecast, where the month went as meters, period table on Mac |
| Subscriptions | monthly and yearly total, creep bars, price-rise and overlap alerts, list with logos and next renewal, next 30 days on Mac |
| Grow | ranked opportunities, each with Because; detail shows evidence, assumptions, risks |
| Connect | Ledger by public address or xpub, read-only, with what was found; other source types |

Dark mode: `iOS-Overview-Dark.html` and `Mac-Overview-Dark.html` show the target. It is the same markup with `data-ground="dark"` on the root.

## Phases

Work phase by phase. Atomic commits. Stop at the end of each phase with a short report and wait.

**Phase 0. Audit, no changes.** Read the repo. Report the stack, routing, state, data layer, current chart code, styling approach and test setup. Propose where tokens, the Mark component, the chart kit and the icon font will live. List anything in this handoff that conflicts with the codebase.

**Phase 1. Foundations.** Tokens, fonts (Instrument Serif, DM Sans, Material Symbols Rounded), `data-ground` and system dark mode, the adaptive `Mark` component, the lockup. *Done when:* one page shows the mark at 300, 120, 64 and 28 px on marble, white, ultramarine and night, and every one is right with no variant prop.

**Phase 2. Primitives.** Card, hairline row, token (all three kinds behind one API with a logo-service interface and monogram fallback), chip, status pill, segmented control, buttons (primary with icon, secondary, tertiary), round button, field, tab bar, sidebar item. *Done when:* a components page matches `Components1.html` and `Components2.html` in light and dark.

**Phase 3. Charts.** Port `charts.js` and `charts.css` into the codebase's conventions, typed, with unit tests on the path math. *Done when:* a charts page matches `Charts.html`, the glow and pulse work, reduced motion is respected, and no chart library was added.

**Phase 4. Screens, web.** Overview, Holdings, Exposure, Cash flow, Subscriptions, Grow (list and detail), Connect, Sign-in, fed by `demo-data.json` behind the existing data layer's interfaces. Responsive from 390 px to 1440 px. *Done when:* each screen matches its reference in light and dark and passes keyboard and screen-reader checks.

**Phase 5. Living mark.** Integrate `living-mark.js` on sign-in, the website header and the sidebar logo, pivot effect, adaptive to ground.

**Phase 6. Native.** SwiftUI package shared by iOS and macOS: tokens, `MarkView`, token tiles, the six charts in Swift (Canvas or Path, no chart library), then screens, iPhone first. SVG logos go in the asset catalog with vector data preserved.

## Accessibility floor

Contrast 4.5:1 for text. Every icon-only control has a label. Charts have a text alternative with the key figures. Focus is always visible. Nothing depends on hover alone. `prefers-reduced-motion` is honoured everywhere.

## One open question to raise with the owner

The temple render the logo is cut from (`assets/source/temple-render-original.png`) should be confirmed as licensed for trademark use before launch.
