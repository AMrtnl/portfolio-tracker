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
