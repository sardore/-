/* 타이틀 v2: 그라데이션 로고 + 지나가는 빛줄기 + 글자를 감싸고 도는 궤도(혜성). 예전 타이틀(텍스트 두 줄)은 draw-ui.js 에 그대로 있다 */
import { G, V, g } from './state.js';
import { PI, TAU, FONT } from './util.js';
import { txt } from './gfx.js';

const WORD = 'SWINGBY';
const lerp = (a, b, k) => a + (b - a) * k;

export function drawTitle2() {
  const { VW, VH } = V, T = G.T, cx = VW / 2, cy = VH * .22;
  const size = Math.min(62, VW * .145);
  g.font = '900 italic ' + size + 'px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const track = size * .09, ws = [...WORD].map(c => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + track * (WORD.length - 1), x0 = cx - total / 2;
  const orbit = { x: cx, y: cy - size * .3, rx: Math.min(total * .64, VW * .47), ry: size * .44, rot: -.2 };

  // 로고 뒤쪽의 은은한 빛
  const hg = g.createRadialGradient(cx, orbit.y, 0, cx, orbit.y, total * .75);
  hg.addColorStop(0, 'rgba(110,170,255,.22)'); hg.addColorStop(1, 'rgba(110,170,255,0)'); g.fillStyle = hg; g.fillRect(0, orbit.y - total, VW, total * 2);

  drawOrbit(orbit, false, T);
  // 글자: 아래로 갈수록 청보라, 빛줄기가 훑고 지나간다
  const word = (fill, dy) => {
    g.fillStyle = fill; let x = x0;
    [...WORD].forEach((c, i) => { g.fillText(c, x, cy + size * .34 + Math.sin(T * 1.6 + i * .55) * 2 + (dy || 0)); x += ws[i] + track; });
  };
  g.save(); g.shadowColor = 'rgba(90,170,255,.9)'; g.shadowBlur = 26; word('rgba(120,190,255,.9)'); g.restore();
  g.save(); g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = 'rgba(8,12,40,.9)';
  { let x = x0; [...WORD].forEach((c, i) => { g.strokeText(c, x, cy + size * .34 + Math.sin(T * 1.6 + i * .55) * 2); x += ws[i] + track; }); } g.restore();
  const body = g.createLinearGradient(0, cy - size * .5, 0, cy + size * .4);
  body.addColorStop(0, '#ffffff'); body.addColorStop(.5, '#bfe8ff'); body.addColorStop(1, '#9d8cff');
  word(body);
  const t = (T * .42) % 1.7 - .35, sw = g.createLinearGradient(x0, 0, x0 + total, 0), band = .07;   // 빛줄기
  for (const [k, a] of [[t - band * 2, 0], [t, .85], [t + band * 2, 0]]) sw.addColorStop(Math.min(1, Math.max(0, k)), 'rgba(255,255,255,' + a + ')');
  g.save(); g.globalCompositeOperation = 'source-atop'; word(sw); g.restore();
  drawOrbit(orbit, true, T);

  // 부제
  const sy = cy + size * .34 + 28;
  for (const sg of [-1, 1]) { const lg = g.createLinearGradient(cx + sg * 62, 0, cx + sg * 150, 0); lg.addColorStop(0, 'rgba(125,211,255,.7)'); lg.addColorStop(1, 'rgba(125,211,255,0)'); g.fillStyle = lg; g.fillRect(Math.min(cx + sg * 62, cx + sg * 150), sy - 5, 88, 1.5); }
  txt('스 윙 바 이', cx, sy, 15, '#9fd8ff', 'center', 700);
  txt('행성을 휘감아, 우주 끝까지', cx, sy + 24, 13, 'rgba(255,255,255,.55)', 'center', 500);
  // 반짝임
  for (const [dx, dy, ph] of [[-.52, -.55, 0], [.5, -.62, 1.7], [.36, .5, 3.1], [-.42, .42, 4.4], [.05, -.78, 2.2]]) {
    const k = .5 + .5 * Math.sin(T * 2.4 + ph), x = cx + dx * total, y = orbit.y + dy * size * 1.2, L = 3 + 7 * k;
    g.strokeStyle = 'rgba(220,240,255,' + (.25 + .6 * k) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
  }
}

/** 로고를 감싸는 타원 궤도와 그 위를 도는 혜성. front=false 는 글자 뒤(위쪽 반), true 는 글자 앞(아래쪽 반) */
function drawOrbit(o, front, T) {
  g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
  const a0 = front ? 0 : PI, a1 = front ? PI : TAU;
  g.strokeStyle = front ? 'rgba(150,215,255,.75)' : 'rgba(150,215,255,.3)'; g.lineWidth = front ? 2 : 1.5;
  g.beginPath(); g.ellipse(0, 0, o.rx, o.ry, 0, a0, a1); g.stroke();
  const a = T * 1.05, N = 22;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let k = N; k >= 0; k--) { // 꼬리부터 머리까지
    const an = a - k * .05, sn = Math.sin(an); if ((sn > 0) !== front) continue;
    const f = 1 - k / N, x = Math.cos(an) * o.rx, y = sn * o.ry;
    g.fillStyle = 'rgba(190,230,255,' + f * .8 + ')'; g.beginPath(); g.arc(x, y, lerp(1, 4.5, f), 0, TAU); g.fill();
  }
  if ((Math.sin(a) > 0) === front) {
    const x = Math.cos(a) * o.rx, y = Math.sin(a) * o.ry, gl = g.createRadialGradient(x, y, 0, x, y, 16);
    gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(.3, 'rgba(160,220,255,.5)'); gl.addColorStop(1, 'rgba(160,220,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 16, 0, TAU); g.fill();
  }
  g.restore();
}
