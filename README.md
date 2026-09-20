# Wealth Hub

Every account, every asset, one clear picture. Wealth Hub brings **banks**, **brokers**, **pensions**, **property**, **debts** and **crypto** into one read-only ledger in your currency, then ranks what is worth changing with its evidence.

It runs as one service: an Express API in `src/` that also serves the Vite client in `client/`. Each person signs up with an email and password and gets their own data directory. Nothing in the product can move money.

## What it does

| Area | What you get |
|------|--------------|
| **Overview** | Net worth, what you own, what you owe, liquid and cash, a daily history chart, allocation, and the freshness of every source. |
| **Holdings** | Every position from every account with its class, where it is held, weight and 30-day trend. |
| **Exposure** | Look-through of every fund by sector, country and currency, with one plain-language insight. |
| **Cash flow** | Money in, out and kept per month, a forecast, where the month went, and a period table. Paste a bank statement and every line is categorised. |
| **Subscriptions** | Everything that renews by itself, price rises, overlaps, and the next 30 days. Recurring charges are detected from the ledger. |
| **Grow** | Ranked opportunities (fund fees, idle cash, unstaked ether, concentration), each with its evidence, assumptions and risks. |
| **Performance, Activity, Planning** | Benchmarks and cost-to-value, broker activity, and savings goals. |

### Connections

Pick a country and a category (banks, brokers, exchanges, wallets, pensions, property, debts) and the supported institutions in it are listed with their logo and the safest way in. The list is the **catalogue** (`GET /api/catalog?country=CH`): a curated set of institutions merged with whatever the configured aggregators offer right now, so a bank that GoCardless supports or a broker SnapTrade lists is upgraded to a live link automatically.

| Method | Aggregator | Sources | How |
|--------|------------|---------|-----|
| **Bank link** | [GoCardless Bank Account Data](https://bankaccountdata.gocardless.com) (open banking, free tier) | 2,500+ banks across the UK and the EEA: Revolut, N26, ING, Deutsche Bank, BNP Paribas, Barclays, Monzo, bunq and so on | Consent on the bank's own page in read mode; the bank sends the person back and the accounts land with their balance. Transactions can be imported into cash flow, categorised and deduplicated. Needs `GOCARDLESS_*` keys. |
| **Broker or exchange link** | [SnapTrade](https://snaptrade.com) | Interactive Brokers, Schwab, Fidelity, Vanguard, DEGIRO, Trading 212, Coinbase, Kraken, Binance and more | The SnapTrade portal opens in read-only mode straight to the broker and returns to Wealth Hub, which imports the accounts on arrival. Needs `SNAPTRADE_*` keys. |
| **Public key** | none | Ledger, Trezor, any Bitcoin address or xpub, Ethereum or Solana address | Balances are read from the network. Nothing that can sign is ever stored. |
| **Balance by hand** | none | Swiss banks (UBS, ZKB, PostFinance, Raiffeisen, neon, Yuh), pensions (3a, 2nd pillar), property, mortgages, loans | Enter the figure; the app reminds you when it looks old. Swiss retail banks are outside open banking for now. |
| **Positions by hand** | none | Any broker without an API (Swissquote, Saxo, Trade Republic) | Tickers, quantities and prices you keep yourself. |

Without keys, links show as "keys needed" and offer the by-hand route; everything else works.

### Plans and billing

Three plans: **Free** (three live connections), **Plus** (unlimited, Grow, exposure, benchmarks) and **Family** (two seats). Prices are in Swiss francs, monthly or yearly. Billing is Stripe Checkout and the Stripe customer portal, driven by a webhook; the server talks to Stripe with plain `fetch`, so there is no extra dependency. A fresh deployment runs in **preview mode**, where every account is Plus and nothing asks for a card, until `STRIPE_SECRET_KEY` is set (or `PREVIEW_MODE` says otherwise). Outside preview, adding a live connection beyond the plan answers `402` and the app offers the upgrade.

## Design

The interface is antique and quiet: marble and night grounds, ultramarine as the one accent, a touch of gold once per screen, and colour only where it carries meaning (olive is gain, red is owed or broken). Titles and the wordmark are set in Instrument Serif, figures and labels in DM Sans with tabular numerals, both self-hosted. The temple mark is the identity: a static SVG in the chrome and a living, pointer-aware version on the sign-in and onboarding pages, with the garden drawn as a screen of dots. Every control is a capsule (fields, segments, buttons, the sidebar and tab bar), cards sit on soft 24px corners, and icons are Lucide strokes. Light and dark follow the device unless a theme is chosen in Settings. The tokens live in `client/src/wh/tokens.css`; the primitives in `client/src/wh/primitives.css`; the mark and effects in `client/src/wh/Mark.tsx`, `LivingMark.tsx` and `effects/`.

```
client/src/
  routes.ts               # every path: the product under /app, the site public
  auth/AuthContext.tsx    # who is signed in, from one shared request
  site/                   # landing, pricing, security, legal, sign-in, sign-up
  wh/                     # design system: tokens, type, Icon, Mark, controls, layout, charts
  wh/screens/             # Overview, Holdings, Exposure, Cash flow, Subscriptions, Grow, Connect, Billing, Settings, Onboarding
  wh/model/               # the ledger model, sample household
  hooks/useCatalog.ts     # the catalogue and the bank-link flow; hooks/useBilling.ts for plans
  pages/                  # older Performance, Activity, Planning and holding detail pages
src/
  server.ts               # Express API, page gating, static client
  auth.ts, users/         # accounts, sessions, per-user tenants, legacy adoption, plan per user
  catalog/                # curated institutions merged with the live aggregator lists
  aggregators/            # GoCardless client, bank-link routes, pending links
  billing/                # plans, entitlements, Stripe checkout, portal and webhook
  store.ts, money/, goals/, analytics/, market/, providers/, snaptrade/, wallets/
```

## Quick start

```bash
cp .env.example .env
npm install
cd client && npm install && cd ..

# Terminal 1: API on :4000
npm run server

# Terminal 2: UI on :3000 (proxies /api to :4000)
cd client && npm run dev
```

Open http://localhost:3000, create an account at `/signup`, and follow the three onboarding steps. Keep the **sample household** on to see the whole product with realistic figures; it sits beside anything you connect and switches off in Settings.

### Accounts and sign-up policy

- `SESSION_SECRET` signs the session cookie and is required in production (`openssl rand -base64 32`).
- `SIGNUP_MODE` is `open`, `invite` or `closed`. It defaults to `invite` whenever `INVITE_CODE` or the legacy `APP_PASSWORD` is set, so an existing deployment does not open to the public by accident.
- The first account to sign up adopts any single-user data still at the root of `DATA_DIR`.

See `DEPLOY.md` for the Railway setup and the full access-control notes.

### SnapTrade (broker and exchange links)

1. Sign up at [dashboard.snaptrade.com](https://dashboard.snaptrade.com) (Personal, free) and enable 2FA.
2. Create a Personal API key and set `SNAPTRADE_CLIENT_ID` and `SNAPTRADE_CONSUMER_KEY` in `.env`. Never paste keys into chat or commit them.
3. Restart. **Connect → search the broker → Continue** opens the portal and imports on return.

Without keys, broker links show as switched off and everything else works. The Personal key is one per server, so on a shared deployment every account that imports sees the same brokerages.

### GoCardless (bank links)

1. Create a free account at [bankaccountdata.gocardless.com](https://bankaccountdata.gocardless.com) and generate a user secret.
2. Set `GOCARDLESS_SECRET_ID` and `GOCARDLESS_SECRET_KEY` in `.env`. Never paste keys into chat or commit them.
3. Set `PUBLIC_URL` to the address people open (the bank redirects back to it). Restart.
4. **Connect → Banks → the bank → Continue** opens the consent page; on return the accounts are imported. **Import transactions** on a bank row pulls the last 90 days into cash flow.

Consents are read-only and expire after 90 days; the row then shows "needs attention" and the link can be made again.

### Stripe (plans)

1. Create the Plus and Family products in Stripe with a monthly and a yearly price each.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`, `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`.
3. Point a webhook at `POST /api/billing/webhook` for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`.
4. Restart. Preview mode switches off by itself; `PREVIEW_MODE=true` keeps every account on Plus while the keys are being tested.

## API (selected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/auth/session` | Who is signed in and the sign-up mode (public) |
| POST | `/api/auth/signup` | `{ email, password, name?, inviteCode? }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | Clears the session |
| GET / PATCH / DELETE | `/api/auth/me` | Profile, `{ name?, onboarded? }`, delete with `{ password }` |
| POST | `/api/auth/password` | `{ currentPassword, newPassword }`; signs out other devices |
| GET | `/api/export` | Everything as one JSON file |
| GET | `/api/accounts` | The signed-in user's accounts (no secrets) |
| POST | `/api/accounts/manual` · `/watch` · `/snaptrade/import` · `/snaptrade/connect` | Add a source; `402` with `upgrade: true` when the plan has no live slot left |
| GET | `/api/catalog?country=CH` | Countries, connectors and every category with its institutions, method and availability |
| POST | `/api/connect/gocardless/start` · `/finish` | `{ institutionId, redirect }` → `{ url, reference }`; `{ reference }` → `{ imported, institution }` |
| POST | `/api/accounts/:id/transactions/import` | `{ days? }` for a bank account → `{ imported, skipped }` |
| GET | `/api/billing` | Plan, source, preview flag, entitlements, usage and the plan table |
| POST | `/api/billing/checkout` · `/portal` · `/webhook` | `{ plan, interval }` → Stripe Checkout; the portal; the signed webhook (public) |
| GET | `/api/portfolio`, `/api/analytics/*`, `/api/market/*`, `/api/money/*`, `/api/goals` | Read-only figures, always with `warnings` |

Everything except health and the auth endpoints needs a session cookie and operates on that user's data alone.

## Checks

```bash
npm run typecheck && npm run lint && npm test        # server
cd client && npx tsc --noEmit && npm run lint && npm run build
```

## Security

- Read-only everywhere: bank consents are read-only and time-limited, broker links open in read mode, wallets are watched from public keys, there are no trading routes.
- Stripe never sees more than an email and a plan; card details stay on Stripe's pages. Webhooks are signature-checked on the raw body.
- Passwords are scrypt-hashed with a per-user salt; sessions are signed HttpOnly cookies revoked on password change.
- Recovery phrases (Hyperliquid) are AES-256-GCM encrypted with `STORE_SECRET`.
- One directory per user under `DATA_DIR/users/<id>/`. Never commit `.env` or `data/`.
- Everything the product shows is educational analysis of the user's own figures, not financial advice.

## License

MIT
