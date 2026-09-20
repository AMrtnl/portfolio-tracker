#!/usr/bin/env node
/**
 * Ask an outside model to audit this app through Vercel's AI Gateway, then ask
 * it why for every finding it made.
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=... node scripts/audit-gateway.mjs [--model google/gemini-2.5-pro] [--screens dir] [--out audit.md]
 *
 * The gateway speaks the OpenAI chat-completions dialect, so any model it
 * lists works: google/gemini-2.5-pro, openai/gpt-5, anthropic/claude-sonnet-4.5,
 * xai/grok-4. No dependencies beyond Node 22's fetch. Nothing is sent that is
 * not already in the repository: source files, the design handoff's rules and,
 * if --screens points at a folder of PNGs, screenshots of the built app.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const MODEL = opt('--model', process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-pro')
const SCREENS = opt('--screens', '')
const OUT = opt('--out', 'audit.md')
const KEY = process.env.AI_GATEWAY_API_KEY
if (!KEY) {
  console.error('Set AI_GATEWAY_API_KEY (Vercel dashboard → AI Gateway → API keys).')
  process.exit(1)
}
const ENDPOINT = process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1/chat/completions'
const root = path.resolve(new URL('..', import.meta.url).pathname)

/** The files that describe the app: enough to judge, small enough to send. */
const FILES = [
  'wealth-hub-handoff/HANDOFF.md',
  'Dockerfile',
  'package.json',
  'client/package.json',
  'src/server.ts',
  'src/auth.ts',
  'src/loginPage.ts',
  'src/store.ts',
  'src/analytics/portfolio.ts',
  'src/providers/watch.ts',
  'src/snaptrade/fetch.ts',
  'client/src/App.tsx',
  'client/src/wh/Shell.tsx',
  'client/src/wh/tokens.css',
  'client/src/wh/primitives.css',
  'client/src/wh/controls.tsx',
  'client/src/wh/layout.tsx',
  'client/src/wh/Token.tsx',
  'client/src/wh/logoService.ts',
  'client/src/wh/model/book.ts',
  'client/src/wh/model/grow.ts',
  'client/src/wh/screens/Overview.tsx',
  'client/src/wh/screens/Connect.tsx',
  'client/src/wh/screens/Grow.tsx',
  'client/src/wh/effects/dotField.ts',
  'client/src/wh/effects/gridLift.ts',
  'client/src/wealth/DemoContext.tsx',
]

async function corpus() {
  const parts = []
  for (const rel of FILES) {
    try {
      const text = await readFile(path.join(root, rel), 'utf8')
      parts.push(`\n\n===== ${rel} =====\n${text.length > 40_000 ? text.slice(0, 40_000) + '\n… (truncated)' : text}`)
    } catch {
      parts.push(`\n\n===== ${rel} =====\n(missing)`)
    }
  }
  return parts.join('')
}

async function screenshots() {
  if (!SCREENS) return []
  const files = (await readdir(SCREENS)).filter((f) => f.endsWith('.png')).sort().slice(0, 12)
  const out = []
  for (const f of files) {
    const b64 = (await readFile(path.join(SCREENS, f))).toString('base64')
    out.push({ type: 'text', text: `Screenshot: ${f}` })
    out.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } })
  }
  return out
}

async function chat(messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 }),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 500)}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

const SYSTEM = `You are a senior reviewer auditing a single-user personal finance web app (Express + TypeScript API, React + Vite client, deployed with Docker on Railway, one household password). Judge it as shipped code, not as a prototype. Be concrete: cite files and lines, name the exact failure or attack, and give the smallest fix. Do not pad. Use the design handoff's hard rules as the standard for design findings.`

const BRIEF = `Audit this app across these areas and report findings ordered by severity within each area:
1. Security: authentication and session cookies, the server-rendered sign-in page, secrets and data at rest, third-party calls (brokerage SDK, blockchain APIs, market data, a favicon lookup service), headers and transport, injection surfaces.
2. Design-system compliance against the handoff's hard rules (one blue, gold at most once per screen, green and red only for money meaning with an icon, serif titles never bold, tabular figures, rows start with a token, every suggestion begins with "Because", no exclamation marks, nothing chooses light or dark by hand, no chart library or UI kit).
3. Accessibility: keyboard, focus, labels, contrast, reduced motion, screen-reader text for charts.
4. Performance and robustness: bundle, request fan-out, caching, outbound timeouts, canvas effects on phones.
5. Code health: dead code, duplication, test gaps, type escapes.
6. Product: anything a careful user of a wealth app would find confusing or untrustworthy.

For each finding give: title, severity (critical, high, medium, low, info), file:line, what the code does, and the smallest fix. End with what is done well. Then the source follows.`

const main = async () => {
  const text = await corpus()
  const shots = await screenshots()
  const first = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: [{ type: 'text', text: `${BRIEF}\n${text}` }, ...shots] },
  ]
  process.stderr.write(`Asking ${MODEL} for the audit…\n`)
  const audit = await chat(first)

  process.stderr.write('Asking why for each finding…\n')
  const why = await chat([
    ...first,
    { role: 'assistant', content: audit },
    {
      role: 'user',
      content:
        'For every finding above, in the same order, explain why: what concretely goes wrong if it is left as is, who is affected, how likely it is, and why the fix you proposed is the right one rather than the alternatives. If a finding does not hold up under that scrutiny, say so and withdraw it.',
    },
  ])

  const report = `# Outside audit by ${MODEL}\n\n_Generated ${new Date().toISOString()} through Vercel AI Gateway._\n\n## Findings\n\n${audit}\n\n## Why\n\n${why}\n`
  await writeFile(OUT, report)
  process.stderr.write(`Written to ${OUT}\n`)
  process.stdout.write(report)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
