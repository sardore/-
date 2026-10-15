/* 특수 이동 행성의 길잡이 선: 승강기가 오가는 길, 위성의 궤도, 맥동 행성의 최소·최대 크기 (행성 본체보다 먼저 그려 뒤에 깔린다) */
import { G, g } from './state.js';
import { TAU } from './util.js';

export function drawSpecialGuide(p) {
  const q = p.sp; if (!q || q.k === 'host') return;
  const T = G.T, a = .28 + .1 * Math.sin(T * 3 + p.ph), col = 'hsla(' + p.hue + ',85%,72%,';
  g.save(); g.lineWidth = 1.5; g.setLineDash([4, 9]); g.lineDashOffset = -T * 16;
  if (q.k === 'lift') {
    g.strokeStyle = col + a + ')'; g.beginPath(); g.moveTo(p.x, q.y0 - q.A); g.lineTo(p.x, q.y0 + q.A); g.stroke(); g.setLineDash([]);
    g.fillStyle = col + (a + .12) + ')';   // 양 끝의 화살표
    for (const d of [-1, 1]) { const y = q.y0 + d * (q.A + 10); g.beginPath(); g.moveTo(p.x, y + d * 6); g.lineTo(p.x - 7, y - d * 5); g.lineTo(p.x + 7, y - d * 5); g.closePath(); g.fill(); }
  } else if (q.k === 'moon') {
    g.strokeStyle = col + a + ')'; g.beginPath(); g.arc(q.host.x, q.host.y, q.Rm, 0, TAU); g.stroke();
  } else if (q.k === 'pulse') {
    g.strokeStyle = col + a + ')';
    for (const f of [q.lo, q.hi]) { g.beginPath(); g.arc(p.x, p.y, q.R0 * f, 0, TAU); g.stroke(); }
  }
  g.restore();
}
