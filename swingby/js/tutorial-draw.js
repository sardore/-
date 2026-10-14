/* 튜토리얼 그림: 월드 위 강조(화살표·링·점선)와 화면 위 안내(손가락·숫자 변화·말풍선). 진행은 tutorial.js */
import { G, V, g } from './state.js';
import { PI, TAU, FONT } from './util.js';
import { capOf } from './stats.js';
import { rr, txt } from './gfx.js';
import { pickLayout } from './draw-pick.js';
import { exitRect, skipRect } from './tutorial.js';

const YEL = '#ffd070', GRN = '#7dffaa', RED = '#ff7a7a', WHT = '#ffffff';
const TEXT = {
  launch: '화면을 눌렀다 떼면 날아갑니다', aim: '화살표가 행성을 향하면 떼세요', star: '별을 먹으면 점수가 오릅니다',
  decay: '오래 돌면 궤도가 줄어 추락합니다', dash: '길게 누르면 충전, 떼면 돌진합니다', evo: '기체를 하나 골라 진화하세요',
  hit: '태양에 부딪혀 피해를 주세요', scroll: '맵이 밀려납니다. 위로 올라가세요', count: '착지할 때마다 숫자가 줄고, 0이 되면 공격합니다',
  zone: '붉은 구역은 터지기 전에 벗어나세요'
};

/* ---------- 그리기 도구 ---------- */
/** 점선 화살표 */
function arrow(x1, y1, x2, y2, col, w = 3) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.setLineDash([8, 8]); g.lineDashOffset = -G.T * 40; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(a) * 10, y2 - Math.sin(a) * 10); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - Math.cos(a - .45) * 15, y2 - Math.sin(a - .45) * 15); g.lineTo(x2 - Math.cos(a + .45) * 15, y2 - Math.sin(a + .45) * 15); g.closePath(); g.fill(); g.restore();
}
/** 퍼져 나가는 강조 링 */
function pulse(x, y, r, col, lw = 3) {
  g.save(); g.strokeStyle = col; g.lineWidth = lw;
  for (let i = 0; i < 2; i++) { const k = (G.T * .9 + i * .5) % 1; g.globalAlpha = (1 - k) * .85; g.beginPath(); g.arc(x, y, r * (.9 + .35 * k), 0, TAU); g.stroke(); }
  g.restore();
}
/** 손가락(터치 점). press 0~1: 눌린 정도, ripple: 0~1 퍼지는 파문 */
function finger(x, y, press, ripple) {
  g.save();
  if (ripple > 0) { g.strokeStyle = 'rgba(255,255,255,' + (1 - ripple) * .8 + ')'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 16 + 34 * ripple, 0, TAU); g.stroke(); }
  const r = 17 * (1 - .22 * press), gr = g.createRadialGradient(x - 4, y - 5, 1, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,255,.98)'); gr.addColorStop(1, 'rgba(190,215,255,' + (.75 + .2 * press) + ')');
  g.shadowColor = 'rgba(160,200,255,.9)'; g.shadowBlur = 14; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
}
/** 위/아래 삼각 표시 (눌림 ▼ / 뗌 ▲) */
function tri(x, y, up, col) { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + (up ? -9 : 9)); g.lineTo(x - 9, y + (up ? 7 : -7)); g.lineTo(x + 9, y + (up ? 7 : -7)); g.closePath(); g.fill(); }
/** 말풍선 */
function bubble(s, y) {
  const { VW } = V; g.font = '700 15px ' + FONT; const w = Math.min(VW - 24, g.measureText(s).width + 36);
  g.save(); rr(VW / 2 - w / 2, y - 18, w, 36, 18); g.fillStyle = 'rgba(8,12,34,.82)'; g.fill(); g.strokeStyle = 'rgba(255,208,112,.8)'; g.lineWidth = 1.5; g.stroke(); g.restore();
  txt(s, VW / 2, y + 5, 15, '#fff', 'center', 700);
}

/* ---------- 월드 위(카메라 변환 안) ---------- */
/** 지금 노릴 다음 행성: 서 있는 행성보다 위쪽에서 가장 가까운 것 */
function nextPlanet() {
  const s = G.ship; let best = null, bd = 1e9;
  for (const p of G.planets) { if (p === s.p || p.dead || p.ghost || p.y > s.p.y - 20) continue; const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
/** 지금 떼면 날아갈 방향의 화살표. 목표 행성 포획 범위를 지나가면 초록색 */
function launchArrow(len, target) {
  const s = G.ship; if (s.mode !== 'orb') return;
  const dx = -Math.sin(s.a) * s.dir, dy = Math.cos(s.a) * s.dir;
  let col = YEL;
  if (target) { const rx = target.x - s.x, ry = target.y - s.y, t = rx * dx + ry * dy, off = Math.abs(rx * dy - ry * dx); if (t > 0 && off < capOf(target) * .85) col = GRN; }
  arrow(s.x, s.y, s.x + dx * len, s.y + dy * len, col, 3.5);
}

export function drawTutoWorld() {
  const T = G.tuto; if (!T || G.st !== 'play') return;
  const s = G.ship, b = G.boss;
  if (b) {
    if (T.bh === 'hit' && s.mode === 'orb') { arrow(s.x, s.y, b.x, b.y + b.hr * 1.15, YEL, 3.5); pulse(b.x, b.y, b.hr * 1.2, YEL); }
    if (T.bh === 'zone') for (const h of G.haz) {
      if (h.k !== 'zone' || h.dead) continue;
      g.save(); g.strokeStyle = RED; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -G.T * 50; g.globalAlpha = .6 + .4 * Math.sin(G.T * 8);
      g.beginPath(); if (h.shape === 'c') g.arc(h.x, h.y, h.r + 8, 0, TAU); else g.rect(h.x - (h.w || 40) - 6, h.y - (h.hh || 40) - 6, (h.w || 40) * 2 + 12, (h.hh || 40) * 2 + 12); g.stroke(); g.restore();
    }
    return;
  }
  switch (T.step) {
    case 'launch': launchArrow(95); break;
    case 'aim': { const p = nextPlanet(); if (p) pulse(p.x, p.y, capOf(p), YEL); launchArrow(130, p); break; }
    case 'star': {
      let best = null, bd = 1e9; for (const t of G.stars) { if (t.got || t.y > s.y + 40) continue; const d = Math.hypot(t.x - s.x, t.y - s.y); if (d < bd) { bd = d; best = t; } }
      if (best) { pulse(best.x, best.y, 22, YEL); const bob = Math.sin(G.T * 6) * 5; arrow(best.x, best.y - 56 + bob, best.x, best.y - 26 + bob, YEL, 3); }
      break;
    }
    case 'decay': if (s.mode === 'orb') { // 줄어드는 궤도: 바깥에서 안으로 모이는 붉은 화살촉
      const p = s.p, k = (G.T * .8) % 1;
      g.save(); g.strokeStyle = RED; g.lineWidth = 2.5; g.setLineDash([7, 7]); g.lineDashOffset = -G.T * 20; g.beginPath(); g.arc(p.x, p.y, s.r, 0, TAU); g.stroke(); g.setLineDash([]);
      g.strokeStyle = 'rgba(255,90,90,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, p.R + 3, 0, TAU); g.stroke();
      g.fillStyle = RED; g.globalAlpha = 1 - k * .6;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + G.T * .35, r = s.r + 22 - 22 * k, c = Math.cos(a), sn = Math.sin(a); g.beginPath(); g.moveTo(p.x + c * (r - 9), p.y + sn * (r - 9)); g.lineTo(p.x + c * (r + 4) - sn * 6, p.y + sn * (r + 4) + c * 6); g.lineTo(p.x + c * (r + 4) + sn * 6, p.y + sn * (r + 4) - c * 6); g.closePath(); g.fill(); }
      g.restore();
    } break;
    case 'dash': launchArrow(70 + 110 * (s.charging ? s.charge : 0), null); break;
  }
}

/* ---------- 화면 위 ---------- */
/** 손가락 반복 동작: hold 초 동안 누르고 있다 떼는 것을 되풀이한다. 누르는 동안 pr(0~1)로 충전 링 진행을 돌려준다 */
function fingerLoop(x, y, hold, rest, ring) {
  const L = .3 + hold + .55 + rest, t = G.T % L;
  const press = t < .3 ? t / .3 : t < .3 + hold ? 1 : 0, relK = t > .3 + hold && t < .3 + hold + .55 ? (t - .3 - hold) / .55 : 0;
  const hk = t > .3 && t < .3 + hold ? (t - .3) / hold : 0;
  if (ring && hk > 0) { g.save(); g.strokeStyle = GRN; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, 30, -PI / 2, -PI / 2 + TAU * hk); g.stroke(); g.restore(); }
  finger(x, y, press, relK > 0 ? relK : t < .3 ? t / .3 * .6 : 0);
  tri(x + 36, y, relK > 0, press ? WHT : YEL);
}

function chipsHint() {
  const b = G.boss, { VW } = V, n = b.q.length || 1, cy = 82, w = n * 70, x0 = VW / 2 - w / 2;
  g.save(); g.strokeStyle = YEL; g.lineWidth = 2.5; g.globalAlpha = .6 + .4 * Math.sin(G.T * 6); rr(x0 - 4, cy - 5, w + 8, 30, 10); g.stroke(); g.restore();
  // 착지 → 숫자 감소 → 0 → 발동 을 되풀이해서 보여 준다
  const L = 4.2, t = G.T % L, step = Math.min(3, Math.floor(t / 1.2)), y = V.VH * .4 - 54, xs = [VW / 2 - 90, VW / 2, VW / 2 + 90];
  for (let i = 0; i < 3; i++) {
    const on = i === Math.min(step, 2), v = [2, 1, 0][i];
    g.save(); g.fillStyle = on ? 'rgba(70,50,10,.9)' : 'rgba(8,12,34,.85)'; g.strokeStyle = on ? YEL : 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.arc(xs[i], y, 20, 0, TAU); g.fill(); g.stroke(); g.restore();
    txt(String(v), xs[i], y + 7, 20, on ? YEL : 'rgba(255,255,255,.6)', 'center', 800);
    if (i < 2) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(xs[i] + 32, y - 7); g.lineTo(xs[i] + 46, y); g.lineTo(xs[i] + 32, y + 7); g.closePath(); g.fill(); }
  }
  if (step >= 2) { const k = (t - 2.4) / 1.8; g.save(); g.strokeStyle = RED; g.lineWidth = 3; g.globalAlpha = 1 - k * .7; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(xs[2] + Math.cos(a) * 26, y + Math.sin(a) * 26); g.lineTo(xs[2] + Math.cos(a) * (34 + 10 * k), y + Math.sin(a) * (34 + 10 * k)); g.stroke(); } g.restore(); }
}

function scrollHint() {
  const { VW, VH } = V; g.save(); g.strokeStyle = YEL; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const x of [28, VW - 28]) for (let i = 0; i < 3; i++) {
    const k = ((G.T * .7 + i / 3) % 1), y = VH * .78 - k * VH * .36; g.globalAlpha = Math.sin(k * PI) * .85;
    g.beginPath(); g.moveTo(x - 12, y + 7); g.lineTo(x, y - 5); g.lineTo(x + 12, y + 7); g.stroke();
  }
  g.restore();
}

export function drawTutoScreen() {
  const T = G.tuto; if (!T || (G.st !== 'play' && G.st !== 'pick')) return;
  const { VW, VH } = V;
  for (const [r, s] of [[exitRect(), '나가기'], ...(!G.boss && T.step !== 'free' && G.st === 'play' ? [[skipRect(), '건너뛰기']] : [])]) {
    rr(r.x, r.y, r.w, r.h, 8); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
    txt(s, r.x + r.w / 2, r.y + 17, 11, 'rgba(255,255,255,.75)', 'center', 600);
  }
  if (G.st === 'pick') { // 진화 선택: 첫 번째 카드를 손가락이 누른다
    const R = pickLayout().rects[0]; if (!R) return;
    g.save(); g.strokeStyle = YEL; g.lineWidth = 3; g.globalAlpha = .6 + .4 * Math.sin(G.T * 6); rr(R.x - 3, R.y - 3, R.w + 6, R.h + 6, 12); g.stroke(); g.restore();
    const k = (G.T % 1.4) / 1.4; finger(R.x + R.w - 46, R.y + R.h / 2 + 4, k < .3 ? k / .3 : 0, k > .3 ? (k - .3) / .7 : 0);
    bubble(TEXT.evo, VH - 100); return;
  }
  const id = G.boss ? T.bh : T.step; if (!id || id === 'free') return;
  bubble(TEXT[id], G.boss ? VH * .4 : 128);
  if (id === 'launch') fingerLoop(VW / 2, VH - 120, .5, .5, false);
  else if (id === 'dash') fingerLoop(VW / 2, VH - 120, 1.4, .8, true);
  else if (id === 'count') chipsHint();
  else if (id === 'scroll') scrollHint();
}
