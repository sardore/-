/* 타이틀 워드마크와 항로. 글자 자체는 고정하고 궤도상의 기체만 움직인다. */
import { G, V, g } from './state.js';
import { PI, TAU } from './util.js';
import { reducedMotion, txt } from './gfx.js';

const LETTERS = [
  [26, [[25, 1], [4, 1], [1, 5], [1, 17], [5, 21], [21, 21], [25, 25], [25, 37], [21, 41], [0, 41]]],
  [37, [[0, 1], [6, 41], [12, 41], [18.5, 16], [25, 41], [31, 41], [37, 1]]],
  [12, [[0, 1], [12, 1]], [[6, 1], [6, 41]], [[0, 41], [12, 41]]],
  [28, [[0, 41], [0, 1], [5, 1], [28, 41], [28, 1]]],
  [28, [[28, 1], [6, 1], [0, 7], [0, 35], [6, 41], [23, 41], [28, 36], [28, 22], [15, 22]]],
  [27, [[0, 41], [0, 1], [22, 1], [27, 6], [27, 16], [22, 21], [0, 21]], [[22, 21], [27, 26], [27, 36], [22, 41], [0, 41]]],
  [27, [[0, 1], [13.5, 23], [27, 1]], [[13.5, 23], [13.5, 41]]]
];
const GAP = 11;
const MARK_W = LETTERS.reduce((width, [w]) => width + w, 0) + GAP * (LETTERS.length - 1);

function wordmark(cx, cy, scale) {
  g.save();
  g.translate(cx - MARK_W * scale / 2, cy - 21 * scale);
  g.scale(scale, scale);
  g.lineWidth = 4.8;
  g.lineCap = 'square';
  g.lineJoin = 'bevel';
  for (let i = 0; i < LETTERS.length; i++) {
    const [w, ...lines] = LETTERS[i];
    g.beginPath();
    for (const [first, ...rest] of lines) {
      g.moveTo(...first);
      for (const point of rest) g.lineTo(...point);
    }
    g.strokeStyle = i < 5 ? '#080e16' : '#0b1317';
    g.lineWidth = 9;
    g.stroke();
    g.strokeStyle = i < 5 ? '#f1f1e9' : '#ffb46f';
    g.lineWidth = 4.8;
    g.stroke();
    g.translate(w + GAP, 0);
  }
  g.restore();
}

export function drawTitle2() {
  const { VW, VH } = V;
  const cx = VW / 2, cy = Math.max(108, VH * .245);
  const rx = 176, ry = 39, tilt = -.19;
  const phase = reducedMotion() ? -.76 : G.T * .77 - .76;
  g.save();
  g.translate(cx, cy);
  g.rotate(tilt);
  g.lineWidth = 1;
  g.strokeStyle = '#668b9a84';
  g.setLineDash([3, 5]);
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, PI, TAU); g.stroke();
  g.restore();

  wordmark(cx, cy, 1.23);

  g.save();
  g.translate(cx, cy);
  g.rotate(tilt);
  g.strokeStyle = '#82a3ab9c';
  g.lineWidth = 1;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, .23, PI - .23); g.stroke();

  // 꼬리는 궤도에 붙이고, 기수는 타원 접선으로 돌린다.
  g.strokeStyle = '#ffb46f';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, phase - .24, phase - .055); g.stroke();
  g.translate(Math.cos(phase) * rx, Math.sin(phase) * ry);
  g.rotate(Math.atan2(Math.cos(phase) * ry, -Math.sin(phase) * rx));
  g.fillStyle = '#ffb46f';
  g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -3); g.lineTo(-2, 0); g.lineTo(-5, 3); g.closePath(); g.fill();
  g.restore();

  txt('스윙바이', cx, cy + 73, 15, '#b3c0c8', 'center', 700);
}
