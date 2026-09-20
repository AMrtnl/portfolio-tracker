# Deploying Wealth Hub to Railway

Wealth Hub is a multi-user, read-only view of personal finances. It runs as
**one Railway service**: the Express API also serves the built Vite client, so
there is no separate frontend host and no cross-origin traffic.

- **Project:** `meridian-portfolio`
- **Service:** `meridian`
- **URL:** https://meridian-production-819a.up.railway.app
- **Builder:** Dockerfile (`railway.json` → `DOCKERFILE`)
- **Healthcheck:** `GET /api/health` (public, returns only `{status, timestamp}`)

---

## 1. Create your account (do this first)

Access is per user: everyone signs up with an email and password at `/signup`
and gets their own data directory. There is no shared password any more.

1. Open the Railway dashboard → project `meridian-portfolio` → service
   `meridian` → **Variables**.
2. Set `SESSION_SECRET` to a long random value (`openssl rand -base64 32`).
   Without it — or `STORE_SECRET` as a fallback — a production server serves
   `503` for everything behind the gate.
3. Decide who may sign up (section 3). If `APP_PASSWORD` is still set from the
   single-password days, sign-ups are already invite-only and that password is
   the invite code, so nothing else is needed.
4. Railway redeploys automatically. Visit the URL and sign up at `/signup`.

**The first account inherits the existing data.** When the very first user
signs up and the old single-user files (`accounts.json`, `settings.json`,
`money.json`, `goals.json`, `history.json`) still sit at the root of
`DATA_DIR`, the server moves them into that user's directory and boots any
saved Hyperliquid wallets on the spot. The move is logged as
`Adopted legacy data into …`. So the owner should be the first to sign up.

Rotating `SESSION_SECRET` signs everyone out at once. Changing a password
signs out that user's other devices (see section 3).

## 2. Variables you must fill in yourself

Set these in the Railway dashboard. Values are listed by **name only** on
purpose — none of them should ever travel through a chat log.

| Variable | Status | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | **required in production** | Signs every session cookie. Rotating it signs everyone out. |
| `STORE_SECRET` | set to a fresh random value | Encrypts recovery phrases at rest; also the fallback signing key. See the warning below before changing it. |
| `NODE_ENV` | set to `production` | Also switches the access gate to fail-closed. |
| `DATA_DIR` | set to `/app/data` | Matches the mounted volume. Holds `users.json` and `users/<id>/`. |
| `SIGNUP_MODE` | optional | `open`, `invite` or `closed`. Defaults to `invite` when an invite code exists, else `open`. |
| `INVITE_CODE` | optional | The code required in `invite` mode. Wins over `APP_PASSWORD`. |
| `APP_PASSWORD` | legacy, optional | Still works as the invite code, so an existing deployment stays invite-only. |
| `SNAPTRADE_CLIENT_ID` | **not set — add when you want brokerage sync** | Absent means SnapTrade is reported as "needs API keys"; the rest of the app works. |
| `SNAPTRADE_CONSUMER_KEY` | **not set — add when you want brokerage sync** | Never exposed to the browser. |
| `GOCARDLESS_SECRET_ID` | optional | Bank links through open banking (section 7). |
| `GOCARDLESS_SECRET_KEY` | optional | Never exposed to the browser. |
| `PUBLIC_URL` | optional | The deployment's public origin, for bank-link and Stripe return URLs. Defaults to the requesting origin. |
| `PREVIEW_MODE` | optional | `true` entitles everyone as Plus. Defaults to `true` until `STRIPE_SECRET_KEY` is set (section 8). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | optional | Billing (section 8). |

> **`STORE_SECRET` warning.** It is the AES-GCM key for any Hyperliquid recovery
> phrase saved through the UI. Changing it makes previously saved phrases
> undecryptable, so set it once and leave it. It is currently a fresh random
> value generated during setup — no value was copied from your local `.env`. If
> you want the deployment to read an `accounts.json` produced locally, you must
> set `STORE_SECRET` to the same value your local `.env` uses, entering it in the
> dashboard yourself.

## 3. Access control

A public URL that serves portfolio data unauthenticated is not acceptable, so
the gate is server-side, per user, and fails closed.

**How it works** (`src/auth.ts` and `src/users/`, wired up in `src/server.ts`):

- **Accounts** live in `DATA_DIR/users.json`: email, scrypt password hash with
  a per-user salt, and a `sessionVersion`. Each user's stores live under
  `DATA_DIR/users/<id>/`, and every request resolves its own user's stores
  from the cookie, so one user's request can never read another's files.
- **Sign-up policy** is `SIGNUP_MODE`: `open` (anyone), `invite` (needs
  `INVITE_CODE`, or `APP_PASSWORD` as the legacy code) or `closed`. It defaults
  to `invite` whenever a code is configured, so a previously password-gated
  deployment does not open to the public by accident.
- `POST /api/auth/login` takes `{ email, password }` and answers the same
  `401` whether the email exists or not; the invite code is compared in
  constant time.
- On success it sets `wh_session`: **HttpOnly**, **Secure**, `SameSite=Lax`,
  `Path=/`, 30-day `Max-Age`. The value is `{ uid, sv, exp }` signed with
  HMAC-SHA256 under a key derived from `SESSION_SECRET` (or `STORE_SECRET`).
  Stateless means sessions survive a restart without a session store; `sv`
  must still equal the user's `sessionVersion`, which a password change bumps,
  so changing a password revokes every other cookie for that user.
- **Every `/api/*` route is closed** by `app.use('/api', requireApiAuth)`. The
  only public endpoints are `GET /api/health`, `GET /api/auth/session`,
  `POST /api/auth/signup`, `POST /api/auth/login` and `POST /api/auth/logout`.
  Unknown `/api/*` paths 401 before they 404, so the gate doesn't leak which
  routes exist.
- **The app is closed; the site is not.** `GET /app` and `GET /app/*` redirect
  to `/login?next=…` without a valid cookie. Every other page (`/`, `/login`,
  `/signup`, `/pricing`, …) is the same static shell, served publicly — the
  SPA renders the marketing site and the auth pages and fetches nothing
  personal until a session exists. Hashed `/assets/*` bundles contain no
  account data.
- **Login and sign-up failures are rate limited** in-process: 10 per IP and 60
  globally per 15-minute window, then `429` with a `Retry-After` header.
  `app.set('trust proxy', 1)` makes `req.ip` reflect the real client behind
  Railway's proxy. A failed attempt never sets a cookie.
- **CORS is off in production.** Dev uses the Vite proxy (same-origin) and prod
  serves the client itself, so a wildcard `Access-Control-Allow-Origin` would
  only weaken the cookie gate.
- **Fail-closed:** with `NODE_ENV=production` and neither `SESSION_SECRET` nor
  `STORE_SECRET`, the server serves `503` instead of data and logs
  `Access gate: MISCONFIGURED`. A missing secret can never silently open the app.
- **Users own their data.** `GET /api/export` downloads everything as JSON and
  `DELETE /api/auth/me` (with the password) removes the account, its directory
  and its live wallet adapters.

Locally, with `NODE_ENV` unset and no `SESSION_SECRET`, sessions are signed
with a fixed dev secret and a warning is printed, so `npm run server` keeps
working. Set `SESSION_SECRET` in `.env` to exercise the real thing.

This is deliberately not "a secret URL". The URL is guessable and indexable;
the account password is what protects the data.

## 4. Persistence

`data/users.json` holds the user list; `data/users/<id>/accounts.json` holds
each user's account list plus encrypted recovery phrases, next to their
settings, ledger, goals and value history. Railway containers are ephemeral,
so a **volume** is attached:

- Volume `meridian-volume`, mount path `/app/data`
- `DATA_DIR=/app/data` points every store at it (`src/dataDir.ts` honours
  `DATA_DIR`, falling back to `<repo>/data` for local runs)

Without the volume, every redeploy would silently wipe every account.
The volume also means the files live on Railway's disk, which is why the
encryption key (`STORE_SECRET`) matters.

Local `data/` is gitignored and was **not** uploaded — the deployment starts with
an empty store, so add accounts through the UI after signing in.

## 5. Build and run

Root `package.json`:

| Script | What it does |
| --- | --- |
| `npm run build` | `build:server` then `build:client` |
| `npm run build:server` | `tsc` → `dist/` |
| `npm run build:client` | `npm ci --prefix client && vite build` → `client/dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm start` | `node dist/server.js` |
| `npm run start:cli` | `node dist/index.js` (the old CLI entry point) |

The server binds `process.env.PORT` on `0.0.0.0` (`HOST` overrides). The
`Dockerfile` builds server and client in one stage and copies only `dist/`,
`client/dist/` and production dependencies into the runtime image.

## 6. Redeploying

The Railway MCP server could not authenticate (its token refresh fails), so
setup was done with the Railway CLI. To redeploy from this directory:

```bash
railway up            # uploads the working tree and builds the Dockerfile
railway logs --build  # build output
railway logs          # runtime output
```

The service is **not** connected to GitHub, so `railway up` deploys your local
working tree — including uncommitted changes. Nothing is pushed to
`origin/main`. To switch to push-to-deploy instead, connect the repo under
service → **Settings → Source**; note that would deploy whatever is on `main`,
which currently predates all the in-flight work.

A deploy fails if either typecheck fails, since the Docker build runs `tsc` for
the server and `tsc && vite build` for the client. Run `npm run typecheck` and
`npx tsc --noEmit` in `client/` before deploying.

## 7. Aggregators

Two aggregators feed live accounts; both are optional and read-only, and the
startup log prints one line per connector saying whether it is configured.
`GET /api/catalog?country=CH` merges the curated institution list with what
each configured aggregator offers, so the client always knows which
institutions link live and which are kept by hand.

**SnapTrade — brokers and exchanges.** Sign up at
[dashboard.snaptrade.com](https://dashboard.snaptrade.com) (Personal plan),
create a Personal API key and set `SNAPTRADE_CLIENT_ID` and
`SNAPTRADE_CONSUMER_KEY`. Coverage is strongest in the US, Canada, the UK and
the EU. The key is one per server, so on a shared deployment every account
that imports sees the same brokerages.

**GoCardless Bank Account Data — banks.** Create a free account at
[bankaccountdata.gocardless.com](https://bankaccountdata.gocardless.com),
open *User secrets*, create a secret and set `GOCARDLESS_SECRET_ID` and
`GOCARDLESS_SECRET_KEY`. Coverage is EU and UK banks through open banking;
**Switzerland is only partially covered** (a handful of banks and the
neobanks), so most Swiss retail banks stay by hand. The flow is
`POST /api/connect/gocardless/start` → the bank's consent page → back to
`PUBLIC_URL/app/connect?ref=…` → `POST /api/connect/gocardless/finish`.
Consents last 90 days and banks allow only a few reads per account per day,
so balances are cached for six hours and an explicit sync
(`POST /api/accounts/:id/sync`) is what asks the bank again.
`POST /api/accounts/:id/transactions/import` pulls booked transactions into
the money ledger, categorised and deduplicated like a CSV import.

## 8. Billing

Plans are `free` (3 live connections), `plus` (CHF 8, unlimited) and `family`
(CHF 14, two seats). A live connection is any account whose provider is not
`manual`. `GET /api/billing` returns the plan in force, its entitlements and
the current usage.

**Preview mode.** With `PREVIEW_MODE=true` — the default until
`STRIPE_SECRET_KEY` exists — every account is entitled as Plus with
`planSource: 'preview'` and nothing is enforced, so a fresh deployment is
fully usable. Set `PREVIEW_MODE=false` to enforce Free limits; without Stripe
there is then no way to upgrade except editing `users.json`.

**Stripe.** Create two products (Plus, Family) with monthly and yearly
recurring prices, then set:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the restricted or secret key |
| `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY` | `price_…` ids |
| `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY` | `price_…` ids |
| `STRIPE_WEBHOOK_SECRET` | the endpoint's signing secret |

Add a webhook endpoint at `https://<PUBLIC_URL>/api/billing/webhook` for
`checkout.session.completed`, `customer.subscription.updated` and
`customer.subscription.deleted`. The endpoint is public, reads the raw body
and verifies Stripe's `t=…,v1=…` signature (5-minute tolerance) before doing
anything. `POST /api/billing/checkout` `{ plan, interval }` returns a
Checkout URL and `POST /api/billing/portal` the customer portal URL; the
success and cancel pages default to `PUBLIC_URL/app/settings?billing=…`.
When the limit is reached, the account-adding routes answer
`402 { error, message, upgrade: true }`.
