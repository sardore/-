/* 월드 요소 그리기: 행성(종류별)·블랙홀·별·갈림길 안내·기체와 차지 연출 */
import { G, g } from './state.js';
import { PI, TAU, clamp, easeOut } from './util.js';
import { BIOMES, BOSSES } from './data.js';
import { SHIPS } from './ships.js';
import { drawShip, SHIP_SC } from './ship-art.js';
import { capOf, maxOrbit, o2max, fs } from './stats.js';
import { viewTop, viewBot } from './camera.js';
import { txt } from './gfx.js';
import { flameColor } from './heat.js';
import { drawMonster } from './draw-monster.js';

/** 행성마다 고정된 의사난수(0~1): 크레이터·균열 모양에 쓴다 */
const hash = (p, i) => { const x = Math.sin(p.ph * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };

export function drawPlanet(p) {
  const s = G.ship, cur = s.mode === 'orb' && s.p === p, cr = capOf(p), T = G.T;
  if (p.dead) {
    if (p.gone) return;
    g.setLineDash([3, 9]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,140,120,' + (.25 + .15 * Math.sin(T * 6)) + ')'; g.beginPath(); g.arc(p.x, p.y, p.R + 8, 0, TAU); g.stroke(); g.setLineDash([]);
    txt(String(Math.max(1, p.re)), p.x, p.y + 6, 16, 'rgba(255,170,150,.8)', 'center', 800); return;
  }
  const sc = easeOut(p.born) * (1 + .12 * Math.sin(p.sq * PI * 2) * p.sq), R = p.R * sc;
  // 포획 범위
  g.setLineDash([5, 7]); g.lineDashOffset = -T * 14; g.lineWidth = p.t === 'm' ? 2 : 1.5;
  g.strokeStyle = 'hsla(' + p.hue + ',85%,70%,' + ((cur ? .55 : p.seen ? .16 : .34) + p.pulse * .4) + ')';
  g.beginPath(); g.arc(p.x, p.y, cr, 0, TAU); g.stroke(); g.setLineDash([]);
  // 빛무리
  const gl = g.createRadialGradient(p.x, p.y, R * .6, p.x, p.y, R * 2.1);
  gl.addColorStop(0, 'hsla(' + p.hue + ',90%,60%,' + ((p.t === 'm' ? .2 : .35) + p.pulse * .4) + ')'); gl.addColorStop(1, 'hsla(' + p.hue + ',90%,60%,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, R * 2.1, 0, TAU); g.fill();
  // 본체
  const sat = p.t === 'm' ? 38 : p.t === 'a' ? 30 : 70;
  const bd = g.createRadialGradient(p.x - R * .35, p.y - R * .4, R * .1, p.x, p.y, R);
  bd.addColorStop(0, 'hsl(' + p.hue + ',' + (p.t === 'm' ? 45 : p.t === 'a' ? 40 : 85) + '%,' + (p.t === 'm' ? 66 : 78) + '%)'); bd.addColorStop(.6, 'hsl(' + p.hue + ',' + sat + '%,' + (p.t === 'm' ? 38 : 48) + '%)'); bd.addColorStop(1, 'hsl(' + (p.hue + 20) + ',' + (sat - 10) + '%,20%)');
  g.fillStyle = bd; g.beginPath();
  if (p.t === 'a') { // 울퉁불퉁한 소행성 외곽
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = R * (.78 + .34 * hash(p, i)); i ? g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : g.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    g.closePath();
  } else g.arc(p.x, p.y, R, 0, TAU);
  g.fill();
  if (p.t === 'a') { // 균열: 떠나면 부서진다는 표시
    g.strokeStyle = 'rgba(255,235,200,.55)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(p.x - R * .5, p.y - R * .3); g.lineTo(p.x, p.y + R * .05); g.lineTo(p.x + R * .45, p.y - R * .35); g.moveTo(p.x, p.y + R * .05); g.lineTo(p.x + R * .1, p.y + R * .6); g.stroke();
  }
  if (p.t === 'm') drawCraters(p, R);
  if (p.t === 'g') { g.strokeStyle = 'hsla(' + p.hue + ',80%,80%,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y, R * 1.55, R * .38, -.35, 0, TAU); g.stroke(); }
  if (p.t === 'r') { g.strokeStyle = 'rgba(255,120,90,' + (.35 + .3 * Math.sin(T * 9 + p.ph)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, R + 4 + 2 * Math.sin(T * 9 + p.ph), 0, TAU); g.stroke(); }
}
function drawCraters(p, R) {
  g.save(); g.beginPath(); g.arc(p.x, p.y, R, 0, TAU); g.clip();
  for (let i = 0; i < 9; i++) {
    const a = hash(p, i) * TAU, d = Math.sqrt(hash(p, i + 20)) * R * .82, r = R * (.07 + .11 * hash(p, i + 40)), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    g.fillStyle = 'rgba(30,14,6,.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,225,190,.3)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x - r * .12, y - r * .12, r, PI * .9, PI * 1.9); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(p.x + R * .4, p.y + R * .45, R * 1.05, 0, TAU); g.arc(p.x, p.y, R, 0, TAU, true); g.fill();
  g.restore();
}

export function drawHole(h) {
  const T = G.T, hg = g.createRadialGradient(h.x, h.y, h.r * .6, h.x, h.y, h.r * 2.6);
  hg.addColorStop(0, 'rgba(170,90,255,.55)'); hg.addColorStop(1, 'rgba(170,90,255,0)');
  g.fillStyle = hg; g.beginPath(); g.arc(h.x, h.y, h.r * 2.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(220,170,255,.9)'; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(h.x, h.y, h.r + 3, T * 3 + k * TAU / 3, T * 3 + k * TAU / 3 + 1.2); g.stroke(); }
  g.fillStyle = '#000'; g.beginPath(); g.arc(h.x, h.y, h.r, 0, TAU); g.fill();
}
export function drawStar(t) {
  const r = 5 + 1.5 * Math.sin(G.T * 5 + t.ph);
  g.fillStyle = '#ffe27a'; g.beginPath();
  g.moveTo(t.x, t.y - r); g.lineTo(t.x + r * .35, t.y - r * .35); g.lineTo(t.x + r, t.y); g.lineTo(t.x + r * .35, t.y + r * .35);
  g.lineTo(t.x, t.y + r); g.lineTo(t.x - r * .35, t.y + r * .35); g.lineTo(t.x - r, t.y); g.lineTo(t.x - r * .35, t.y - r * .35); g.closePath(); g.fill();
}

/** 화면에 보이는 월드 요소 전부 */
export function drawWorld() {
  const top = viewTop(), bot = viewBot();
  for (const p of G.planets) { if (p.y < top - 140 || p.y > bot + 140) continue; drawPlanet(p); }
  drawForkGuides();
  for (const m of G.mons) { if (m.y < top - 100 || m.y > bot + 100) continue; drawMonster(m); }
  for (const h of G.holes) { if (h.y < top - 60 || h.y > bot + 60) continue; drawHole(h); }
  for (const t of G.stars) { if (t.got || t.y < top - 30 || t.y > bot + 30) continue; drawStar(t); }
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
    txt('▶ ' + BOSSES[br.bi].n, x, y + 21, 15, 'rgba(255,255,255,.85)', 'center', 700);
  }
}

/** 기체: 궤도선, 진행 방향 점선, 꼬리, 잔상, 차지 연출, 본체, 추진기 방패, 산소 막대 */
export function drawPlayer() {
  const s = G.ship, T = G.T, def = SHIPS[G.shipId];
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
  for (let i = 2; i < tr.length; i += 2) {
    g.strokeStyle = 'hsla(' + def.L.h + ',90%,72%,' + (i / tr.length * .7) + ')'; g.lineWidth = 1 + i / tr.length * (s.mode === 'free' ? 5 : 3) * (1 + (s.boost - 1) * .8 + s.heat * .15);
    g.beginPath(); g.moveTo(tr[i - 2], tr[i - 1]); g.lineTo(tr[i], tr[i + 1]); g.stroke();
  }
  // 돌격 잔상
  for (const gh of s.ghosts) {
    g.save(); g.translate(gh.x, gh.y); g.rotate(gh.a); g.globalAlpha = (1 - gh.t / .32) * .4;
    g.shadowColor = 'hsl(' + def.L.h + ',100%,70%)'; g.shadowBlur = 8; drawShip(g, def, 1, T, fs()); g.restore();
  }
  g.globalAlpha = 1;
  if (s.heat) drawFlames(s, hx, hy);
  if (!(s.inv > 0 && Math.floor(T * 20) % 2)) {
    const em = (1 + .9 * s.evoT * s.evoT) * fs(), jit = s.charging ? s.charge * 1.6 : 0;
    g.save(); g.translate(s.x + (jit ? (Math.random() - .5) * jit * 2 : 0), s.y + (jit ? (Math.random() - .5) * jit * 2 : 0)); g.rotate(Math.atan2(hy, hx));
    g.shadowColor = 'hsl(' + def.L.h + ',100%,75%)'; g.shadowBlur = (s.mode === 'free' ? 20 : 12) + s.evoT * 30 + (s.charging ? 24 * s.charge : 0) + (s.boost > 1.2 ? 14 : 0) + s.heat * 6;
    drawShip(g, def, s.mode === 'free' ? 1 : s.charging ? .3 + .7 * s.charge : .3, T, em); g.restore();
  }
  if (s.charging) drawChargeRing(s, def);
  if (G.stats.shield > 0) { g.strokeStyle = 'rgba(255,157,122,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(s.x, s.y, (8 + 8 * SHIP_SC[G.tier]) * fs(), 0, TAU); g.stroke(); }
  if (s.mode === 'free' && G.st === 'play' && !G.boss) { // 비행 중 남은 산소
    const f = clamp(1 - s.air / o2max(), 0, 1);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(s.x - 16, s.y + 16, 32, 3);
    g.fillStyle = f < .3 ? '#ff6a6a' : '#b8a8ff'; g.fillRect(s.x - 16, s.y + 16, 32 * f, 3);
  }
}

/** 열기: 기체 뒤로 기체색 불꽃 혀가 일렁인다. 단계가 오를수록 길고 많아진다 */
function drawFlames(s, hx, hy) {
  const h = s.heat, T = G.T, n = 2 + h;
  g.save(); g.translate(s.x, s.y); g.rotate(Math.atan2(-hy, -hx)); // +x 방향이 뒤쪽
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1) - .5, fl = .75 + .25 * Math.sin(T * 26 + i * 2.1), L = (16 + h * 11) * fl * (1 - Math.abs(f) * .7), wd = 4 + h * .9 - Math.abs(f) * 3;
    const gr = g.createLinearGradient(4, 0, 4 + L, f * 14);
    gr.addColorStop(0, '#fff'); gr.addColorStop(.25, flameColor(72)); gr.addColorStop(.7, flameColor(52)); gr.addColorStop(1, 'hsla(' + SHIPS[G.shipId].L.h + ',100%,45%,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(3, -wd); g.quadraticCurveTo(4 + L * .5, f * 12 - wd * .6, 4 + L, f * 16); g.quadraticCurveTo(4 + L * .5, f * 12 + wd * .6, 3, wd); g.closePath(); g.fill();
  }
  const ag = g.createRadialGradient(0, 0, 2, 0, 0, 22 + h * 5);
  ag.addColorStop(0, 'hsla(' + SHIPS[G.shipId].L.h + ',100%,65%,' + (.25 + h * .07) + ')'); ag.addColorStop(1, 'hsla(' + SHIPS[G.shipId].L.h + ',100%,55%,0)');
  g.fillStyle = ag; g.beginPath(); g.arc(0, 0, 22 + h * 5, 0, TAU); g.fill();
  g.restore();
}

/** 차지: 기체 쪽으로 오므라드는 링, 가득 차면 맥동 */
function drawChargeRing(s, def) {
  const c = s.charge, col = 'hsl(' + def.L.h + ',100%,' + (70 + 25 * c) + '%)', T = G.T;
  const r = 46 - 30 * c;
  g.strokeStyle = col; g.lineWidth = 1.5 + 2.5 * c; g.globalAlpha = .35 + .5 * c;
  g.beginPath(); g.arc(s.x, s.y, r, 0, TAU); g.stroke();
  g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(s.x, s.y, r + 5, -PI / 2, -PI / 2 + TAU * c); g.stroke();
  if (c >= 1) { g.globalAlpha = .5 + .5 * Math.sin(T * 24); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, 24 + 3 * Math.sin(T * 24), 0, TAU); g.stroke(); g.globalAlpha = 1; }
}

/** 파티클·링·떠오르는 글자 */
export function drawFx() {
  for (const f of G.fxr) {
    const k = f.t / f.dur, r = f.r0 + (f.r1 - f.r0) * easeOut(k);
    g.globalAlpha = 1 - k; g.strokeStyle = f.c; g.lineWidth = f.w * (1 - k * .6); g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.stroke();
  }
  for (const p of G.parts) {
    g.globalAlpha = 1 - p.t / p.l;
    if (p.line) { g.strokeStyle = p.c; g.lineWidth = p.s * .6; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); g.stroke(); }
    else { g.fillStyle = p.c; const sz = p.s || 3; g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz); }
  }
  for (const t of G.texts) {
    const pop = t.t < .12 ? 1 + (1 - t.t / .12) * .5 : 1;
    g.globalAlpha = 1 - t.t * t.t; txt(t.s, clamp(t.x, 60, G.w - 60), t.y - t.t * 42, (t.sz || 15) * pop, t.c);
  }
  g.globalAlpha = 1;
}
