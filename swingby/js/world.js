/* 월드 생성: 행성(종류·바이옴)·별·블랙홀, 그리고 갈림길(거대 암석 행성 + 좌우 항로) */
import { G } from './state.js';
import { W, rnd, clamp, shuffle, TAU } from './util.js';
import { BIOMES, STAGES } from './data.js';
import { viewTop } from './camera.js';
import { toast } from './fx.js';

/* ---------- 행성 ---------- */
/** 바이옴에 맞는 행성 종류를 고른다. 처음 몇 개는 항상 평범한 행성 */
function pickType(i, biome) {
  if (i <= 4) return 'n';
  const r = Math.random();
  switch (biome) {
    case 'belt': return r < .8 ? 'a' : 'n';
    case 'nebula': return r < .75 ? 'g' : 'n';
    case 'redzone': return r < .65 ? 'r' : r < .8 ? 'n' : 'g';
    default: return r < .2 ? 'r' : r < .36 ? 'g' : 'n';
  }
}
/** n 일반 · r 적색왜성 · g 가스행성 · a 소행성(떠나면 부서짐) · m 거대 암석(갈림길 허브) */
export function mkPlanet(i, x, y, biome = 'normal', forceType) {
  const t = forceType || pickType(i, biome);
  let R, ring;
  switch (t) {
    case 'g': R = rnd(34, 42); ring = 92; break;
    case 'r': R = rnd(16, 20); ring = 64; break;
    case 'a': R = rnd(11, 16); ring = 46; break;
    case 'm': R = rnd(60, 64); ring = 104; break;
    default: R = rnd(22, 30); ring = 76;
  }
  if (t !== 'm') ring -= Math.min(i * .45, 16) * (t === 'a' ? .5 : 1);
  const hue = t === 'r' ? 8 : t === 'g' ? (biome === 'nebula' ? rnd(255, 300) : 36) : t === 'a' ? rnd(18, 42) : t === 'm' ? 24 : rnd(190, 320);
  return { i, x, y, R, cap: R + ring, t, hue, seen: false, ph: rnd(0, TAU), dead: false, re: 0, born: 1, sq: 0, pulse: 0, brittle: t === 'a' };
}

/** 소행성이 부서진다. 보스전에서는 잠시 뒤 다시 생기고, 평소에는 그대로 사라진다 */
export function shatter(p) {
  p.dead = true; p.re = G.boss ? 3 : 999; p.gone = !G.boss;
}

/** 행성별 맥박·찌그러짐·등장 애니메이션 (논리 시간 기준) */
export function animatePlanets(dt) {
  for (const p of G.planets) {
    if (p.dead) continue;
    if (p.pulse > 0) p.pulse = Math.max(0, p.pulse - dt * 2.5);
    if (p.sq > 0) p.sq = Math.max(0, p.sq - dt * 4);
    if (p.born < 1) p.born = Math.min(1, p.born + dt * 2);
  }
}

/* ---------- 별·블랙홀 ---------- */
function addStars(a, b, tag) {
  const k = Math.random() < .75 ? 1 + (Math.random() * 3 | 0) : 0;
  for (let j = 0; j < k; j++) {
    const f = (j + 1) / (k + 1);
    G.stars.push({ x: clamp(a.x + (b.x - a.x) * f + rnd(-22, 22), 14, W - 14), y: a.y + (b.y - a.y) * f + rnd(-22, 22), got: false, ph: rnd(0, TAU), br: tag });
  }
}
function maybeHole(prev, p, dy) {
  const odds = Math.min(.14 + G.genI * .006, .45) * (G.biome === 'void' ? 2.2 : 1);
  if (G.genI <= 7 || Math.random() >= odds) return;
  const h = { x: clamp(W - (prev.x + p.x) / 2 + rnd(-40, 40), 30, W - 30), y: G.genY + dy / 2 + rnd(-30, 30), r: 13 };
  const d1 = Math.hypot(h.x - p.x, h.y - p.y), d2 = Math.hypot(h.x - prev.x, h.y - prev.y);
  if (d1 > p.cap + 40 && d2 > prev.cap + 40) G.holes.push(h);
}

/** 화면 위쪽이 비지 않도록 행성을 이어서 만든다. 갈림길 선택 대기 중에는 멈춘다 */
export function gen() {
  const F = G.fork;
  if (F && F.state === 'hub') return;
  while (G.genY > viewTop() - 320) {
    const prev = G.planets[G.planets.length - 1];
    if (F && F.state === 'queued' && G.genI >= F.at) { buildFork(prev); return; }
    const dy = rnd(150, 200) + Math.min(G.genI * 1.2, 40);
    let x, n = 0; do { x = rnd(58, W - 58); } while (Math.abs(x - prev.x) < 75 && n++ < 20);
    G.genY -= dy;
    const p = mkPlanet(G.genI++, x, G.genY, G.biome);
    G.planets.push(p);
    addStars(prev, p);
    maybeHole(prev, p, dy);
  }
}

/* ---------- 갈림길 ----------
 * 보스를 쓰러뜨리면 몇 개 뒤에 거대 암석 행성(허브)이 나온다. 그 궤도는 거의 줄어들지 않고,
 * 도착하면 시야가 넓어져 왼쪽/오른쪽 항로가 보인다. 항로마다 다음 보스(2개 스테이지)와 바이옴이 다르다. */
export function scheduleFork() {
  G.fork = { state: 'queued', at: G.genI + 3, active: false, hub: null, branches: null };
}

/** 이번 갈림길의 좌/우 선택지. 처음에는 단순한 바이옴만, 소행성대·공허대는 두 번째 갈림길부터 */
function routeOptions() {
  const stage = G.kills % STAGES.length, bis = STAGES[stage], f = G.kills - 1;
  const pool = f <= 0 ? ['nebula', 'redzone'] : f === 1 ? ['belt', 'void'] : Object.keys(BIOMES).filter(k => k !== 'normal');
  const biomes = shuffle(pool.slice()), bosses = bis.length > 1 ? shuffle(bis.slice()) : [bis[0], bis[0]];
  return [0, 1].map(i => ({ biome: biomes[i], bi: bosses[i] }));
}

function buildFork(prev) {
  const F = G.fork;
  G.genY -= rnd(200, 220);
  const hub = mkPlanet(G.genI++, W / 2, G.genY, 'normal', 'm');
  G.planets.push(hub); addStars(prev, hub);
  F.hub = hub; F.state = 'hub'; F.branches = {};
  const opts = routeOptions();
  ['L', 'R'].forEach((side, si) => {
    const o = opts[si], list = [];
    for (let j = 0; j < 2; j++) {
      const x = side === 'L' ? 82 + j * 22 : W - 82 - j * 22;
      const q = mkPlanet(G.genI++, x, hub.y - 230 - j * 185, o.biome);
      q.branch = side; G.planets.push(q); list.push(q);
    }
    addStars(list[0], list[1], side);
    F.branches[side] = { biome: o.biome, bi: o.bi, planets: list };
  });
  G.genY = hub.y - 230 - 185;
}

/** 허브에 도착: 시야를 넓힌다 */
export function enterFork() {
  const F = G.fork; if (!F || F.state !== 'hub') return;
  F.active = true;
  G.banner = { t: 0, dur: 1.8, a: '갈림길', b: '항로를 고르자', c: '#ffd9a8', sub: '' };
  toast('양쪽 항로가 열렸다', '#ffd9a8');
}

/** 항로의 첫 행성에 닿았다: 반대편을 치우고 바이옴·다음 보스를 확정한다 */
export function commitRoute(p) {
  const F = G.fork, side = p.branch, br = F.branches[side], other = side === 'L' ? 'R' : 'L';
  G.planets = G.planets.filter(q => q.branch !== other);
  G.stars = G.stars.filter(t => t.br !== other);
  G.biome = br.biome; G.nextBi = br.bi;
  G.genY = Math.min(...br.planets.map(q => q.y));
  G.fork = null;
  return br;
}
