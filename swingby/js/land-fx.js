/* 착지 링: 행성에 붙을 때 번지는 링. 색은 늘 기체 색이고, 모양만 상점 상품('landshape' 칸, shop-data.js)으로 바뀐다.
 * 링 하나는 fx 목록의 항목({x,y,c,r0,r1,t,dur,w})이고, shape 가 있으면 원 대신 그 모양으로 그려진다. */
import { TAU } from './util.js';

/** 모양 정의: poly 정다각형 · star 안쪽 꼭짓점이 있는 별 · lobe 둘레가 물결치는 꽃 */
const SHAPES = {
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

/** 모양별 구성. 층마다 [모양, 크기 배율, 지속(초), 선 굵기, 회전(rad/지속), 지연(초), 옵션]: 옵션 w 흰색 · f 안을 옅게 채움.
 * 첫 층이 주인공 링이고, 입자는 sp 개가 그 꼭짓점 방향으로 뻗는다 */
const LAYERS = {
  hex:     { sp: 6,  L: [['hex', 1.2, .75, 4, 1.4, 0, 'f'], ['hex', .9, .6, 2.5, -2.4, .06, 'w'], ['hex', 1.55, .95, 1.4, .8, .12, '']] },
  diamond: { sp: 4,  L: [['diamond', 1.25, .7, 3.6, .5, 0, 'f'], ['diamond', .8, .5, 2.2, -.9, .05, 'w'], ['diamond', 1.6, .9, 1.4, .3, .12, '']] },
  tri:     { sp: 6,  L: [['tri', 1.25, .75, 3.6, 1.2, 0, ''], ['tri', 1.25, .75, 3.6, -1.2, 0, 'f'], ['tri', .75, .5, 2, 2.4, .08, 'w']] },
  cross:   { sp: 4,  L: [['cross', 1.35, .7, 3.4, .9, 0, 'f'], ['cross', .95, .5, 2.2, -1.6, .05, 'w'], ['cross', 1.8, .9, 1.2, .4, .1, '']] },
  star:    { sp: 5,  L: [['star', 1.3, .8, 3.4, 1.2, 0, 'f'], ['hex', .6, .6, 2, -2, .05, 'w'], ['star', 1.7, 1, 1.3, -.7, .12, '']] },
  gear:    { sp: 6,  L: [['gear', 1.2, .8, 3.6, 1.8, 0, 'f'], ['gear', .85, .6, 2.4, -2.8, .06, 'w'], ['gear', 1.5, .95, 1.4, 1, .12, '']] },
  flower:  { sp: 8,  L: [['flower', 1.25, .85, 3.4, 1.0, 0, 'f'], ['flower', 1.0, .7, 2.4, -1.4, .05, 'w'], ['flower', 1.65, 1, 1.3, .6, .12, '']] }
};
const TEMPO = .62;   // 연출 속도 배율(작을수록 빠르다)
const PEAKS = { hex: 6, diamond: 4, tri: 3, star: 5, cross: 4, gear: 12, flower: 8 };

/** 착지 링을 list 에(입자는 parts 에) 더한다. R 은 행성 반지름, cap 은 포획 범위, hue 는 기체 색상, shape 는 상품 값({style}) 또는 null(기본 원) */
export function spawnLand(list, parts, x, y, R, cap, hue, shape) {
  const col = (l, a) => 'hsla(' + hue + ',90%,' + l + '%,' + a + ')', st = shape && shape.style, def = st && LAYERS[st];
  if (!def) { list.push({ x, y, c: col(75, .9), r0: R, r1: cap * .9, t: 0, dur: .5, w: 3 }); return; }
  const rot = Math.random() * TAU, dir = Math.random() < .5 ? -1 : 1;
  for (const [s, m, dur, w, spin, delay, opt] of def.L) {
    const white = opt.includes('w');
    list.push({ x, y, c: white ? '#fff' : col(72, .95), r0: R * .7, r1: cap * m, t: -delay * TEMPO, dur: dur * TEMPO, w, shape: s, rot: rot + (white ? Math.PI / PEAKS[s] : 0), spin: spin * dir, fill: opt.includes('f') ? .16 : 0 });
  }
  const main = def.L[0], n = def.sp;
  for (let i = 0; i < n; i++) {   // 꼭짓점 방향으로 뻗는 빛줄기
    const a = rot + i / n * TAU + (main[0] === 'gear' ? TAU / 24 : 0), v = cap * 3.8;
    parts.push({ x: x + Math.cos(a) * R * 1.1, y: y + Math.sin(a) * R * 1.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, l: .3, c: col(82, 1), s: 3.4, line: true });
  }
}

/** 상점 목록용 작은 그림: 모양 두 겹 */
export function drawShapeIcon(g, x, y, style, hue) {
  const f = { x, y, shape: style, rot: -Math.PI / 2, spin: 0, t: 0, dur: 1 };
  g.save(); g.lineJoin = 'round'; g.shadowColor = 'hsl(' + hue + ',100%,70%)'; g.shadowBlur = 8;
  g.strokeStyle = 'hsl(' + hue + ',90%,72%)'; g.lineWidth = 2; ringPath(g, f, 12); g.stroke();
  g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2; f.rot += Math.PI / PEAKS[style]; ringPath(g, f, 6.5); g.stroke();
  g.restore();
}
