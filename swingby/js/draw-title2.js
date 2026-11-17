/* 타이틀 v2: 그라데이션 로고 + 지나가는 빛줄기 + 글자를 감싸고 도는 궤도(혜성). 예전 타이틀(텍스트 두 줄)은 draw-ui.js 에 그대로 있다 */
import { G, V, g } from './state.js';
import { PI, TAU, FONT } from './util.js';
import { reducedMotion, txt } from './gfx.js';

const WORD = [...'SWINGBY'];

export function drawTitle2() {
  const { VW, VH } = V, still = reducedMotion(), T = still ? 0 : G.T, cx = VW / 2, cy = VH * .22;
  const size = Math.min(62, VW * .145);
  g.save();
  g.font = 'italic 900 ' + size + 'px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const track = size * .09;
  const widths = WORD.map(c => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (WORD.length - 1);
  let x = cx - total / 2;
  const base = cy + size * .34;
  const glyphs = WORD.map((letter, i) => {
    const glyph = { letter, x, y: base + (still ? 0 : Math.sin(T * 1.6 + i * .55) * 1.35) };
    x += widths[i] + track;
    return glyph;
  });
  const orbit = { x: cx, y: cy - size * .3, rx: Math.min(total * .64, VW * .47), ry: size * .44, rot: -.2 };

  const halo = g.createRadialGradient(cx, orbit.y, 0, cx, orbit.y, total * .72);
  halo.addColorStop(0, 'rgba(103,157,239,.25)');
  halo.addColorStop(.51, 'rgba(88,115,213,.12)');
  halo.addColorStop(1, 'rgba(88,115,213,0)');
  g.fillStyle = halo; g.fillRect(0, orbit.y - total, VW, total * 2);

  drawOrbit(orbit, false, T);
  const body = g.createLinearGradient(0, base - size * .74, 0, base + 1);
  body.addColorStop(0, '#f9fcff');
  body.addColorStop(.43, '#caefff');
  body.addColorStop(.73, '#b3d5ff');
  body.addColorStop(1, '#a295ff');
  g.lineJoin = 'round'; g.lineWidth = 4;
  g.strokeStyle = '#11172f';
  g.shadowColor = 'rgba(116,180,255,.84)'; g.shadowBlur = 15;
  for (const c of glyphs) g.strokeText(c.letter, c.x, c.y);
  g.shadowBlur = 0;
  g.fillStyle = body;
  for (const c of glyphs) g.fillText(c.letter, c.x, c.y);

  // 빛이 로고를 가로지를 때만 얇은 반사를 얹는다.
  const beam = (T * .37) % 1.7 - .3;
  if (!still && beam > -.11 && beam < 1.11) {
    const left = cx - total / 2;
    const sheen = g.createLinearGradient(left + total * (beam - .11), 0, left + total * (beam + .11), size * .36);
    sheen.addColorStop(0, '#ffffff00'); sheen.addColorStop(.5, '#ffffffa0'); sheen.addColorStop(1, '#ffffff00');
    g.fillStyle = sheen;
    for (const c of glyphs) g.fillText(c.letter, c.x, c.y);
  }
  drawOrbit(orbit, true, T);

  // 부제
  const sy = cy + size * .34 + 28;
  for (const sg of [-1, 1]) { const lg = g.createLinearGradient(cx + sg * 62, 0, cx + sg * 150, 0); lg.addColorStop(0, 'rgba(125,211,255,.7)'); lg.addColorStop(1, 'rgba(125,211,255,0)'); g.fillStyle = lg; g.fillRect(Math.min(cx + sg * 62, cx + sg * 150), sy - 5, 88, 1.5); }
  txt('스 윙 바 이', cx, sy, 15, '#bde6ff', 'center', 700);
  txt('행성을 휘감아, 우주 끝까지', cx, sy + 24, 13, '#b7c4dc', 'center', 500);
  // 반짝임
  for (const [dx, dy, ph] of [[-.52, -.55, 0], [.5, -.62, 1.7], [.36, .5, 3.1], [-.42, .42, 4.4], [.05, -.78, 2.2]]) {
    const k = still ? .48 : .53 + .26 * Math.sin(T * 2.4 + ph), x = cx + dx * total, y = orbit.y + dy * size * 1.2, L = 3 + 7 * k;
    g.strokeStyle = 'rgba(220,240,255,' + (.25 + .6 * k) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
  }
  g.restore();
}

/** 로고를 감싸는 타원 궤도와 그 위를 도는 혜성. front=false 는 글자 뒤(위쪽 반), true 는 글자 앞(아래쪽 반) */
function drawOrbit(o, front, T) {
  g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
  const a0 = front ? 0 : PI, a1 = front ? PI : TAU;
  g.strokeStyle = front ? 'rgba(150,215,255,.63)' : 'rgba(150,215,255,.25)';
  g.lineWidth = front ? 1.6 : 1.1;
  g.beginPath(); g.ellipse(0, 0, o.rx, o.ry, 0, a0, a1); g.stroke();

  const phase = (T * 1.05 + .65) % TAU, count = 20, segment = .048;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let k = count; k > 0; k--) {
    const start = phase - k * segment, end = start + segment;
    const f = 1 - (k - 1) / count;
    // 앞뒤 반원을 각각 그리되 경계에서 꼬리가 글자를 뚫지 않도록 자른다.
    for (const shift of [-TAU, 0]) {
      const from = Math.max(start, a0 + shift), to = Math.min(end, a1 + shift);
      if (to <= from) continue;
      g.lineWidth = 1 + f * 2.2;
      g.strokeStyle = 'rgba(142,198,255,' + f * f * .6 + ')';
      g.beginPath(); g.ellipse(0, 0, o.rx, o.ry, 0, from, to); g.stroke();
    }
  }
  if ((phase < PI) === front) {
    const x = Math.cos(phase) * o.rx, y = Math.sin(phase) * o.ry;
    const glow = g.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, '#d8f8ff'); glow.addColorStop(.25, '#a7e7ff85'); glow.addColorStop(1, '#8ccaff00');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
    g.fillStyle = '#edfaff'; g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fill();
  }
  g.restore();
}
