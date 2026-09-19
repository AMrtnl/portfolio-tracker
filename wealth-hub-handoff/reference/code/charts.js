// Wealth Hub chart kit. No dependencies. Every function returns an SVG (or HTML) string.
// Colours come from CSS tokens so the charts follow light and dark grounds by themselves.
const BAYER8 = (() => { let m = [[0]]; for (let n = 1; n < 8; n *= 2) { const s = m.length, o = Array.from({ length: s * 2 }, () => Array(s * 2));
  for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { const v = m[i][j] * 4; o[i][j] = v; o[i][j + s] = v + 2; o[i + s][j] = v + 3; o[i + s][j + s] = v + 1; } m = o; } return m; })();
const sq = (x, y, d) => `M${x} ${y}h${d}v${d}h-${d}z`;

/** BIG chart: smooth rounded line, dot-screen fill, gold point on today. Hover glow lives in charts.css. */
export function areaChart(values, { width = 790, height = 170 } = {}) {
  const c = width < 400 ? 5 : 6, cols = Math.floor(width / c), rows = Math.floor(height / c), W = cols * c, H = rows * c, top = 10, span = H - top - 8;
  const lo = Math.min(...values), hi = Math.max(...values), at = x => { const t = (x / (W - 8)) * (values.length - 1), i = Math.min(values.length - 2, Math.floor(t)), f = t - i;
    const v = values[i] + (values[i + 1] - values[i]) * f; return top + (1 - (v - lo) / (hi - lo || 1)) * span; };
  const pts = []; for (let x = 0; x <= W - 8; x += 3) pts.push([x, at(x)]);
  const line = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
  let dots = ''; for (let i = 0; i < cols; i++) { if (i * c + c > W - 8) continue; const j0 = Math.floor(at(i * c + c / 2) / c) + 1;
    for (let j = j0; j < rows; j++) { const dens = 0.62 * Math.pow(1 - (j - j0) / Math.max(1, rows - j0), 1.2); if (BAYER8[j % 8][i % 8] / 64 < dens) dots += sq(i * c + 1, j * c + 1, c - 3); } }
  const [ex, ey] = pts[pts.length - 1], grid = [0.25, 0.5, 0.75].map(g => `<line x1="0" y1="${H * g}" x2="${W}" y2="${H * g}" stroke="var(--wh-rule)" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" data-chart="nw" style="display:block;width:100%;height:auto;overflow:visible">${grid}
  <path data-dots d="${dots}" fill="var(--wh-ultra)" fill-opacity=".38" shape-rendering="crispEdges"/>
  <path data-aura d="${line}" fill="none" stroke="var(--wh-ultra)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path data-line d="${line}" fill="none" stroke="var(--wh-ultra)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle data-halo cx="${ex}" cy="${ey}" r="7" fill="var(--wh-stone)"/><circle data-today cx="${ex}" cy="${ey}" r="7" fill="var(--wh-stone)" stroke="var(--wh-card)" stroke-width="3"/></svg>`;
}

/** MINI chart: stepped pixel sparkline. Red only when the series ends lower than it started. */
export function sparkline(values, { width = 64, height = 28 } = {}) {
  const c = 3, n = 21, rows = Math.floor(height / c), lo = Math.min(...values), hi = Math.max(...values);
  const ys = Array.from({ length: n }, (_, i) => { const v = values[Math.round(i / (n - 1) * (values.length - 1))]; return Math.round((1 - (v - lo) / (hi - lo || 1)) * (rows - 2)); });
  let d = ''; ys.forEach((y, i) => { const y1 = ys[i + 1] ?? y; for (let yy = Math.min(y, y1); yy <= Math.max(y, y1); yy++) d += sq(i * c, yy * c, c - 1); });
  const neg = values[values.length - 1] < values[0];
  return `<svg viewBox="0 0 ${n * c} ${rows * c}" width="${width}" height="${height}" shape-rendering="crispEdges"><path d="${d}" fill="var(${neg ? '--wh-owed' : '--wh-ultra'})"/></svg>`;
}

/** PERCENT: a meter of twenty slim upright bars. scale stretches small shares so they stay readable. */
export function meter(pct, { scale = 2.2, n = 20, color = 'var(--wh-ultra)' } = {}) {
  const f = Math.max(0, Math.min(n, pct * scale / 100 * n)), full = Math.floor(f), frac = f - full; let o = '';
  for (let k = 0; k < n; k++) { const on = k < full, part = k === full && frac > 0.25;
    o += `<span style="flex:1 1 0;min-width:0;max-width:5px;height:14px;border-radius:2px;background:${on || part ? color : 'var(--wh-rule)'};${part ? `opacity:${Math.max(0.4, frac).toFixed(2)}` : ''}"></span>`; }
  return `<span style="flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:2px">${o}</span>`;
}

/** ALLOCATION: one hundred bevelled tesserae, filled column by column. parts = [[label, percent, colour], ...] summing to 100. */
export function tessera(parts, { cols = 20, rows = 5, gap = 3 } = {}) {
  const t = parts.flatMap(([, p, c]) => Array(p).fill(`<span style="border-radius:3px;background:${c};box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(0,0,0,.18)"></span>`)).join('');
  return `<div role="img" aria-label="${parts.map(p => p[0] + ' ' + p[1] + '%').join(', ')}" style="display:grid;grid-auto-flow:column;grid-template-rows:repeat(${rows},1fr);grid-template-columns:repeat(${cols},1fr);gap:${gap}px;aspect-ratio:${cols}/${rows}">${t}</div>`;
}

/** CASH FLOW: rounded paired bars (in, out), a position line, and a marble band from forecastFrom onward. */
export function cashflow({ months, ins, outs, position, forecastFrom }, { width = 900, height = 240 } = {}) {
  const n = months.length, slot = width / n, mx = Math.max(...ins, ...outs) * 1.08, pl = Math.min(...position), ph = Math.max(...position); let o = '';
  o += `<rect x="${forecastFrom * slot}" y="0" width="${width - forecastFrom * slot}" height="${height}" fill="var(--wh-panel)" fill-opacity=".8"/>`;
  for (let i = 0; i < n; i++) { const op = i >= forecastFrom ? 0.38 : 1, x = i * slot + slot * 0.18, bw = slot * 0.28, hi = ins[i] / mx * height, ho = outs[i] / mx * height;
    o += `<rect x="${x}" y="${height - hi}" width="${bw}" height="${hi}" rx="5" fill="var(--wh-gain)" fill-opacity="${op}"/><rect x="${x + bw + slot * 0.06}" y="${height - ho}" width="${bw}" height="${ho}" rx="5" fill="var(--wh-owed)" fill-opacity="${op * 0.85}"/>`; }
  const P = position.map((v, i) => [i * slot + slot / 2, height - 20 - (v - pl) / (ph - pl || 1) * (height - 70)]), path = a => 'M' + a.map(p => p.join(',')).join(' L');
  o += `<path d="${path(P.slice(0, forecastFrom))}" fill="none" stroke="var(--wh-ultra)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="${path(P.slice(forecastFrom - 1))}" fill="none" stroke="var(--wh-ultra)" stroke-width="2.5" stroke-dasharray="5 6" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="display:block;width:100%;height:${height}px">${o}</svg>`;
}

/** CREEP: mini tile stacks that deepen over time, the latest one gold. For subscription totals. */
export function creepBars(values, { width = 520, height = 110, floor = null } = {}) {
  const n = values.length, slot = width / n, t = Math.max(4, Math.floor(slot * 0.34)), lo = floor ?? Math.min(...values) * 0.8, hi = Math.max(...values); let o = '';
  values.forEach((v, i) => { const r = Math.max(1, Math.round((v - lo) / (hi - lo) * Math.floor(height / t))), x = i * slot + (slot - 2 * t - 1) / 2; let d = '';
    for (let k = 0; k < r; k++) for (const cx of [0, 1]) d += sq(Math.round(x + cx * t), height - (k + 1) * t, t - 1);
    o += `<path d="${d}" fill="var(${i === n - 1 ? '--wh-stone' : '--wh-ultra'})" fill-opacity="${i === n - 1 ? 1 : (0.35 + 0.55 * i / n).toFixed(2)}"/>`; });
  return `<svg viewBox="0 0 ${width} ${height}" style="display:block;width:100%;height:auto" shape-rendering="crispEdges">${o}</svg>`;
}
