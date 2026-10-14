/* 적 함선 보스 그림 도구: 3D 느낌의 장갑판·포탑·포신·렌즈·창문 줄 같은 부품. 좌표 원점은 보스 중심, 길이 단위는 R/50(보스 충돌 반지름이 50), 뱃머리는 아래(+y)다.
 * 빛은 왼쪽 위에서 온다: 장갑판은 가운데 선(용마루)을 기준으로 왼쪽이 밝고 오른쪽이 어둡고, 위쪽 가장자리에 하이라이트·아래쪽에 그늘이 진다.
 * 몸체는 검정·회색 철갑이고, 주포·렌즈·냉각구 같은 곳만 보스의 위협색(붉은색·보라색, b.d.hue)으로 빛난다 */
import { G, g } from './state.js';
import { PI, TAU, clamp } from './util.js';

/** [하이라이트, 밝은 면, 그늘진 면, 가장 어두운 면] */
export const PAL = {
  gun:   ['#8a919c', '#505762', '#262b32', '#090b0e'],
  steel: ['#c0c7d0', '#7c848f', '#40464f', '#14171c'],
  black: ['#59606a', '#2b3037', '#14171b', '#040506']
};
const LIGHT = [-.5, -.85];

export const path = pts => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); };
/** 오른쪽 절반(x>=0, 위에서 아래로, 처음과 끝이 x=0) → 좌우 대칭 전체 윤곽 */
export const mirX = half => half.concat(half.slice(1, -1).reverse().map(q => [-q[0], q[1]]));
export const rectP = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** 위협색(보스 색상 h) */
export const hot = (h, l, a) => 'hsla(' + h + ',100%,' + l + '%,' + (a == null ? 1 : a) + ')';

/** 장갑판 한 장. o: crest 용마루 x · seams 패널 이음선 수 · flat 세부 생략 */
export function plate(pts, pal, o) {
  o = o || {};
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, cx = 0, cy = 0;
  for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); cx += q[0]; cy += q[1]; }
  cx /= pts.length; cy /= pts.length;
  const w = x1 - x0 || 1, h = y1 - y0 || 1, crest = o.crest != null ? o.crest : (x0 + x1) / 2, f = clamp((crest - x0) / w, .03, .96);
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, pal[1]); gr.addColorStop(f, pal[0]); gr.addColorStop(Math.min(.99, f + .004), pal[2]); gr.addColorStop(1, pal[3]);
  g.fillStyle = gr; path(pts); g.fill();
  g.save(); path(pts); g.clip();
  const vl = g.createLinearGradient(0, y0, 0, y1); vl.addColorStop(0, 'rgba(255,255,255,.16)'); vl.addColorStop(.5, 'rgba(255,255,255,0)'); vl.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = vl; g.fillRect(x0, y0, w, h);
  const sp = g.createLinearGradient(x0, y0, x0 + w * .6, y0 + h * .6); sp.addColorStop(0, 'rgba(255,255,255,.2)'); sp.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = sp; g.fillRect(x0, y0, w, h);
  if (!o.flat && w > 14 && h > 14) {
    g.lineWidth = .9;
    const n = o.seams != null ? o.seams : Math.max(1, Math.round(h / 24));
    for (let i = 1; i <= n; i++) { const y = y0 + h * i / (n + 1); g.strokeStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(x0, y + 1); g.lineTo(x1, y + 1); g.stroke(); }
    for (const s of [-1, 1]) { const x = crest + s * w * .24; if (x > x0 + 3 && x < x1 - 3) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + 1, y0); g.lineTo(x + 1, y1); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let y = y0 + 5; y < y1 - 3; y += 9) { g.fillRect(x0 + 3, y, 1.1, 1.1); g.fillRect(x1 - 4, y, 1.1, 1.1); }
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1.4; g.lineJoin = 'round'; path(pts); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, m = Math.hypot(mx, my) || 1;
    if ((mx * LIGHT[0] + my * LIGHT[1]) / m > .4) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  }
}
/** 구·돔: 왼쪽 위가 밝은 방사 그라데이션 */
export function dome(cx, cy, rx, ry, pal) {
  const gr = g.createRadialGradient(cx - rx * .35, cy - ry * .45, Math.min(rx, ry) * .1, cx, cy, Math.max(rx, ry) * 1.05);
  gr.addColorStop(0, pal[0]); gr.addColorStop(.45, pal[1]); gr.addColorStop(.85, pal[2]); gr.addColorStop(1, pal[3]);
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = .9; g.beginPath(); g.ellipse(cx, cy, rx - .5, ry - .5, 0, PI * .95, PI * 1.55); g.stroke();
}
/** 빛나는 곳(위협색 방사 번짐) */
export function glow(x, y, r, h, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hot(h, 62, a)); gr.addColorStop(.4, hot(h, 50, a * .45)); gr.addColorStop(1, hot(h, 50, 0));
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
}
/** 보스에서 플레이어 쪽을 향하는 각도(아래쪽 부채꼴 안으로 제한) */
export function aimAngle(b, x, y, spread) {
  const s = G.ship, sc = b.R / 50, dx = s.x - (b.x + x * sc), dy = s.y - (b.y + y * sc), a = Math.atan2(dy, dx);
  return clamp(a, PI / 2 - (spread || 1.1), PI / 2 + (spread || 1.1));
}
/** 포신: (x,y) 에서 각도 ang 방향으로 len, 굵기 w. 주포는 포구 둘레가 위협색으로 달아오른다(charge 0~1) */
export function barrel(x, y, ang, len, w, pal, h, charge) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(0, -w / 2, 0, w / 2); gr.addColorStop(0, pal[1]); gr.addColorStop(.35, pal[0]); gr.addColorStop(1, pal[3]);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(1, -w / 2 + 1.5, len, w);
  g.fillStyle = gr; g.fillRect(0, -w / 2, len, w);
  g.fillStyle = pal[2]; g.fillRect(len * .45, -w / 2 - 1, 3, w + 2); g.fillRect(len - 5, -w / 2 - 1.4, 5, w + 2.8);
  g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1; g.strokeRect(0, -w / 2, len, w);
  if (charge != null) { g.globalCompositeOperation = 'lighter'; g.fillStyle = hot(h, 58, .35 + .65 * charge); g.fillRect(len - 4, -w / 2 + .6, 3.4, w - 1.2); g.fillStyle = hot(h, 70, .3 + .5 * charge); g.fillRect(len * .5, -.8, len * .45, 1.6); g.globalCompositeOperation = 'source-over'; }
  g.restore();
  if (charge != null) glow(x + Math.cos(ang) * len, y + Math.sin(ang) * len, 7 + 16 * charge, h, .35 + .55 * charge);
}
/** 포탑: 둥근 받침 + 플레이어를 겨누는 포신 */
export function turret(b, x, y, r, pal, h, charge, len) {
  const a = aimAngle(b, x, y);
  dome(x, y, r, r, pal);
  barrel(x, y, a, len || r * 1.9, r * .5, pal, h, charge);
  dome(x, y, r * .62, r * .62, pal);
  g.fillStyle = hot(h, 55, .5 + .5 * (charge || 0)); g.beginPath(); g.arc(x, y, r * .16, 0, TAU); g.fill();
}
/** 렌즈(눈): 어두운 유리와 위협색 눈동자가 플레이어를 쫓는다 */
export function lens(b, x, y, r, h, power) {
  dome(x, y, r * 1.18, r * 1.18, PAL.black);
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hot(h, 70, .95)); gr.addColorStop(.5, hot(h, 40, .9)); gr.addColorStop(1, hot(h, 15, 1));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  const s = G.ship, sc = b.R / 50, dx = s.x - (b.x + x * sc), dy = s.y - (b.y + y * sc), d = Math.hypot(dx, dy) || 1, k = r * .36;
  g.fillStyle = '#080204'; g.beginPath(); g.ellipse(x + dx / d * k, y + dy / d * k, r * .24, r * .5, Math.atan2(dy, dx) + PI / 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x - r * .38, y - r * .42, r * .22, r * .12, -.6, 0, TAU); g.fill();
  glow(x, y, r * 2.4, h, .25 * power);
}
/** 창문 줄: 위협색 불빛이 일부 깜박인다 */
export function windows(x0, x1, y, n, h, seed, size) {
  const t = G.T, sz = size || 2.2;
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (n === 1 ? .5 : i / (n - 1)), on = Math.sin(t * 2 + (i + seed) * 1.7) > -.5; g.fillStyle = on ? hot(h, 62, .9) : 'rgba(40,10,14,.9)'; g.fillRect(x - sz / 2, y - sz / 2, sz, sz); }
}
/** 엔진 분사구 줄(함선 뒤쪽, 위): 위협색으로 이글거린다 */
export function engines(xs, y, w, h) {
  const t = G.T;
  xs.forEach((x, i) => {
    g.fillStyle = '#07080a'; g.fillRect(x - w / 2 - 1.5, y - 2, w + 3, 8);
    const fl = 10 + 5 * Math.sin(t * 22 + i * 2), gr = g.createLinearGradient(0, y + 2, 0, y - fl - 6); gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(.3, hot(h, 62, .8)); gr.addColorStop(1, hot(h, 50, 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y + 1); g.lineTo(x, y - fl - 6); g.lineTo(x + w / 2, y + 1); g.closePath(); g.fill();
  });
}
/** 보스의 공격 준비 정도(0~1): 예고 중이면 포구·렌즈가 더 달아오른다 */
export const charge = b => b.cast > 0 ? 1 : .15 + .12 * Math.sin(G.T * 2.5);
