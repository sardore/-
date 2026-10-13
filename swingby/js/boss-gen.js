/* 무한 모드 보스의 외형: 기존 보스 그림을 재활용하지 않고, 부품(몸 윤곽·표면 무늬·핵·코로나·고리·위성·제트·껍질 조각)을 무작위로 조합해 그린다.
 * genLook() 이 외형 명세(JSON 으로 표현 가능한 값들)를 만들고, drawGen() 이 매 프레임 그린다. 표정·눈 같은 괴물 요소는 쓰지 않는다. */
import { G, g } from './state.js';
import { PI, TAU, rnd, rint, pickOf, shuffle } from './util.js';

const hsl = (h, s, l, a = 1) => 'hsla(' + (((h % 360) + 360) % 360).toFixed(0) + ',' + s + '%,' + l + '%,' + a + ')';
const chance = p => Math.random() < p;
const mod = (a, k) => ((a % k) + k) % k;

/* ---------- 명세 만들기 ---------- */
const SHAPES = ['circle', 'poly', 'poly', 'star', 'star', 'blob', 'gear', 'squircle', 'petal', 'ellipse', 'multi', 'multi', 'shard'];
const PATTERNS = ['bands', 'cells', 'spots', 'lattice', 'rays', 'concentric', 'cracks', 'swirl', 'dots', 'none'];
const CORES = ['glow', 'glow', 'diamond', 'glint', 'cross', 'none'];   // 눈처럼 보이는 고리·구멍 핵은 쓰지 않는다
const SCHEMES = { mono: [0, 0], analog: [28, -28], comp: [180, 160], triad: [120, 240], split: [150, 210] };

function genShape() {
  const t = pickOf(SHAPES), s = { t, spin: rnd(-.5, .5) };
  if (t === 'poly') { s.n = rint(3, 9); s.round = chance(.4) ? rnd(.2, .6) : 0; }
  else if (t === 'star') { s.n = rint(4, 12); s.k = rnd(.4, .8); s.p = rnd(.6, 1.5); }
  else if (t === 'blob') { s.w = [0, 1, 2].map(() => ({ m: rint(2, 7), a: rnd(.03, .07), ph: rnd(0, TAU), v: rnd(-1, 1) })); }
  else if (t === 'gear') { s.n = rint(6, 16); s.d = rnd(.1, .22); }
  else if (t === 'squircle') s.p = rnd(2.8, 6);
  else if (t === 'petal') { s.n = rint(3, 8); s.d = rnd(.25, .5); }
  else if (t === 'ellipse') s.b = rnd(.5, .82);
  else if (t === 'multi') { s.m = rint(2, 4); s.sub = pickOf(['circle', 'circle', 'poly', 'star']); s.n = rint(3, 7); s.k = rnd(.5, .75); s.sp = rnd(.25, .6) * (chance(.5) ? 1 : -1); }
  else if (t === 'shard') s.pts = Array.from({ length: rint(5, 9) }, (_, i) => rnd(.72, 1));
  return s;
}
function genPattern() {
  const t = pickOf(PATTERNS), p = { t, n: rint(3, 9), ang: rnd(0, PI), sp: rnd(-1, 1), gap: rnd(.28, .5), tw: rnd(1.5, 4.5), acc: chance(.5) ? 0 : 1 };
  p.arr = Array.from({ length: 14 }, () => [rnd(0, TAU), rnd(.1, .85), rnd(.07, .22), rnd(-1, 1), rnd(0, PI), chance(.5) ? 1 : 0]);
  p.cracks = Array.from({ length: rint(3, 6) }, () => { const a = rnd(0, TAU), pts = [[0, 0]]; let x = 0, y = 0, aa = a; for (let i = 0; i < 4; i++) { aa += rnd(-.7, .7); x += Math.cos(aa) * rnd(.15, .3); y += Math.sin(aa) * rnd(.15, .3); pts.push([x, y]); } return pts; });
  return p;
}
const pickCore = () => pickOf(CORES);
/** 새 보스의 외형 명세 */
export function genLook() {
  const h = rint(0, 359), sch = SCHEMES[pickOf(Object.keys(SCHEMES))], dark = chance(.22);
  const L = { pal: { h, a: [h + sch[0], h + sch[1]], s: rint(62, 100), dark }, shape: genShape(), pat: genPattern(), core: pickCore(), coreSp: rnd(.5, 2) };
  L.rays = chance(.55) ? { n: rint(6, 22), len: rnd(.18, .7), w: rnd(2, 6), sp: rnd(-.5, .5), tri: chance(.5), pulse: rnd(.5, 3) } : null;
  L.blades = !L.rays && chance(.35) ? { n: rint(3, 8), len: rnd(.35, .7), sw: rnd(.3, .9), sp: rnd(.4, 1.2) * (chance(.5) ? 1 : -1) } : null;
  L.rings = Array.from({ length: pickOf([0, 0, 1, 1, 2, 3]) }, () => ({ r: rnd(1.3, 2.1), ry: rnd(.15, .5), tilt: rnd(-.7, .7), w: rnd(2, 8), dash: chance(.35) ? [rnd(4, 14), rnd(4, 12)] : null, acc: rint(0, 1), sp: rnd(-1, 1) }));
  L.orbs = Array.from({ length: pickOf([0, 0, 1, 2, 3, 4, 6]) }, () => ({ r: rnd(.06, .16), o: rnd(1.25, 2.1), sq: rnd(.35, 1), sp: rnd(.4, 1.6) * (chance(.5) ? 1 : -1), ph: rnd(0, TAU), tilt: rnd(-.8, .8), sh: pickOf(['disc', 'disc', 'square', 'tri', 'diamond']), acc: rint(0, 1) }));
  L.arcs = chance(.4) ? Array.from({ length: rint(2, 5) }, () => ({ r: rnd(1.12, 1.5), a0: rnd(0, TAU), len: rnd(.5, 1.5), w: rnd(3, 7), sp: rnd(-.8, .8), acc: rint(0, 1) })) : [];
  L.frames = chance(.3) ? Array.from({ length: rint(1, 2) }, () => ({ n: rint(3, 8), r: rnd(1.2, 1.6), sp: rnd(-.6, .6), acc: rint(0, 1) })) : [];
  L.jets = chance(.2) ? { ang: rnd(0, PI), len: rnd(2.2, 3.6), w: rnd(.2, .42) } : null;
  L.halo = chance(.3) ? { r: rnd(1.25, 1.55), dash: [rnd(3, 9), rnd(5, 14)], sp: rnd(-1, 1) } : null;
  return L;
}

/* ---------- 윤곽 ---------- */
/** 각도 a 에서의 몸 반지름 비율(최대 약 1) */
function rho(s, a, t) {
  switch (s.t) {
    case 'poly': { const k = TAU / s.n, u = mod(a, k) - k / 2, p = Math.cos(PI / s.n) / Math.cos(u); return p + (1 - p) * s.round; }
    case 'star': { const k = TAU / s.n, u = Math.abs(mod(a, k) / k - .5) * 2; return 1 - (1 - s.k) * Math.pow(u, s.p); }
    case 'blob': { let v = .9; for (const w of s.w) v += w.a * Math.sin(w.m * a + w.ph + t * w.v); return v; }
    case 'gear': { const q = Math.sin(a * s.n); return 1 - s.d / (1 + Math.exp(-q * 5)); }
    case 'squircle': { const c = Math.abs(Math.cos(a)), n = Math.abs(Math.sin(a)); return Math.pow(Math.pow(c, s.p) + Math.pow(n, s.p), -1 / s.p) / Math.pow(2, 1 / 2 - 1 / s.p) * 1; }
    case 'petal': return 1 - s.d + s.d * Math.abs(Math.cos(s.n * a / 2));
    case 'ellipse': { const c = Math.cos(a), n = Math.sin(a); return 1 / Math.sqrt(c * c + n * n / (s.b * s.b)); }
    case 'shard': { const k = s.pts.length, f = mod(a, TAU) / TAU * k, i = Math.floor(f), u = f - i; return s.pts[i % k] * (1 - u) + s.pts[(i + 1) % k] * u; }
    default: return 1;
  }
}
function trace(s, R, rot, t) {
  g.beginPath();
  const N = s.t === 'circle' ? 40 : 128;
  for (let i = 0; i <= N; i++) { const a = i / N * TAU, r = R * rho(s, a - rot, t); i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath();
}

/* ---------- 표면 무늬 (몸 안쪽으로 클립된 상태에서 그린다) ---------- */
function pattern(p, R, ac, t) {
  const c = (l, a) => hsl(ac, 90, l, a);
  switch (p.t) {
    case 'bands': {
      g.save(); g.rotate(p.ang); const bw = R * 2 / p.n / 1.0, off = mod(t * p.sp * R * .12, bw * 2);
      for (let i = -p.n - 2; i <= p.n + 2; i++) { g.fillStyle = i % 2 ? c(75, .26) : 'rgba(0,0,0,.22)'; g.fillRect(-R * 1.3, i * bw + off, R * 2.6, bw * (i % 3 ? .8 : .45)); }
      g.restore(); break;
    }
    case 'cells': for (const [a, r, s, w] of p.arr) { g.fillStyle = c(76, .3); g.beginPath(); g.arc(Math.cos(a + t * w * .3) * r * R, Math.sin(a + t * w * .3) * r * R * .9, s * R * 1.1, 0, TAU); g.fill(); } break;
    case 'spots': for (const [a, r, s, w, rot, dk] of p.arr.slice(0, 7)) { g.fillStyle = dk ? 'rgba(0,0,0,.3)' : c(80, .3); g.beginPath(); g.ellipse(Math.cos(a) * r * R, Math.sin(a) * r * R, s * R * 1.5, s * R * .8, rot + t * w * .1, 0, TAU); g.fill(); } break;
    case 'lattice': {
      g.save(); g.rotate(p.ang + t * p.sp * .1); g.strokeStyle = c(82, .32); g.lineWidth = 1.6; const gap = R * p.gap, off = mod(t * 6, gap);
      for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(-R * 1.3, i * gap + off); g.lineTo(R * 1.3, i * gap + off); g.stroke(); g.beginPath(); g.moveTo(i * gap + off, -R * 1.3); g.lineTo(i * gap + off, R * 1.3); g.stroke(); }
      g.restore(); break;
    }
    case 'rays': {
      const n = p.n * 2, k = TAU / n; g.fillStyle = c(78, .2);
      for (let i = 0; i < n; i += 2) { const a = i * k + t * p.sp * .4; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * 1.2, a, a + k); g.closePath(); g.fill(); }
      break;
    }
    case 'concentric': {
      g.strokeStyle = c(80, .35); g.lineWidth = 2.2;
      for (let i = 1; i <= p.n; i++) { g.setLineDash(i % 2 ? [] : [8, 7]); g.lineDashOffset = -t * 14 * p.sp * (i % 2 ? 1 : -1); g.beginPath(); g.arc(0, 0, R * i / (p.n + .5), 0, TAU); g.stroke(); }
      g.setLineDash([]); break;
    }
    case 'cracks': {
      g.save(); g.rotate(t * p.sp * .1); g.strokeStyle = c(78, .55 + .3 * Math.sin(t * 2.2)); g.lineWidth = 2.4; g.lineJoin = 'round';
      for (const pl of p.cracks) { g.beginPath(); pl.forEach(([x, y], i) => i ? g.lineTo(x * R * 1.2, y * R * 1.2) : g.moveTo(0, 0)); g.stroke(); }
      g.restore(); break;
    }
    case 'swirl': {
      g.strokeStyle = c(80, .34); g.lineWidth = Math.max(3, R * .08); const arms = Math.max(2, p.n % 5);
      for (let k = 0; k < arms; k++) { g.beginPath(); for (let i = 0; i <= 24; i++) { const f = i / 24, a = k / arms * TAU + f * p.tw + t * p.sp * .8; i ? g.lineTo(Math.cos(a) * f * R * 1.1, Math.sin(a) * f * R * 1.1) : g.moveTo(0, 0); } g.stroke(); }
      break;
    }
    case 'dots': {
      g.save(); g.rotate(p.ang + t * p.sp * .15); g.fillStyle = c(84, .42); const gap = R * (.22 + p.gap * .3);
      for (let x = -R; x <= R; x += gap) for (let y = -R; y <= R; y += gap) { g.beginPath(); g.arc(x, y, R * .035, 0, TAU); g.fill(); }
      g.restore(); break;
    }
  }
}
/** 핵 */
function core(kind, R, ac, t, sp) {
  const pul = .5 + .5 * Math.sin(t * sp * 3);
  if (kind === 'glow') { const r = R * (.5 + .1 * pul), gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.4, hsl(ac, 100, 78, .55)); gr.addColorStop(1, hsl(ac, 100, 60, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }
  else if (kind === 'diamond') { g.save(); g.rotate(t * sp * .6); const r = R * .3; g.fillStyle = hsl(ac, 100, 85, .35 + .2 * pul); g.strokeStyle = hsl(ac, 100, 88, .9); g.lineWidth = 2.5; g.beginPath(); g.rect(-r, -r, r * 2, r * 2); g.fill(); g.stroke(); g.restore(); }
  else if (kind === 'cross') { g.save(); g.rotate(t * sp * .5); g.fillStyle = hsl(ac, 100, 88, .85); const l = R * (.5 + .08 * pul), w = R * .07; g.fillRect(-l, -w, l * 2, w * 2); g.fillRect(-w, -l, w * 2, l * 2); g.restore(); }
  else if (kind === 'glint') { const r = R * (.42 + .08 * pul); g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * .16, -r * .16); g.lineTo(r, 0); g.lineTo(r * .16, r * .16); g.lineTo(0, r); g.lineTo(-r * .16, r * .16); g.lineTo(-r, 0); g.lineTo(-r * .16, -r * .16); g.closePath(); g.fill(); }
}

/** 몸 하나(또는 다체 구성의 한 덩이) */
function unit(L, s, R, t, ac) {
  const P = L.pal, rot = t * s.spin * .5;
  const gr = g.createRadialGradient(-R * .3, -R * .35, R * .1, 0, 0, R * 1.05);
  if (P.dark) { gr.addColorStop(0, hsl(P.h, 40, 16)); gr.addColorStop(.7, hsl(P.h, 50, 7)); gr.addColorStop(1, hsl(P.h, 60, 3)); }
  else { gr.addColorStop(0, hsl(P.h, P.s, 90)); gr.addColorStop(.5, hsl(P.h, P.s, 58)); gr.addColorStop(1, hsl(P.h, P.s - 8, 20)); }
  trace(s, R, rot, t); g.fillStyle = gr; g.fill();
  g.save(); g.clip(); pattern(L.pat, R, ac, t); core(L.core, R, ac, t, L.coreSp);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(R * .4, R * .45, R * 1.1, 0, TAU); g.arc(0, 0, R * 1.3, 0, TAU, true); g.fill(); g.restore();
  trace(s, R, rot, t); g.strokeStyle = P.dark ? hsl(ac, 100, 70, .9) : 'rgba(255,255,255,.4)'; g.lineWidth = P.dark ? 3 : 2; g.stroke();
}
const poly = (n, r, a0) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };

/** 보스 몸을 그린다 (보스 중심 기준 좌표) */
export function drawGen(b) {
  const L = b.d.look, R = b.R, t = G.T, P = L.pal, acs = [P.h, ...P.a], ac = i => acs[1 + (i | 0)] ;
  const A0 = ac(0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // --- 뒤쪽 층: 제트·코로나·날개·고리 뒤쪽 절반 ---
  if (L.jets) for (const sg of [-1, 1]) { g.save(); g.rotate(L.jets.ang + PI / 2); const jl = g.createLinearGradient(0, 0, 0, sg * R * L.jets.len), w = R * L.jets.w * (1 + .15 * Math.sin(t * 6)); jl.addColorStop(0, hsl(A0, 100, 82, .7)); jl.addColorStop(1, hsl(A0, 100, 62, 0)); g.fillStyle = jl; g.beginPath(); g.moveTo(-R * .12, 0); g.lineTo(R * .12, 0); g.lineTo(w, sg * R * L.jets.len); g.lineTo(-w, sg * R * L.jets.len); g.closePath(); g.fill(); g.restore(); }
  if (L.halo) { g.strokeStyle = hsl(A0, 100, 80, .5); g.lineWidth = 2; g.setLineDash(L.halo.dash); g.lineDashOffset = -t * 20 * L.halo.sp; g.beginPath(); g.arc(0, 0, R * L.halo.r, 0, TAU); g.stroke(); g.setLineDash([]); }
  if (L.rays) { const r = L.rays; for (let i = 0; i < r.n; i++) { const a = i / r.n * TAU + t * r.sp, len = R * (1 + r.len * (.7 + .3 * Math.sin(t * r.pulse + i * 1.7))); g.fillStyle = g.strokeStyle = hsl(P.h, 100, 72, .6); if (r.tri) { g.beginPath(); g.moveTo(Math.cos(a - .09) * R * .95, Math.sin(a - .09) * R * .95); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.lineTo(Math.cos(a + .09) * R * .95, Math.sin(a + .09) * R * .95); g.closePath(); g.fill(); } else { g.lineWidth = r.w; g.beginPath(); g.moveTo(Math.cos(a) * R * .95, Math.sin(a) * R * .95); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke(); } } }
  if (L.blades) { const bl = L.blades; g.fillStyle = hsl(A0, 90, 60, .75); for (let i = 0; i < bl.n; i++) { const a = i / bl.n * TAU + t * bl.sp, r1 = R * .9, r2 = R * (1 + bl.len); g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.quadraticCurveTo(Math.cos(a + bl.sw * .6) * r2 * .98, Math.sin(a + bl.sw * .6) * r2 * .98, Math.cos(a + bl.sw) * r2, Math.sin(a + bl.sw) * r2); g.lineTo(Math.cos(a + .25) * r1, Math.sin(a + .25) * r1); g.closePath(); g.fill(); } }
  const ringArc = (rg, a0, a1) => { g.save(); g.rotate(rg.tilt); g.strokeStyle = hsl(ac(rg.acc), 90, 72, .8); g.lineWidth = rg.w; if (rg.dash) { g.setLineDash(rg.dash); g.lineDashOffset = -t * 18 * rg.sp; } g.beginPath(); g.ellipse(0, 0, R * rg.r, R * rg.r * rg.ry * 2, 0, a0, a1); g.stroke(); g.setLineDash([]); g.restore(); };
  for (const rg of L.rings) ringArc(rg, PI, TAU);
  // --- 몸 ---
  const s = L.shape;
  if (s.t === 'multi') {
    const m = s.m, r = R * (m === 2 ? .52 : m === 3 ? .46 : .4), d = R - r;
    for (let i = 0; i < m; i++) { const a = i / m * TAU + t * s.sp; g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); unit(L, s.sub === 'circle' ? { t: 'circle', spin: 0 } : s.sub === 'poly' ? { t: 'poly', n: s.n, round: .15, spin: s.sp } : { t: 'star', n: s.n + 2, k: s.k, p: 1, spin: s.sp }, r, t, A0); g.restore(); }
  } else unit(L, s, R, t, A0);
  // --- 앞쪽 층 ---
  for (const rg of L.rings) ringArc(rg, 0, PI);
  for (const a of L.arcs) { g.strokeStyle = hsl(ac(a.acc), 95, 70, .85); g.lineWidth = a.w; const a0 = a.a0 + t * a.sp; g.beginPath(); g.arc(0, 0, R * a.r, a0, a0 + a.len); g.stroke(); }
  for (const f of L.frames) { g.save(); g.rotate(t * f.sp); g.strokeStyle = hsl(ac(f.acc), 95, 74, .6); g.lineWidth = 2.2; poly(f.n, R * f.r, 0); g.stroke(); g.restore(); }
  for (const o of L.orbs) {
    const a = o.ph + t * o.sp, x0 = Math.cos(a) * R * o.o, y0 = Math.sin(a) * R * o.o * o.sq, ct = Math.cos(o.tilt), st = Math.sin(o.tilt), x = x0 * ct - y0 * st, y = x0 * st + y0 * ct, r = R * o.r;
    g.strokeStyle = hsl(ac(o.acc), 90, 70, .25); g.lineWidth = r * .8; g.beginPath();
    for (let i = 0; i < 7; i++) { const aa = a - i * .09 * Math.sign(o.sp), px = Math.cos(aa) * R * o.o, py = Math.sin(aa) * R * o.o * o.sq; i ? g.lineTo(px * ct - py * st, px * st + py * ct) : g.moveTo(px * ct - py * st, px * st + py * ct); }
    g.stroke(); g.fillStyle = hsl(ac(o.acc), 95, 75, .95); g.beginPath();
    if (o.sh === 'disc') g.arc(x, y, r, 0, TAU); else if (o.sh === 'square') g.rect(x - r, y - r, r * 2, r * 2); else if (o.sh === 'tri') { g.moveTo(x, y - r * 1.3); g.lineTo(x + r * 1.1, y + r * .8); g.lineTo(x - r * 1.1, y + r * .8); g.closePath(); } else { g.moveTo(x, y - r * 1.3); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.3); g.lineTo(x - r, y); g.closePath(); }
    g.fill();
  }
  g.lineCap = 'butt';
}
