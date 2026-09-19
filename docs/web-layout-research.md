# Web interface layout research — Fey, Kraken, Mercury

Reference study for the Meridian web client (`client/`), based on real product
screens captured on [Mobbin](https://mobbin.com) (platform: web). The goal is a
concrete layout blueprint for our desktop web version, grounded in three apps
that each solve a piece of our problem:

| App | What it is | What we take from it |
| --- | --- | --- |
| **Fey** | Markets/portfolio research tool, dark & minimal | Visual language, chart-first pages, holding-detail anatomy |
| **Kraken** | Crypto exchange (consumer + Pro) | Portfolio hero, grouped balance tables, right action rail, privacy mode |
| **Mercury** | Business banking | App shell (sidebar + top bar), quick actions, transactions table, onboarding checklist |

Where we already are: `client/src/wealth/Shell.tsx` renders a 220px left rail +
centered content column (`.a-shell`, max-width 1180px) on ≥960px, and a bottom
tab bar on mobile (`client/src/wealth.css:826-964`). Dark, iOS-flavored theme
(#000 background, #0A84FF accent). So the bones are right — this document is
about upgrading it from "wide phone app" to "desktop workspace".

---

## 1. Fey — the visual language and chart-first pages

Screens studied:

- [Home, "Hello, Sam" with watchlist panel](https://mobbin.com/screens/5c326535-4eb7-4652-855f-1c6fe9ecdb91)
- [Home with daily recap column](https://mobbin.com/screens/439de82b-140c-4673-b36c-1e8f61b015f1)
- [Portfolio — watchlist vs markets split](https://mobbin.com/screens/ba4a167d-2b95-49dd-b8d9-fd8ddbeb90dd)
- [Portfolio — custom list editing](https://mobbin.com/screens/ccac3be7-3fb5-4ed3-baf6-20229f5ad97a)
- [Stock detail (TSLA) — price header + stat strip](https://mobbin.com/screens/7e486036-e843-4576-a496-f8b1a5685f22)
- [Stock detail — peer analysis tables](https://mobbin.com/screens/946f8b3b-8634-4820-8b5b-b824745f12fa)
- [Stock detail — quarterly financials table](https://mobbin.com/screens/e5b48211-c3c4-4ab7-bb73-9fc228cd09b7)
- [Markets switcher popover](https://mobbin.com/screens/03246461-94cb-40bf-a873-d9e122b05bde)

### Layout anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ ‹ Page title                          contextual controls →  │  slim top row
│                                                              │
│ ┌────────────────────────┐  ┌─────────────────────────────┐  │
│ │  Market/portfolio card │  │  Daily recap / news column  │  │  2 columns of
│ │  big line chart        │  │  logo · headline · delta    │  │  full-height
│ │  S&P500 | VIX  1M…2Y   │  │  chip per story             │  │  cards
│ │  ───────────────────   │  └─────────────────────────────┘  │
│ │  sector rows w/ bars   │       ┌────────────────────────┐  │
│ └────────────────────────┘       │ floating side panel    │  │  slide-over,
│                                  │ Holdings | Watchlist   │  │  not a route
│            ⌂ ◷ ▤ ☆ ✉ ⚙ 🔍       └────────────────────────┘  │
└────────────────△─────────────────────────────────────────────┘
           floating bottom dock (Fey's primary nav)
```

Key patterns:

1. **No persistent sidebar.** Primary nav is a centered floating icon dock at
   the bottom (home, markets, calendar, watchlist, inbox, settings, search).
   Page chrome is nearly invisible; content owns the viewport. We keep our rail
   (see Mercury) but the *discipline* transfers: chrome quiet, content loud.
2. **Chart footer convention.** Series legend bottom-left (`S&P 500 | VIX`),
   time-range pills bottom-right or top-right (`1M 3M YTD 1Y 2Y`). Never a
   toolbar above the chart. Charts have no card-within-card framing — one
   hairline border, chart bleeds to the edges.
3. **Right-hand context panels are overlays, not routes.** The
   Holdings/Watchlist panel floats over the dashboard. Our `SyncSheet` already
   does this; holding quick-look could too.
4. **Stock detail anatomy** (directly applicable to `pages/HoldingDetail.tsx`):
   - Row 1: identity (logo, ticker, name) left; actions (Analyze, compare,
     bookmark) right.
   - Row 2: huge price + delta, full-bleed chart with previous-close dashed
     line; range pills *below* the chart (`1D 1W 1M 3M YTD 1Y 5Y All`).
   - Row 3: **horizontal stat strip** — one row of equal cells with micro
     uppercase labels (Mkt cap · EV/Sales · P/E · Revenue · EPS · Margin ·
     Beta · Div yield · Sector). This is the cheapest high-impact pattern here.
   - Row 4: tabs (News / KPIs / About), then content.
   - Financials as column-per-quarter tables, current period highlighted in
     accent color; a `Quarterly | Annual` segmented pill floats at the bottom.
5. **Color discipline.** Near-black surfaces, hairline borders
   (≈`rgba(255,255,255,.08)`), monochrome text; red/green reserved exclusively
   for deltas, rendered as small filled chips (`+1.44%` on faint green). Our
   palette already matches — adopt the *chip* treatment for deltas in tables.

## 2. Kraken — the portfolio dashboard mechanics

Screens studied:

- [Portfolio — grouped balances + convert rail (light)](https://mobbin.com/screens/2a79fa54-931f-40ad-b684-59ffe5de99e5)
- [Home — portfolio value hero + chart + convert rail](https://mobbin.com/screens/9ea34e68-7bd9-4212-b36f-ed7a9bde83e3)
- [Portfolio value + category chips](https://mobbin.com/screens/1c70d56d-ccf0-4cc6-93a6-ffe1be07ddbe)
- [Balance row kebab menu (Buy/Sell/Convert/Deposit…)](https://mobbin.com/screens/2b1b3206-d3b5-4c5c-ad74-08310843155a)
- [Kraken Pro — overview with summary cells + tabbed tables (dark)](https://mobbin.com/screens/87cf22f4-48fa-474b-9ac1-ffe8eba368b1)
- [Kraken Pro — dashboard + settings menu](https://mobbin.com/screens/90e20c00-24f2-4cea-9644-cc0ae9ba7cc4)
- [Kraken Pro — privacy mode, all values masked](https://mobbin.com/screens/ef4191b4-997b-40c7-827d-4cdd1f9537af)
- [Kraken Pro — portfolio + transactions + earn grid](https://mobbin.com/screens/bb447c35-ba4e-4bad-a22a-70fad3b36ab4)

### Layout anatomy

```
┌───────┬──────────────────────────────────────────┬───────────┐
│ ▪ logo│  ── top bar ──  [🔍 Search…      ⌘K]     │ Transfer  │
│ Home  │                                          │ ▦ 🔔 (CL) │
│ Portf.├──────────────────────────────────────────┴───────────┤
│ Explo.│ Portfolio value          1W 1M 3M 6M 1Y ALL │ Buy Sell│
│ Earn  │ $11.78                                      │ Convert │
│ Activ.│ Balance chg ▾$0.00 · Unrealized −$0.0004    │ ┌─────┐ │
│ ────  │ [Deposit] [Withdraw]                        │ │ 0 ↕ │ │
│ ₿ BTC │ ~~~~~~ full-bleed area chart ~~~~~~~~~~~~~  │ │USDC │ │
│ ◆ ETH │─────────────────────────────────────────────│ └─────┘ │
│       │ (Crypto $0.97 · 8.3% ◔) (Cash $10.76 · 91%◕)│ 25|50|75│
│       │ Your Balances            [Convert small]    │ [Review]│
│       │ ┌ Cryptocurrencies 8.3% ────── −$0.019 ▾ ┐  │         │
│ ────  │ │ ASSET  BALANCE  AVG BUY  PRICE  24H  P/L │ │  sticky │
│ Collap│ └──────────────────────────────────────────┘ │  action │
│ Help  │ ┌ Cash & Stablecoins 91.7% ───────────── ▾ ┐ │  rail   │
└───────┴──────────────────────────────────────────┴───────────┘
```

Key patterns:

1. **Three-zone shell:** icon+label sidebar (collapsible, `Collapse`/`Help`
   pinned at bottom) · fluid content · **persistent right action rail** with
   the primary transactional surface (Buy/Sell/Convert ticket). The rail is
   sticky and survives scroll — action is always one click away.
2. **Sidebar carries pinned entities.** Below the nav: favorite assets (₿
   Bitcoin, ◆ Ethereum) as first-class nav items. For us: pin top holdings or
   accounts under the nav (`useAccounts` already has the data).
3. **Portfolio hero.** Big number + labeled deltas ("Balance Change 1M",
   "Unrealized return") + `Deposit / Withdraw` buttons, range pills top-right,
   then a **full-bleed area chart** that runs under the layout — no card box.
4. **Category chips → grouped tables.** Summary chips (label, value, % of
   portfolio with a tiny donut) sit above "Your Balances"; the table below is
   grouped into collapsible sections per category, each with its own subtotal
   and P/L. Columns: Asset · Balance · Avg buy price · Current price · 24h
   change · Unrealized P/L · ⋮. The kebab opens per-asset actions.
   → Maps 1:1 to our `HoldingsGroups.tsx` / `HoldingsTable.tsx` with classes
   from `classifyAccount.ts`.
5. **Pro overview cells.** A single row of bordered cells (Main / Spot /
   Margin / Earn), each with 2–3 label:value pairs and a health badge — a
   compact alternative to four separate stat cards. Good fit for our
   Cash / Investments / Property / Debt split.
6. **Privacy mode done fully.** The eye toggle masks *every* number with
   `••••••` dot glyphs — headers, tables, tooltips. We already have
   `PrivacyContext`; the reference confirms: mask everywhere, keep layout
   width stable (fixed-width dot string), never just blur.
7. **Tabbed tables** (Balances / Open orders / Positions) instead of stacked
   sections — relevant for `pages/Brokerage.tsx`.

## 3. Mercury — the app shell, transactions, and onboarding

Screens studied:

- [Home — quick actions + balance & accounts cards](https://mobbin.com/screens/dbf9eb63-dcfe-4876-965a-e8a6d8702092)
- [Home — balance chart + Bill Pay / Invoicing cards](https://mobbin.com/screens/d8564614-5b4c-4cdc-8088-0891fc9260df)
- [Home — profile menu with Appearance (system/dark/light)](https://mobbin.com/screens/d7aa120c-c488-4f38-bf61-78460910320d)
- [Home — "Finalize setup" onboarding checklist](https://mobbin.com/screens/9406b767-7525-4ba5-b147-bf02de8b11f8)
- [Transactions — filter toolbar + dense table](https://mobbin.com/screens/f77b24a7-e68e-4fc1-b5ac-91856a92f12b)

### Layout anatomy

```
┌────────┬─────────────────────────────────────────────────────┐
│ ▣ Workspace ▾ │ [🔍 Search for anything  ⌘K]  [Move Money ▾] 👁 🔔 (JL) │
│        ├─────────────────────────────────────────────────────┤
│ Home   │  Welcome, ____                                      │
│ Tasks  │  (Send)(Request)(Transfer)(Deposit)(Pay Bill)(Invoice)  Customize │
│ Transac│  ┌ Mercury balance ─────────┐ ┌ Accounts ──────[+]┐ │
│ Payment│  │ $1,999.45   [chart|table]│ │ ◉ Checking ••2502 │ │
│ Cards  │  │ Last 30 days ↗$10 ↘−$2   │ │ ◉ Savings  ••5679 │ │
│ Capital│  │ ~~~~ area chart ~~~~     │ │ + Create account  │ │
│ Account│  └──────────────────────────┘ └───────────────────┘ │
│ ─────  │  Money movement   ‹ Aug 2025 ›                      │
│ Workflows │ ┌ Money in $··· ┐  ┌ Money out $··· ┐            │
│ Bill Pay  │ └───────────────┘  └────────────────┘            │
│ Invoicing │  Transactions  View all ›                        │
│ Reimburse.│  [Recent][Monthly in][Monthly out]               │
│ Accounting│  …rows…                                          │
└────────┴─────────────────────────────────────────────────────┘
```

Key patterns:

1. **The canonical SaaS shell.** ~210px sidebar: workspace switcher on top,
   flat nav, then a **labeled group** ("Workflows") for secondary features.
   Top bar is global: centered search (`⌘K`), one primary CTA dropdown
   (`Move Money ▾`), privacy eye, notifications, avatar. Page titles live in
   the content, not the top bar.
2. **Nav items expand in place.** "Accounts" expands to child rows *with live
   balances* (Checking ••2502 · $972.04) right in the sidebar.
3. **Quick-action pill row** under the page title: Send · Request · Transfer ·
   Deposit · Pay Bill · Create Invoice, plus `Customize`. One row = the six
   most common verbs. Ours: Add account · Sync all · Add transaction · Connect
   broker · Toggle sample.
4. **Home = balance card + entity card side by side.** Balance card: value,
   chart/table view toggle, "Last 30 days ▾" scope, in/out deltas, area chart.
   Accounts card: rows with masked numbers + balances, explainer text, and a
   `+ Create account` CTA in the empty space. Below: month-scoped "Money
   movement" (Money in / Money out cards with `‹ Aug 2025 ›` pager) — a
   direct template for `pages/Cashflow.tsx`.
5. **Transactions page** (template for Cashflow/Brokerage activity):
   - Toolbar of dropdown filter chips: `Data Views · Filters · Date ·
     Keywords · Amount`, with `Export All` far right.
   - Summary band: net change this month vs last, Money in/out legend, mini
     charts per counterparty.
   - Dense table: Date · To/From (logo + name) · Amount (green for credits,
     plain for debits) · Account · Method · GL Code · Attachment. Row height
     ~44px, hairline separators, no zebra striping.
6. **Onboarding checklist card** pinned at the top of Home ("Finalize setup":
   numbered steps, done items collapsed with checkmarks, current step expanded
   with illustration + CTA + "Skip For Now"). Perfect replacement for our
   empty-state dashboard when `accountCount === 0`.
7. **Appearance menu** (System default / Dark / Light) inside the avatar menu —
   where a theme switch belongs if we ever add one.

---

## 4. Synthesis — target layout for Meridian web

The three references agree on more than they differ; where they differ, pick:

- **Shell & navigation** → Mercury (sidebar with groups + global top bar),
  with Kraken's collapse control and pinned entities.
- **Dashboard mechanics** → Kraken (hero + full-bleed chart + category chips +
  grouped tables), with Mercury's quick-action row.
- **Detail pages & styling** → Fey (stat strip, chart conventions, color
  discipline, floating panels).

### Target shell (≥ 1024px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│ M Meridian │ [🔍 Search assets, accounts…  ⌘K]  [Sample] 👁 ⟳ (A) │
│          ├──────────────────────────────────────────────────────┤
│ OVERVIEW │                                                      │
│ • Wealth │   ┌────────────── page content ──────────────┐       │
│ • Analysis│  │ fluid, max-width ~1280px                 │       │
│ MONEY    │   │ pages may split into                     │       │
│ • Cash flow│ │ primary (1.5fr) + aside (1fr, sticky)    │       │
│ • Subscript.│└──────────────────────────────────────────┘       │
│ SETUP    │                                                      │
│ • Accounts ▸ (expands: per-account balances)                    │
│ • Brokerage│                                                    │
│ ──────── │                                                      │
│ ★ NVDA … │  ← pinned top holdings (Kraken)                      │
│ ──────── │                                                      │
│ ⇤ Collapse · ? Help                                             │
└──────────┴──────────────────────────────────────────────────────┘
```

Changes vs today's `Shell.tsx`:

1. Move the **search field into a global top bar** (today there is none; the
   header only shows title + 3 buttons). Wire `⌘K` to a command palette that
   jumps to holdings/accounts/pages. Keep Sample, privacy eye, and sync in the
   top-right cluster; add the avatar menu later.
2. **Page titles move into page content** (Mercury). The `titleFor()` /
   `subtitle` logic in `Shell.tsx:42-124` becomes a per-page `<PageHeader>`;
   the top bar stays constant while navigating.
3. **Group the nav** with micro-labels (Overview / Money / Setup) instead of
   one flat list; add Brokerage back into the sidebar (it currently has a
   route but no tab).
4. **Accounts nav item expands** to show the classified account list with
   balances (data already in `useAccounts` + `classifyAccount.ts`).
5. **Collapse control + Help** pinned at the sidebar bottom; collapsed state
   is icon-only 64px (Kraken).
6. Widen `.a-shell` to `max-width: 1280px` and let pages opt into the
   `.a-desk` primary/aside split (already exists in `wealth.css:912-922`) —
   with the aside `position: sticky; top: <topbar height>`.

### Dashboard (`pages/Dashboard.tsx`)

```
[ Finalize setup checklist — only while no real accounts ]        (Mercury)
Net worth                                    1W 1M 3M 6M 1Y ALL   (Kraken)
$248,310   ▴ +$3,120 (1.3%) 1M · Unrealized +$12,480
(Add account)(Sync all)(Add transaction)(Connect broker)          (Mercury)
~~~~~~~~~~~~~~ full-bleed area chart ~~~~~~~~~~~~~~~~~~~~~~~~
(Cash $32k · 13% ◔)(Investments $180k · 72% ◕)(Property…)(Debt…)  (Kraken)
┌ primary column ───────────────────────┐ ┌ aside (sticky) ─────┐
│ Holdings, grouped by class,           │ │ Movers strip        │
│ collapsible w/ subtotals + P/L        │ │ Insights cards      │
│ ASSET · BALANCE · PRICE · 24H · P/L ⋮ │ │ News (daily recap)  │ (Fey)
└───────────────────────────────────────┘ └─────────────────────┘
```

Components already exist: `PortfolioOverview`, `HoldingsGroups`,
`AllocationBar` (→ becomes the category chips), `MoversStrip`, `Insights`,
`NewsList`. The change is arrangement, not new features.

### Holding detail (`pages/HoldingDetail.tsx`) — copy Fey

Identity row → hero price + full-bleed chart with previous-close dashed line →
range pills below chart → **stat strip** (Qty · Avg cost · Mkt value · P/L ·
Day change · Weight · Sector) → tabs (Activity / News / About).

### Cashflow (`pages/Cashflow.tsx`) — copy Mercury

Month pager (`‹ Aug 2025 ›`) · Money in / Money out cards with 3-month
average · filter-chip toolbar · dense transaction table with merchant logos
and green credits · `Export` on the right. `Subscriptions` keeps its calendar
but adopts the same toolbar.

### Cross-cutting conventions

| Convention | Rule | Source |
| --- | --- | --- |
| Time ranges | Pill group `1W 1M 3M 6M 1Y ALL`, right-aligned at chart level | Kraken/Fey |
| Deltas | Chip-styled, red/green only there; sign always shown | Fey |
| Privacy | Eye toggle masks every figure with fixed-width `••••` | Kraken Pro |
| Tables | Micro uppercase column headers, 44px rows, hairline separators, kebab menu per row | Kraken/Mercury |
| Panels | Contextual detail = right slide-over, never a new route | Fey |
| Empty states | Checklist card with numbered steps + illustration | Mercury |
| Charts | No box-in-box; legend bottom-left, ranges at edge; area fill fades to transparent | Fey/Kraken/Mercury |

## 5. Suggested implementation order

1. **Shell**: global top bar (search placeholder + existing buttons), grouped
   sidebar with collapse, page-level `<PageHeader>`. Pure `Shell.tsx` +
   `wealth.css` work, no data changes.
2. **Dashboard hero**: rearrange into hero + full-bleed chart + range pills +
   category chips; move Movers/Insights/News into the sticky aside.
3. **Holding detail**: stat strip + tabs.
4. **Cashflow/Subscriptions**: toolbar + table upgrade, month pager.
5. **Polish**: command palette (⌘K), sidebar account expansion with balances,
   pinned holdings, onboarding checklist, full privacy masking audit.

Each step is independently shippable; 1 + 2 deliver most of the perceived
change.
