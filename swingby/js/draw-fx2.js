/* 효과 그리기 v2: 빛이 번지는 꼬리·링·파티클(가산 합성)과 반짝이는 별. 예전 렌더러는 draw-world.js 에 그대로 있다 */
import { G, g } from './state.js';
import { TAU, easeOut } from './util.js';
import { ringPath } from './land-fx.js';
import { hueOf, satOf } from './cos.js';

/** 기체 꼬리: 넓고 옅은 빛 + 밝은 심지를 겹쳐 그린다 */
export function drawTrail2(s, def, sp) {
  const tr = s.trail, n = tr.length; if (n < 4) return;
  const h = hueOf(sp, def.L.h, G.T), sat = satOf(sp), wm = (s.mode === 'free' ? 5 : 3) * (1 + (s.boost - 1) * .8 + s.heat * .15);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 2; i < n; i += 2) {
    const k = i / n;
    g.strokeStyle = 'hsla(' + h + ',' + sat * .9 + '%,58%,' + k * .2 + ')'; g.lineWidth = 2 + k * wm * 2.6;
    g.beginPath(); g.moveTo(tr[i - 2], tr[i - 1]); g.lineTo(tr[i], tr[i + 1]); g.stroke();
    g.strokeStyle = 'hsla(' + h + ',' + sat * .9 + '%,78%,' + k * .75 + ')'; g.lineWidth = 1 + k * wm;
    g.beginPath(); g.moveTo(tr[i - 2], tr[i - 1]); g.lineTo(tr[i], tr[i + 1]); g.stroke();
  }
  if (sp && sp.style === 'dust') { // 별가루: 꼬리를 따라 반짝이는 십자
    g.lineWidth = 1;
    for (let i = 2; i < n; i += 2) {
      const k = i / n, tw = .5 + .5 * Math.sin(G.T * 9 + i * 1.9), L = (1.5 + 3.5 * tw) * (.4 + k);
      g.strokeStyle = 'hsla(' + (h + i * 3) % 360 + ',100%,85%,' + k * tw + ')';
      g.beginPath(); g.moveTo(tr[i] - L + Math.sin(i * 7) * 4, tr[i + 1] + Math.cos(i * 5) * 4); g.lineTo(tr[i] + L + Math.sin(i * 7) * 4, tr[i + 1] + Math.cos(i * 5) * 4);
      g.moveTo(tr[i] + Math.sin(i * 7) * 4, tr[i + 1] - L + Math.cos(i * 5) * 4); g.lineTo(tr[i] + Math.sin(i * 7) * 4, tr[i + 1] + L + Math.cos(i * 5) * 4); g.stroke();
    }
  }
  g.restore();
}

/** 금화 입자(황금 상선 장식): 빙글 도는 동전 */
export function drawCoin(p, a) {
  const w = .25 + .75 * Math.abs(Math.cos(p.t * 12 + p.ph)), r = p.s;
  g.globalAlpha = a; g.fillStyle = '#ffd24a'; g.strokeStyle = '#fff3b0'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(p.x, p.y, r * w, r, 0, 0, TAU); g.fill(); g.stroke();
}

/** 링·파티클(글자는 제외). 상점 미리보기는 자기 목록을 넘긴다 */
export function drawFxLayers2(fxr = G.fxr, parts = G.parts) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of fxr) {
    const k = f.t / f.dur, r = f.r0 + (f.r1 - f.r0) * easeOut(k), lw = f.w * (1 - k * .6);
    g.strokeStyle = f.c; ringPath(g, f, r);
    g.globalAlpha = (1 - k) * .3; g.lineWidth = lw * 2.8; g.stroke();
    g.globalAlpha = 1 - k; g.lineWidth = lw; g.stroke();
  }
  for (const p of parts) {
    const a = 1 - p.t / p.l; g.fillStyle = p.c; g.strokeStyle = p.c;
    if (p.coin) { drawCoin(p, a); continue; }
    if (p.line) { g.globalAlpha = a; g.lineWidth = p.s * .6; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); g.stroke(); continue; }
    const sz = p.s || 3;
    g.globalAlpha = a * .22; g.beginPath(); g.arc(p.x, p.y, sz * 1.7, 0, TAU); g.fill();
    g.globalAlpha = a; g.beginPath(); g.arc(p.x, p.y, sz * .6, 0, TAU); g.fill();
  }
  g.restore(); g.globalAlpha = 1;
}

/** 별(수집품): 번지는 빛과 돌아가는 반짝임 */
export function drawStar2(t) {
  const T = G.T, r = 5 + 1.5 * Math.sin(T * 5 + t.ph), x = t.x, y = t.y;
  const gl = g.createRadialGradient(x, y, 0, x, y, r * 3.2); gl.addColorStop(0, 'rgba(255,226,122,.5)'); gl.addColorStop(1, 'rgba(255,226,122,0)');
  g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
  const shape = k => {
    const q = r * k; g.beginPath();
    g.moveTo(x, y - q); g.lineTo(x + q * .35, y - q * .35); g.lineTo(x + q, y); g.lineTo(x + q * .35, y + q * .35);
    g.lineTo(x, y + q); g.lineTo(x - q * .35, y + q * .35); g.lineTo(x - q, y); g.lineTo(x - q * .35, y - q * .35); g.closePath();
  };
  g.fillStyle = '#ffe27a'; shape(1); g.fill(); g.fillStyle = '#fff6cc'; shape(.5); g.fill();
  g.save(); g.translate(x, y); g.rotate(T * 1.6 + t.ph); g.strokeStyle = 'rgba(255,245,200,' + (.35 + .25 * Math.sin(T * 7 + t.ph)) + ')'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-r * 1.9, 0); g.lineTo(r * 1.9, 0); g.moveTo(0, -r * 1.9); g.lineTo(0, r * 1.9); g.stroke(); g.restore();
}
