# Deploying Meridian to Railway

Meridian is a single-user, read-only view of personal finances. It runs as **one
Railway service**: the Express API also serves the built Vite client, so there
is no separate frontend host and no cross-origin traffic.

- **Project:** `meridian-portfolio`
- **Service:** `meridian`
- **URL:** https://meridian-production-819a.up.railway.app
- **Builder:** Dockerfile (`railway.json` → `DOCKERFILE`)
- **Healthcheck:** `GET /api/health` (public, returns only `{status, timestamp}`)

---

## 1. Set your password (do this first)

The deployment ships with a **random `APP_PASSWORD` that nobody knows**, so the
app is closed until you replace it. Nothing can be read until you do.

1. Open the Railway dashboard → project `meridian-portfolio` → service
   `meridian` → **Variables**.
2. Replace `APP_PASSWORD` with a long random password of your own
   (`openssl rand -base64 24` produces a good one). Never paste it into a chat
   or a commit.
3. Railway redeploys automatically. Visit the URL and sign in at `/login`.

Rotating `APP_PASSWORD` immediately invalidates every existing session cookie,
because the cookie signing key is derived from the password.

## 2. Variables you must fill in yourself

Set these in the Railway dashboard. Values are listed by **name only** on
purpose — none of them should ever travel through a chat log.

| Variable | Status | Notes |
| --- | --- | --- |
| `APP_PASSWORD` | **set to a random placeholder — replace it** | Gates the whole app. |
| `STORE_SECRET` | set to a fresh random value | Encrypts recovery phrases at rest. See the warning below before changing it. |
| `NODE_ENV` | set to `production` | Also switches the access gate to fail-closed. |
| `DATA_DIR` | set to `/app/data` | Matches the mounted volume. |
| `SNAPTRADE_CLIENT_ID` | **not set — add when you want brokerage sync** | Absent means SnapTrade is reported as "needs API keys"; the rest of the app works. |
| `SNAPTRADE_CONSUMER_KEY` | **not set — add when you want brokerage sync** | Never exposed to the browser. |
| `SESSION_SECRET` | optional | Mixed into the cookie signing key alongside `APP_PASSWORD`. |

> **`STORE_SECRET` warning.** It is the AES-GCM key for any Hyperliquid recovery
> phrase saved through the UI. Changing it makes previously saved phrases
> undecryptable, so set it once and leave it. It is currently a fresh random
> value generated during setup — no value was copied from your local `.env`. If
> you want the deployment to read an `accounts.json` produced locally, you must
> set `STORE_SECRET` to the same value your local `.env` uses, entering it in the
> dashboard yourself.

## 3. Access control

A public URL that serves portfolio data unauthenticated is not acceptable, so
the gate is server-side and fails closed.

**How it works** (`src/auth.ts`, wired up in `src/server.ts`):

- `POST /api/auth/login` takes `{ password }` and compares it to `APP_PASSWORD`
  using a constant-time compare over SHA-256 digests, so neither the password
  nor its length leaks through response timing.
- On success it sets `meridian_session`: **HttpOnly**, **Secure**,
  `SameSite=Lax`, `Path=/`, 7-day `Max-Age`. The value is a stateless HMAC over
  an expiry claim, keyed by `HMAC(SESSION_SECRET || STORE_SECRET :: APP_PASSWORD)`.
  Stateless means sessions survive a restart without a session store, and
  rotating the password revokes every cookie at once.
- **Every `/api/*` route is closed** by `app.use('/api', requireApiAuth)`. The
  only public endpoints are `GET /api/health` and the three `/api/auth/*`
  routes. Unknown `/api/*` paths 401 before they 404, so the gate doesn't leak
  which routes exist.
- **The app shell is closed too.** `GET /`, `GET /index.html` and every
  client-side route redirect to `/login` without a valid cookie. Hashed
  `/assets/*` bundles are served unauthenticated on purpose: they are the same
  static JS/CSS for every user and contain no account data.
- **Login is rate limited** in-process: 10 failures per IP and 60 globally per
  15-minute window, then `429` with a `Retry-After` header. `app.set('trust
  proxy', 1)` makes `req.ip` reflect the real client behind Railway's proxy.
  A failed attempt never sets a cookie.
- **CORS is off in production.** Dev uses the Vite proxy (same-origin) and prod
  serves the client itself, so a wildcard `Access-Control-Allow-Origin` would
  only weaken the cookie gate.
- **Fail-closed:** with `NODE_ENV=production` and no `APP_PASSWORD`, the server
  serves `503` instead of data and logs `Access gate: MISCONFIGURED`. A missing
  password can never silently open the app.
- The client installs an axios interceptor (`client/src/lib/authGuard.ts`) that
  bounces to `/login` on a `401`, so an expired session doesn't turn into a wall
  of error panels.

Locally the gate stays **off** when `APP_PASSWORD` is unset and `NODE_ENV` is
not `production`, so `npm run server` keeps working as before. Set
`APP_PASSWORD` in `.env` to exercise it locally.

This is deliberately not "a secret URL". The URL is guessable and indexable;
the password is what protects the data. `/login` sends `noindex, nofollow`.

## 4. Persistence

`data/accounts.json` holds the account list plus encrypted recovery phrases.
Railway containers are ephemeral, so a **volume** is attached:

- Volume `meridian-volume`, mount path `/app/data`
- `DATA_DIR=/app/data` points the store at it (`src/store.ts` honours
  `DATA_DIR`, falling back to `<repo>/data` for local runs)

Without the volume, every redeploy would silently wipe your connected accounts.
The volume also means the file lives on Railway's disk, which is why the
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
