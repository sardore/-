/* 별·블랙홀 배치: 행성 사이를 잇는 별 줄과, 길목에 가끔 놓이는 블랙홀 */
import { G } from './state.js';
import { rnd, clamp, TAU } from './util.js';
import { fs } from './stats.js';

export function addStars(a, b, tag) {
  const k = Math.random() < .75 ? 1 + (Math.random() * 3 | 0) : 0;
  for (let j = 0; j < k; j++) {
    const f = (j + 1) / (k + 1);
    G.stars.push({ x: clamp(a.x + (b.x - a.x) * f + rnd(-22, 22), 14, G.w - 14), y: a.y + (b.y - a.y) * f + rnd(-22, 22), got: false, ph: rnd(0, TAU), br: tag });
  }
}
export function maybeHole(prev, p, dy) {
  const odds = Math.min(.14 + G.genI * .006, .45) * (G.biome === 'void' ? 2.2 : 1);
  if (G.genI <= 7 || Math.random() >= odds || p.drift) return;
  const h = { x: clamp(G.w - (prev.x + p.x) / 2 + rnd(-40, 40) * fs(), 30, G.w - 30), y: G.genY + dy / 2 + rnd(-30, 30) * fs(), r: 13 * fs() };
  const d1 = Math.hypot(h.x - p.x, h.y - p.y), d2 = Math.hypot(h.x - prev.x, h.y - prev.y);
  if (d1 > p.cap + 40 && d2 > prev.cap + 40) G.holes.push(h);
}
