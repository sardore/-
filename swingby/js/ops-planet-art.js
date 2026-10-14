/* 블랙쉽 전용 행성 그리기(draw-planet2.js 가 포획 링·빛무리를 그린 뒤 이어서 부른다).
 *   s 중계기지 — 안테나 탑과 퍼져 나가는 신호 · d 보관고 — 육각 장갑판과 둥근 금고문 · h 홀로그램 위성 — 투명한 격자 구와 떠 있는 문양
 *   l 탐조등 위성 — 크레이터 달과 훑는 탐조등 빛 · k 출격 갑판(거대) — 해치와 경고등, 쾌속정이 나갈 항로 · v 보급 부두(거대) — 크레인과 정박한 수송선, 짐 표시
 * 글자는 쓰지 않는다: 출격 예고는 해치의 불빛과 점선 항로, 보급 부두의 보상은 짐 모양(진화 화살표 / 불꽃)으로만 알린다 */
import { G, g } from './state.js';
import { PI, TAU } from './util.js';
import { hash } from './draw-planet.js';
import { ART } from './ops-ship-art.js';

const LX = -.42, LY = -.5;
const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };

/** 철제 구체: 왼쪽 위가 밝고 오른쪽 아래가 어둡다 */
function steel(x, y, R, h, s, l) {
  const bd = g.createRadialGradient(x + LX * R * .7, y + LY * R * .7, R * .06, x + LX * R * .2, y + LY * R * .2, R * 1.15);
  bd.addColorStop(0, hsl(h, s, l + 24)); bd.addColorStop(.45, hsl(h, s, l)); bd.addColorStop(.85, hsl(h + 10, s, l * .5)); bd.addColorStop(1, hsl(h + 14, s, l * .28));
  g.fillStyle = bd; circle(x, y, R); g.fill();
}
/** 어두운 면 + 빛 쪽 테두리(마무리) */
function finish(x, y, R, h) {
  const sh = g.createRadialGradient(x + LX * R * .5, y + LY * R * .5, R * .55, x + LX * R * .5, y + LY * R * .5, R * 1.55);
  sh.addColorStop(0, 'rgba(0,0,12,0)'); sh.addColorStop(.6, 'rgba(0,0,12,.12)'); sh.addColorStop(1, 'rgba(0,0,12,.6)');
  g.fillStyle = sh; g.fillRect(x - R * 1.3, y - R * 1.3, R * 2.6, R * 2.6);
}
const rim = (x, y, R, h) => { g.strokeStyle = hsl(h, 40, 86, .45); g.lineWidth = Math.max(1, R * .05); g.beginPath(); g.arc(x, y, R - g.lineWidth * .5, PI * .92, PI * 1.58); g.stroke(); };
const lamp = (x, y, r, col, a) => { const p = g.globalAlpha; g.globalAlpha = p * (a == null ? 1 : a); g.fillStyle = col; circle(x, y, r); g.fill(); g.globalAlpha = p; };

export function drawOpsPlanet(p, R) {
  const T = G.T, x = p.x, y = p.y, h = p.hue;
  switch (p.t) {
    case 's': relay(p, x, y, R, h, T); break;
    case 'd': vault(p, x, y, R, h, T); break;
    case 'h': holo(p, x, y, R, h, T); break;
    case 'l': moon(p, x, y, R, h, T); break;
    case 'k': hangar(p, x, y, R, h, T); break;
    case 'v': depot(p, x, y, R, h, T); break;
  }
}

/** 중계기지: 회색 구체 위의 안테나 탑, 적도의 신호등, 탑 끝에서 퍼져 나가는 호 */
function relay(p, x, y, R, h, T) {
  steel(x, y, R, h, 14, 40);
  g.save(); circle(x, y, R); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(x, y, R, R * (.18 + Math.abs(i) * .2), 0, 0, TAU); g.stroke(); }
  g.fillStyle = hsl(h, 20, 20, .8); g.fillRect(x - R, y - R * .12, R * 2, R * .24);   // 적도 띠
  for (let i = 0; i < 8; i++) { const a = (i / 8 + T * .05) * TAU, k = Math.cos(a); if (k > -.1) lamp(x + Math.sin(a) * R * .94, y, 1.1, i % 3 ? '#ffd9a0' : '#ff6a4a', .35 + .5 * Math.max(0, k) * (.5 + .5 * Math.sin(T * 3 + i))); }
  finish(x, y, R, h); g.restore();
  rim(x, y, R, h);
  const tip = y - R - R * .62;   // 탑
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = Math.max(2, R * .12); g.beginPath(); g.moveTo(x, y - R + 2); g.lineTo(x, tip); g.stroke();
  g.strokeStyle = hsl(h, 14, 72); g.lineWidth = Math.max(1.2, R * .07); g.beginPath(); g.moveTo(x - .5, y - R + 2); g.lineTo(x - .5, tip); g.stroke();
  g.strokeStyle = hsl(h, 14, 62); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - R * .28, tip + R * .22); g.lineTo(x + R * .28, tip + R * .22); g.moveTo(x - R * .2, tip + R * .4); g.lineTo(x + R * .2, tip + R * .4); g.stroke();
  lamp(x, tip, 2, '#ff5a4a', .5 + .5 * Math.sin(T * 5 + p.ph));
  for (let i = 0; i < 3; i++) { const k = ((T * .6 + i / 3) % 1); g.strokeStyle = hsl(h, 60, 78, (1 - k) * .45); g.lineWidth = 1.4; g.beginPath(); g.arc(x, tip, R * .25 + k * R * .9, -PI * .85, -PI * .15); g.stroke(); }
}

/** 보관고: 육각 장갑판 무늬와 한가운데 둥근 금고문(살이 천천히 돈다) */
function vault(p, x, y, R, h, T) {
  steel(x, y, R, h, 12, 36);
  g.save(); circle(x, y, R); g.clip();
  const hr = R * .34; g.lineWidth = 1;
  for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++) {
    const cx = x + (col + (row & 1 ? .5 : 0)) * hr * 1.74, cy = y + row * hr * 1.5; if (Math.hypot(cx - x, cy - y) > R * 1.1) continue;
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; k ? g.lineTo(cx + Math.cos(a) * hr * .98, cy + Math.sin(a) * hr * .98) : g.moveTo(cx + Math.cos(a) * hr * .98, cy + Math.sin(a) * hr * .98); } g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(cx - hr * .8, cy - hr * .4); g.lineTo(cx, cy - hr * .9); g.stroke();
  }
  // 금고문
  const dr = R * .42; steel(x - R * .06, y + R * .02, dr, h, 10, 30); g.strokeStyle = hsl(h, 20, 70, .8); g.lineWidth = 1.6; circle(x - R * .06, y + R * .02, dr); g.stroke();
  g.save(); g.translate(x - R * .06, y + R * .02); g.rotate(T * .12); g.strokeStyle = hsl(h, 16, 68, .9); g.lineWidth = Math.max(1.4, R * .06);
  for (let i = 0; i < 4; i++) { g.rotate(PI / 4); g.beginPath(); g.moveTo(-dr * .78, 0); g.lineTo(dr * .78, 0); g.stroke(); } g.restore();
  lamp(x - R * .06, y + R * .02, R * .08, '#1a1208'); lamp(x - R * .06, y + R * .02, R * .05, '#ffd070', .6 + .4 * Math.sin(T * 2 + p.ph));
  finish(x, y, R, h); g.restore(); rim(x, y, R, h);
}

/** 홀로그램 위성: 속이 비치는 격자 구와 위에 떠서 도는 문양(삼각 눈) */
function holo(p, x, y, R, h, T) {
  const hh = h; g.globalCompositeOperation = 'lighter';
  const bd = g.createRadialGradient(x, y, R * .2, x, y, R); bd.addColorStop(0, hsl(hh, 70, 50, .05)); bd.addColorStop(1, hsl(hh, 80, 60, .3)); g.fillStyle = bd; circle(x, y, R); g.fill();
  g.strokeStyle = hsl(hh, 80, 72, .55); g.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(x, y + i * R * .32, Math.sqrt(Math.max(0, 1 - Math.pow(i * .32, 2))) * R, R * .14, 0, 0, TAU); g.stroke(); }
  for (let i = 0; i < 4; i++) { const k = Math.cos((i / 4 + T * .04) * PI); g.beginPath(); g.ellipse(x, y, Math.abs(k) * R, R, 0, 0, TAU); g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  rim(x, y, R, hh);
  // 떠 있는 문양: 위로 쏘아 올린 빛줄기와 돌아가는 삼각형 안의 눈
  const hy = y - R - R * .75, k = .75 + .25 * Math.sin(T * 3 + p.ph);
  g.globalCompositeOperation = 'lighter';
  const bm = g.createLinearGradient(0, y - R, 0, hy); bm.addColorStop(0, hsl(hh, 90, 70, .35)); bm.addColorStop(1, hsl(hh, 90, 70, .05)); g.fillStyle = bm;
  g.beginPath(); g.moveTo(x - R * .22, y - R * .9); g.lineTo(x + R * .22, y - R * .9); g.lineTo(x + R * .42, hy); g.lineTo(x - R * .42, hy); g.closePath(); g.fill();
  g.save(); g.translate(x, hy); g.scale(Math.cos(T * 1.3) * .5 + .6, 1); g.strokeStyle = hsl(hh, 95, 78, .9 * k); g.lineWidth = 1.5;
  g.beginPath(); for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; i ? g.lineTo(Math.cos(a) * R * .42, Math.sin(a) * R * .42) : g.moveTo(Math.cos(a) * R * .42, Math.sin(a) * R * .42); } g.closePath(); g.stroke();
  g.beginPath(); g.ellipse(0, 0, R * .22, R * .11, 0, 0, TAU); g.stroke(); lamp(0, 0, R * .06, hsl(hh, 100, 85)); g.restore();
  g.globalCompositeOperation = 'source-over';
}

/** 탐조등 위성: 크레이터 달 위의 탑에서 빛이 천천히 훑는다 */
function moon(p, x, y, R, h, T) {
  steel(x, y, R, h, 10, 46);
  g.save(); circle(x, y, R); g.clip();
  for (let i = 0; i < 6; i++) { const a = hash(p, i) * TAU, d = Math.sqrt(hash(p, i + 20)) * R * .75, r = R * (.1 + .12 * hash(p, i + 40)), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; g.fillStyle = 'rgba(10,10,16,.4)'; circle(cx, cy, r); g.fill(); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.beginPath(); g.arc(cx - r * .1, cy - r * .1, r, PI * .9, PI * 1.9); g.stroke(); }
  finish(x, y, R, h); g.restore(); rim(x, y, R, h);
  // 탑과 탐조등
  const a0 = -PI / 2 + Math.sin(T * .5 + p.ph) * 1.1, bx = x + Math.cos(-PI / 2 + .35) * R * .8, by = y + Math.sin(-PI / 2 + .35) * R * .8;
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - R * .35); g.stroke();
  g.save(); g.translate(bx, by - R * .35); g.rotate(a0);
  g.fillStyle = '#2a2a30'; g.fillRect(-2, -3.2, 8, 6.4); lamp(6.5, 0, 2.2, '#fff6d0');
  g.globalCompositeOperation = 'lighter'; const L = R * 3.2, bm = g.createLinearGradient(6, 0, L, 0); bm.addColorStop(0, 'rgba(255,246,208,.42)'); bm.addColorStop(1, 'rgba(255,246,208,0)');
  g.fillStyle = bm; g.beginPath(); g.moveTo(6, -1.6); g.lineTo(L, -R * .55); g.lineTo(L, R * .55); g.lineTo(6, 1.6); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; g.restore();
}

/** 출격 갑판: 어두운 장갑 구체에 해치 둘. 곧 쾌속정이 나갈 해치는 열리고 경고등이 번쩍이며, 나갈 방향으로 점선 항로가 뻗는다 */
function hangar(p, x, y, R, h, T) {
  const gm = p.gim || { ang: [0, PI], open: 0, warn: 0, hatch: 0 };
  steel(x, y, R, h, 8, 24);
  g.save(); circle(x, y, R); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(x, y, Math.abs(Math.cos(i / 7 * PI)) * R, R, 0, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.07)'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(x + 1, y, Math.abs(Math.cos(i / 7 * PI)) * R, R, 0, 0, TAU); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - R, y - R * .1, R * 2, R * .2);
  finish(x, y, R, h); g.restore(); rim(x, y, R, h);
  // 해치
  gm.ang.forEach((a, i) => {
    const hot = gm.warn > 0 && gm.hatch === i, op = hot ? gm.open : 0, cx = x + Math.cos(a) * R * .94, cy = y + Math.sin(a) * R * .94, blink = hot ? (Math.floor(T * 7) % 2) : 0;
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = '#06070a'; g.fillRect(-R * .1, -R * .2, R * .26, R * .4);
    if (op > 0) { const gr = g.createLinearGradient(-R * .1, 0, R * .5, 0); gr.addColorStop(0, 'rgba(255,90,50,' + .8 * op + ')'); gr.addColorStop(1, 'rgba(255,90,50,0)'); g.fillStyle = gr; g.fillRect(-R * .1, -R * .2 * op, R * .7, R * .4 * op); }
    g.fillStyle = '#3a3d44'; g.fillRect(-R * .12, -R * .24, R * .18, R * .09 * (1 - op * .8)); g.fillRect(-R * .12, R * .15 + R * .09 * op * .8, R * .18, R * .09 * (1 - op * .8));
    for (const s of [-1, 1]) lamp(R * .18, s * R * .27, Math.max(1.4, R * .035), blink ? '#ff3a2a' : '#5a1a14', blink ? 1 : .8);
    g.restore();
    if (hot) { // 점선 항로: 나가는 방향으로
      g.save(); g.setLineDash([5, 8]); g.lineDashOffset = -T * 40; g.strokeStyle = 'rgba(255,110,70,' + (.25 + .35 * blink) + ')'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .3, cy + Math.sin(a) * R * .3); g.lineTo(x + Math.cos(a) * (G.w * .9), y + Math.sin(a) * (G.w * .9)); g.stroke(); g.restore();
    }
  });
  // 가장자리 항로등
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + T * .1; lamp(x + Math.cos(a) * (R + 5), y + Math.sin(a) * (R + 5), 1.2, '#ff6a4a', .15 + .4 * (.5 + .5 * Math.sin(T * 2 + i))); }
}

/** 보급 부두: 밝은 철제 행성, 옆으로 뻗은 부두 팔과 크레인, 정박한 수송선. 수송선 위에 떠 있는 짐 표시가 보상 */
function depot(p, x, y, R, h, T) {
  const gm = p.gim || { reward: 'evo', used: false, leave: 0, a: -.6 };
  steel(x, y, R, h, 12, 44);
  g.save(); circle(x, y, R); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(x, y + i * R * .26, R, R * .08, 0, 0, TAU); g.stroke(); }
  for (let i = 0; i < 6; i++) { const a = hash(p, i) * TAU, d = hash(p, i + 10) * R * .7; g.fillStyle = 'rgba(255,230,170,.7)'; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 1.4); }   // 창문 불빛
  finish(x, y, R, h); g.restore(); rim(x, y, R, h);
  // 부두 팔(오른쪽) + 크레인
  const side = gm.a > -.6 ? 1 : -1, px = x + side * R * .92, py = y + R * .12, armL = R * .95;
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = R * .14; g.beginPath(); g.moveTo(px, py); g.lineTo(px + side * armL, py); g.stroke();
  g.strokeStyle = hsl(h, 12, 66); g.lineWidth = R * .09; g.beginPath(); g.moveTo(px, py - 1); g.lineTo(px + side * armL, py - 1); g.stroke();
  g.strokeStyle = hsl(h, 14, 56); g.lineWidth = 1.4; g.beginPath(); g.moveTo(px + side * armL * .3, py); g.lineTo(px + side * armL * .3, py - R * .5); g.lineTo(px + side * armL * .9, py - R * .5); g.stroke();
  lamp(px + side * armL * .9, py - R * .5, 1.8, '#ffd070', .5 + .5 * Math.sin(T * 4));
  // 정박한 수송선(받침 위): 떠날 때는 멀리 미끄러져 나간다
  const lv = gm.leave, sx = px + side * (armL * .55 + lv * R * 3), sy = py + R * .1 - lv * R * .4;
  if (lv < 1) {
    g.save(); g.globalAlpha = 1 - lv; g.translate(sx, sy); g.scale(side * R / 20, R / 20);
    const { PAL, shape, mir, rect, lamp: l2 } = ART;
    shape(g, rect(-12, -3.4, 12, 4.4), PAL.tan, { noShadow: true });
    for (let i = 0; i < 3; i++) shape(g, rect(-10.4 + i * 7, -8, -4.6 + i * 7, -3.4), i === 1 ? PAL.white : PAL.brown, { noShadow: true });
    shape(g, mir([[16, 0], [12, 2.6], [12, -2.6]]), PAL.gun, { noShadow: true }); l2(g, 15, 0, .9, '#ffd070');
    g.restore();
  }
  // 짐 표시: 진화(위를 가리키는 쌍화살표) / 비상 추진기(불꽃). 수송선 위에 떠서 위아래로 천천히 흔들린다
  if (!gm.used) {
    const bob = Math.sin(T * 2.4 + p.ph) * 3, ix = sx, iy = sy - R * .62 + bob, r = R * .26;
    g.save(); g.translate(ix, iy);
    const bg = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.7); bg.addColorStop(0, gm.reward === 'evo' ? 'rgba(160,220,255,.5)' : 'rgba(255,150,90,.5)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = bg; circle(0, 0, r * 1.7); g.fill();
    if (gm.reward === 'evo') {
      g.strokeStyle = '#bfe8ff'; g.lineWidth = Math.max(2, r * .26); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const k of [0, 1]) { g.globalAlpha = k ? .55 : 1; g.beginPath(); g.moveTo(-r * .8, r * (.15 - k * .85)); g.lineTo(0, -r * (.55 + k * .85) + r * .2); g.lineTo(r * .8, r * (.15 - k * .85)); g.stroke(); }
      g.globalAlpha = 1;
    } else {
      const f = 1 + .12 * Math.sin(T * 14);
      g.fillStyle = '#ff7a3a'; g.beginPath(); g.moveTo(0, -r * 1.1 * f); g.bezierCurveTo(r * .9, -r * .2, r * .8, r * .8, 0, r * .9); g.bezierCurveTo(-r * .8, r * .8, -r * .9, -r * .2, 0, -r * 1.1 * f); g.fill();
      g.fillStyle = '#ffd070'; g.beginPath(); g.moveTo(0, -r * .4); g.bezierCurveTo(r * .45, r * .1, r * .4, r * .6, 0, r * .65); g.bezierCurveTo(-r * .4, r * .6, -r * .45, r * .1, 0, -r * .4); g.fill();
    }
    g.restore();
  }
}
