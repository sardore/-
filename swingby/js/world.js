/* 월드 생성: 행성(종류·바이옴)·별·블랙홀, 그리고 갈림길(거대 암석 행성 + 좌우 항로) */
import { G } from './state.js';
import { W0, rnd, clamp, shuffle, TAU } from './util.js';
import { BIOMES, STAGES } from './data.js';
import { viewTop } from './camera.js';
import { fs } from './stats.js';

/* ---------- 필드 폭 ----------
 * 진행할수록 필드가 점점 넓어지고(카메라는 줌아웃) 행성·간격도 같이 커진다. 보스 아레나는 항상 기본 폭. */
const FIELD_MAX = 220;     // 기본 폭에서 최대로 더 넓어지는 양
/** 행성 하나 지날 때마다 조금씩 넓어진다 */
export const fieldTarget = () => W0 + Math.min(FIELD_MAX, G.hops * 2.2);
export function growField(dt) {
  if (G.boss || (G.fork && G.fork.state === 'hub')) return;   // 보스전·갈림길 선택 중에는 고정
  G.w += (fieldTarget() - G.w) * Math.min(1, dt * .9);
}

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
/** n 일반 · r 적색왜성 · g 가스행성 · a 소행성(떠나면 부서짐) · m 거대 암석(갈림길 허브). 크기는 지금 필드 배율을 따른다 */
export function mkPlanet(i, x, y, biome = 'normal', forceType) {
  const t = forceType || pickType(i, biome), k = fs();
  let R, ring;
  switch (t) {
    case 'g': R = rnd(34, 42); ring = 92; break;
    case 'r': R = rnd(16, 20); ring = 64; break;
    case 'a': R = rnd(11, 16); ring = 46; break;
    case 'm': R = rnd(60, 64); ring = 104; break;
    default: R = rnd(22, 30); ring = 76;
  }
  if (t !== 'm') ring -= Math.min(i * .45, 16) * (t === 'a' ? .5 : 1);
  R *= k; ring *= k;
  const hue = t === 'r' ? 8 : t === 'g' ? (biome === 'nebula' ? rnd(255, 300) : 36) : t === 'a' ? rnd(18, 42) : t === 'm' ? 24 : rnd(...BIOMES[biome].ph);
  return { i, x, y, R, cap: R + ring, t, hue, seen: false, ph: rnd(0, TAU), dead: false, re: 0, born: 1, sq: 0, pulse: 0, brittle: t === 'a' };
}

/** 소행성이 부서진다. 보스전에서는 잠시 뒤 다시 생기고, 평소에는 그대로 사라진다 */
export function shatter(p) {
  p.dead = true; p.re = G.boss ? 3 : 999; p.gone = !G.boss;
}

/** 행성별 맥박·찌그러짐·등장 애니메이션, 떠다니는 행성의 이동 (논리 시간 기준) */
export function animatePlanets(dt) {
  for (const p of G.planets) {
    if (p.dead) continue;
    if (p.pulse > 0) p.pulse = Math.max(0, p.pulse - dt * 2.5);
    if (p.sq > 0) p.sq = Math.max(0, p.sq - dt * 4);
    if (p.born < 1) p.born = Math.min(1, p.born + dt * 2);
    if (p.drift) { p.drift.t += dt * p.drift.sp; p.x = p.drift.x0 + Math.sin(p.drift.t) * p.drift.amp; }
  }
}

/* ---------- 별·블랙홀 ---------- */
function addStars(a, b, tag) {
  const k = Math.random() < .75 ? 1 + (Math.random() * 3 | 0) : 0;
  for (let j = 0; j < k; j++) {
    const f = (j + 1) / (k + 1);
    G.stars.push({ x: clamp(a.x + (b.x - a.x) * f + rnd(-22, 22), 14, G.w - 14), y: a.y + (b.y - a.y) * f + rnd(-22, 22), got: false, ph: rnd(0, TAU), br: tag });
  }
}
function maybeHole(prev, p, dy) {
  const odds = Math.min(.14 + G.genI * .006, .45) * (G.biome === 'void' ? 2.2 : 1);
  if (G.genI <= 7 || Math.random() >= odds || p.drift) return;
  const h = { x: clamp(G.w - (prev.x + p.x) / 2 + rnd(-40, 40) * fs(), 30, G.w - 30), y: G.genY + dy / 2 + rnd(-30, 30) * fs(), r: 13 * fs() };
  const d1 = Math.hypot(h.x - p.x, h.y - p.y), d2 = Math.hypot(h.x - prev.x, h.y - prev.y);
  if (d1 > p.cap + 40 && d2 > prev.cap + 40) G.holes.push(h);
}

/* ---------- 지형 패턴 ----------
 * 행성 몇 개마다 배치 방식이 바뀐다. 필드가 넓어질수록(진행할수록) 더 다양한 패턴이 열린다.
 *   scatter 흩뿌림 · zigzag 좌우 번갈아 · column 중앙 기둥 · cluster 3개 군집 뒤 긴 공백 · giant 거대 가스행성 · drift 좌우로 떠다님 */
const PATTERNS = [
  { k: 'scatter', from: 0,  w: 3, len: [3, 5] },
  { k: 'zigzag',  from: 10, w: 2, len: [4, 6] },
  { k: 'column',  from: 14, w: 1, len: [3, 4] },
  { k: 'giant',   from: 16, w: 1, len: [1, 1] },
  { k: 'cluster', from: 18, w: 1.5, len: [3, 3] },
  { k: 'drift',   from: 22, w: 1.5, len: [3, 4] }
];
function nextPattern(prevK) {
  const open = PATTERNS.filter(p => G.genI >= p.from), other = open.filter(p => p.k !== prevK), pool = other.length ? other : open;
  const tot = pool.reduce((a, p) => a + p.w, 0);
  let r = Math.random() * tot, pick = pool[0];
  for (const p of pool) { if ((r -= p.w) <= 0) { pick = p; break; } }
  return { k: pick.k, left: Math.round(rnd(pick.len[0], pick.len[1])), side: Math.random() < .5 ? -1 : 1, gap: G.pat.gap };
}

/** 다음 행성의 위치와 모양을 패턴에 따라 정한다 */
function place(prev) {
  if (G.pat.left <= 0) G.pat = nextPattern(G.pat.k);
  const P = G.pat, k = fs(), m = 58 * k, lo = m, hi = G.w - m, first = !P.started;
  P.started = true; P.left--;
  let dy = (rnd(150, 200) + Math.min(G.genI * 1.2, 40)) * k, x, mod = null;
  if (P.gap) { dy *= 1.55; P.gap = false; }
  switch (P.k) {
    case 'zigzag': { P.side = -P.side; x = P.side > 0 ? rnd(G.w * .64, hi) : rnd(lo, G.w * .36); break; }
    case 'column': { x = clamp(G.w / 2 + rnd(-36, 36) * k, lo, hi); dy *= .92; break; }
    case 'giant': { x = rnd(G.w * .3, G.w * .7); dy *= 1.1; mod = 'giant'; break; }
    case 'cluster': {
      if (first) x = rnd(G.w * .3, G.w * .7);
      else { P.side = -P.side; x = clamp(prev.x + P.side * rnd(78, 104) * k, lo, hi); }
      dy = first ? dy : rnd(78, 100) * k;
      if (P.left === 0) P.gap = true;
      break;
    }
    case 'drift': { x = rnd(lo + 60 * k, hi - 60 * k); mod = 'drift'; break; }
    default: { let n = 0; do { x = rnd(lo, hi); } while (Math.abs(x - prev.x) < 75 * k && n++ < 20); }
  }
  return { x, dy, mod };
}

/** 화면 위쪽이 비지 않도록 행성을 이어서 만든다. 갈림길 선택 대기 중에는 멈춘다 */
export function gen() {
  const F = G.fork;
  if (F && F.state === 'hub') return;
  while (G.genY > viewTop() - 320) {
    const prev = G.planets[G.planets.length - 1];
    if (F && F.state === 'queued' && G.genI >= F.at) { buildFork(prev); return; }
    const { x, dy, mod } = place(prev);
    G.genY -= dy;
    const p = mkPlanet(G.genI++, x, G.genY, G.biome, mod === 'giant' && G.biome !== 'belt' ? 'g' : undefined);
    if (mod === 'giant' && p.t === 'g') { const ring = p.cap - p.R; p.R *= 1.5; p.cap = p.R + ring * 1.35; p.giant = true; }
    if (mod === 'drift' && p.t !== 'm') p.drift = { x0: x, amp: Math.min(70 * fs(), x - 40, G.w - 40 - x), sp: rnd(.5, .8), t: rnd(0, TAU) };
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
  G.genY -= rnd(200, 220) * fs();
  const hub = mkPlanet(G.genI++, G.w / 2, G.genY, 'normal', 'm');
  G.planets.push(hub); addStars(prev, hub);
  F.hub = hub; F.state = 'hub'; F.branches = {};
  const opts = routeOptions();
  ['L', 'R'].forEach((side, si) => {
    const o = opts[si], list = [];
    for (let j = 0; j < 2; j++) {
      const f = (82 + j * 22) / W0, x = (side === 'L' ? f : 1 - f) * G.w;
      const q = mkPlanet(G.genI++, x, hub.y - 230 - j * 185, o.biome);
      q.branch = side; G.planets.push(q); list.push(q);
    }
    addStars(list[0], list[1], side);
    F.branches[side] = { biome: o.biome, bi: o.bi, planets: list };
  });
  G.genY = hub.y - (230 + 185) * fs();
}

/** 허브에 도착: 시야를 넓힌다 */
export function enterFork() {
  const F = G.fork; if (!F || F.state !== 'hub') return;
  F.active = true;
  G.banner = { t: 0, dur: 1.8, a: 'FORK', b: '갈림길', c: '#ffd9a8' };
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
