/* 돌진 충전 링: 기체 둘레에 그려지는 충전 연출. 기본 디자인과 상점 디자인(shop-data.js 의 'charge' 칸)을 한곳에서 그린다.
 * c 는 cos.js 의 꾸밈 설정({charge: 디자인 값, chargecol: 색 값}), hue 는 색을 정하지 않았을 때 쓸 기본 색상(기체 색). */
import { g as gMain } from './state.js';
import { PI, TAU } from './util.js';
import { hslOf, isDuo, pass, drawDuo } from './cos.js';

let g = gMain;   // 그림을 그릴 판: 다색일 때 잠깐 따로 만든 판으로 바뀐다
const poly = (x, y, n, r, a0) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };

/** 디자인별 그리기. ch 는 충전량(0~1), col(l,a) 는 색 문자열 */
const DESIGNS = {
  /** 기본: 오므라드는 링과 진행 호 */
  base(x, y, ch, col, T) {
    const r = 46 - 30 * ch;
    g.strokeStyle = col(70 + 25 * ch, .35 + .5 * ch); g.lineWidth = 1.5 + 2.5 * ch; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 5, -PI / 2, -PI / 2 + TAU * ch); g.stroke();
  },
  /** 육각 응축: 돌며 오므라드는 육각형 */
  hex(x, y, ch, col, T) {
    const r = 46 - 28 * ch; g.lineJoin = 'round';
    g.strokeStyle = col(72, .45 + .45 * ch); g.lineWidth = 2 + 2 * ch; poly(x, y, 6, r, T * (1 + 2 * ch)); g.stroke();
    g.strokeStyle = col(86, .3 + .4 * ch); g.lineWidth = 1.4; poly(x, y, 6, r * .66, -T * (1.4 + 2 * ch)); g.stroke();
    g.fillStyle = col(92, .9); for (let i = 0; i < 6; i++) { const a = T * (1 + 2 * ch) + i / 6 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.5 + 1.5 * ch, 0, TAU); g.fill(); }
  },
  /** 별 문장: 돌며 모이는 오각별 */
  star(x, y, ch, col, T) {
    const r = 48 - 26 * ch, a0 = -PI / 2 + T * (.8 + 2 * ch); g.lineJoin = 'round';
    g.strokeStyle = col(76, .5 + .4 * ch); g.lineWidth = 1.8 + 1.8 * ch; g.beginPath();
    for (let i = 0; i <= 5; i++) { const a = a0 + i * 2 * TAU / 5; i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
    g.globalAlpha = .2 + .5 * ch; g.fillStyle = col(85, 1); g.beginPath(); g.arc(x, y, 4 + 5 * ch, 0, TAU); g.fill(); g.globalAlpha = 1;
  },
  /** 위성 궤도: 점 여섯 개가 안쪽으로 감겨 들어온다 */
  orbit(x, y, ch, col, T) {
    for (let i = 0; i < 6; i++) {
      const sp = 2 + 5 * ch, a = T * sp + i / 6 * TAU, r = (46 - 28 * ch) * (1 + .08 * Math.sin(T * 3 + i));
      g.strokeStyle = col(80, .35); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, a - .5, a); g.stroke();
      g.fillStyle = col(90, .95); g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2 + 1.5 * ch, 0, TAU); g.fill();
    }
  },
  /** 룬 링: 반대로 도는 점선 이중 링 */
  rune(x, y, ch, col, T) {
    const r = 44 - 22 * ch;
    g.lineWidth = 2.4; g.strokeStyle = col(76, .6 + .3 * ch); g.setLineDash([10, 7]); g.lineDashOffset = -T * 40 * (1 + ch); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = col(88, .55); g.setLineDash([3, 8]); g.lineDashOffset = T * 50 * (1 + ch); g.beginPath(); g.arc(x, y, r * .72, 0, TAU); g.stroke(); g.setLineDash([]);
  },
  /** 연꽃: 꽃잎이 오므라든다 */
  petals(x, y, ch, col, T) {
    const n = 8, r = 40 - 18 * ch, a0 = T * .8, pl = 14 + 6 * (1 - ch);
    g.strokeStyle = col(78, .6 + .3 * ch); g.lineWidth = 1.8; g.fillStyle = col(82, .12 + .15 * ch);
    for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; g.save(); g.translate(x + Math.cos(a) * r, y + Math.sin(a) * r); g.rotate(a); g.beginPath(); g.ellipse(0, 0, pl, 5.5 - 1.5 * ch, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
  },
  /** 시계: 눈금이 차례로 켜진다 */
  clock(x, y, ch, col, T) {
    const n = 24, on = Math.round(n * ch), r = 36;
    for (let i = 0; i < n; i++) { const a = -PI / 2 + i / n * TAU, lit = i < on, r0 = r - (lit ? 6 : 3), r1 = r + (lit ? 5 : 2); g.strokeStyle = lit ? col(88, .95) : col(70, .28); g.lineWidth = lit ? 2.6 : 1.4; g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke(); }
  },
  /** 소나: 바깥에서 안으로 파문이 계속 모인다 */
  sonar(x, y, ch, col, T) {
    for (let i = 0; i < 3; i++) { const k = ((T * (.7 + 1.4 * ch) + i / 3) % 1), r = 50 * (1 - k) + 6; g.strokeStyle = col(80, (1 - k) * (.35 + .55 * ch)); g.lineWidth = 1.5 + 2 * k; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  }
};

/** (x, y) 둘레에 충전 연출을 그린다. 가득 차면(ch>=1) 맥동 링이 더해진다 */
export function drawCharge(x, y, c, hue, ch, T) {
  const sp = c.chargecol, st = c.charge && c.charge.style, design = DESIGNS[st] || DESIGNS.base;
  g.save(); g.lineCap = 'round';
  if (isDuo(sp)) { // 다색: 색 B 링 위에 색 A 링을 부드러운 경계로 겹친다 (경계는 비중에 따라 오가고 천천히 흔들린다)
    g.save(); g.translate(x, y);
    drawDuo(gMain, 40, T, (ctx, i) => { const p = pass(sp, i); g = ctx; g.lineCap = 'round'; design(0, 0, ch, (l, a) => hslOf(p, hue, T, l, a), T); g = gMain; });
    g.restore();
  } else design(x, y, ch, (l, a) => hslOf(sp, hue, T, l, a), T);
  if (ch >= 1) { g.globalAlpha = .5 + .5 * Math.sin(T * 24); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 24 + 3 * Math.sin(T * 24), 0, TAU); g.stroke(); }
  g.restore();
}
