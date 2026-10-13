/* 고유 패턴이 쓰는 범용 존: 정의(z)를 지금 보스 위치에 맞춰 놓고(place), 존 안의 임의의 점을 뽑는다.
 * 모양: c 원(x,y,r) · w 부채꼴(x,y,a,half,len) · b 띠(x,y,w,hh: 가로·세로 반폭) · o 도넛(x,y,r1,r2) */
import { G } from './state.js';
import { rnd, clamp, TAU } from './util.js';
import { arenaH } from './camera.js';

/** rel 이면 좌표가 보스 기준(보스와 함께 올라감), vert 이면 아레나 전체 높이를 덮는 세로 띠 */
export function place(z, b) {
  const o = Object.assign({}, z);
  if (z.rel) { o.x = b.x + z.x; o.y = b.y + z.y; }
  if (z.vert) { o.y = (G.arenaTop + G.arenaBot) / 2; o.hh = arenaH() * .7; }
  return o;
}

/** 존 안의 임의의 점 (파티클·불꽃 위치용) */
export function randIn(h) {
  if (h.shape === 'b') return { x: clamp(h.x + rnd(-h.w, h.w), 0, G.w), y: clamp(h.y + rnd(-h.hh, h.hh), G.arenaTop, G.arenaBot) };
  if (h.shape === 'o') { const a = rnd(0, TAU), r = rnd(h.r1, h.r2); return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }; }
  const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * (h.r || 0); return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r };
}
