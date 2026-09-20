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

One search box. Type the institution and the right method is chosen:

| Method | Sources | How |
|--------|---------|-----|
| **Broker or exchange link** | Interactive Brokers, Schwab, Fidelity, Vanguard, DEGIRO, Trading 212, Coinbase, Kraken, Binance and more | The SnapTrade portal opens in read-only mode straight to the broker and returns to Wealth Hub, which imports the accounts on arrival. Needs `SNAPTRADE_*` keys on the server. |
| **Public key** | Ledger, Trezor, any Bitcoin address or xpub, Ethereum or Solana address | Balances are read from the network. Nothing that can sign is ever stored. |
| **Balance by hand** | Swiss and European banks, pensions (3a, 2nd pillar), property, mortgages, loans | Enter the figure; the app reminds you when it looks old. Swiss retail banks are not in any aggregator yet. |
| **Positions by hand** | Any broker without an API (Swissquote, Saxo) | Tickers, quantities and prices you keep yourself. |

## Design

The interface is one neutral ground, one accent, hairline rules and colour only where it carries meaning (green is gain, red is owed or broken). Type is the system UI face (SF Pro on Apple platforms) with self-hosted Inter behind it; icons are Lucide strokes. Light and dark follow the device unless a theme is chosen in Settings. The tokens live in `client/src/wh/tokens.css`; the primitives in `client/src/wh/primitives.css`.

```
client/src/
  routes.ts               # every path: the product under /app, the site public
  auth/AuthContext.tsx    # who is signed in, from one shared request
  site/                   # landing, pricing, security, legal, sign-in, sign-up
  wh/                     # design system: tokens, type, Icon, Mark, controls, layout, charts
  wh/screens/             # Overview, Holdings, Exposure, Cash flow, Subscriptions, Grow, Connect, Settings, Onboarding
  wh/model/               # the ledger model, institutions catalogue, sample household
  pages/                  # older Performance, Activity, Planning and holding detail pages
src/
  server.ts               # Express API, page gating, static client
  auth.ts, users/         # accounts, sessions, per-user tenants, legacy adoption
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
| POST | `/api/accounts/manual` · `/watch` · `/snaptrade/import` · `/snaptrade/connect` | Add a source |
| GET | `/api/portfolio`, `/api/analytics/*`, `/api/market/*`, `/api/money/*`, `/api/goals` | Read-only figures, always with `warnings` |

Everything except health and the auth endpoints needs a session cookie and operates on that user's data alone.

## Checks

```bash
npm run typecheck && npm run lint && npm test        # server
cd client && npx tsc --noEmit && npm run lint && npm run build
```

## Security

- Read-only everywhere: broker links open in read mode, wallets are watched from public keys, there are no trading routes.
- Passwords are scrypt-hashed with a per-user salt; sessions are signed HttpOnly cookies revoked on password change.
- Recovery phrases (Hyperliquid) are AES-256-GCM encrypted with `STORE_SECRET`.
- One directory per user under `DATA_DIR/users/<id>/`. Never commit `.env` or `data/`.
- Everything the product shows is educational analysis of the user's own figures, not financial advice.

## License

MIT
