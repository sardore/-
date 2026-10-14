/* 블랙쉽 Lv2 기체(침투정·호송정)의 그림: 입체 표현 없이 단순한 면과 테두리로 그린다. 입체감은 Lv3 부터 조금, Lv4 에서 가장 정교하다(ops-ship-art.js).
 * 하양·검정·갈색 팔레트, 선체 윤곽만 계열(needle·box)로 나뉜다. 기체 앞이 +x */
import { TAU } from './util.js';

const PAL = { white: ['#f6f3ea', '#cbc7ba', '#6f6b5f'], black: ['#5d626b', '#282c32', '#0a0c0f'], brown: ['#bf9468', '#7e583a', '#38250f'], tan: ['#e4cca0', '#b39a6e', '#6a5738'] };
const HULL = {
  needle: { pts: [[14, 0], [8, 1.2], [1, 2.2], [-6, 2.6], [-9, 2], [-9, 0]], w: 2.6 },
  box:    { pts: [[8.5, 0], [8.5, 2.2], [6.5, 4.2], [-7.5, 4.8], [-9, 3.6], [-9, 0]], w: 4.8 }
};
const accOf = (L, l) => L.acc != null ? 'hsl(' + L.acc + ',95%,' + (l || 62) + '%)' : '#dfe7ee';
const path = (c, pts) => pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
const outline = H => H.pts.concat(H.pts.slice(1, -1).reverse().map(q => [q[0], -q[1]]));

export function drawOpsFlat(c, d, flame, tm, sc, o) {
  const L = d.L, H = HULL[L.hull] || HULL.needle, [lite, mid, dark] = PAL[L.main] || PAL.black, trim = PAL[L.trim] || PAL.white;
  const fh = o && o.fh != null ? o.fh : L.h + 10, fsa = o && o.fs != null ? o.fs : 70, acc = accOf(L);
  c.save(); c.scale(sc, sc); c.lineJoin = 'round';
  const fl = (x, y, len, w) => { const gr = c.createLinearGradient(x, 0, x - len, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'hsla(' + fh + ',' + fsa + '%,70%,.8)'); gr.addColorStop(1, 'hsla(' + fh + ',' + fsa + '%,60%,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x, y - w); c.lineTo(x - len, y); c.lineTo(x, y + w); c.closePath(); c.fill(); };
  const fk = .25 + .75 * (flame || 0), E = L.engines || 1, ex = -H.pts[H.pts.length - 1][0] > 8.9 ? -9.4 : -9;
  const ys = E === 1 ? [0] : [-.55, .55];
  ys.forEach((k, i) => fl(ex, k * H.w * .9, (3 + 6.5 * fk) * (1 + .25 * Math.sin(tm * 38 + i * 2)), 1.2 + (L.hull === 'box' ? .3 : 0)));
  c.lineWidth = .9;
  // 날개
  for (let i = 0; i < (L.fins || 0); i++) {
    const x0 = 1.5 - i * 4, w = H.w + 3.6 + i * 2.2;
    for (const sg of [-1, 1]) { c.fillStyle = trim[1]; c.strokeStyle = dark; c.lineWidth = .8; c.beginPath(); c.moveTo(x0, sg * H.w * .6); c.lineTo(x0 - 9 - i * 1.4, sg * w); c.lineTo(x0 - 6, sg * H.w * .6); c.closePath(); c.fill(); c.stroke(); }
  }
  // 선체
  const pts = outline(H), gr = c.createLinearGradient(0, -H.w, 0, H.w); gr.addColorStop(0, lite); gr.addColorStop(.55, mid); gr.addColorStop(1, dark);
  c.fillStyle = gr; c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .8; c.beginPath(); path(c, pts); c.closePath(); c.fill(); c.stroke();
  c.save(); c.beginPath(); path(c, pts); c.closePath(); c.clip();
  const pa = c.globalAlpha; c.fillStyle = trim[1]; c.globalAlpha = pa * .92; c.fillRect(-12, -H.w - 1, 8.5, H.w * 2 + 2);
  c.globalAlpha = pa; c.fillStyle = trim[0]; c.fillRect(-4, -.55, 17, 1.1);
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .6; c.beginPath(); c.moveTo(-3.5, -H.w); c.lineTo(-3.5, H.w); c.stroke();
  c.restore();
  // 화물 상자(호송정)
  for (let i = 0; i < (L.crates || 0); i++) {
    const row = i % 2 ? 1 : -1, col = Math.floor(i / 2), x = -1 - col * 4.2, y = row * H.w * .42;
    c.fillStyle = i % 3 === 0 ? PAL.tan[1] : PAL.brown[1]; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .6; c.beginPath(); c.rect(x - 1.8, y - 1.5, 3.6, 3); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x, y - 1.5); c.lineTo(x, y + 1.5); c.stroke();
  }
  // 조종석 틈
  const cx = L.hull === 'needle' ? 5.5 : 4.2;
  c.fillStyle = '#dfe7ee'; c.beginPath(); c.ellipse(cx, 0, 2.1, .9, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(cx + .6, -.25, .8, .3, 0, 0, TAU); c.fill();
  if (o && o.art) o.art(c, tm, L, L.h);
  c.restore();
}
