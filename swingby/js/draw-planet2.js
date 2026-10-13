/* 행성 그리기 v2: 왼쪽 위에서 오는 빛의 음영과 어두운 면, 대기 테두리, 자전하는 표면 무늬, 가스행성 고리의 앞뒤.
 * 예전 렌더러(draw-planet.js)는 그대로 있고, 죽은(부서진) 행성 표시는 그쪽을 쓴다. */
import { G, g } from './state.js';
import { PI, TAU, easeOut } from './util.js';
import { capOf } from './stats.js';
import { hash, drawPlanet, drawCraters } from './draw-planet.js';

const LX = -.42, LY = -.5;           // 빛이 오는 방향(왼쪽 위)
const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };

/** 본체 외곽 경로. 소행성은 울퉁불퉁한 다각형 */
function bodyPath(p, R) {
  g.beginPath();
  if (p.t !== 'a') { g.arc(p.x, p.y, R, 0, TAU); return; }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = R * (.78 + .34 * hash(p, i)); i ? g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : g.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
  g.closePath();
}

/** 구 위를 흘러가는 얼룩: 가장자리에 가까울수록 좁아지고 옅어져서 자전하는 것처럼 보인다 */
function blobs(p, R, n, seed, speed, size, ew, fill) {
  for (let i = 0; i < n; i++) {
    const u = (hash(p, i + seed) + G.T * speed * (.6 + hash(p, i + seed + 60))) % 1, lx = u * 2 - 1, k = Math.sqrt(Math.max(0, 1 - lx * lx));
    if (k < .12) continue;
    const yy = p.y + (hash(p, i + seed + 30) * 2 - 1) * R * .64, rr = R * size * (.6 + .8 * hash(p, i + seed + 90));
    g.fillStyle = fill(k); g.beginPath(); g.ellipse(p.x + lx * R * .94, yy, rr * k * ew, rr * .55, 0, 0, TAU); g.fill();
  }
}

/** 가스행성의 가로 줄무늬 */
function bands(p, R) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, by = p.y - R + t * 2 * R + Math.sin(G.T * .35 + i * 1.7) * R * .025, th = R * 2 / n * (.55 + .5 * hash(p, i));
    g.fillStyle = i % 2 ? hsl(p.hue - 14, 70, 34 + 10 * hash(p, i + 9), .3) : hsl(p.hue + 10, 85, 66 + 8 * hash(p, i + 9), .26);
    g.fillRect(p.x - R, by - th / 2, R * 2, th);
  }
  const u = (hash(p, 40) + G.T * .012) % 1, lx = u * 2 - 1, k = Math.sqrt(Math.max(0, 1 - lx * lx));   // 폭풍 얼룩
  g.fillStyle = hsl(p.hue - 28, 80, 40, .5 * k); g.beginPath(); g.ellipse(p.x + lx * R * .9, p.y + R * (.15 + .25 * hash(p, 41)), R * .24 * k, R * .12, 0, 0, TAU); g.fill();
}

/** 가스행성 고리의 한쪽 절반. back=true 는 본체 뒤쪽 */
function gasRing(p, R, back) {
  g.save(); g.translate(p.x, p.y); g.rotate(-.35);
  const a0 = back ? PI : 0, a1 = back ? TAU : PI;
  g.strokeStyle = hsl(p.hue, 70, 72, back ? .38 : .62); g.lineWidth = R * .14; g.beginPath(); g.ellipse(0, 0, R * 1.5, R * .38, 0, a0, a1); g.stroke();
  g.strokeStyle = hsl(p.hue, 85, 88, back ? .3 : .7); g.lineWidth = Math.max(1.2, R * .035); g.beginPath(); g.ellipse(0, 0, R * 1.72, R * .44, 0, a0, a1); g.stroke();
  g.restore();
}

export function drawPlanet2(p) {
  if (p.dead) { drawPlanet(p); return; }
  const s = G.ship, cur = s.mode === 'orb' && s.p === p, cr = capOf(p), T = G.T, h = p.hue, t = p.t;
  const sc = easeOut(p.born) * (1 + .12 * Math.sin(p.sq * PI * 2) * p.sq), R = p.R * sc, x = p.x, y = p.y;
  // 포획 범위: 점선 + 지금 도는 행성은 안쪽이 살짝 차오른다
  g.setLineDash([5, 7]); g.lineDashOffset = -T * 14; g.lineWidth = t === 'm' ? 2 : 1.5;
  g.strokeStyle = hsl(h, 85, 70, (cur ? .55 : p.seen ? .16 : .34) + p.pulse * .4); circle(x, y, cr); g.stroke(); g.setLineDash([]);
  if (cur) { const f = g.createRadialGradient(x, y, R, x, y, cr); f.addColorStop(0, hsl(h, 90, 65, 0)); f.addColorStop(1, hsl(h, 90, 65, .1)); g.fillStyle = f; circle(x, y, cr); g.fill(); }
  if (R < 2) return;                    // 막 생겨나는 중
  // 빛무리 + 대기 테두리
  const gl = g.createRadialGradient(x, y, R * .6, x, y, R * 2.1);
  gl.addColorStop(0, hsl(h, 90, 60, (t === 'm' ? .2 : .32) + p.pulse * .4)); gl.addColorStop(1, hsl(h, 90, 60, 0)); g.fillStyle = gl; circle(x, y, R * 2.1); g.fill();
  if (t !== 'a') {
    const at = g.createRadialGradient(x, y, R * .86, x, y, R * 1.25);
    at.addColorStop(0, hsl(h, 90, 75, 0)); at.addColorStop(.42, hsl(h, 90, 72, t === 'r' ? .55 : t === 'm' ? .2 : .42)); at.addColorStop(1, hsl(h, 90, 70, 0));
    g.globalCompositeOperation = 'lighter'; g.fillStyle = at; circle(x, y, R * 1.25); g.fill(); g.globalCompositeOperation = 'source-over';
  }
  if (t === 'g') gasRing(p, R, true);
  // 본체: 빛 쪽이 밝은 구
  const sat = t === 'm' ? 38 : t === 'a' ? 30 : 70, hiS = t === 'm' ? 45 : t === 'a' ? 40 : 85, hiL = t === 'm' ? 68 : t === 'r' ? 82 : 80;
  const bd = g.createRadialGradient(x + LX * R * .7, y + LY * R * .7, R * .06, x + LX * R * .2, y + LY * R * .2, R * 1.15);
  bd.addColorStop(0, hsl(h, hiS, hiL)); bd.addColorStop(.42, hsl(h, sat, t === 'm' ? 42 : 52)); bd.addColorStop(.85, hsl(h + 14, sat - 8, 26)); bd.addColorStop(1, hsl(h + 22, sat - 12, 15));
  g.fillStyle = bd; bodyPath(p, R); g.fill();
  g.save(); bodyPath(p, R); g.clip();
  if (t === 'n') { // 대륙과 구름
    blobs(p, R, 5, 0, .018, .3, 1, k => hsl(h + 32, sat, 30, .34 * k));
    blobs(p, R, 6, 20, .03, .22, 1.9, k => 'rgba(255,255,255,' + .15 * k + ')');
  } else if (t === 'g') bands(p, R);
  else if (t === 'r') { blobs(p, R, 7, 0, .03, .22, 1, k => hsl(h + 30, 100, 78, .4 * k)); blobs(p, R, 5, 20, .02, .2, 1, k => hsl(h - 4, 80, 22, .5 * k)); }
  else if (t === 'a') { // 면과 작은 분화구
    g.strokeStyle = 'rgba(255,235,200,.18)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 4; i++) { const a = hash(p, i + 50) * TAU; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } g.stroke();
    for (let i = 0; i < 5; i++) { const a = hash(p, i + 60) * TAU, d = hash(p, i + 70) * R * .55, r = R * (.08 + .1 * hash(p, i + 80)); g.fillStyle = 'rgba(30,14,6,.3)'; circle(x + Math.cos(a) * d, y + Math.sin(a) * d, r); g.fill(); }
  }
  // 어두운 면(적색왜성은 스스로 빛나므로 옅게)
  const sh = g.createRadialGradient(x + LX * R * .5, y + LY * R * .5, R * .55, x + LX * R * .5, y + LY * R * .5, R * 1.55);
  sh.addColorStop(0, 'rgba(0,0,12,0)'); sh.addColorStop(.6, 'rgba(0,0,12,' + (t === 'r' ? .04 : .1) + ')'); sh.addColorStop(1, 'rgba(0,0,12,' + (t === 'r' ? .28 : .62) + ')');
  g.fillStyle = sh; g.fillRect(x - R * 1.3, y - R * 1.3, R * 2.6, R * 2.6);
  if (t === 'n' || t === 'g' || t === 'm') { // 반짝이는 하이라이트
    const sp = g.createRadialGradient(x + LX * R * .5, y + LY * R * .55, 0, x + LX * R * .5, y + LY * R * .55, R * .5);
    sp.addColorStop(0, 'rgba(255,255,255,.3)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sp; g.fillRect(x - R, y - R, R * 2, R * 2);
  }
  g.restore();
  if (t === 'm') drawCraters(p, R);
  if (t === 'a') { // 균열: 떠나면 부서진다는 표시
    g.strokeStyle = 'rgba(255,235,200,.55)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(x - R * .5, y - R * .3); g.lineTo(x, y + R * .05); g.lineTo(x + R * .45, y - R * .35); g.moveTo(x, y + R * .05); g.lineTo(x + R * .1, y + R * .6); g.stroke();
  } else { // 빛 쪽 가장자리의 밝은 테두리
    g.strokeStyle = hsl(h, 90, 88, t === 'r' ? .3 : .42); g.lineWidth = Math.max(1, R * .05); g.beginPath(); g.arc(x, y, R - g.lineWidth * .5, PI * .92, PI * 1.58); g.stroke();
  }
  if (t === 'g') gasRing(p, R, false);
  if (t === 'r') { // 코로나가 맥동한다
    const pl = .5 + .5 * Math.sin(T * 9 + p.ph), co = g.createRadialGradient(x, y, R, x, y, R * (1.7 + .25 * pl));
    co.addColorStop(0, 'rgba(255,120,90,' + (.3 + .2 * pl) + ')'); co.addColorStop(1, 'rgba(255,120,90,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = co; circle(x, y, R * 2); g.fill(); g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,120,90,' + (.35 + .3 * Math.sin(T * 9 + p.ph)) + ')'; g.lineWidth = 2; circle(x, y, R + 4 + 2 * Math.sin(T * 9 + p.ph)); g.stroke();
  }
}
