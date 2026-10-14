/* 착지 링: 행성에 붙을 때 번지는 링. 색은 늘 기체 색이고, 모양만 상점 상품('landshape' 칸, shop-data.js)으로 바뀐다.
 * 링 하나는 fx 목록의 항목({x,y,c,r0,r1,t,dur,w})이고, shape 가 있으면 원 대신 그 모양으로 그려진다. */
import { TAU } from './util.js';

/** 모양 정의: poly 정다각형 · star 안쪽 꼭짓점이 있는 별 · lobe 둘레가 물결치는 꽃 */
export const SHAPES = {
  hex:     { t: 'poly', n: 6 },
  diamond: { t: 'poly', n: 4 },
  tri:     { t: 'poly', n: 3 },
  star:    { t: 'star', n: 5, k: .45 },
  cross:   { t: 'star', n: 4, k: .3 },
  gear:    { t: 'star', n: 12, k: .78 },
  flower:  { t: 'lobe', n: 8, k: .17 }
};

/** 링 f 를 반지름 r 로 그리는 경로를 만든다 (선을 긋는 일은 부르는 쪽) */
export function ringPath(g, f, r) {
  g.beginPath();
  const s = f.shape && SHAPES[f.shape];
  if (!s) { g.arc(f.x, f.y, r, 0, TAU); return; }
  const rot = f.rot + f.spin * (f.t / f.dur);
  const pts = s.t === 'lobe' ? 72 : s.t === 'star' ? s.n * 2 : s.n;
  for (let i = 0; i < pts; i++) {
    const a = rot + i / pts * TAU;
    const rr = s.t === 'lobe' ? r * (1 + s.k * Math.cos(s.n * (a - rot))) : s.t === 'star' && i % 2 ? r * s.k : r;
    const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

/** 착지 링을 list 에 더한다. R 은 행성 반지름, cap 은 포획 범위, col 은 기체 색(h 색상), shape 는 상품 값({style}) 또는 null(기본 원) */
export function spawnLand(list, x, y, R, cap, hue, shape) {
  const col = (l, a) => 'hsla(' + hue + ',90%,' + l + '%,' + a + ')', st = shape && shape.style, rot = Math.random() * TAU;
  if (!st) { list.push({ x, y, c: col(75, .9), r0: R, r1: cap * .9, t: 0, dur: .5, w: 3 }); return; }
  const spin = (Math.random() < .5 ? -1 : 1) * 1.6;
  list.push({ x, y, c: col(72, .95), r0: R * .6, r1: cap * 1.15, t: 0, dur: .7, w: 4, shape: st, rot, spin });
  list.push({ x, y, c: '#fff', r0: R, r1: cap * .7, t: 0, dur: .35, w: 2, shape: st, rot, spin: -spin });
}
