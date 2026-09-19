/**
 * The sign-in page, served by the API before the app shell loads. It follows
 * the Wealth Hub design: the garden on the left, "Welcome back" on the right,
 * one blue, gold only in the roof of the mark. Fonts, the picture and the mark
 * come from the client's /wh/ assets, which stay
 * public because they hold no portfolio data. Nothing here chooses light or
 * dark by hand: the system preference sets the ground, and every token follows.
 */
export interface LoginPageOptions {
  error?: boolean
  /** The deployment has no password set. */
  misconfigured?: boolean
}


export function renderLoginPage(options: LoginPageOptions = {}): string {
  const notice = options.misconfigured
    ? '<p class="notice" role="status">This deployment has no <code>APP_PASSWORD</code> set. Add it in the hosting dashboard, then reload.</p>'
    : '';
  const initialError = options.error ? '<p class="error" role="alert">That password is not right.</p>' : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="color-scheme" content="light dark" />
    <title>Sign in · Wealth Hub</title>
    <link rel="icon" href="/wh/logo/wh-l3-xs-light.svg" type="image/svg+xml" />
    <link rel="preload" href="/wh/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/wh/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossorigin />
    <style>
      @font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 400 700; font-display: swap; src: url(/wh/fonts/dm-sans-latin.woff2) format('woff2'); }
      @font-face { font-family: 'Instrument Serif'; font-style: normal; font-weight: 400; font-display: swap; src: url(/wh/fonts/instrument-serif-latin.woff2) format('woff2'); }
      @font-face { font-family: 'Material Symbols Rounded'; font-style: normal; font-weight: 100 700; font-display: block; src: url(/wh/fonts/material-symbols-rounded.woff2) format('woff2'); }
      :root {
        --wh-marble: #FBF6EA; --wh-panel: #F2ECDC; --wh-card: #FFFFFF; --wh-rule: #E9E0CB;
        --wh-ink: #0C1230; --wh-muted: #5B6076; --wh-ultra: #1F3FD0; --wh-ultra-soft: #E6EBFB;
        --wh-owed: #B5301B; --wh-owed-soft: #FBE3DD; --wh-stone-deep: #8A5F0A; --wh-stone-soft: #FBF0D2;
        --wh-shadow: 0 18px 40px -28px rgba(12, 18, 48, 0.35);
        --wh-serif: "Instrument Serif", Georgia, serif; --wh-sans: "DM Sans", Helvetica, Arial, sans-serif;
        --wh-picture: url(/wh/images/garden-dots-marble.png);
        --wh-mark: url(/wh/logo/wh-l3-s-light.svg);
        --wh-living-ink: var(--wh-ultra);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --wh-marble: #080C22; --wh-panel: #0D1230; --wh-card: #141A3A; --wh-rule: #232B55;
          --wh-ink: #EEF1FF; --wh-muted: #9AA3CC; --wh-ultra: #4A6CF0; --wh-ultra-soft: #1B2350;
          --wh-owed: #FF8A6B; --wh-owed-soft: #3A1D19; --wh-stone-deep: #F0CB6A; --wh-stone-soft: #3A2F12;
          --wh-shadow: 0 0 0 1px #1E2650;
          --wh-picture: url(/wh/images/garden-dots-night.png);
          --wh-mark: url(/wh/logo/wh-l3-s-dark.svg);
          --wh-living-ink: #EEF1FF;
        }
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0; background: var(--wh-marble); color: var(--wh-ink);
        font-family: var(--wh-sans); font-size: 16px; line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      .wh-icon {
        font-family: 'Material Symbols Rounded'; font-weight: 400; font-style: normal; line-height: 1; letter-spacing: normal;
        display: inline-block; width: 1em; height: 1em; overflow: hidden; white-space: nowrap; direction: ltr;
        font-feature-settings: 'liga'; font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; flex: 0 0 auto;
      }
      .page { display: flex; gap: 20px; padding: 20px; min-height: 100%; }
      .picture {
        position: relative; flex: 1.2 1 0; min-height: 520px; border-radius: 32px; overflow: hidden;
        background: var(--wh-picture) 46% 50% / cover no-repeat, var(--wh-panel);
      }
      .lockup {
        position: absolute; top: 28px; left: 28px; display: flex; align-items: center; gap: 6px;
        padding: 12px 18px; border-radius: 999px; background: var(--wh-marble); color: var(--wh-ink);
        font-family: var(--wh-serif); font-size: 23px; letter-spacing: -.015em; line-height: 1;
      }
      .lockup i { display: block; width: 29px; height: 23px; background: var(--wh-mark) center / contain no-repeat; }
      .plate {
        position: absolute; left: 28px; bottom: 28px; padding: 22px 26px; border-radius: 26px; background: var(--wh-marble);
        font-family: var(--wh-serif); font-size: 48px; letter-spacing: -.015em; line-height: 1; color: var(--wh-ultra);
      }
      .form { display: flex; flex-direction: column; justify-content: center; gap: 20px; flex: 1 1 0; padding: 0 80px; min-width: 0; }
      .living { position: relative; width: 96px; height: 77px; color: var(--wh-living-ink); border-radius: 12px; outline-offset: 6px; cursor: pointer; }
      .living:focus-visible { outline: 2px solid var(--wh-ultra); }
      .living img { display: block; width: 96px; height: 77px; }
      .living svg { position: absolute; inset: 0; display: block; width: 96px; height: 77px; opacity: 0; }
      .living.live svg { opacity: 1; }
      .living.live img { visibility: hidden; }
      h1 { margin: 0; font-family: var(--wh-serif); font-weight: 400; font-size: 60px; letter-spacing: -.015em; line-height: 1; }
      p { margin: 0; }
      .lead { color: var(--wh-muted); }
      form { display: contents; }
      .field { display: flex; flex-direction: column; gap: 8px; }
      label { font-size: 14px; font-weight: 600; }
      .box {
        display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 18px; border-radius: 18px;
        background: var(--wh-card); border: 1px solid var(--wh-rule); color: var(--wh-ink);
      }
      .box .wh-icon { font-size: 22px; color: var(--wh-muted); }
      .box:focus-within { border-color: var(--wh-ultra); box-shadow: 0 0 0 3px var(--wh-ultra-soft); }
      input {
        flex: 1 1 auto; min-width: 0; border: 0; outline: 0; background: transparent; padding: 0;
        font: inherit; font-size: 16px; color: inherit;
      }
      .show { border: 0; background: none; padding: 0; margin: 0; color: var(--wh-muted); cursor: pointer; display: flex; border-radius: 999px; }
      .show:focus-visible { outline: 2px solid var(--wh-ultra); outline-offset: 3px; }
      .show .wh-icon { font-size: 22px; }
      button.primary {
        display: flex; align-items: center; justify-content: center; gap: 10px; height: 58px; border: 0; border-radius: 999px;
        background: var(--wh-ultra); color: #fff; font: inherit; font-size: 17px; font-weight: 600; cursor: pointer;
      }
      button.primary .wh-icon { font-size: 24px; }
      button.primary:disabled { opacity: .6; cursor: progress; }
      button.primary:focus-visible { outline: 2px solid var(--wh-ultra); outline-offset: 3px; }
      .error, .notice { margin: -8px 0 0; font-size: 14px; }
      .error { color: var(--wh-owed); }
      .notice { color: var(--wh-stone-deep); }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
      .strip { display: flex; flex-wrap: wrap; gap: 18px; padding-top: 18px; border-top: 1px solid var(--wh-rule); color: var(--wh-muted); font-size: 13px; }
      .strip span { display: flex; align-items: center; gap: 6px; }
      .strip .wh-icon { font-size: 18px; }
      @media (max-width: 1100px) { .form { padding: 0 40px; } h1 { font-size: 48px; } .plate { font-size: 36px; } }
      @media (max-width: 760px) {
        .page { flex-direction: column; gap: 0; padding: 0; }
        .picture { flex: 0 0 auto; min-height: 300px; height: 38vh; border-radius: 0 0 32px 32px; background-position: 50% 40%; }
        .lockup { top: 24px; left: 20px; padding: 10px 16px; font-size: 22px; }
        .plate { display: none; }
        .form { padding: 28px 24px 40px; gap: 18px; }
        h1 { font-size: 42px; }
      }
      @media (prefers-reduced-motion: no-preference) { .living { transition: transform .2s; } }
    </style>
  </head>
  <body>
    <div class="page">
      <aside class="picture" role="img" aria-label="A classical garden with a temple, a statue and cypresses, drawn in blue dots">
        <div class="lockup" aria-hidden="true"><i></i>Wealth Hub</div>
        <div class="plate" aria-hidden="true">Own the whole picture.</div>
      </aside>
      <main class="form">
        <span class="living" id="living" role="img" aria-label="Wealth Hub" tabindex="0">
          <img src="/wh/logo/wh-l3-s-light.svg" alt="" width="96" height="77" decoding="async" />
        </span>
        <h1>Welcome back</h1>
        <p class="lead">Sign in with the household password. Nothing on this side can move your money.</p>
        <form id="login-form" method="post" action="/api/auth/login">
          <div class="field">
            <label for="password">Password</label>
            <div class="box">
              <span class="wh-icon" aria-hidden="true">lock</span>
              <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
              <button type="button" class="show" id="show" aria-label="Show password" aria-pressed="false"><span class="wh-icon" aria-hidden="true">visibility</span></button>
            </div>
          </div>
          ${initialError}
          ${notice}
          <p class="error" id="message" role="alert" hidden></p>
          <button type="submit" class="primary" id="submit"><span class="wh-icon" aria-hidden="true">arrow_forward</span>Sign in</button>
        </form>
        <div class="strip">
          <span><span class="wh-icon" aria-hidden="true">visibility</span>Read-only</span>
          <span><span class="wh-icon" aria-hidden="true">download</span>Export any time</span>
          <span><span class="wh-icon" aria-hidden="true">school</span>Analysis, not advice</span>
        </div>
      </main>
    </div>
    <script>
      (function () {
        var form = document.getElementById('login-form');
        var button = document.getElementById('submit');
        var message = document.getElementById('message');
        var field = document.getElementById('password');
        var show = document.getElementById('show');
        show.addEventListener('click', function () {
          var open = field.type === 'password';
          field.type = open ? 'text' : 'password';
          show.setAttribute('aria-pressed', String(open));
          show.setAttribute('aria-label', open ? 'Hide password' : 'Show password');
          show.firstElementChild.textContent = open ? 'visibility_off' : 'visibility';
          field.focus();
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          message.hidden = true;
          button.disabled = true;
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ password: field.value }),
          })
            .then(function (res) {
              if (res.ok) { window.location.replace('/'); return; }
              return res.json().catch(function () { return {}; }).then(function (body) {
                message.textContent = res.status === 401 ? 'That password is not right.' : (body.message || body.error || 'Sign in did not work. Try again.');
                message.hidden = false;
              });
            })
            .catch(function () {
              message.textContent = 'No connection. Try again.';
              message.hidden = false;
            })
            .then(function () { button.disabled = false; });
        });
      })();
    </script>
  </body>
</html>`;
}

