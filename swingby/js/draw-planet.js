/* 행성 그리기 v1 (예전 렌더러). v2 는 draw-planet2.js — 롤백용으로 그대로 남겨 둔다 */
import { G, g } from './state.js';
import { PI, TAU, easeOut } from './util.js';
import { capOf } from './stats.js';
import { txt } from './gfx.js';

/** 행성마다 고정된 의사난수(0~1): 크레이터·균열 모양에 쓴다 */
export const hash = (p, i) => { const x = Math.sin(p.ph * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };

export function drawPlanet(p) {
  const s = G.ship, cur = s.mode === 'orb' && s.p === p, cr = capOf(p), T = G.T;
  if (p.dead) {
    if (p.gone) return;
    g.setLineDash([3, 9]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,140,120,' + (.25 + .15 * Math.sin(T * 6)) + ')'; g.beginPath(); g.arc(p.x, p.y, p.R + 8, 0, TAU); g.stroke(); g.setLineDash([]);
    txt(String(Math.max(1, p.re)), p.x, p.y + 6, 16, 'rgba(255,170,150,.8)', 'center', 800); return;
  }
  const sc = easeOut(p.born) * (1 + .12 * Math.sin(p.sq * PI * 2) * p.sq), R = p.R * sc;
  // 포획 범위
  g.setLineDash([5, 7]); g.lineDashOffset = -T * 14; g.lineWidth = p.t === 'm' ? 2 : 1.5;
  g.strokeStyle = 'hsla(' + p.hue + ',85%,70%,' + ((cur ? .55 : p.seen ? .16 : .34) + p.pulse * .4) + ')';
  g.beginPath(); g.arc(p.x, p.y, cr, 0, TAU); g.stroke(); g.setLineDash([]);
  // 빛무리
  const gl = g.createRadialGradient(p.x, p.y, R * .6, p.x, p.y, R * 2.1);
  gl.addColorStop(0, 'hsla(' + p.hue + ',90%,60%,' + ((p.t === 'm' ? .2 : .35) + p.pulse * .4) + ')'); gl.addColorStop(1, 'hsla(' + p.hue + ',90%,60%,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, R * 2.1, 0, TAU); g.fill();
  // 본체
  const sat = p.t === 'm' ? 38 : p.t === 'a' ? 30 : 70;
  const bd = g.createRadialGradient(p.x - R * .35, p.y - R * .4, R * .1, p.x, p.y, R);
  bd.addColorStop(0, 'hsl(' + p.hue + ',' + (p.t === 'm' ? 45 : p.t === 'a' ? 40 : 85) + '%,' + (p.t === 'm' ? 66 : 78) + '%)'); bd.addColorStop(.6, 'hsl(' + p.hue + ',' + sat + '%,' + (p.t === 'm' ? 38 : 48) + '%)'); bd.addColorStop(1, 'hsl(' + (p.hue + 20) + ',' + (sat - 10) + '%,20%)');
  g.fillStyle = bd; g.beginPath();
  if (p.t === 'a') { // 울퉁불퉁한 소행성 외곽
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = R * (.78 + .34 * hash(p, i)); i ? g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : g.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    g.closePath();
  } else g.arc(p.x, p.y, R, 0, TAU);
  g.fill();
  if (p.t === 'a') { // 균열: 떠나면 부서진다는 표시
    g.strokeStyle = 'rgba(255,235,200,.55)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(p.x - R * .5, p.y - R * .3); g.lineTo(p.x, p.y + R * .05); g.lineTo(p.x + R * .45, p.y - R * .35); g.moveTo(p.x, p.y + R * .05); g.lineTo(p.x + R * .1, p.y + R * .6); g.stroke();
  }
  if (p.t === 'm') drawCraters(p, R);
  if (p.t === 'g') { g.strokeStyle = 'hsla(' + p.hue + ',80%,80%,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(p.x, p.y, R * 1.55, R * .38, -.35, 0, TAU); g.stroke(); }
  if (p.t === 'r') { g.strokeStyle = 'rgba(255,120,90,' + (.35 + .3 * Math.sin(T * 9 + p.ph)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, R + 4 + 2 * Math.sin(T * 9 + p.ph), 0, TAU); g.stroke(); }
}
export function drawCraters(p, R) {
  g.save(); g.beginPath(); g.arc(p.x, p.y, R, 0, TAU); g.clip();
  for (let i = 0; i < 9; i++) {
    const a = hash(p, i) * TAU, d = Math.sqrt(hash(p, i + 20)) * R * .82, r = R * (.07 + .11 * hash(p, i + 40)), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    g.fillStyle = 'rgba(30,14,6,.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,225,190,.3)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x - r * .12, y - r * .12, r, PI * .9, PI * 1.9); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(p.x + R * .4, p.y + R * .45, R * 1.05, 0, TAU); g.arc(p.x, p.y, R, 0, TAU, true); g.fill();
  g.restore();
}
