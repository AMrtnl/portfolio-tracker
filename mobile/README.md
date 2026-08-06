# Meridian for iOS

Native iOS client for the Meridian personal portfolio tracker. Read-only: it
shows your aggregated crypto, brokerage and manual accounts and never places
orders, moves money or edits accounts.

Built with Expo SDK 57 (React Native 0.86, React 19), expo-router, React Query
and TypeScript.

---

## The credential rule that shapes this app

SnapTrade's **Personal** API key (`SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY`)
identifies *you* as the account holder. Per
[SnapTrade's guidance](https://docs.snaptrade.com/docs/build-with-ai.md) it must
**not** be embedded in a distributed application — anyone who downloads an app
containing it can read your linked brokerage accounts.

So the architecture is:

```
iPhone app  ──HTTPS + Bearer token──▶  Your Railway deployment  ──▶  SnapTrade / Hyperliquid
(no broker keys)                       (holds all provider keys)
```

- The app contains **no** brokerage or exchange credentials of any kind.
- It authenticates to *your own* backend with that server's `APP_PASSWORD`, and
  stores the resulting session in the **iOS Keychain** via `expo-secure-store`
  (never `AsyncStorage`, which is unencrypted).
- Only `GET` requests are made after login. There is no order, transfer or
  account-mutation code path in this project.
- Failures surface as real errors with the server's message. Balances are never
  faked, defaulted to zero, or filled in with placeholder data.

---

## Screens

| Route | Screen | What it shows |
|---|---|---|
| `/login` | Sign in | Server password → session in the Keychain. Optional Face ID unlock on relaunch. |
| `/(tabs)` | **Portfolio** | Total value, day change in both currency and percent, 24h/7d/30d performance, allocation, per-source breakdown, retrieved-at line. |
| `/(tabs)/holdings` | **Holdings** | Assets and derivative positions, grouped by source account, with an Assets / Positions switch. |
| `/(tabs)/accounts` | **Accounts** | Brokerages, crypto wallets and manual accounts grouped by kind, each with status, sync age and error text, plus SnapTrade connection health. |
| `/(tabs)/activity` | **Activity** | Recent orders and ~90 days of activities across all brokerage accounts, grouped by day. |
| `/(tabs)/settings` | **Settings** | Face ID toggle, API host, brokerage-sync status, credential disclosure, sign out. |
| `/account/[id]` | Account detail | Identity, native-currency value, cash balances, positions with allocation, recent orders and activity. |

Every screen has explicit loading, empty, partial-failure and error states, and
pull-to-refresh with haptic feedback.

### Currency handling

Values are formatted from whatever currency the API reports, not a hardcoded USD.
Per-account and per-position figures use the `currency` field on their payload, so
a CHF brokerage renders as CHF. The `/api/portfolio` aggregate is summed in USD
today (its fields are literally `usdValue` / `valueUsd`), so the Portfolio tab
labels the total accordingly and adds a note listing any account currencies that
are not FX-converted. It reads `portfolio.currency` first, so it upgrades on its
own once the backend adds FX normalization.

---

## Design

Tokens are converted straight from `client/src/index.css` so web and iOS match:
deep teal `#0D6D63` on a sage mist `#F6F9F7`, Bricolage Grotesque for display,
Source Sans 3 for body, IBM Plex Mono with tabular figures for every number. The
web app's layered radial atmosphere is rebuilt from stacked linear gradients in
`src/components/Atmosphere.tsx`.

Three intentional motions, no more: the portfolio total counts up on load and
eases between refreshes, allocation segments wipe outward in sequence, and the
hero sentiment curve draws in from the left. The curve is explicitly decorative —
the API exposes no balance history, so drawing a real chart would mean inventing
data.

iOS conventions: translucent blurred tab bar with content scrolling beneath,
transparent blurred navigation header on pushed screens, hairline separators
instead of stacked cards, safe-area-aware padding everywhere, native
`RefreshControl`, and haptics only where the user caused something
(`selectionAsync` on row taps, success/error notifications after a refresh).

---

## Running locally

Requirements: Node 20+, Xcode with an iOS simulator, and a reachable Meridian API.

```bash
cd mobile
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_URL
npx expo start
```

Press `i` to open the iOS simulator.

`EXPO_PUBLIC_API_URL` values:

| Target | Value |
|---|---|
| Simulator → local server | `http://localhost:4000` |
| Physical device → local server | `http://<your-mac-lan-ip>:4000` |
| Any device → Railway | `https://<your-app>.up.railway.app` |

`EXPO_PUBLIC_*` variables are **inlined into the bundle at build time**. Only put
non-secret values there — a URL is fine, a key is not. Changing `.env` requires
restarting the dev server.

The login password is the server's `APP_PASSWORD`; it is never stored in this
project. Running the API locally without `APP_PASSWORD` set leaves the gate off, and
the server reports `required: false` — the app signs in and works without one.

### Native modules

This project uses `expo-secure-store`, `expo-local-authentication`,
`react-native-reanimated`, `react-native-svg` and `expo-blur`. Expo Go covers
these, but a development build is more representative:

```bash
npx expo run:ios          # local build (needs Xcode + CocoaPods)
# or
eas build --profile development --platform ios
```

### Checks

```bash
npm run typecheck    # tsc --noEmit
npm run assets       # regenerate placeholder icon / splash
```

---

## Building and submitting via EAS

**Do not run these until you have an Apple Developer Program membership**
($99/year). EAS will prompt for Apple credentials interactively; nothing here
stores them.

### 1. One-time setup

```bash
npm install -g eas-cli
eas login
cd mobile
eas init                  # writes the project id
```

Set your real bundle identifier — it must be globally unique and registered to
your Apple team:

```bash
export MERIDIAN_BUNDLE_ID=com.yourname.meridian
```

Put the production API URL on the EAS servers rather than in a local `.env`:

```bash
eas env:create --name EXPO_PUBLIC_API_URL \
  --value https://your-meridian-api.up.railway.app \
  --environment production --visibility plaintext
eas env:create --name MERIDIAN_BUNDLE_ID \
  --value com.yourname.meridian \
  --environment production --visibility plaintext
```

### 2. Build

```bash
eas build --profile production --platform ios
```

EAS generates and stores the distribution certificate and provisioning profile
for you after you sign in with your Apple ID.

### 3. Submit to TestFlight

```bash
eas submit --platform ios --latest
```

Or in one step: `eas build --profile production --platform ios --auto-submit`.

Then in App Store Connect: add yourself as an **Internal Tester** (up to 100
testers across 100 devices on your own team, no App Review needed), install
TestFlight on your iPhone, and accept the invite. Internal builds are usually
available within minutes of processing.

### 4. Replace the placeholders before any real submission

- `assets/icon.png` — 1024×1024, no alpha channel, no rounded corners
- `assets/splash-icon.png` — transparent logo
- `app.config.ts` → `name`, `slug`, `ios.bundleIdentifier`
- App Store Connect metadata: privacy policy URL and App Privacy questionnaire
  (declare financial data as collected-and-linked, not used for tracking)

---

## Distribution reality check

**TestFlight internal distribution is the realistic path.** Recommended, in order:

1. **TestFlight internal testing** — no App Review, no public listing, 90-day
   build expiry, re-upload to extend. Best fit for a single-user private tool.
2. **Unlisted app distribution** — passes App Review but is not searchable and is
   reachable only by direct link. Requires a request form to Apple.
3. **Public App Store listing** — likely to be rejected.

Why a public listing is a poor bet:

- **Guideline 4.2 (Minimum Functionality)** — Apple rejects apps that are
  primarily a personal utility or feel like a wrapper around a private service.
- **Guideline 2.1 / App Review Information** — review requires working demo
  credentials. This app authenticates against *your* backend holding *your*
  brokerage data; you would either have to hand a reviewer real access or stand up
  a fake tenant, and there is no mock mode here by design.
- **Guideline 5.1.1 and financial-app scrutiny** — apps surfacing brokerage data
  attract questions about the provider relationship, and SnapTrade's Personal tier
  is not licensed for distributed apps.

Also required regardless of path: an **Apple Developer Program membership** for
any App Store Connect access, including TestFlight. Free personal-team signing
works only for a 7-day local build via Xcode.

There is no Android submission path configured here; the Android keys in
`app.config.ts` exist only so `expo start` and prebuild don't fail.

---

## How this app fits the server's auth

The backend (`src/auth.ts`) issues a **stateless HMAC session as an HttpOnly
`meridian_session` cookie**; `POST /api/auth/login` returns no token in the body.
Browsers replay that cookie automatically, but a native app has to decide where to
keep it, and iOS's own cookie store is not encrypted.

So on login the app lifts the cookie value out of the response's `Set-Cookie`
header, stores it in the Keychain, and replays it as an explicit `Cookie` header.
The server only reads the `Cookie` header, so it can't tell the difference.
`src/auth/session.ts` handles four cases in priority order:

1. a `token` in the response body (works automatically if the server ever adds one),
2. the `Set-Cookie` value → Keychain (the normal path),
3. `required: false`, which the server returns when `APP_PASSWORD` is unset outside
   production — no session to store, and the app just works,
4. `Set-Cookie` unreadable → fall back to iOS's own cookie store, recording only
   that a session exists. Signing out calls `POST /api/auth/logout`, whose
   `Max-Age=0` response clears it.

Any `401` clears the Keychain and returns to the login screen. A stored session is
re-checked against the public `GET /api/auth/session` on cold start, since sessions
expire after seven days — but a *network* failure there keeps the session so a
dropped connection doesn't force a re-login.

CORS is disabled in production server-side, which doesn't affect this app: CORS is
a browser policy and native requests carry no `Origin`.

### Gaps the backend could close

1. **`GET /api/activities`** — a merged, paginated feed. The Activity tab currently
   fans out one orders call and one activities call per brokerage account and
   merges client-side.
2. **`currency` on `/api/portfolio`** plus FX-normalized totals. Already on the
   server roadmap; the client reads the field the moment it appears.
3. **Balance history** — any time series would let the hero curve show real data
   instead of a decorative shape.
4. **`GET /api/accounts/:id`** — account detail refetches the whole list to find one
   record.
5. **A token-in-body login response** would remove the `Set-Cookie` scraping in
   step 2 entirely. The client already prefers it when present.
6. **HTTPS is mandatory.** iOS App Transport Security blocks plaintext HTTP, so an
   `http://` production URL fails on a real device (the simulator is more lenient).

---

## Project layout

```
mobile/
  app/                       # expo-router file routes
    _layout.tsx              # fonts, React Query, auth, splash, stack
    index.tsx                # session gate
    login.tsx
    (tabs)/                  # Portfolio · Holdings · Accounts · Activity · Settings
    account/[id].tsx
  src/
    api/client.ts            # fetch wrapper, typed errors, bearer injection
    api/queries.ts           # React Query hooks + keys
    api/types.ts             # mirrors of the server view models
    auth/AuthContext.tsx     # session phases, biometrics
    auth/session.ts          # Keychain read/write, cookie-session exchange
    components/              # Atmosphere, AllocationBar, AnimatedMoney, rows, states
    lib/                     # formatting, portfolio derivations, haptics, refresh
    theme/tokens.ts          # colours, spacing, type scale from the web app
  scripts/generate-assets.mjs
  app.config.ts
  eas.json
```
