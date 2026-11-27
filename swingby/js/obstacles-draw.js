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

/** 반전 포탈: 지오메트리 대시식 중력 포탈. 가로폭을 채우는 납작한 타원 고리 + 안쪽 흐름 화살표 + 테두리를 도는 불꽃.
 *  내려가기(to<0)는 파랑 ▼, 되돌리기(to>0)는 노랑 ▲. 지나간 포탈은 흐려진다. */
function drawPortal(o, T, still, k, top, bot) {
  if (o.y < top - 60 || o.y > bot + 60) return;
  const down = o.to < 0, hue = down ? 200 : 48, cx = G.w / 2, rx = G.w / 2 + 26, ry = 26 * k, dirY = down ? 1 : -1;
  const col = l => 'hsl(' + hue + ',100%,' + l + '%)', al = o.used ? .3 : 1, pulse = still ? 1 : .85 + .15 * Math.sin(T * 7);
  g.save(); g.globalAlpha = al; g.translate(cx, o.y);
  // 안쪽: 위아래로 흐르는 빛
  g.save(); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.clip();
  const fill = g.createRadialGradient(0, 0, 0, 0, 0, rx); fill.addColorStop(0, 'hsla(' + hue + ',100%,70%,.55)'); fill.addColorStop(.6, 'hsla(' + hue + ',100%,55%,.28)'); fill.addColorStop(1, 'hsla(' + hue + ',100%,50%,.12)');
  g.fillStyle = fill; g.fillRect(-rx, -ry, rx * 2, ry * 2);
  g.strokeStyle = 'hsla(' + hue + ',100%,92%,.95)'; g.lineWidth = 3.4; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let x = -rx + 26; x < rx - 10; x += 38) {   // 진행 방향으로 흐르는 ▼/▲ 화살표(chevron)
    const m = still ? .5 : ((T * 1.4 + x * .013) % 1), y = (m - .5) * ry * 2 * dirY;
    g.globalAlpha = al * Math.sin(m * Math.PI);
    g.beginPath(); g.moveTo(x - 11, y - 7 * dirY); g.lineTo(x, y + 5 * dirY); g.lineTo(x + 11, y - 7 * dirY); g.stroke();
  }
  g.restore(); g.globalAlpha = al;
  // 테두리: 바깥 번짐 → 색 고리 → 흰 속테두리
  g.shadowColor = col(60); g.shadowBlur = 22 * pulse; g.strokeStyle = 'hsla(' + hue + ',100%,60%,.55)'; g.lineWidth = 11; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
  g.shadowBlur = 10; g.strokeStyle = col(68); g.lineWidth = 5; g.stroke();
  g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, rx - 2, ry - 2, 0, 0, TAU); g.stroke();
  // 테두리를 도는 불꽃
  if (!still) for (let i = 0; i < 14; i++) { const a = T * (down ? 1.6 : -1.6) + i * TAU / 14, px = Math.cos(a) * rx, py = Math.sin(a) * ry, r = 2.2 + 1.6 * Math.sin(T * 9 + i); g.fillStyle = i % 3 ? col(80) : '#fff'; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); }
  g.restore();
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
      case 'portal': drawPortal(o, T, still, k, top, bot); break;
    }
  }
}
