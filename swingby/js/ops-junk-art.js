/* 우주 쓰레기 그리기(ops-walls.js 가 부른다). 한 조각은 (-hl..hl, -hh..hh) 안에 들어가고, 색은 조각마다 다르다(도장 칠: 회색·녹슨 갈색·바랜 흰색·남색·그을린 붉은색…).
 * 모든 조각은 같은 방식으로 입체감을 낸다: 칠한 뒤 왼쪽 위에서 오는 빛으로 위는 밝게·아래는 어둡게(shade), 긁힌 자국·리벳·녹 같은 세부는 그 위에. 이 파일은 아무것도 import 하지 않는다. */
const TAU = Math.PI * 2;
const PAINT = [
  { fill: '#6e747c', edge: '#c8ced6', dark: '#1f2329' },   // 회색 장갑
  { fill: '#8a5c38', edge: '#e6b682', dark: '#2a180b' },   // 녹슨 갈색
  { fill: '#cfc8b4', edge: '#fff8e2', dark: '#4a4438' },   // 바랜 흰색
  { fill: '#3c5268', edge: '#a2c6e6', dark: '#0f1820' },   // 남색
  { fill: '#6a3a34', edge: '#eaa088', dark: '#200f0d' },   // 그을린 붉은색
  { fill: '#4a5046', edge: '#c0c8a8', dark: '#161912' }    // 군청회색
];
export const paintOf = (w, K) => w.seed < .3 ? K : PAINT[Math.floor((w.seed * 977) % 1 * PAINT.length)];

const seeded = s => { let r = Math.floor(s * 99991) + 7; return () => (r = (r * 9301 + 49297) % 233280) / 233280; };
const poly = (c, pts) => { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); };
const rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); };
const ln = (c, x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

/** 지금 만든 경로를 칠하고 입체 음영을 얹은 뒤 테두리를 두른다. after(): 같은 클립 안에서 그릴 세부 */
function shade(c, P, hl, hh, flash, after) {
  c.fillStyle = P.fill; c.fill();
  c.save(); c.clip();
  let g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(.4, 'rgba(255,255,255,.04)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(-hl - 2, -hh - 2, hl * 2 + 4, hh * 2 + 4);
  g = c.createLinearGradient(-hl, 0, hl, 0); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); c.fillStyle = g; c.fillRect(-hl - 2, -hh - 2, hl * 2 + 4, hh * 2 + 4);
  if (after) after();
  c.restore();
  c.strokeStyle = flash ? '#fff' : 'rgba(0,0,0,.78)'; c.lineWidth = 1.7; c.lineJoin = 'round'; c.stroke();
  c.strokeStyle = flash ? '#fff' : P.edge; c.lineWidth = .8; c.globalAlpha *= .55; c.stroke(); c.globalAlpha /= .55;
}
/** 녹·그을음 얼룩 */
const stains = (c, r, hl, hh, n, col) => { c.fillStyle = col; for (let i = 0; i < n; i++) { c.globalAlpha *= .5; c.beginPath(); c.ellipse((r() * 2 - 1) * hl * .8, (r() * 2 - 1) * hh * .7, 2 + r() * hl * .25, 1.5 + r() * hh * .3, r() * 3, 0, TAU); c.fill(); c.globalAlpha /= .5; } };
const rivets = (c, P, x0, x1, y, step) => { c.fillStyle = P.edge; for (let x = x0; x <= x1; x += step) dot(c, x, y, .85); };
const cells = (c, hl, hh, r, miss) => { // 전지판 칸: 남색 유리, 군데군데 깨짐
  const cw = 6.4, ch = 6.4;
  for (let x = -hl + 2; x < hl - 1; x += cw) for (let y = -hh + 2; y < hh - 1; y += ch) {
    const g = r() < miss; c.fillStyle = g ? '#0a0e14' : 'rgba(' + (40 + r() * 14 | 0) + ',' + (84 + r() * 20 | 0) + ',' + (140 + r() * 20 | 0) + ',.92)'; c.fillRect(x, y, cw - 1, ch - 1);
    if (!g) { c.fillStyle = 'rgba(190,225,255,.28)'; c.fillRect(x, y, cw - 1, 1.2); }
  }
};

const JUNK = {
  /** 컨테이너: 주름 골, 모서리 기둥, 문짝 걸쇠, 바랜 줄무늬와 녹 */
  container(c, w, P, hl, hh, r) {
    rr(c, -hl, -hh, hl * 2, hh * 2, 2.5);
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.strokeStyle = 'rgba(0,0,0,.34)'; c.lineWidth = 1; for (let x = -hl + 7; x < hl - 5; x += 4.2) ln(c, x, -hh + 1, x, hh - 1);
      c.strokeStyle = 'rgba(255,255,255,.12)'; for (let x = -hl + 8; x < hl - 5; x += 4.2) ln(c, x, -hh + 1, x, hh - 1);
      c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(-hl, -hh, 5, hh * 2); c.fillRect(hl - 5, -hh, 5, hh * 2); c.fillRect(-hl, -hh, hl * 2, 2.4); c.fillRect(-hl, hh - 2.4, hl * 2, 2.4);
      c.fillStyle = P.edge; c.globalAlpha *= .5; c.fillRect(-hl + 6, -hh * .35, hl * 2 - 12, 3); c.globalAlpha /= .5;
      c.strokeStyle = P.dark; c.lineWidth = 1.2; ln(c, 0, -hh, 0, hh); c.fillStyle = P.edge; c.fillRect(-3, -1, 2, 2); c.fillRect(1, -1, 2, 2);
      stains(c, r, hl, hh, 4, 'rgba(120,60,20,.7)');
    });
  },
  /** 태양전지판: 귀퉁이가 꺾이고 칸이 깨졌다. 버팀대가 삐져나온다 */
  panel(c, w, P, hl, hh, r) {
    poly(c, [[-hl, -hh], [hl * .35, -hh], [hl, -hh * .2 - r() * 4], [hl, hh], [-hl, hh]]);
    shade(c, { fill: '#26384c', edge: '#9fc4e8', dark: '#0a1018' }, hl, hh, w.flash > 0, () => {
      cells(c, hl, hh, r, .12);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .9; ln(c, -hl * .3, -hh, hl * .1, hh * .3); ln(c, hl * .1, hh * .3, hl * .5, hh);
      c.fillStyle = '#7d8590'; c.fillRect(-hl, -hh, hl * 2, 2.6); c.fillRect(-hl, hh - 2.6, hl * 2, 2.6); c.fillRect(-hl, -hh, 2.6, hh * 2);
    });
    c.strokeStyle = '#9aa2ac'; c.lineWidth = 1.6; ln(c, hl, hh * .5, hl + 6, hh + 3);
  },
  /** 탱크: 둥근 몸통, 두 개의 띠, 밸브와 압력계, 번진 얼룩 */
  tank(c, w, P, hl, hh, r) {
    rr(c, -hl, -hh * .86, hl * 2, hh * 1.72, hh * .86);
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.fillStyle = 'rgba(0,0,0,.34)'; c.fillRect(-hl * .46 - 2, -hh, 4, hh * 2); c.fillRect(hl * .46 - 2, -hh, 4, hh * 2);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-hl * .46 - 2, -hh, 1.4, hh * 2); c.fillRect(hl * .46 - 2, -hh, 1.4, hh * 2);
      c.fillStyle = 'rgba(255,255,255,.24)'; c.fillRect(-hl * .85, -hh * .52, hl * 1.7, 2.6);
      c.fillStyle = P.edge; c.globalAlpha *= .6; c.fillRect(-hl * .3, -hh * .1, hl * .6, hh * .3); c.globalAlpha /= .6;
      stains(c, r, hl, hh, 3, 'rgba(20,12,6,.6)');
    });
    c.fillStyle = '#8c929a'; c.fillRect(-2.2, -hh * .86 - 4, 4.4, 4); dot(c, 0, -hh * .86 - 5, 2.8); c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = .8; c.beginPath(); c.arc(0, -hh * .86 - 5, 2.8, 0, TAU); c.stroke();
  },
  /** 선체 조각: 찢긴 윤곽, 이음선과 리벳, 불에 그을린 곳, 뚫린 구멍 */
  hull(c, w, P, hl, hh, r) {
    const n = 12, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, q = (i % 2 ? .66 : .94) + r() * .12; pts.push([Math.cos(a) * hl * q, Math.sin(a) * hh * q]); }
    poly(c, pts);
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1.2; ln(c, -hl, -hh * .2, hl, -hh * .35); ln(c, -hl * .3, -hh, -hl * .1, hh);
      c.strokeStyle = 'rgba(255,255,255,.14)'; ln(c, -hl, -hh * .2 + 1.4, hl, -hh * .35 + 1.4);
      rivets(c, P, -hl * .8, hl * .8, -hh * .2 - 3.4, 5);
      const g = c.createRadialGradient(hl * .35, hh * .3, 0, hl * .35, hh * .3, hl * .6); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-hl, -hh, hl * 2, hh * 2);
      c.fillStyle = '#05060a'; c.beginPath(); c.ellipse(-hl * .3, hh * .22, hl * .2, hh * .26, .5, 0, TAU); c.fill(); c.strokeStyle = P.edge; c.lineWidth = 1; c.stroke();
    });
  },
  /** 엔진 노즐: 종 모양, 보강 고리, 그을린 목구멍 */
  engine(c, w, P, hl, hh, r) {
    poly(c, [[-hl, -hh * .52], [-hl * .3, -hh * .6], [hl * .6, -hh * .98], [hl, -hh], [hl, hh], [hl * .6, hh * .98], [-hl * .3, hh * .6], [-hl, hh * .52]]);
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.fillStyle = 'rgba(0,0,0,.36)'; for (const x of [-hl * .1, hl * .3, hl * .66]) c.fillRect(x, -hh, 3.2, hh * 2);
      c.fillStyle = 'rgba(255,255,255,.14)'; for (const x of [-hl * .1, hl * .3, hl * .66]) c.fillRect(x, -hh, 1.2, hh * 2);
      rivets(c, P, -hl * .9, -hl * .4, 0, 5);
      const g = c.createLinearGradient(hl * .5, 0, hl, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,4,.7)'); c.fillStyle = g; c.fillRect(hl * .5, -hh, hl, hh * 2);
    });
    c.fillStyle = '#06070a'; c.beginPath(); c.ellipse(hl - .5, 0, hh * .26, hh * .92, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,130,60,.4)'; c.lineWidth = 1; c.stroke();
  },
  /** 위성 잔해: 금박 몸체, 양쪽 전지판(한쪽은 비뚤어짐), 안테나와 접시 */
  satellite(c, w, P, hl, hh, r) {
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * hl * .72, 0); c.rotate(s * (.08 + r() * .14)); c.translate(-s * hl * .72, 0);
      rr(c, s > 0 ? hl * .46 : -hl, -hh * .56, hl * .54, hh * 1.12, 1.5);
      shade(c, { fill: '#26384c', edge: '#9fc4e8', dark: '#0a1018' }, hl, hh, w.flash > 0, () => { c.save(); c.translate(s * hl * .73, 0); cells(c, hl * .27, hh * .56, r, .1); c.restore(); });
      c.restore();
    }
    rr(c, -hl * .46, -hh * .86, hl * .92, hh * 1.72, 3);
    shade(c, { fill: '#b48a32', edge: '#ffe08a', dark: '#3a2a0a' }, hl, hh, w.flash > 0, () => {
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; for (let x = -hl * .4; x < hl * .45; x += 5) ln(c, x, -hh, x + 3, hh);
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-hl * .46, -hh * .86, hl * .92, 3);
    });
    c.strokeStyle = '#aab2bc'; c.lineWidth = 1.3; ln(c, hl * .1, -hh * .86, hl * .2, -hh - 6); c.fillStyle = '#d6dce4'; dot(c, hl * .2, -hh - 6.5, 1.8);
    c.fillStyle = '#9aa2ac'; c.beginPath(); c.ellipse(-hl * .15, hh * .98, 5, 2.6, 0, 0, Math.PI); c.fill();
  },
  /** 안테나 접시: 휜 그릇, 겹무늬, 급전 팔 */
  dish(c, w, P, hl, hh, r) {
    c.beginPath(); c.ellipse(0, -hh * .15, hl, hh * 1.12, 0, 0, Math.PI); c.closePath();
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; for (const f of [.35, .65]) { c.beginPath(); c.ellipse(0, -hh * .15, hl * f, hh * 1.12 * f, 0, 0, Math.PI); c.stroke(); }
      stains(c, r, hl, hh, 2, 'rgba(0,0,0,.5)');
    });
    c.strokeStyle = P.edge; c.lineWidth = 1.6; ln(c, 0, -hh * .15, hl * .34, -hh - 3); ln(c, -hl * .1, hh * .9, -hl * .1, hh + 4); c.fillStyle = P.edge; dot(c, hl * .34, -hh - 3.4, 2);
  },
  /** 드럼통: 테두리 고리와 찌그러진 옆구리 */
  drum(c, w, P, hl, hh, r) {
    const dw = Math.min(hl, hh * 1.25); rr(c, -dw, -hh, dw * 2, hh * 2, 4);
    shade(c, P, dw, hh, w.flash > 0, () => {
      c.fillStyle = 'rgba(0,0,0,.4)'; for (const x of [-dw * .55, 0, dw * .55]) c.fillRect(x - 1.4, -hh, 2.8, hh * 2);
      c.fillStyle = 'rgba(255,255,255,.2)'; for (const x of [-dw * .55, 0, dw * .55]) c.fillRect(x - 1.4, -hh, 1, hh * 2);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(dw * .3, -hh * .1, dw * .3, hh * .4, .5, 0, TAU); c.fill();
      c.fillStyle = '#d8b040'; c.fillRect(-dw * .3, -hh * .35, dw * .26, hh * .7); c.fillStyle = '#16120a'; c.fillRect(-dw * .26, -hh * .1, dw * .18, 2);
      stains(c, r, dw, hh, 3, 'rgba(110,50,14,.7)');
    });
  },
  /** 구조 트러스: 속이 빈 격자 들보 */
  truss(c, w, P, hl, hh, r) {
    const f = w.flash > 0, col = f ? '#fff' : P.edge;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rails = [-hh * .85, hh * .85], n = Math.max(2, Math.round(hl / 8)), seg = hl * 2 / n;
    const draw = (lw, st) => { c.strokeStyle = st; c.lineWidth = lw; for (const y of rails) ln(c, -hl, y, hl, y); for (let i = 0; i <= n; i++) ln(c, -hl + i * seg, rails[0], -hl + i * seg, rails[1]); for (let i = 0; i < n; i++) ln(c, -hl + i * seg, i % 2 ? rails[0] : rails[1], -hl + (i + 1) * seg, i % 2 ? rails[1] : rails[0]); };
    draw(4.2, 'rgba(0,0,0,.8)'); draw(2.4, P.fill === PAINT[0].fill ? '#7a828c' : P.fill); draw(.9, col);
    c.fillStyle = col; for (let i = 0; i <= n; i += 2) { dot(c, -hl + i * seg, rails[0], 1.5); dot(c, -hl + i * seg, rails[1], 1.5); }
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(hl, rails[0]); c.lineTo(hl + 5, rails[0] - 4); c.stroke();
    c.lineCap = 'butt';
  },
  /** 탈출 캡슐: 둥근 몸통, 푸른 창, 줄무늬 */
  pod(c, w, P, hl, hh, r) {
    rr(c, -hl, -hh * .9, hl * 2, hh * 1.8, hh * .9);
    shade(c, P, hl, hh, w.flash > 0, () => {
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(hl * .35, -hh, 3, hh * 2); c.fillStyle = '#d8553c'; c.fillRect(-hl * .75, -hh * .12, hl * .7, 3.2);
      stains(c, r, hl, hh, 3, 'rgba(0,0,0,.45)');
    });
    const g = c.createRadialGradient(-hl * .3 - 1.5, -2, 0, -hl * .3, 0, hh * .5); g.addColorStop(0, '#d8f4ff'); g.addColorStop(.5, '#4a8ab0'); g.addColorStop(1, '#0c2230'); c.fillStyle = g; c.beginPath(); c.ellipse(-hl * .3, 0, hh * .5, hh * .5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1.3; c.stroke();
  }
};
export const JUNK_SHAPES = Object.keys(JUNK);

/** 쓰레기 한 조각(월드 좌표 그리기 안에서). w: 벽 객체, K: 지역 색(KINDS) */
export function drawJunk(c, w, K, T) {
  const hl = w.hl, hh = w.th / 2, dmg = 1 - w.hp / w.max, P = paintOf(w, K), r = seeded(w.seed);
  c.save(); c.translate(w.x, w.y); c.rotate(w.a); c.globalAlpha = Math.min(1, .25 + w.born);
  c.scale(1 + w.sq * .06, 1 - w.sq * .1);
  JUNK[w.shape](c, w, P, hl, hh, r);
  if (w.kind === 'slab') { // 달아오른 쓰레기: 틈이 맥박처럼 빛난다
    const g2 = .5 + .5 * Math.sin(T * 2.2 + w.ph); c.strokeStyle = 'rgba(255,140,80,' + (.3 + .5 * g2) + ')'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(-hl * .5, -hh * .2); c.lineTo(-hl * .1, hh * .1); c.lineTo(hl * .2, -hh * .3); c.lineTo(hl * .55, hh * .2); c.stroke();
  }
  if (dmg > .25) { c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1.2; c.beginPath(); const n = Math.ceil(dmg * 4); for (let i = 0; i < n; i++) { const x = -hl + (i + .6) / (n + .2) * hl * 2; c.moveTo(x, -hh); c.lineTo(x + 3, -hh * .2); c.lineTo(x - 2, hh * .4); c.lineTo(x + 2, hh); } c.stroke(); }
  c.restore();
}
