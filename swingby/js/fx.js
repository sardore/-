/* 타격감 연출: 파티클·링·텍스트·히트스톱·줌펀치·화면 번쩍임·슬로모션·토스트, 점수 표시 */
import { G } from './state.js';
import { scoreMul } from './stats.js';
import { rnd, TAU } from './util.js';

export function burst(x, y, c, n, sp) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(30, sp || 150); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, l: rnd(.3, .8), c, s: 3 }); }
}
export function sparks(x, y, c, n, sp, dir, spread) {
  for (let i = 0; i < n; i++) { const a = dir + rnd(-spread, spread), v = rnd(sp * .4, sp); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, l: rnd(.2, .55), c, s: rnd(1.5, 3.5), line: true }); }
}
export const ringFx = (x, y, c, r0, r1, dur, w) => G.fxr.push({ x, y, c, r0, r1, t: 0, dur: dur || .45, w: w || 3 });
export const hitstop = t => { G.freeze = Math.max(G.freeze, t); };
export const punch = z => { G.zoom = Math.max(G.zoom, z); };
export const shakeAdd = a => { G.shake = Math.max(G.shake, a); };
export const flashScreen = (a, c) => { G.flashA = Math.max(G.flashA, a); G.flashC = c || '#fff'; };
export const slowmo = (f, t) => { G.ts = f; G.tsT = t; };
export const toast = (s, c) => { G.toastO = { t: 0, s, c: c || '#fff' }; };
export const popText = (x, y, s, c, sz) => G.texts.push({ x, y, t: 0, s, c, sz: sz || 15 });

/** 점수 추가 + 떠오르는 숫자. 능력치·바이옴 배율이 여기서 한 번에 적용된다 */
export function addScore(n, x, y, c, label, big) {
  n = Math.round(n * scoreMul()); G.score += n;
  popText(x, y, (label ? label + '  ' : '') + '+' + n, c || '#fff', big);
  return n;
}

/** 파티클 목록을 dt 만큼 진행시킨다 (게임 월드와 상점 미리보기가 같이 쓴다) */
export function stepParts(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t > p.l) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97;
  }
}

/** 시간이 흐르는 연출 요소 갱신. rawDt: 실제 dt(타이머), dt: 히트스톱·슬로모션이 반영된 dt */
export function updateFx(rawDt, dt) {
  if (G.flashA > 0) G.flashA = Math.max(0, G.flashA - rawDt * 2.4);
  G.zoom += (0 - G.zoom) * Math.min(1, rawDt * 10);
  if (G.banner) { G.banner.t += rawDt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.tsT > 0) { G.tsT -= rawDt; if (G.tsT <= 0) G.ts = 1; }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  if (G.toastO) { G.toastO.t += dt; if (G.toastO.t > 1.6) G.toastO = null; }
  if (G.castO) { G.castO.t += dt; if (G.castO.t >= G.castO.dur) G.castO = null; }
  const { fxr, parts, texts } = G;
  for (let i = fxr.length - 1; i >= 0; i--) { fxr[i].t += dt; if (fxr[i].t > fxr[i].dur) fxr.splice(i, 1); }
  stepParts(parts, dt);
  for (let i = texts.length - 1; i >= 0; i--) { texts[i].t += dt; if (texts[i].t > 1) texts.splice(i, 1); }
}
