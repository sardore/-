/* 벽 = 떠다니는 우주 쓰레기(컨테이너·태양전지판·탱크·선체 조각·안테나·엔진·위성 잔해…): 적처럼 기체를 튕겨 내지만, 세게 부딪히면 부서진다. 행성 사이에 놓이고, 지역(ops-data 의 wall)마다 나오는 곳/안 나오는 곳과 모양이 다르다.
 * 보스전에는 나오지 않는다 — 감옥선(오블리엣)의 '무단 투하' 공격만 쓰레기를 대량으로 떨어뜨린다(junk).
 * 벽은 선분(가운데 x,y · 기울기 a · 반길이 hl) 둘레의 캡슐(두께 th)이다. */
import { G } from './state.js';
import { TAU, rnd, clamp, pickOf } from './util.js';
import { BIOMES } from './data.js';
import { fs, shipR } from './stats.js';
import { impactDamage, bounceShip, bounceSpeed } from './impact.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, popText, addScore } from './fx.js';
import { beep, thump, noise, vibe } from './audio.js';
import { drawJunk } from './ops-junk-art.js';

const HIT_COOLDOWN = .3;
/** 모양별 체력(충돌 1회 ≈ 26, 돌격하면 그 두 배 안팎)과 색 */
const KINDS = {
  plate:     { hp: 55,  fill: '#34464a', edge: '#8fb4ae', dark: '#1b2628' },
  wreck:     { hp: 85,  fill: '#4a3624', edge: '#c0905e', dark: '#24180e' },
  slab:      { hp: 75,  fill: '#2c1618', edge: '#e0705a', dark: '#140a0b' },
  bars:      { hp: 65,  fill: '#202c3a', edge: '#9db6cf', dark: '#0b1118' },
  barricade: { hp: 95,  fill: '#1c1c26', edge: '#e9e5d5', dark: '#0a0a10' },
  junk:      { hp: 70,  fill: '#4a4a4a', edge: '#d0d0d0', dark: '#161616' }   // 무단 투하로 떨어지는 쓰레기
};
export const wallKinds = () => Object.keys(KINDS);
const list = () => G.ops.walls;

/** 지역(kind)마다 많이 나오는 쓰레기 모양(ops-junk-art.js) */
const THEME = {
  plate: ['panel', 'tank', 'container', 'pod', 'dish'], wreck: ['hull', 'engine', 'truss', 'satellite', 'hull', 'drum'], slab: ['hull', 'engine', 'drum', 'tank', 'container'],
  bars: ['container', 'truss', 'satellite', 'panel', 'pod'], barricade: ['container', 'drum', 'truss', 'dish', 'tank'], junk: ['container', 'panel', 'tank', 'hull', 'engine', 'satellite', 'drum', 'pod', 'truss', 'dish']
};
export function mkWall(kind, x, y, a, hl, th) {
  const K = KINDS[kind], k = fs();
  return { kind, shape: pickOf(THEME[kind]), x, y, a, hl: hl * k, th: th * k, hp: K.hp, max: K.hp, flash: 0, sq: 0, vy: 0, born: 0, ph: rnd(0, TAU), seed: Math.random() };
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
    const t = rnd(.4, .6), side = rnd(-1, 1) * 46 * k, hl = rnd(22, 33), a = base + rnd(-.9, .9);
    const x = clamp(prev.x + dx * t + Math.cos(base) * side, 26 * k, G.w - 26 * k), y = prev.y + ddy * t;
    const w = mkWall(cfg.kind, x, y, a, hl, rnd(30, 38));   // 막대가 아니라 굵직한 덩어리
    if (near.every(q => segDist(w, q.x, q.y) > q.cap * .9 + w.th)) { list().push(w); return; }
  }
}

/** 급하게 떨어지는 쓰레기 더미(감옥선의 '무단 투하'). xs: 쓰레기가 떨어질 x 들 — 한 줄로 잇지 않고 조각마다 모양·크기·속도·회전이 다르며, 위쪽에 흩어져 시차를 두고 쏟아진다 */
export function spawnJunk(xs, y, vy, hp) {
  const k = fs();
  for (const x of xs) {
    const w = mkWall('junk', x, y - rnd(0, 330) * k, rnd(0, TAU), rnd(14, 23), rnd(24, 32));
    w.vy = vy * rnd(.85, 1.2); w.va = rnd(-1.1, 1.1); w.hp = w.max = hp; w.born = 1; list().push(w);
  }
  return xs.length;
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
    if (w.va) w.a += w.va * dt;
  }
  if (G.boss) G.ops.walls = L.filter(w => w.y < G.arenaBot + 140);   // 떨어진 쓰레기 벽은 화면 밖에서 치운다
}

/** 비행 중인 기체가 벽에 닿았는지 보고 튕겨 낸다. 떨어지는 벽은 맞으면 아프다(onHurt: boss-attacks.js 의 피격) */
/** 착지해 있어도 떨어지는 쓰레기에 깔리면 맞는다(보스전의 무단 투하) */
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

/** 돌진 포대의 포탄이 쓰레기에 맞았는지: 맞았으면 피해를 주고 true */
export function shootWall(x, y, dmg) {
  for (const w of list()) {
    const q = nearest(w, x, y);
    if (Math.hypot(x - q.x, y - q.y) < w.th / 2 + 2) {
      w.hp -= dmg; w.flash = .1; w.sq = Math.max(w.sq, .4); popText(x, y - 10, '-' + dmg, '#ffd6a0', 13);
      if (w.hp <= 0) breakWall(w);
      return true;
    }
  }
  return false;
}

function breakWall(w) {
  w.dead = true; G.ops.walls = list().filter(q => q !== w);
  const K = KINDS[w.kind], n = Math.max(2, Math.round(w.hl / 10));
  for (let i = 0; i < n; i++) { const t = (i / (n - 1 || 1) - .5) * 2 * w.hl, x = w.x + Math.cos(w.a) * t, y = w.y + Math.sin(w.a) * t; burst(x, y, K.edge, 9, 220); sparks(x, y, '#fff', 3, 260, rnd(0, TAU), Math.PI); }
  ringFx(w.x, w.y, '#fff', 6, w.hl * 1.2, .4, 3); hitstop(.07); shakeAdd(8); thump(100, 30, .4, .38); noise(.5, .26, 3000, 150); beep(640, .08, 'triangle', .08);
  if (!G.boss) addScore(25, w.x, w.y - 18, K.edge, '벽 파괴', 16);
}

/* ---------- 그리기 (조각 그림은 ops-junk-art.js) ---------- */
export function drawWallList(c, top, bot, T) {
  for (const w of list()) { if (w.y < top - 200 || w.y > bot + 200) continue; drawJunk(c, w, KINDS[w.kind], T); }
}
