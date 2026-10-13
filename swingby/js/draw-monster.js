/* 괴물 행성 그리기: 종류(slime · eye · urchin · maw)마다 몸 모양이 다르고, 색은 주로 녹색.
 * 눈동자는 기체를 따라 움직이고, 맞으면 하얗게 번쩍이며, 다치면 아래에 체력 호가 나타난다. */
import { G, g } from './state.js';
import { TAU, PI } from './util.js';
import { reachOf } from './monsters.js';

const hsl = (h, s, l, a = 1) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';

/** 기체 쪽을 바라보는 눈동자 오프셋 (최대 lim) */
function gaze(m, lim) {
  const dx = G.ship.x - m.x, dy = G.ship.y - m.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160) * lim;
  return [dx / d * k, dy / d * k];
}
const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
function eyeball(m, x, y, r, iris) {
  const [gx, gy] = gaze(m, r * .35);
  dot(x, y, r, '#f2ffe0'); g.strokeStyle = hsl(m.hue - 60, 70, 40, .55); g.lineWidth = Math.max(1, r * .06);
  for (let i = 0; i < 4; i++) { const a = m.ph + i * 1.6; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .95); g.lineTo(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55); g.stroke(); }
  dot(x + gx, y + gy, r * iris, hsl(m.hue + 70, 90, 52)); dot(x + gx, y + gy, r * iris * .52, '#10051a');
  dot(x + gx - r * iris * .3, y + gy - r * iris * .3, r * iris * .2, '#fff');
}

const BODY = {
  slime(m, R, T) { // 출렁이는 점액 덩어리
    const n = 16, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, w = 1 + .07 * Math.sin(T * 3 + i * 1.7 + m.ph) + .04 * Math.sin(T * 5 + i * 2.9); pts.push([Math.cos(a) * R * w, Math.sin(a) * R * w * .94]); }
    const path = () => { g.beginPath(); g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2); for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } g.closePath(); };
    const gr = g.createRadialGradient(-R * .25, -R * .3, R * .1, 0, 0, R * 1.1); gr.addColorStop(0, hsl(m.hue, 85, 68)); gr.addColorStop(1, hsl(m.hue, 80, 28));
    path(); g.fillStyle = gr; g.fill(); g.strokeStyle = hsl(m.hue, 90, 18); g.lineWidth = 2.5; g.stroke();
    g.fillStyle = hsl(m.hue, 90, 85, .45); g.beginPath(); g.ellipse(-R * .32, -R * .5, R * .26, R * .12, -.5, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) dot(Math.cos(m.ph + i * 2.2) * R * .45, Math.sin(m.ph * 2 + i * 2.2) * R * .4 + R * .1, R * (.07 + i * .02), hsl(m.hue, 80, 80, .35));
    eyeball(m, -R * .3, -R * .08, R * .24, .55); eyeball(m, R * .3, -R * .08, R * .24, .55);
    g.strokeStyle = hsl(m.hue, 90, 14); g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.arc(0, R * .22, R * .25, .15 * PI, .85 * PI); g.stroke();
    return path;
  },
  eye(m, R, T) { // 눈알 하나에 촉수 술
    g.strokeStyle = hsl(m.hue, 80, 38); g.lineWidth = Math.max(2, R * .09); g.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * R * .32, w = Math.sin(T * 3 + i * 1.3 + m.ph) * R * .16; g.beginPath(); g.moveTo(x, R * .7); g.quadraticCurveTo(x + w, R * 1.1, x - w * .6, R * 1.5); g.stroke(); }
    const path = () => { g.beginPath(); g.arc(0, 0, R, 0, TAU); };
    path(); g.fillStyle = hsl(m.hue, 70, 34); g.fill(); g.strokeStyle = hsl(m.hue, 90, 16); g.lineWidth = 2.5; g.stroke();
    eyeball(m, 0, 0, R * .8, .58);
    const blink = Math.max(0, Math.sin(T * 1.3 + m.ph * 3) - .96) * 25; // 가끔 눈을 감는다
    if (blink > 0) { g.fillStyle = hsl(m.hue, 70, 30); g.beginPath(); g.arc(0, 0, R * .82, PI, TAU); g.fill(); g.fillRect(-R * .82, -R * .82 * 0, R * 1.64, 0); }
    g.fillStyle = hsl(m.hue, 80, 28); g.beginPath(); g.arc(0, 0, R * .84, PI * 1.06, PI * 1.94); g.lineTo(0, -R * .2); g.closePath(); g.globalAlpha = .55; g.fill(); g.globalAlpha = 1;
    return path;
  },
  urchin(m, R) { // 가시 성게
    const n = 13, core = R * .8;
    for (let i = 0; i < n; i++) {
      const a = m.rot + i / n * TAU, L = R * (i % 2 ? 1.15 : 1.3), w = .13;
      g.fillStyle = hsl(m.hue + (i % 2) * 14, 75, i % 2 ? 40 : 52); g.strokeStyle = hsl(m.hue, 90, 16); g.lineWidth = 2;
      g.beginPath(); g.moveTo(Math.cos(a - w) * core * .9, Math.sin(a - w) * core * .9); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + w) * core * .9, Math.sin(a + w) * core * .9); g.closePath(); g.fill(); g.stroke();
      dot(Math.cos(a) * L, Math.sin(a) * L, R * .06, hsl(m.hue - 30, 100, 78));
    }
    const path = () => { g.beginPath(); g.arc(0, 0, core, 0, TAU); };
    const gr = g.createRadialGradient(-core * .3, -core * .3, core * .1, 0, 0, core); gr.addColorStop(0, hsl(m.hue, 70, 58)); gr.addColorStop(1, hsl(m.hue, 75, 26));
    path(); g.fillStyle = gr; g.fill(); g.strokeStyle = hsl(m.hue, 90, 16); g.lineWidth = 2.5; g.stroke();
    eyeball(m, 0, 0, core * .5, .6);
    return path;
  },
  maw(m, R, T) { // 이빨 가득한 큰 입
    const path = () => { g.beginPath(); g.arc(0, 0, R, 0, TAU); };
    const gr = g.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R * 1.05); gr.addColorStop(0, hsl(m.hue, 65, 50)); gr.addColorStop(1, hsl(m.hue, 70, 20));
    path(); g.fillStyle = gr; g.fill(); g.strokeStyle = hsl(m.hue, 90, 12); g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 5; i++) dot(Math.cos(m.ph + i * 1.9) * R * .6, -R * .3 + Math.sin(m.ph * 3 + i * 2.3) * R * .25, R * (.06 + (i % 3) * .02), hsl(m.hue + 25, 60, 36, .8));
    eyeball(m, -R * .34, -R * .42, R * .17, .6); eyeball(m, R * .34, -R * .42, R * .17, .6);
    const open = .55 + .3 * Math.sin(T * 2.4 + m.ph), mw = R * .78, mh = R * .5 * open, my = R * .22;
    g.fillStyle = '#1a0510'; g.beginPath(); g.ellipse(0, my, mw, mh, 0, 0, TAU); g.fill();
    g.fillStyle = hsl(335, 70, 48); g.beginPath(); g.ellipse(0, my + mh * .45, mw * .5, mh * .5, 0, 0, PI); g.fill();
    g.fillStyle = '#f4f7e4'; g.strokeStyle = '#2a3a1a'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const x = (i - 3) * mw * .29, tw = mw * .1; for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(x - tw, my + sgn * mh * .86); g.lineTo(x, my + sgn * (mh * .86 - Math.min(mh * .9, R * .26))); g.lineTo(x + tw, my + sgn * mh * .86); g.closePath(); g.fill(); g.stroke(); } }
    return path;
  }
};

export function drawMonster(m) {
  const T = G.T, R = m.R, sq = m.sq;
  g.save(); g.translate(m.x, m.y); g.scale(1 + .14 * sq, 1 - .14 * sq);
  const halo = g.createRadialGradient(0, 0, R * .6, 0, 0, R * 2); halo.addColorStop(0, hsl(m.hue, 90, 55, .28)); halo.addColorStop(1, hsl(m.hue, 90, 55, 0));
  g.fillStyle = halo; g.beginPath(); g.arc(0, 0, R * 2, 0, TAU); g.fill();
  const path = BODY[m.kind](m, R, T);
  if (m.flash > 0) { path(); g.fillStyle = '#fff'; g.globalAlpha = Math.min(.85, m.flash * 6); g.fill(); g.globalAlpha = 1; }
  g.restore();
  if (m.hp < m.max && m.hp > 0) { // 체력 호
    const r = reachOf(m) + 8; g.lineCap = 'round'; g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(m.x, m.y, r, .15 * PI, .85 * PI); g.stroke();
    g.strokeStyle = hsl(m.hue, 95, 65); g.beginPath(); g.arc(m.x, m.y, r, .15 * PI, (.15 + .7 * m.hp / m.max) * PI); g.stroke();
  }
}
