/* 행성: 종류·바이옴에 따른 생성, 소행성 파쇄, 매 프레임의 맥박·등장·떠다님 */
import { G } from './state.js';
import { rnd, TAU } from './util.js';
import { BIOMES } from './data.js';
import { fs } from './stats.js';

/** 바이옴에 맞는 행성 종류를 고른다. 처음 몇 개는 항상 평범한 행성 */
function pickType(i, biome) {
  if (i <= 4) return 'n';
  const r = Math.random();
  switch (biome) {
    case 'belt': return r < .8 ? 'a' : 'n';
    case 'nebula': return r < .75 ? 'g' : 'n';
    case 'redzone': return r < .45 ? 'r' : r < .8 ? 'n' : 'g';
    case 'monster': return r < .7 ? 'n' : r < .85 ? 'g' : 'r';   // 일반 행성이 대부분: 독 행성은 지형이 아니라 그 사이를 떠다닌다
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
    case 'a': R = rnd(18, 24); ring = 64; break;
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
