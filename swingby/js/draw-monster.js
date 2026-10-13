/* 독 행성 그리기(내부 이름은 monster): 종류(volcano · crater · river · crystal)마다 생김새가 다르고, 색은 주로 독성 녹색(가끔 청록·연두·보라).
 * 독 화산(분출하는 독 용암과 가스) · 분화구(부글거는 독 웅덩이) · 독 강(흐르는 독의 강줄기) · 독 수정(뾰족한 수정 군락).
 * 같은 종류여도 균열·강줄기·분화구·수정의 수와 배치가 개체마다 달라 다양하다. 맞으면 하얗게 번쩍이고, 다치면 아래에 체력 호가 나타난다. */
import { G, g } from './state.js';
import { TAU, PI } from './util.js';
import { reachOf } from './monsters.js';

const hsl = (h, s, l, a = 1) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';
/** 개체마다 고정된 의사난수(0~1) */
const rn = (m, i) => { const x = Math.sin(m.ph * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const circle = R => () => { g.beginPath(); g.arc(0, 0, R, 0, TAU); };

/** 구 본체: 왼쪽 위에서 빛을 받는 음영. dark 는 어두운 면의 명도 */
function sphere(m, R, hue, sat, lite, dark) {
  const gr = g.createRadialGradient(-R * .35, -R * .4, R * .08, -R * .05, -R * .05, R * 1.1);
  gr.addColorStop(0, hsl(hue, sat + 10, lite + 14)); gr.addColorStop(.5, hsl(hue, sat, lite)); gr.addColorStop(1, hsl(hue + 12, sat - 10, dark));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
}
/** 어두운 면 + 가장자리 윤곽 (구 안쪽에 클립된 상태에서 부른다) */
function terminator(R, a = .55) {
  const sh = g.createRadialGradient(-R * .45, -R * .5, R * .5, -R * .45, -R * .5, R * 1.6);
  sh.addColorStop(0, 'rgba(0,10,0,0)'); sh.addColorStop(.6, 'rgba(0,10,0,.1)'); sh.addColorStop(1, 'rgba(0,10,0,' + a + ')');
  g.fillStyle = sh; g.fillRect(-R, -R, R * 2, R * 2);
}
function outline(R, hue) { g.strokeStyle = hsl(hue, 80, 12); g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); }
/** 위로 피어오르는 독가스 (분출구·웅덩이 위) */
function gas(m, x, y, R, T, n, hue) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const u = (T * .35 + i / n + rn(m, 90 + i)) % 1, r = R * (.12 + .26 * u);
    dot(x + Math.sin(T * 1.3 + i * 2) * R * .12 * u, y - u * R * .9, r, hsl(hue, 90, 55, .3 * (1 - u)));
  }
  g.globalCompositeOperation = 'source-over';
}

const BODY = {
  /** 독 화산: 어두운 지각 위로 독 용암의 균열이 번쩍이고, 꼭대기 분출구에서 독 용암 방울과 가스가 솟는다 */
  volcano(m, R, T) {
    const h = m.hue, vx = (rn(m, 1) - .5) * R * .5;   // 분출구 위치
    const cone = () => { g.beginPath(); g.moveTo(vx - R * .42, -R * .74); g.lineTo(vx - R * .15, -R * 1.26); g.lineTo(vx + R * .15, -R * 1.26); g.lineTo(vx + R * .42, -R * .74); g.closePath(); };
    g.fillStyle = hsl(h - 8, 34, 22); cone(); g.fill(); g.strokeStyle = hsl(h, 80, 10); g.lineWidth = 2; g.stroke();   // 화산 원뿔(몸체 뒤)
    sphere(m, R, h - 8, 40, 30, 11);
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const pulse = .6 + .4 * Math.sin(T * 2.2 + m.ph), nc = 4 + Math.floor(rn(m, 2) * 4);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < nc; i++) { // 분출구에서 뻗어 나가는 용암 균열
      let x = vx, y = -R * .8, a = PI / 2 + (rn(m, 10 + i) - .5) * 2.4; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { a += (rn(m, 20 + i * 7 + s) - .5) * 1.3; x += Math.cos(a) * R * .3; y += Math.sin(a) * R * .3; g.lineTo(x, y); }
      g.strokeStyle = hsl(h, 100, 45, .45 * pulse); g.lineWidth = R * .18; g.stroke();
      g.strokeStyle = hsl(h, 100, 72, .95 * pulse); g.lineWidth = R * .07; g.stroke();
    }
    terminator(R, .6); g.restore();
    g.fillStyle = hsl(h, 100, 62, .9); g.beginPath(); g.ellipse(vx, -R * 1.26, R * .15, R * .05, 0, 0, TAU); g.fill();   // 분출구의 독 용암
    const nd = 7;
    for (let i = 0; i < nd; i++) { // 솟았다 떨어지는 독 방울
      const u = (T * .8 + i / nd + rn(m, 30 + i)) % 1, vxs = (rn(m, 40 + i) - .5) * R * 1.1;
      dot(vx + vxs * u, -R * 1.26 - 4 * R * .85 * u * (1 - u), R * .085 * (1 - u * .5), hsl(h, 100, 68, 1 - u * .6));
    }
    gas(m, vx, -R * 1.3, R, T, 4, h);
    return circle(R);
  },
  /** 분화구: 크고 작은 분화구에 독 웅덩이가 부글거린다 */
  crater(m, R, T) {
    const h = m.hue;
    sphere(m, R, h - 15, 28, 42, 15);
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const nc = 2 + Math.floor(rn(m, 1) * 3);
    for (let i = 0; i < nc; i++) {
      const big = i === 0, a = rn(m, 5 + i) * TAU, d = big ? rn(m, 9) * R * .3 : (.35 + rn(m, 6 + i) * .4) * R, cx = Math.cos(a) * d, cy = Math.sin(a) * d + (big ? R * .08 : 0), cr = R * (big ? .42 : .14 + .12 * rn(m, 15 + i)), sq = .62;
      g.fillStyle = hsl(h - 15, 30, 10, .8); g.beginPath(); g.ellipse(cx, cy, cr * 1.12, cr * 1.12 * sq, 0, 0, TAU); g.fill();            // 분화구 안쪽 그림자
      const pool = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      pool.addColorStop(0, hsl(h, 100, 70, .95)); pool.addColorStop(1, hsl(h, 95, 40, .9));
      g.fillStyle = pool; g.beginPath(); g.ellipse(cx, cy + cr * .06, cr * .86, cr * .86 * sq, 0, 0, TAU); g.fill();                    // 독 웅덩이
      g.strokeStyle = hsl(h - 15, 25, 62, .55); g.lineWidth = Math.max(1.2, R * .035); g.beginPath(); g.ellipse(cx, cy, cr * 1.12, cr * 1.12 * sq, 0, PI * .95, PI * 1.9); g.stroke();   // 밝은 테두리
      for (let b = 0; b < (big ? 5 : 2); b++) { // 부글거리는 거품
        const u = (T * .9 + b * .31 + rn(m, 50 + i * 5 + b)) % 1, bx = cx + (rn(m, 60 + i * 5 + b) - .5) * cr * 1.1, by = cy + (rn(m, 70 + i * 5 + b) - .5) * cr * .5;
        g.strokeStyle = hsl(h, 100, 88, .8 * (1 - u)); g.lineWidth = 1.2; g.beginPath(); g.arc(bx, by, cr * (.05 + .12 * u), 0, TAU); g.stroke();
      }
      if (big) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = hsl(h, 100, 55, .18 + .08 * Math.sin(T * 2 + m.ph)); g.beginPath(); g.ellipse(cx, cy, cr * 1.5, cr * 1.5 * sq, 0, 0, TAU); g.fill(); g.restore(); }
    }
    terminator(R, .6); g.restore();
    gas(m, 0, R * .05, R, T, 3, h);
    return circle(R);
  },
  /** 독 강: 행성 표면을 가로질러 독이 흐르는 강줄기와 호수 */
  river(m, R, T) {
    const h = m.hue;
    sphere(m, R, h - 25, 36, 38, 14);
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const nr = 2 + Math.floor(rn(m, 1) * 3);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const trace = i => { // i 번째 강줄기를 왼쪽에서 오른쪽으로 구불구불
      const y0 = (rn(m, 3 + i) * 1.3 - .65) * R, amp = R * (.18 + .2 * rn(m, 13 + i)), k = 1 + rn(m, 23 + i) * 1.5, ph = rn(m, 33 + i) * TAU;
      g.beginPath();
      for (let s = 0; s <= 16; s++) { const t = s / 16, x = -R * 1.05 + t * R * 2.1, y = y0 + Math.sin(t * TAU * k * .6 + ph) * amp + (t - .5) * R * (rn(m, 43 + i) - .5) * 1.4; s ? g.lineTo(x, y) : g.moveTo(x, y); }
    };
    for (let i = 0; i < nr; i++) {
      trace(i); g.strokeStyle = hsl(h - 25, 30, 12, .85); g.lineWidth = R * .16; g.stroke();                    // 강둑
      trace(i); g.strokeStyle = hsl(h, 95, 48, .95); g.lineWidth = R * .09; g.stroke();                          // 독의 강물
      trace(i); g.setLineDash([R * .22, R * .3]); g.lineDashOffset = -T * R * .5; g.strokeStyle = hsl(h, 100, 82, .8); g.lineWidth = R * .03; g.stroke(); g.setLineDash([]);   // 흐름
    }
    const lx = (rn(m, 7) - .5) * R * .9, ly = (rn(m, 8) - .5) * R * .8, lr = R * (.18 + .1 * rn(m, 9));   // 호수
    g.fillStyle = hsl(h - 25, 30, 12, .85); g.beginPath(); g.ellipse(lx, ly, lr * 1.2, lr * .8, .3, 0, TAU); g.fill();
    g.fillStyle = hsl(h, 95, 52, .95); g.beginPath(); g.ellipse(lx, ly, lr, lr * .65, .3, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter'; g.fillStyle = hsl(h, 100, 60, .1 + .06 * Math.sin(T * 2 + m.ph)); g.beginPath(); g.ellipse(lx, ly, lr * 1.8, lr * 1.2, .3, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
    terminator(R, .6); g.restore();
    return circle(R);
  },
  /** 독 수정: 작은 핵에서 뾰족한 독 수정이 사방으로 자란다 */
  crystal(m, R, T) {
    const h = m.hue, n = 7 + Math.floor(rn(m, 1) * 4), core = R * .6;
    for (let pass = 0; pass < 2; pass++) { // 0: 핵 뒤로 가는 수정, 1: 앞쪽 수정
      for (let i = 0; i < n; i++) {
        if (i % 2 !== pass) continue;
        const a = m.rot + i / n * TAU + (rn(m, 10 + i) - .5) * .35, L = R * (.85 + .4 * rn(m, 20 + i)) * (i % 3 ? 1 : 1.15), w = R * (.1 + .07 * rn(m, 30 + i)), ca = Math.cos(a), sa = Math.sin(a);
        const hh = rn(m, 40 + i) < .3 ? h + 150 : h, br = .8 + .2 * Math.sin(T * 2 + i);      // 가끔 보랏빛 수정이 섞인다
        const bx = ca * core * .75, by = sa * core * .75, tx = ca * L, ty = sa * L, nx = -sa * w, ny = ca * w, mx = bx + (tx - bx) * .72, my = by + (ty - by) * .72;
        g.fillStyle = hsl(hh, 85, 70 * br); g.beginPath(); g.moveTo(bx - nx, by - ny); g.lineTo(mx - nx * 1.1, my - ny * 1.1); g.lineTo(tx, ty); g.lineTo(mx, my); g.lineTo(bx, by); g.closePath(); g.fill();   // 밝은 면
        g.fillStyle = hsl(hh, 85, 42 * br); g.beginPath(); g.moveTo(bx + nx, by + ny); g.lineTo(mx + nx * 1.1, my + ny * 1.1); g.lineTo(tx, ty); g.lineTo(mx, my); g.lineTo(bx, by); g.closePath(); g.fill();   // 어두운 면
        g.strokeStyle = hsl(hh, 90, 16); g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx - nx, by - ny); g.lineTo(mx - nx * 1.1, my - ny * 1.1); g.lineTo(tx, ty); g.lineTo(mx + nx * 1.1, my + ny * 1.1); g.lineTo(bx + nx, by + ny); g.stroke();
        g.strokeStyle = hsl(hh, 100, 90, .55 * br); g.lineWidth = 1; g.beginPath(); g.moveTo(bx + (mx - bx) * .2 - nx * .4, by + (my - by) * .2 - ny * .4); g.lineTo(tx - ca * L * .1 - nx * .2, ty - sa * L * .1 - ny * .2); g.stroke();   // 반짝이는 모서리
      }
      if (pass === 0) { // 핵
        sphere(m, core, h - 20, 40, 34, 12); g.save(); g.beginPath(); g.arc(0, 0, core, 0, TAU); g.clip(); terminator(core, .5); g.restore(); outline(core, h);
        g.globalCompositeOperation = 'lighter'; dot(0, 0, core * .55, hsl(h, 100, 55, .25 + .12 * Math.sin(T * 2.6 + m.ph))); g.globalCompositeOperation = 'source-over';   // 핵의 독빛
      }
    }
    return circle(core);
  }
};

export function drawMonster(m) {
  const T = G.T, R = m.R, sq = m.sq;
  g.save(); g.translate(m.x, m.y); g.scale(1 + .14 * sq, 1 - .14 * sq);
  const halo = g.createRadialGradient(0, 0, R * .6, 0, 0, R * 2.1); halo.addColorStop(0, hsl(m.hue, 95, 55, .26 + .06 * Math.sin(T * 2 + m.ph))); halo.addColorStop(1, hsl(m.hue, 95, 55, 0));
  g.fillStyle = halo; g.beginPath(); g.arc(0, 0, R * 2.1, 0, TAU); g.fill();
  for (let i = 0; i < 5; i++) { // 둥둥 떠다니는 독 포자
    const u = (T * .25 + i * .2 + rn(m, 80 + i)) % 1, a = rn(m, 85 + i) * TAU + T * .3, r = R * (1.1 + u * .7);
    g.globalAlpha = (1 - u) * .7; dot(Math.cos(a) * r, Math.sin(a) * r, 1.3 + R * .03, hsl(m.hue, 100, 78)); g.globalAlpha = 1;
  }
  const path = BODY[m.kind](m, R, T);
  if (m.flash > 0) { path(); g.fillStyle = '#fff'; g.globalAlpha = Math.min(.85, m.flash * 6); g.fill(); g.globalAlpha = 1; }
  g.restore();
  if (m.hp < m.max && m.hp > 0) { // 체력 호
    const r = reachOf(m) + 8; g.lineCap = 'round'; g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(m.x, m.y, r, .15 * PI, .85 * PI); g.stroke();
    g.strokeStyle = hsl(m.hue, 95, 65); g.beginPath(); g.arc(m.x, m.y, r, .15 * PI, (.15 + .7 * m.hp / m.max) * PI); g.stroke();
  }
}
