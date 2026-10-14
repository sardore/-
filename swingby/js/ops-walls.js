/* 벽 = 떠다니는 우주 쓰레기(컨테이너·태양전지판·탱크·선체 조각·안테나·엔진·위성 잔해…): 적처럼 기체를 튕겨 내지만, 세게 부딪히면 부서진다. 행성 사이에 놓이고, 지역(ops-data 의 wall)마다 나오는 곳/안 나오는 곳과 모양이 다르다.
 * 보스전에는 나오지 않는다 — 감옥선(오블리엣)의 '무단 투하' 공격만 급하게 떨어지는 쓰레기 벽(cage)을 만든다.
 * 벽은 선분(가운데 x,y · 기울기 a · 반길이 hl) 둘레의 캡슐(두께 th)이다. */
import { G } from './state.js';
import { TAU, rnd, clamp, pickOf } from './util.js';
import { BIOMES } from './data.js';
import { fs, shipR } from './stats.js';
import { impactDamage, bounceShip, bounceSpeed } from './impact.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, popText, addScore } from './fx.js';
import { beep, thump, noise, vibe } from './audio.js';

const HIT_COOLDOWN = .3;
/** 모양별 체력(충돌 1회 ≈ 26, 돌격하면 그 두 배 안팎)과 색 */
const KINDS = {
  plate:     { hp: 55,  fill: '#34464a', edge: '#8fb4ae', dark: '#1b2628' },
  wreck:     { hp: 85,  fill: '#4a3624', edge: '#c0905e', dark: '#24180e' },
  slab:      { hp: 75,  fill: '#2c1618', edge: '#e0705a', dark: '#140a0b' },
  bars:      { hp: 65,  fill: '#202c3a', edge: '#9db6cf', dark: '#0b1118' },
  barricade: { hp: 95,  fill: '#1c1c26', edge: '#e9e5d5', dark: '#0a0a10' },
  cage:      { hp: 150, fill: '#3b352d', edge: '#d9c9a6', dark: '#14110d' }
};
export const wallKinds = () => Object.keys(KINDS);
const list = () => G.ops.walls;

/** 지역(kind)마다 많이 나오는 쓰레기 모양 */
const THEME = { plate: ['panel', 'tank', 'container', 'hatch'], wreck: ['hull', 'engine', 'hull', 'satellite'], slab: ['hull', 'engine', 'tank', 'container'], bars: ['container', 'crate', 'satellite', 'panel'], barricade: ['crate', 'container', 'tank', 'dish'] };
export function mkWall(kind, x, y, a, hl, th) {
  const K = KINDS[kind], k = fs();
  return { kind, shape: kind === 'cage' ? 'row' : pickOf(THEME[kind]), x, y, a, hl: hl * k, th: th * k, hp: K.hp, max: K.hp, flash: 0, sq: 0, vy: 0, born: 0, ph: rnd(0, TAU), seed: Math.random() };
}

/** 점 (px,py) 에서 벽 선분의 가장 가까운 점 */
function nearest(w, px, py) {
  const c = Math.cos(w.a), s = Math.sin(w.a), t = clamp((px - w.x) * c + (py - w.y) * s, -w.hl, w.hl);
  return { x: w.x + c * t, y: w.y + s * t };
}
const segDist = (w, px, py) => { const q = nearest(w, px, py); return Math.hypot(px - q.x, py - q.y); };

/** 새 행성 p 가 prev 위에 생길 때, 이 지역에 벽이 나오는 곳이면 둘 사이에 벽을 놓는다. 행성 포획 범위에 닿는 자리는 쓰지 않는다 */
export function maybeWall(prev, p, dy) {
  const cfg = BIOMES[G.biome].wall;
  if (!cfg || G.boss || G.genI < 7 || p.drift || prev.drift || dy < 110 * fs() || Math.random() > cfg.p) return;
  const k = fs(), dx = p.x - prev.x, ddy = p.y - prev.y, base = Math.atan2(ddy, dx) + Math.PI / 2;   // 항로에 가로로 놓는다
  const near = G.planets.slice(-5);
  for (let tr = 0; tr < 12; tr++) {
    const t = rnd(.4, .6), side = rnd(-1, 1) * 46 * k, hl = rnd(19, 30), a = base + rnd(-.9, .9);
    const x = clamp(prev.x + dx * t + Math.cos(base) * side, 26 * k, G.w - 26 * k), y = prev.y + ddy * t;
    const w = mkWall(cfg.kind, x, y, a, hl, rnd(26, 34));   // 막대가 아니라 굵직한 덩어리
    if (near.every(q => segDist(w, q.x, q.y) > q.cap * .9 + w.th)) { list().push(w); return; }
  }
}

/** 급하게 떨어지는 쓰레기 벽(감옥선의 '무단 투하'). gaps: 비워 둘 x 구간 [[x0,x1], …]. 구간 밖을 같은 두께의 벽 조각으로 채운다 */
export function spawnCage(y, vy, gaps, hp) {
  const k = fs(), W = G.w, edges = [0]; let n = 0;
  for (const [a, b] of gaps) edges.push(a, b);
  edges.push(W);
  for (let i = 0; i < edges.length; i += 2) {
    const x0 = edges[i], x1 = edges[i + 1]; if (x1 - x0 < 8) continue;
    const w = mkWall('cage', (x0 + x1) / 2, y, 0, (x1 - x0) / 2 / k, 28); w.vy = vy; w.hp = w.max = hp; list().push(w); n++;
  }
  return n;
}

export function clearWalls() { if (G.ops) G.ops.walls = []; }
/** 필드 폭이 줄어들 때 같이 가로로 줄인다 */
export function squeezeWalls(r) { if (G.ops) for (const w of list()) w.x *= r; }
export function cullWalls(lim) { if (G.ops && list().length) G.ops.walls = list().filter(w => w.y < lim); }

export function updateWalls(dt) {
  const L = list(); if (!L.length) return;
  for (const w of L) {
    w.born = Math.min(1, w.born + dt * 2);
    if (w.flash > 0) w.flash -= dt; if (w.sq > 0) w.sq = Math.max(0, w.sq - dt * 5);
    if (w.vy) w.y += w.vy * dt;
  }
  if (G.boss) G.ops.walls = L.filter(w => w.y < G.arenaBot + 140);   // 떨어진 쓰레기 벽은 화면 밖에서 치운다
}

/** 비행 중인 기체가 벽에 닿았는지 보고 튕겨 낸다. 떨어지는 벽은 맞으면 아프다(onHurt: boss-attacks.js 의 피격) */
/** 착지해 있어도 떨어지는 철창이 덮치면 맞는다(보스전의 무단 투하) */
export function hitLanded(onHurt) {
  const s = G.ship; if (s.mode === 'free') return;
  for (const w of list()) { if (!(w.vy > 0)) continue; const q = nearest(w, s.x, s.y); if (Math.hypot(s.x - q.x, s.y - q.y) < w.th / 2 + shipR()) { onHurt(q.x, q.y); return; } }
}
export function hitWalls(onHurt) {
  const s = G.ship; if (s.mode !== 'free' || s.ramT > 0) return;
  for (const w of list()) {
    const q = nearest(w, s.x, s.y), dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy), reach = w.th / 2 + shipR();
    if (d >= reach) continue;
    let nx, ny;
    if (d > .01) { nx = dx / d; ny = dy / d; } else { nx = -Math.sin(w.a); ny = Math.cos(w.a); if (nx * s.vx + ny * s.vy > 0) { nx = -nx; ny = -ny; } }
    bump(w, q, nx, ny, onHurt); return;
  }
}

function bump(w, q, nx, ny, onHurt) {
  const s = G.ship, dmg = impactDamage(), K = KINDS[w.kind], ang = Math.atan2(ny, nx);
  w.hp -= dmg; w.flash = .16; w.sq = 1; s.ramT = HIT_COOLDOWN;
  bounceShip(q.x, q.y, nx, ny, w.th / 2 + shipR() + 4, bounceSpeed());
  const bx = q.x + nx * w.th / 2, by = q.y + ny * w.th / 2;
  sparks(s.x, s.y, '#fff', 8, 340, ang, .9); sparks(bx, by, K.edge, 12, 300, ang, 1.2);
  ringFx(bx, by, '#fff', 4, 40, .28, 3); hitstop(.05 + Math.min(dmg, 40) / 900); shakeAdd(5 + dmg * .08); punch(.025); vibe(20);
  thump(160, 40, .2, .35); noise(.16, .2, 4200, 300); beep(300 + (1 - w.hp / w.max) * 260, .05, 'square', .06);
  popText(bx + nx * 16, by + ny * 16, '-' + dmg, '#ffd6a0', clamp(14 + dmg * .3, 15, 28));
  if (w.hp <= 0) breakWall(w);
  if (w.vy > 0 && onHurt) onHurt(bx, by);   // 떨어지는 벽
}

function breakWall(w) {
  w.dead = true; G.ops.walls = list().filter(q => q !== w);
  const K = KINDS[w.kind], n = Math.max(2, Math.round(w.hl / 10));
  for (let i = 0; i < n; i++) { const t = (i / (n - 1 || 1) - .5) * 2 * w.hl, x = w.x + Math.cos(w.a) * t, y = w.y + Math.sin(w.a) * t; burst(x, y, K.edge, 9, 220); sparks(x, y, '#fff', 3, 260, rnd(0, TAU), Math.PI); }
  ringFx(w.x, w.y, '#fff', 6, w.hl * 1.2, .4, 3); hitstop(.07); shakeAdd(8); thump(100, 30, .4, .38); noise(.5, .26, 3000, 150); beep(640, .08, 'triangle', .08);
  if (!G.boss) addScore(25, w.x, w.y - 18, K.edge, '벽 파괴', 16);
}

/* ---------- 그리기 ---------- */
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); };

export function drawWallList(c, top, bot, T) {
  for (const w of list()) { if (w.y < top - 200 || w.y > bot + 200) continue; drawWall(c, w, T); }
}
const poly = (c, pts) => { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); };
const line = (c, x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const seeded = s => { let r = s * 9999 + 1; return () => (r = (r * 9301 + 49297) % 233280) / 233280; };

/** 쓰레기 한 조각을 (-hl..hl, -hh..hh) 안에 그린다. 칠은 호출한 쪽이 정한 fillStyle/strokeStyle(K.fill, K.edge) */
const JUNK = {
  container(c, hl, hh, K) { // 컨테이너: 세로 골과 문짝 선
    rr(c, -hl, -hh, hl * 2, hh * 2, 3); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1; for (let x = -hl + 6; x < hl - 3; x += 7) line(c, x, -hh + 2, x, hh - 2);
    c.strokeStyle = K.edge; c.lineWidth = 1.4; line(c, 0, -hh, 0, hh); c.fillStyle = K.edge; c.fillRect(-2.5, -1.5, 2, 3); c.fillRect(.5, -1.5, 2, 3);
  },
  crate(c, hl, hh, K) { // 상자: 엑스 자 보강대와 모서리 표시
    rr(c, -hl, -hh, hl * 2, hh * 2, 2); c.fill(); c.stroke(); c.strokeStyle = K.dark; c.lineWidth = 1.6; line(c, -hl + 3, -hh + 3, hl - 3, hh - 3); line(c, -hl + 3, hh - 3, hl - 3, -hh + 3);
    c.fillStyle = K.edge; for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect(x * (hl - 4) - 1.5, y * (hh - 4) - 1.5, 3, 3);
  },
  tank(c, hl, hh, K) { // 탱크: 둥근 몸통과 밴드, 밸브
    rr(c, -hl, -hh * .85, hl * 2, hh * 1.7, hh * .85); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1.6; line(c, -hl * .4, -hh * .85, -hl * .4, hh * .85); line(c, hl * .4, -hh * .85, hl * .4, hh * .85);
    c.fillStyle = K.edge; c.fillRect(-2, -hh * .85 - 3, 4, 3); c.beginPath(); c.arc(0, -hh * .85 - 4, 2.4, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-hl * .8, -hh * .5, hl * 1.6, 2.4);
  },
  panel(c, hl, hh, K, r) { // 태양전지판: 한쪽 귀퉁이가 꺾여 나갔다
    poly(c, [[-hl, -hh], [hl * .45, -hh], [hl, -hh * .15], [hl, hh], [-hl, hh]]); c.fill(); c.stroke();
    c.save(); poly(c, [[-hl, -hh], [hl * .45, -hh], [hl, -hh * .15], [hl, hh], [-hl, hh]]); c.clip();
    c.fillStyle = 'rgba(40,70,110,.75)'; c.fillRect(-hl + 2, -hh + 2, hl * 2, hh * 2 - 4);
    c.strokeStyle = 'rgba(160,200,255,.4)'; c.lineWidth = .8; for (let x = -hl + 2; x < hl; x += 7) line(c, x, -hh, x, hh); for (let y = -hh + 2; y < hh; y += 7) line(c, -hl, y, hl, y);
    c.restore(); c.strokeStyle = K.edge; c.lineWidth = 1; line(c, hl, hh * .4, hl + 5, hh * .9);
  },
  hull(c, hl, hh, K, r) { // 선체 조각: 들쭉날쭉한 윤곽과 구멍
    const n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, q = .72 + .28 * r(); pts.push([Math.cos(a) * hl * q, Math.sin(a) * hh * q]); }
    poly(c, pts); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1.1; line(c, -hl * .5, -hh * .3, hl * .3, -hh * .5); line(c, -hl * .3, hh * .35, hl * .55, hh * .25);
    c.fillStyle = K.dark; c.beginPath(); c.ellipse(hl * .2, hh * .05, hl * .22, hh * .28, .4, 0, TAU); c.fill();
  },
  engine(c, hl, hh, K) { // 엔진: 종 모양 노즐과 고리
    poly(c, [[-hl, -hh * .5], [-hl * .25, -hh * .55], [hl, -hh], [hl, hh], [-hl * .25, hh * .55], [-hl, hh * .5]]); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1.2; line(c, 0, -hh * .62, 0, hh * .62); line(c, hl * .45, -hh * .8, hl * .45, hh * .8);
    c.fillStyle = K.dark; c.beginPath(); c.ellipse(hl, 0, hh * .28, hh * .9, 0, 0, TAU); c.fill();
  },
  satellite(c, hl, hh, K) { // 위성 잔해: 가운데 몸체, 양옆 전지판, 안테나
    c.save(); c.fillStyle = 'rgba(40,70,110,.8)'; for (const s of [-1, 1]) { rr(c, s > 0 ? hl * .5 : -hl, -hh * .55, hl * .5, hh * 1.1, 1.5); c.fill(); c.strokeStyle = K.edge; c.lineWidth = 1; c.stroke(); }
    c.restore(); c.fillStyle = K.fill; c.strokeStyle = K.edge; rr(c, -hl * .5, -hh * .85, hl, hh * 1.7, 3); c.fill(); c.stroke();
    c.strokeStyle = K.edge; c.lineWidth = 1.2; line(c, 0, -hh * .85, 2, -hh - 4); c.fillStyle = K.edge; c.beginPath(); c.arc(2, -hh - 4, 1.6, 0, TAU); c.fill();
    c.strokeStyle = K.dark; line(c, -hl * .5, 0, hl * .5, 0);
  },
  dish(c, hl, hh, K) { // 안테나 접시: 휜 그릇과 받침
    c.beginPath(); c.ellipse(0, -hh * .1, hl, hh * 1.05, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -hh * .1, hl * .55, hh * .55, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = K.edge; c.lineWidth = 1.4; line(c, 0, -hh * .1, hl * .3, -hh); c.fillStyle = K.edge; c.beginPath(); c.arc(hl * .3, -hh, 1.8, 0, TAU); c.fill();
  },
  hatch(c, hl, hh, K) { // 해치 덮개: 바퀴 손잡이가 달린 둥근 판
    c.beginPath(); c.ellipse(0, 0, hl, hh, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = K.dark; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, hl * .7, hh * .7, 0, 0, TAU); c.stroke(); line(c, -hl * .45, 0, hl * .45, 0); line(c, 0, -hh * .45, 0, hh * .45);
    c.fillStyle = K.edge; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill();
  },
  /** 떨어지는 쓰레기 벽(무단 투하): 여러 조각이 이어진 줄 */
  row(c, hl, hh, K, r) {
    const n = Math.max(1, Math.round(hl / 15)), pw = hl / n, kinds = ['container', 'crate', 'panel', 'tank', 'hull', 'container'];
    for (let i = 0; i < n; i++) { c.save(); c.translate(-hl + pw * (2 * i + 1), 0); c.fillStyle = K.fill; c.strokeStyle = K.edge; c.lineWidth = 1.4; JUNK[kinds[Math.floor(r() * kinds.length)]](c, pw - .8, hh, K, r); c.restore(); }
  }
};

function drawWall(c, w, T) {
  const K = KINDS[w.kind], hl = w.hl, hh = w.th / 2, dmg = 1 - w.hp / w.max, born = w.born, r = seeded(w.seed);
  c.save(); c.translate(w.x, w.y); c.rotate(w.a); c.globalAlpha = Math.min(1, .25 + born);
  c.scale(1 + w.sq * .06, 1 - w.sq * .1);
  if (w.kind === 'cage') { c.shadowColor = 'rgba(255,200,140,.6)'; c.shadowBlur = 10; }
  c.fillStyle = K.fill; c.strokeStyle = w.flash > 0 ? '#fff' : K.edge; c.lineWidth = 1.6; c.lineJoin = 'round';
  JUNK[w.shape](c, hl, hh, K, r);
  c.shadowBlur = 0;
  if (w.kind === 'slab') { // 달아오른 쓰레기: 틈이 맥박처럼 빛난다
    const g2 = .5 + .5 * Math.sin(T * 2.2 + w.ph); c.strokeStyle = 'rgba(255,140,80,' + (.35 + .5 * g2) + ')'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(-hl * .5, -hh * .2); c.lineTo(-hl * .1, hh * .1); c.lineTo(hl * .2, -hh * .3); c.lineTo(hl * .55, hh * .2); c.stroke();
  }
  // 금: 상처가 깊을수록 늘어난다
  if (dmg > .25) { c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1.2; c.beginPath(); const n = Math.ceil(dmg * 4); for (let i = 0; i < n; i++) { const x = -hl + (i + .6) / (n + .2) * hl * 2; c.moveTo(x, -hh); c.lineTo(x + 3, -hh * .2); c.lineTo(x - 2, hh * .4); c.lineTo(x + 2, hh); } c.stroke(); }
  c.restore();
}
