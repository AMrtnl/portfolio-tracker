# Meridian

Personal portfolio tracker that aggregates **crypto wallets**, **brokerages** (SnapTrade Personal), and **manual accounts** into one dashboard.

## What works today

| Source | Status | Needs API keys? |
|--------|--------|-----------------|
| **Hyperliquid** (crypto wallet via recovery phrase) | Live sync of perps equity + spot | No |
| **Manual** (any broker/bank/cash/holdings) | Works immediately — you enter balances | No |
| **SnapTrade** (brokerages, read-only) | Import already-connected accounts + brokerage dashboard | Yes — free Personal plan |

Swiss / EU note: SnapTrade coverage is strongest for US/CA/UK/EU brokers. Many Swiss retail banks are not available via aggregators — use **Manual** for those.

## Architecture

```
src/
  server.ts                 # Express API
  store.ts                  # Account persistence (v2)
  providers/                # hyperliquid · manual · snaptrade
  snaptrade/                # Personal client, fetch, normalize (server-only)
  types/
client/src/
  pages/Dashboard.tsx
  pages/Accounts.tsx
  pages/Brokerage.tsx       # SnapTrade-focused read-only surface
```

SnapTrade credentials stay in `.env` only. The Personal API key identifies you — Meridian never registers a Commercial `userId` / `userSecret`.

## Quick start

```bash
cp .env.example .env
npm install
cd client && npm install && cd ..

# Terminal 1 — API
npm run server

# Terminal 2 — UI
cd client && npm run dev
```

- UI: http://localhost:3000  
- API: http://localhost:4000  

### SnapTrade Personal (brokerages)

1. Sign up at [dashboard.snaptrade.com](https://dashboard.snaptrade.com) (Personal, free) and enable 2FA.
2. Connect brokerages in the SnapTrade Dashboard (or Connection Portal).
3. Create a Personal API key on the [API Key page](https://dashboard.snaptrade.com/api-key).
4. Set in `.env` (do not paste keys into chat or commit them):

```env
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=
STORE_SECRET=your-long-random-string
```

5. Restart the server → **Accounts → Brokerage → Import connected accounts**, or open **Brokerage** in the nav.
6. Connection Portal is secondary (add or repair a brokerage).

Without keys, SnapTrade routes return **503** and other providers still work. Failures never invent balances — you get clear errors and any sections that loaded successfully.

## How to test (no broker keys)

1. Open http://localhost:3000 → redirected to **Accounts**.
2. Choose **Manual account** → name it e.g. `UBS` → add holding `CHF` qty `10000` price `1.12`.
3. Or choose **Crypto wallet** and paste a Hyperliquid recovery phrase.
4. Portfolio shows combined total + **Sources** breakdown.

## Cash flow, statements, and subscriptions

There is no bank aggregator wired (Swiss retail banks are mostly outside
Plaid/GoCardless coverage anyway), so the ledger fills itself from what you
give it and does the sorting for you:

- **Log a transaction** — the category is guessed from the note as you type
  (`Migros` → Groceries, `SBB` → Transport, `Lohn` → Salary). Pick another one
  to override.
- **Import a bank statement** — paste or upload the CSV your bank exports.
  Delimiters, date formats (`16.09.2026`, `2026-09-16`, `16/09/2026`), amount
  formats (`1'234.50`, `1.234,50`, `(45.00)`), signed-amount or debit/credit
  columns, and header rows are all detected. Every line is categorised;
  lines already in the ledger are skipped, so re-importing is safe.
- **Recurring charges are detected** — anything at the same merchant with a
  stable amount that repeats monthly, quarterly, or yearly shows up on the
  Subscriptions page as a suggestion. Add it as-is, open it to adjust, or
  dismiss it. Suggestions disappear once tracked.

The rules live in `src/money/detect.ts` and the parser in
`src/money/import.ts`; both are covered by unit tests.

## Watch-only wallets (Ledger, or any address)

Track cold storage without ever typing a seed phrase. Paste a Bitcoin account key (`xpub`, `ypub`, or `zpub` — what Ledger Live shows under *Account settings → Advanced*) or a single Bitcoin, Ethereum, or Solana address, and Meridian reads the balance from the network:

- **Bitcoin** — every receive and change address is derived from the account key (BIP44 / 49 / 84) and totalled from an Esplora API with the standard 20-address gap limit. `BTC_API_URL` defaults to `https://mempool.space/api`.
- **Ethereum** — ETH plus USDC, USDT, DAI, WBTC, stETH, LINK, and UNI over JSON-RPC. `ETH_RPC_URL` defaults to `https://ethereum-rpc.publicnode.com`.
- **Solana** — SOL plus USDC and USDT. `SOLANA_RPC_URL` defaults to `https://api.mainnet-beta.solana.com`.

In Chrome, Edge, or Brave, **Read device** pulls the key straight from a plugged-in Ledger over WebHID (Bitcoin or Ethereum app open). The device only ever exports public material, and Meridian stores just the key — nothing that can sign. Reads are cached for five minutes, and the last successful read stays on the account so a flaky RPC never zeroes the dashboard.

## Goals, budget targets, and the command palette

- **Goals** (`/goals`, `/api/goals`): a target, an optional date, a monthly contribution, an expected return, and the accounts that fund it. Progress is the live balance of those accounts; each card shows what is needed per month to land on the date and when the current pace gets there.
- **Budget targets** (`/api/money/budgets`): a monthly ceiling per spend category, shown against the running average in Cash flow › Where it goes. Bars fill against the target and turn red when a month runs over.
- **⌘K / Ctrl K / `/`** opens the palette: pages, asset classes, accounts, positions, and actions (add a transaction, import a statement, add an account, new goal, sync everything, hide balances, switch the display currency, open preferences).
- **Appearance** (Preferences, or ⌘K → "Switch to…"): **Paper** is the light, institutional theme — warm grey ground, ink and grey series, one muted red for anything that needs attention, mono tick labels on dotted grids; **Night** keeps the black shell and the neon composition chart. Both run off the same CSS tokens.
- **Needs attention** (the bell): failed or stale syncs, recurring charges waiting for a decision, and goals that have slipped — each with its one next step.

## API (selected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/providers` | Provider registry + configured flags |
| GET | `/api/accounts` | List Meridian accounts (no secrets) |
| POST | `/api/accounts/snaptrade/import` | Import SnapTrade accounts into Meridian |
| POST | `/api/accounts/snaptrade/connect` | Connection Portal URL (repair/add) |
| GET | `/api/snaptrade/status` | Configured + connection summary |
| GET | `/api/snaptrade/accounts` | Live list from SnapTrade |
| GET | `/api/snaptrade/accounts/:id` | Details + balances + positions |
| GET | `/api/snaptrade/accounts/:id/orders` | Recent orders (24h) |
| GET | `/api/snaptrade/accounts/:id/activities` | Activities (~90d, limit 100) |
| GET | `/api/snaptrade/connections` | Brokerage authorization health |
| GET | `/api/portfolio` | Aggregate across all sources (`allSettled`) |

## Security

- Never commit `.env` or `data/`.
- Recovery phrases: encrypted at rest; not sent to the browser after connect.
- SnapTrade `CONSUMER_KEY`: server-side only. No trading endpoints.
- This is a personal local tool — add auth before exposing on a public host.
- Avoid logging full brokerage API responses.

## Troubleshooting (SnapTrade)

| Symptom | Check |
|---------|--------|
| 503 on `/api/snaptrade/*` | `.env` keys set and server restarted |
| Empty import | Accounts connected in SnapTrade Dashboard; then Import |
| Stale / empty holdings | Connection disabled → Add or repair via portal |
| Totals look wrong across currencies | Values are in each account’s reported currency; FX normalization is a later phase |

## Roadmap / gaps

- [ ] Live SnapTrade FX normalization (multi-currency → display currency)
- [ ] Return rates / balance history charts
- [ ] Plaid Investments (US) provider
- [ ] GoCardless / TrueLayer (EU open banking)
- [ ] CSV import for manual holdings
- [ ] Price refresh for manual equities

## License

MIT
