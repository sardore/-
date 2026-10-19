/* 캔버스 그리기 도우미 */
import { g } from './state.js';
import { FONT } from './util.js';

/** 그래픽 버전. 기본 2(새 렌더러: draw-*2.js). 주소에 ?gfx=1 을 붙이면 예전 렌더러로 돌아간다 — 예전 코드는 롤백용으로 남겨 두었다 */
export const GFX = { v: typeof location !== 'undefined' && /[?&]gfx=1\b/.test(location.search) ? 1 : 2 };

/** 둥근 사각형 경로 */
export function rr(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/** 별 조각 아이콘 (상점·강화 창) */
export function shardIcon(x, y, r) {
  g.fillStyle = '#ffe27a'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .72, y - r * .15); g.lineTo(x + r * .4, y + r); g.lineTo(x - r * .4, y + r); g.lineTo(x - r * .72, y - r * .15); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .72, y - r * .15); g.lineTo(x, y + r * .1); g.closePath(); g.fill();
}
/** 글자 한 줄 */
export function txt(s, x, y, size, c, al, wt) {
  g.font = (wt || 700) + ' ' + size + 'px ' + FONT; g.textAlign = al || 'center'; g.fillStyle = c || '#fff'; g.fillText(s, x, y);
}
/** 칩의 가로 길이 */
export function chipWidth(t, size = 11) { g.font = '700 ' + size + 'px ' + FONT; return g.measureText(t).width + 12; }
/** 알약 모양 칩. 그린 너비를 돌려준다 */
export function chip(t, x, y, color, size = 11) {
  g.font = '700 ' + size + 'px ' + FONT;
  const w = g.measureText(t).width + 12, h = size + 6;
  rr(x, y - h + 4, w, h, h / 2); g.fillStyle = hexRgba(color, .18); g.fill(); g.strokeStyle = hexRgba(color, .7); g.lineWidth = 1; g.stroke();
  txt(t, x + 6, y, size, color, 'left', 700);
  return w;
}
function hexRgba(h, a) {
  if (h[0] !== '#') return h;
  const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
