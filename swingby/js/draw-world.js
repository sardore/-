/* 월드 요소 그리기: 행성(종류별)·블랙홀·별·갈림길 안내·기체와 차지 연출 */
import { G, g } from './state.js';
import { TAU, clamp, easeOut } from './util.js';
import { BIOMES, BOSSES } from './data.js';
import { drawShip, SHIP_SC } from './ship-art.js';
import { maxOrbit, o2max, fs } from './stats.js';
import { viewTop, viewBot } from './camera.js';
import { txt, GFX } from './gfx.js';
import { flameColor } from './heat.js';
import { cfg, shipDef, shipOpts, glowOf, heatHsl, hslOf } from './cos.js';
import { ringPath } from './land-fx.js';
import { drawCharge } from './charge-fx.js';
import { drawMonster } from './draw-monster.js';
import { drawPlanet } from './draw-planet.js';
import { drawSpecialGuide } from './draw-special.js';
import { drawPlanet2 } from './draw-planet2.js';
import { drawTrail2, drawFxLayers2, drawStar2, drawCoin } from './draw-fx2.js';


function drawHole(h) {
  const T = G.T, hg = g.createRadialGradient(h.x, h.y, h.r * .6, h.x, h.y, h.r * 2.6);
  hg.addColorStop(0, 'rgba(170,90,255,.55)'); hg.addColorStop(1, 'rgba(170,90,255,0)');
  g.fillStyle = hg; g.beginPath(); g.arc(h.x, h.y, h.r * 2.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(220,170,255,.9)'; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(h.x, h.y, h.r + 3, T * 3 + k * TAU / 3, T * 3 + k * TAU / 3 + 1.2); g.stroke(); }
  g.fillStyle = '#000'; g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill();
}
/** 별(수집품) v1 */
function drawStar(t) {
  const r = 5 + 1.5 * Math.sin(G.T * 5 + t.ph);
  g.fillStyle = '#ffe27a'; g.beginPath();
  g.moveTo(t.x, t.y - r); g.lineTo(t.x + r * .35, t.y - r * .35); g.lineTo(t.x + r, t.y); g.lineTo(t.x + r * .35, t.y + r * .35);
  g.lineTo(t.x, t.y + r); g.lineTo(t.x - r * .35, t.y + r * .35); g.lineTo(t.x - r, t.y); g.lineTo(t.x - r * .35, t.y - r * .35); g.closePath(); g.fill();
}

/** 화면에 보이는 월드 요소 전부 */
export function drawWorld() {
  const top = viewTop(), bot = viewBot(), v2 = GFX.v >= 2, dp = v2 ? drawPlanet2 : drawPlanet, ds = v2 ? drawStar2 : drawStar;
  for (const p of G.planets) if (p.sp && p.y > top - 260 && p.y < bot + 260) drawSpecialGuide(p);
  for (const p of G.planets) { if (p.y < top - 140 || p.y > bot + 140) continue; if (p.fa < 1) g.globalAlpha = p.fa; dp(p); g.globalAlpha = 1; }
  drawForkGuides();
  for (const m of G.mons) { if (m.y < top - 100 || m.y > bot + 100) continue; drawMonster(m); }
  for (const h of G.holes) { if (h.y < top - 60 || h.y > bot + 60) continue; drawHole(h); }
  for (const t of G.stars) { if (t.got || t.y < top - 30 || t.y > bot + 30) continue; ds(t); }
}

/** 갈림길: 좌/우 항로의 점선 경로와 라벨(바이옴 · 다음 보스) */
function drawForkGuides() {
  const F = G.fork; if (!F || F.state !== 'hub' || !F.active) return;
  const T = G.T;
  for (const side of ['L', 'R']) {
    const br = F.branches[side], bm = BIOMES[br.biome], [p0, p1] = br.planets;
    g.setLineDash([6, 9]); g.lineDashOffset = -T * 20; g.strokeStyle = bm.c; g.globalAlpha = .35; g.lineWidth = 2;
    g.beginPath(); g.moveTo(F.hub.x, F.hub.y); g.lineTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    const y = p1.y - p1.R - 46, x = clamp((p0.x + p1.x) / 2, 76, G.w - 76);
    txt(bm.n, x, y, 21, bm.c, 'center', 900);
    txt('▶ ' + (br.bi < 0 ? '미지의 별' : BOSSES[br.bi].n), x, y + 21, 15, 'rgba(255,255,255,.85)', 'center', 700);
  }
}

/** 기체: 궤도선, 진행 방향 점선, 꼬리, 잔상, 차지 연출, 본체, 추진기 방패, 산소 막대 */
export function drawPlayer() {
  const s = G.ship, T = G.T, c = cfg(), def = shipDef(), opts = shipOpts(c, def, T);
  let hx, hy;
  if (s.mode === 'orb') {
    const p = s.p, ratio = (s.r - p.R) / (maxOrbit(p) - p.R), danger = !G.boss && ratio < .38;
    g.strokeStyle = danger ? 'rgba(255,90,90,' + (.5 + .4 * Math.sin(T * 18)) + ')' : 'rgba(255,255,255,.2)'; g.lineWidth = danger ? 2 : 1;
    g.beginPath(); g.arc(p.x, p.y, s.r, 0, TAU); g.stroke();
    hx = -Math.sin(s.a) * s.dir; hy = Math.cos(s.a) * s.dir;
    g.setLineDash([3, 8]); g.strokeStyle = s.charging ? 'hsla(' + def.L.h + ',100%,75%,' + (.5 + .5 * s.charge) + ')' : 'rgba(255,255,255,.5)'; g.lineWidth = s.charging ? 1.5 + 2 * s.charge : 1.5;
    const len = 230 * (1 + (s.charging ? def.dash * s.charge * .9 : 0));
    g.beginPath(); g.moveTo(s.x + hx * 12, s.y + hy * 12); g.lineTo(s.x + hx * len, s.y + hy * len); g.stroke(); g.setLineDash([]);
  } else { const m = Math.hypot(s.vx, s.vy) || 1; hx = s.vx / m; hy = s.vy / m; }
  // 꼬리
  const tr = s.trail;
  if (GFX.v >= 2) drawTrail2(s, def, c.trail);
  else for (let i = 2; i < tr.length; i += 2) {
    g.strokeStyle = hslOf(c.trail, def.L.h, T, 72, i / tr.length * .7); g.lineWidth = 1 + i / tr.length * (s.mode === 'free' ? 5 : 3) * (1 + (s.boost - 1) * .8 + s.heat * .15);
    g.beginPath(); g.moveTo(tr[i - 2], tr[i - 1]); g.lineTo(tr[i], tr[i + 1]); g.stroke();
  }
  // 돌격 잔상
  for (const gh of s.ghosts) {
    g.save(); g.translate(gh.x, gh.y); g.rotate(gh.a); g.globalAlpha = (1 - gh.t / .32) * .4;
    g.drawImage(ghostSprite(def, opts, fs()), -GR, -GR, GR * 2, GR * 2); g.restore();
  }
  g.globalAlpha = 1;
  if (s.heat) drawFlames(s, hx, hy);
  if (!(s.inv > 0 && Math.floor(T * 20) % 2)) {
    const em = (1 + .9 * s.evoT * s.evoT) * fs(), jit = s.charging ? s.charge * 1.6 : 0;
    g.save(); g.translate(s.x + (jit ? (Math.random() - .5) * jit * 2 : 0), s.y + (jit ? (Math.random() - .5) * jit * 2 : 0)); g.rotate(Math.atan2(hy, hx));
    const gl = glowOf(c, def, s.mode === 'free', T);   // 기본 글로우는 약하고, 상점 상품으로 강해진다
    if (gl.aura) drawAura(gl.col, T, (14 + 12 * SHIP_SC[G.tier]) * fs());
    g.shadowColor = gl.col; g.shadowBlur = gl.blur + s.evoT * 30 + (s.charging ? 24 * s.charge : 0) + (s.boost > 1.2 ? 14 : 0) + s.heat * 6;
    drawShip(g, def, s.mode === 'free' ? 1 : s.charging ? .3 + .7 * s.charge : .3, T, em, opts); g.restore();
  }
  if (s.charging) drawChargeRing(s, def);
  if (G.stats.shield > 0) { g.strokeStyle = 'rgba(255,157,122,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(s.x, s.y, (8 + 8 * SHIP_SC[G.tier]) * fs(), 0, TAU); g.stroke(); }
  if (s.mode === 'free' && G.st === 'play' && !G.boss) { // 비행 중 남은 산소
    const f = clamp(1 - s.air / o2max(), 0, 1);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(s.x - 16, s.y + 16, 32, 3);
    g.fillStyle = f < .3 ? '#ff6a6a' : '#b8a8ff'; g.fillRect(s.x - 16, s.y + 16, 32 * f, 3);
  }
}

/** 글로우 '강': 기체를 감싸는 맥동 후광 (기체 좌표계 안에서 그린다) */
export function drawAura(col, T, size) {
  const r = size * (1 + .08 * Math.sin(T * 3.4)), gr = g.createRadialGradient(0, 0, 2, 0, 0, r);
  gr.addColorStop(0, col.replace('hsl(', 'hsla(').replace(')', ',.35)')); gr.addColorStop(1, col.replace('hsl(', 'hsla(').replace(')', ',0)'));
  g.save(); g.shadowBlur = 0; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
}

/** 열기: 기체 뒤로 기체색 불꽃 혀가 일렁인다. 단계가 오를수록 길고 많아진다 */
function drawFlames(s, hx, hy) {
  const h = s.heat, T = G.T, n = 2 + h;
  g.save(); g.translate(s.x, s.y); g.rotate(Math.atan2(-hy, -hx)); // +x 방향이 뒤쪽
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1) - .5, fl = .75 + .25 * Math.sin(T * 26 + i * 2.1), L = (16 + h * 11) * fl * (1 - Math.abs(f) * .7), wd = 4 + h * .9 - Math.abs(f) * 3;
    const gr = g.createLinearGradient(4, 0, 4 + L, f * 14);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.25, flameColor(72)); gr.addColorStop(.7, flameColor(52)); gr.addColorStop(1, heatHsl(45, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(3, -wd); g.quadraticCurveTo(4 + L * .5, f * 12 - wd * .6, 4 + L, f * 16); g.quadraticCurveTo(4 + L * .5, f * 12 + wd * .6, 3, wd); g.closePath(); g.fill();
  }
  const ag = g.createRadialGradient(0, 0, 2, 0, 0, 22 + h * 5);
  ag.addColorStop(0, heatHsl(65, .25 + h * .07)); ag.addColorStop(1, heatHsl(55, 0));
  g.fillStyle = ag; g.beginPath(); g.arc(0, 0, 22 + h * 5, 0, TAU); g.fill();
  g.restore();
}

/** 차지: 기체 둘레의 충전 링 (디자인·색은 상점에서 바꾼다 — charge-fx.js) */
/** 돌격 잔상용 스프라이트: 기체를 한 번만 불투명하게 그려 두고 잔상마다 한 장으로 반투명하게 얹는다.
 * (부품마다 반투명으로 겹쳐 그리면 겹친 곳이 거의 불투명해져 부자연스럽다 — 부품이 많은 고단계 기체일수록 심했다) */
const ghostCache = new Map(), GR = 80;
function ghostSprite(def, opts, k) {
  const key = def.id + '|' + k.toFixed(2) + '|' + def.L.h + '|' + (opts.fh == null ? '' : opts.fh) + (opts.nobay ? 'n' : '') + (opts.art || '');
  let sp = ghostCache.get(key); if (sp) return sp;
  const cv = document.createElement('canvas'); cv.width = cv.height = GR * 4;
  const c = cv.getContext('2d'); c.scale(2, 2); c.translate(GR, GR);
  c.shadowColor = 'hsl(' + def.L.h + ',100%,70%)'; c.shadowBlur = 8; drawShip(c, def, 1, 1, k, opts);
  ghostCache.set(key, cv); if (ghostCache.size > 48) ghostCache.delete(ghostCache.keys().next().value);
  return cv;
}
const drawChargeRing = (s, def) => drawCharge(s.x, s.y, cfg(), def.L.h, s.charge, G.T);

/** 파티클·링·떠오르는 글자 */
export function drawFx() {
  if (GFX.v >= 2) drawFxLayers2();
  else {
    for (const f of G.fxr) {
      if (f.t < 0) continue;
      const k = f.t / f.dur, r = f.r0 + (f.r1 - f.r0) * easeOut(k);
      g.globalAlpha = 1 - k; g.strokeStyle = f.c; g.lineWidth = f.w * (1 - k * .6); ringPath(g, f, r); g.stroke();
    }
    for (const p of G.parts) {
      g.globalAlpha = 1 - p.t / p.l;
      if (p.coin) drawCoin(p, 1 - p.t / p.l);
      else if (p.line) { g.strokeStyle = p.c; g.lineWidth = p.s * .6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); g.stroke(); }
      else { g.fillStyle = p.c; const sz = p.s || 3; g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz); }
    }
  }
  for (const t of G.texts) {
    const pop = t.t < .12 ? 1 + (1 - t.t / .12) * .5 : 1;
    g.globalAlpha = 1 - t.t * t.t; txt(t.s, clamp(t.x, 60, G.w - 60), t.y - t.t * 42, (t.sz || 15) * pop, t.c);
  }
  g.globalAlpha = 1;
}
