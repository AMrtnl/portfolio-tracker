// Wealth Hub living mark. Engraves the temple live from a light map, so the lines can be cut at any angle.
// No dependencies. Put an <svg viewBox="0 8 100 84"> with <g class="fg" fill="none" stroke="currentColor" stroke-linecap="round">
// and <g class="rf" fill="none" stroke="#E2B23C" stroke-linecap="round"> inside any element, then call mount(el, options).
// The light map (140 x 140, one character per cell: 5 bits of darkness + 1 roof bit, space = empty) is in temple-lightmap.txt.
const GW = 140, GH = 140, ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', LUT = {};
for (let q = 0; q < 64; q++) LUT[ALPH.charCodeAt(q)] = q;
let S = ''; export function setLightMap(text) { S = text; }
var LV = 10;
function cell(x,y){var i=Math.floor(x/100*GW),j=Math.floor(y/100*GH);if(i<0||j<0||i>=GW||j>=GH)return -1;var c=S.charCodeAt(j*GW+i);return c===32?-1:LUT[c];}
  function render(el,theta,e,inv,coarse){
    var sp=coarse?3.4:2.25, st=coarse?2.2:1.5, R=62, ux=Math.cos(theta),uy=Math.sin(theta),nx=-uy,ny=ux;
    var fg=[],rf=[],k; for(k=0;k<LV;k++){fg.push('');rf.push('');}
    var len=Math.max(0.02,st*e), hx=ux*len/2, hy=uy*len/2, lx=(ux*len).toFixed(2), ly=(uy*len).toFixed(2);
    for(var b=-R;b<=R;b+=sp){ for(var a=-R;a<=R;a+=st){
      var px=50+a*ux+b*nx, py=50+a*uy+b*ny, v=cell(px,py); if(v<0)continue;
      var d=(v&31)/31, roof=v>>5; if(inv)d=1-d; if(roof&&d<0.5)d=0.5;
      var lvl=Math.round(d*(LV-1)), seg='M'+(px-hx).toFixed(2)+' '+(py-hy).toFixed(2)+'l'+lx+' '+ly;
      if(roof)rf[lvl]+=seg; else fg[lvl]+=seg;
    }}
    // dots are drawn a little larger than lines so the tone stays the same when they shrink
    var gain=1+0.55*(1-e);
    function put(g,arr){ var out=''; for(var k=0;k<LV;k++){ if(!arr[k])continue; var w=sp*(0.10+0.84*k/(LV-1))*gain; out+='<path stroke-width="'+w.toFixed(2)+'" d="'+arr[k]+'"/>'; } g.innerHTML=out; }
    put(el.querySelector('.fg'),fg); put(el.querySelector('.rf'),rf);
  }
  
const ease = p => p * p * (3 - 2 * p);
/** effect: 'pivot' (lines swing 0 to 90 degrees) | 'dots' (turn through dots) | 'bloom' (dots to lines) | 'follow' (face the pointer) */
export function mount(el, { effect = 'pivot', dark = false, coarse = false } = {}) {
  const it = { p: 0, target: 0, ang: 0, tang: 0, raf: 0, last: 0 }, H = Math.PI / 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = () => { const e = ease(it.p); return effect === 'pivot' ? [e * H, 1] : effect === 'dots' ? [e * H, Math.abs(Math.cos(it.p * Math.PI))] : effect === 'bloom' ? [0, e] : [it.ang, 1]; };
  const draw = () => { const s = state(); render(el, s[0], s[1], dark, coarse); };
  function tick(ts) { if (!it.last) it.last = ts; const dt = Math.min(0.05, (ts - it.last) / 1000); it.last = ts; let busy = false;
    if (effect === 'follow') { let df = it.tang - it.ang; while (df > H) df -= Math.PI; while (df < -H) df += Math.PI; if (Math.abs(df) > 0.004) { it.ang += df * Math.min(1, dt * 9); busy = true; } }
    else if (it.p !== it.target) { const dir = it.target > it.p ? 1 : -1; it.p += dir * dt / (effect === 'dots' ? 1.1 : 0.8); if ((dir > 0 && it.p >= it.target) || (dir < 0 && it.p <= it.target)) it.p = it.target; busy = it.p !== it.target; }
    draw(); if (busy) it.raf = requestAnimationFrame(tick); else { it.raf = 0; it.last = 0; } }
  const kick = () => { if (reduce) { it.p = it.target; it.ang = it.tang; draw(); return; } if (!it.raf) { it.last = 0; it.raf = requestAnimationFrame(tick); } };
  el.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse' && effect !== 'follow') { it.target = 1; kick(); } });
  el.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') { if (effect === 'follow') it.tang = 0; else it.target = 0; kick(); } });
  el.addEventListener('pointermove', ev => { if (effect !== 'follow') return; const r = el.querySelector('svg').getBoundingClientRect(); it.tang = Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)); kick(); });
  el.addEventListener('click', ev => { if (effect === 'follow' || (matchMedia('(hover: hover)').matches && ev.detail !== 0)) return; it.target = it.target ? 0 : 1; kick(); });
  draw(); return { setDark(v) { dark = v; draw(); }, setEffect(v) { effect = v; it.p = it.target = 0; draw(); } };
}
