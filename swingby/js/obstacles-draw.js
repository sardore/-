/* 장애물 그리기: 플라즈마 오브·네온 전류, 화살표(중력) 오브, 부스트 오브, 반전 포탈, 미지 행성 표식.
 * 월드 변환(뒤집힘 포함)이 걸린 채로 불린다. 글자는 uprightText 로 뒤집힘과 상관없이 바로 선다. */
import { G, g } from './state.js';
import { TAU, rnd } from './util.js';
import { fs } from './stats.js';
import { viewTop, viewBot } from './camera.js';
import { txt, reducedMotion } from './gfx.js';

/** 화면이 뒤집혀도 글자는 바로 서게 그린다 */
export function uprightText(s, x, y, size, c, al, wt) {
  if (G.flipK >= 0) { txt(s, x, y, size, c, al, wt); return; }
  g.save(); g.translate(x, y); g.scale(1, -1); txt(s, 0, 0, size, c, al, wt); g.restore();
}

function lightning(o, T, still) {
  const dx = o.bx - o.ax, dy = o.by - o.ay, L = Math.hypot(dx, dy), n = Math.max(3, Math.round(L / 18)), nx = -dy / (L || 1), ny = dx / (L || 1);
  const pts = [];
  for (let i = 0; i <= n; i++) { const f = i / n, j = i === 0 || i === n || still ? 0 : (Math.sin(T * 37 + i * 2.1 + o.ph) + rnd(-.6, .6)) * 4.5 * fs(); pts.push(o.ax + dx * f + nx * j, o.ay + dy * f + ny * j); }
  const path = () => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#ff4fe8'; g.shadowBlur = 16; g.strokeStyle = 'rgba(255,80,235,.55)'; g.lineWidth = 7 * fs(); path(); g.stroke();
  g.shadowColor = '#7ff6ff'; g.shadowBlur = 10; g.strokeStyle = '#9ff6ff'; g.lineWidth = 2.6 * fs(); path(); g.stroke();
  g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 1 * fs(); path(); g.stroke();
}

/* 반전 포탈: 지오메트리 대시의 중력 포탈처럼 — 납작하게 누운 굵은 고리, 검은 외곽선, 단색 + 밝은 줄 한 가닥.
 * 고리의 뒤쪽 반(위)은 기체 뒤에, 앞쪽 반(아래)은 기체 앞에 그려 기체가 고리를 "통과"한다. 주변의 네모 입자가 고리로 빨려든다.
 * 아래로 반전(to<0)은 노랑, 되돌림(to>0)은 파랑 (GD 의 중력 포탈 색). 지나간 포탈은 흐려진다. */
const PORTAL_COL = { flip: ['#ffd51f', '#fff38a', '#a87c00'], back: ['#1fb7ff', '#a6ecff', '#0a5f9e'] };
const OUTLINE = '#0a0a12';
function portalGeom(o, k) { return { cx: G.w / 2, rx: G.w / 2 + 34, ry: 30 * k, c: PORTAL_COL[o.to < 0 ? 'flip' : 'back'] }; }
/** 고리 반쪽: from~to 각도(라디안)의 굵은 띠 */
function ringHalf(cx, y, rx, ry, a0, a1, c, w) {
  const arc = (dr, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.ellipse(cx, y, rx + dr, ry + dr * .35, 0, a0, a1); g.stroke(); };
  g.lineCap = 'butt';
  arc(0, w + 5, OUTLINE);       // 검은 외곽선
  arc(0, w, c[0]);              // 단색 몸체
  arc(-w * .28, w * .3, c[2]);  // 안쪽 어두운 띠
  arc(w * .18, w * .22, c[1]);  // 바깥쪽 밝은 줄
}
function portalParticles(o, y, g0, T, k, still) {
  if (still || o.used) return;
  for (let i = 0; i < 22; i++) {   // 위아래에서 고리 쪽으로 빨려드는 네모
    const ph = (i * .618) % 1, m = (T * .9 + ph) % 1, side = i % 2 ? 1 : -1;
    const x = g0.cx + (((i * 97) % 100) / 100 - .5) * (g0.rx * 2 - 30), py = y + side * (1 - m) * 70 * k, s = (3 + (i % 3)) * k * (1 - m * .5);
    g.save(); g.globalAlpha *= Math.min(1, m * 3) * (1 - m * .4); g.translate(x, py); g.rotate(T * 3 + i);
    g.fillStyle = i % 4 ? g0.c[1] : '#fff'; g.fillRect(-s / 2, -s / 2, s, s); g.restore();
  }
}
/** 뒤쪽 반(기체 뒤): 안쪽 면 + 위쪽 고리 + 입자 */
function drawPortalBack(o, T, still, k) {
  const P = portalGeom(o, k);
  g.save(); g.globalAlpha = o.used ? .3 : 1;
  g.fillStyle = P.c[0]; g.globalAlpha *= .16; g.beginPath(); g.ellipse(P.cx, o.y, P.rx, P.ry, 0, 0, TAU); g.fill(); g.globalAlpha = o.used ? .3 : 1;
  ringHalf(P.cx, o.y, P.rx, P.ry, Math.PI, TAU, [P.c[2], P.c[0], OUTLINE], 10 * k);   // 뒤쪽은 어둡고 얇게
  portalParticles(o, o.y, P, T, k, still);
  g.restore();
}
/** 앞쪽 반(기체 앞) */
function drawPortalFront(o, k) {
  const P = portalGeom(o, k);
  g.save(); g.globalAlpha = o.used ? .3 : 1;
  ringHalf(P.cx, o.y, P.rx, P.ry, 0, Math.PI, P.c, 16 * k);
  g.restore();
}
/** 기체를 그린 뒤에 부른다: 포탈의 앞쪽 반 */
export function drawObstaclesFront() {
  const top = viewTop() - 80, bot = viewBot() + 80, k = fs();
  for (const o of G.obs) if (o.k === 'portal' && o.y > top && o.y < bot) drawPortalFront(o, k);
}

export function drawObstacles() {
  const top = viewTop() - 80, bot = viewBot() + 80, T = G.T, still = reducedMotion(), k = fs();
  // 미지 행성: 검은 몸체와 물음표
  for (const p of G.planets) {
    if (!p.unk || p.dead || p.y < top - 100 || p.y > bot + 100) continue;
    const gr = g.createRadialGradient(p.x - p.R * .3, p.y - p.R * .3, p.R * .1, p.x, p.y, p.R * 1.05);
    gr.addColorStop(0, '#2a2236'); gr.addColorStop(.7, '#0b0910'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.R * 1.03, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(190,140,255,' + (.55 + .25 * Math.sin(T * 2.5)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, p.R * 1.03, 0, TAU); g.stroke();
    g.save(); g.shadowColor = '#b98cff'; g.shadowBlur = 12; uprightText('?', p.x, p.y + p.R * .32, p.R * 1.05, '#d9c2ff', 'center', 900); g.restore();
  }
  for (const o of G.obs) {
    switch (o.k) {
      case 'arc': if (Math.max(o.ay, o.by) > top && Math.min(o.ay, o.by) < bot) lightning(o, T, still); break;
      case 'orb': {
        if (o.y < top || o.y > bot) break;
        const r = o.r * (1 + (still ? 0 : .12 * Math.sin(T * 9 + o.x)));
        const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 2.4); gr.addColorStop(0, 'rgba(255,120,240,.7)'); gr.addColorStop(1, 'rgba(255,120,240,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, r * 2.4, 0, TAU); g.fill();
        g.fillStyle = '#ffe6fb'; g.beginPath(); g.arc(o.x, o.y, r, 0, TAU); g.fill();
        g.strokeStyle = '#ff5ee6'; g.lineWidth = 2; g.stroke();
        break;
      }
      case 'boost': {
        if (o.y < top || o.y > bot) break;
        const used = G.ship.lastBoost === o, pulse = still ? 0 : Math.sin(T * 6) * .1;
        const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2.2); gr.addColorStop(0, 'rgba(255,200,80,.55)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r * 2.2, 0, TAU); g.fill();
        g.fillStyle = used ? '#7a5a20' : '#ffb43a'; g.beginPath(); g.arc(o.x, o.y, o.r * (1 + pulse), 0, TAU); g.fill();
        g.strokeStyle = '#fff3c0'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#fff8dc'; g.beginPath();   // 번개 표식
        g.moveTo(o.x + o.r * .15, o.y - o.r * .7); g.lineTo(o.x - o.r * .35, o.y + o.r * .08); g.lineTo(o.x - o.r * .02, o.y + o.r * .08);
        g.lineTo(o.x - o.r * .18, o.y + o.r * .72); g.lineTo(o.x + o.r * .38, o.y - o.r * .12); g.lineTo(o.x + o.r * .04, o.y - o.r * .12); g.closePath(); g.fill();
        break;
      }
      case 'pull': {
        if (o.y < top || o.y > bot) break;
        const on = G.ship.pull && G.ship.pull.o === o, a = [0, .35, .6, .9][o.lv], ang = Math.atan2(o.dy, o.dx);
        const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2); gr.addColorStop(0, 'rgba(80,200,255,' + a * .6 + ')'); gr.addColorStop(1, 'rgba(80,200,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r * 2, 0, TAU); g.fill();
        g.fillStyle = 'hsla(200,95%,' + (62 - o.lv * 10) + '%,' + (.35 + a * .6) + ')'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, TAU); g.fill();
        g.strokeStyle = on ? '#fff' : 'rgba(190,240,255,.9)'; g.lineWidth = on ? 3 : 2; g.stroke();
        g.save(); g.translate(o.x, o.y); g.rotate(ang);   // 화살표
        const m = still ? 0 : (T * 1.6) % 1;
        g.strokeStyle = '#fff'; g.lineWidth = 3.2; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-o.r * .55, 0); g.lineTo(o.r * .5, 0); g.moveTo(o.r * .12, -o.r * .38); g.lineTo(o.r * .52, 0); g.lineTo(o.r * .12, o.r * .38); g.stroke();
        g.globalAlpha = .5 * (1 - m); g.lineWidth = 2; g.beginPath(); g.moveTo(o.r * (1 + m * .9), -o.r * .3); g.lineTo(o.r * (1.3 + m * .9), 0); g.lineTo(o.r * (1 + m * .9), o.r * .3); g.stroke(); g.globalAlpha = 1;
        g.restore();
        break;
      }
      case 'portal': if (o.y > top && o.y < bot) drawPortalBack(o, T, still, k); break;
    }
  }
}
