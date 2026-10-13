/* 선택 화면: 기체 진화(상위 기체 비교 + 능력치 다각형) · 강화 카드 */
import { G, V, g } from './state.js';
import { TAU, clamp } from './util.js';
import { STAT_INFO } from './data.js';
import { SHIPS, statsAfter } from './ships.js';
import { drawShip, SHIP_SC } from './ship-art.js';
import { drawRadar } from './radar.js';
import { rr, txt, chip, chipWidth } from './gfx.js';

const EVO = { w: 372, h: 104, gap: 8, head: 160 };
const CARD = { w: 372, h: 84, gap: 8, head: 170 };

/** 현재 선택 화면의 위쪽 y 와 카드 사각형들. 입력 판정과 그리기가 같은 값을 쓴다 */
export function pickLayout() {
  const evo = G.pickMode === 'evo', L = evo ? EVO : CARD, n = evo ? G.evoOpts.length : G.cards.length;
  const total = L.head + n * L.h + (n - 1) * L.gap, top = Math.max(14, (V.VH - total) / 2);
  const rects = []; for (let i = 0; i < n; i++) rects.push({ x: V.VW / 2 - L.w / 2, y: top + L.head + i * (L.h + L.gap), w: L.w, h: L.h });
  return { top, rects };
}

export function drawPick() {
  g.fillStyle = 'rgba(5,6,15,.82)'; g.fillRect(0, 0, V.VW, V.VH);
  if (G.pickMode === 'evo') drawEvo(); else drawCards();
  g.globalAlpha = 1;
}

const fade = i => clamp(G.pickT * 3 - i * .25, 0, 1);
const shipHsl = d => 'hsl(' + d.L.h + ',90%,68%)';

function drawEvo() {
  const { top, rects } = pickLayout(), cur = SHIPS[G.shipId], cx = V.VW / 2;
  txt('기체 진화', cx, top + 20, 22, '#fff', 'center', 900);
  txt('Lv ' + G.tier + ' ' + cur.n + '  →  Lv ' + (G.tier + 1) , cx, top + 42, 13, 'rgba(255,226,122,.9)', 'center', 700);
  g.save(); g.translate(cx - 118, top + 104); g.shadowColor = shipHsl(cur); g.shadowBlur = 18; drawShip(g, cur, .6, G.T, cur.t === 1 ? 2.2 : 2.25 / SHIP_SC[cur.t]); g.restore();
  drawRadar(cx + 78, top + 100, 36, [{ stats: G.stats, color: shipHsl(cur), fill: .22 }], { labels: true, fs: 10 });
  txt('현재 기체', cx - 118, top + 140, 11, 'rgba(255,255,255,.5)', 'center', 600);

  G.evoOpts.forEach((o, i) => {
    const r = rects[i], col = shipHsl(o), after = statsAfter(G.stats, o);
    g.globalAlpha = fade(i);
    rr(r.x, r.y, r.w, r.h, 14); g.fillStyle = 'rgba(22,24,48,.96)'; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
    const gg = g.createRadialGradient(r.x + 42, r.y + 52, 4, r.x + 42, r.y + 52, 40);
    gg.addColorStop(0, 'hsla(' + o.L.h + ',90%,60%,.28)'); gg.addColorStop(1, 'hsla(' + o.L.h + ',90%,60%,0)'); g.fillStyle = gg; g.fillRect(r.x + 2, r.y + 2, 82, r.h - 4);
    g.save(); g.translate(r.x + 44, r.y + 54); g.rotate(-.35 + .1 * Math.sin(G.T * 2 + i)); g.shadowColor = col; g.shadowBlur = 10; drawShip(g, o, .7, G.T, 2.25 / SHIP_SC[o.t]); g.restore();
    txt(String(i + 1), r.x + 12, r.y + 18, 12, 'rgba(255,255,255,.4)', 'left', 800);
    txt(o.n, r.x + 86, r.y + 27, 18, '#fff', 'left', 800);
    txt(o.d, r.x + 86, r.y + 45, 11, 'rgba(255,255,255,.65)', 'left', 500);
    // 바뀌는 능력치: 새 퍼센트 값
    const maxX = r.x + r.w - 96; let x = r.x + 86, y = r.y + 68;
    const chips = Object.keys(o.delta).map(k => k === 'shield' ? ['추진기 +' + o.delta[k], STAT_INFO[k].c] : [STAT_INFO[k].n + ' ' + after[k] + '%', STAT_INFO[k].c]);
    if (o.strong) chips.push(['강력한 돌진', '#ffb070']);
    for (const [t, c] of chips) {
      const w = chipWidth(t) + 6;
      if (x + w > maxX && x > r.x + 90) { x = r.x + 86; y += 20; }
      x += chip(t, x, y, c) + 5;
    }
    drawRadar(r.x + r.w - 54, r.y + 54, 36, [{ stats: G.stats, color: 'rgba(255,255,255,.7)', dash: true, w: 1.2 }, { stats: after, color: col, fill: .28 }]);
  });
}

function drawCards() {
  const { top, rects } = pickLayout(), cx = V.VW / 2;
  txt(G.pickTitle, cx, top + 20, 20, '#fff', 'center', 800);
  drawRadar(cx, top + 98, 46, [{ stats: G.stats, color: shipHsl(SHIPS[G.shipId]), fill: .24 }], { labels: true, fs: 10 });
  G.cards.forEach((c, i) => {
    const r = rects[i], info = STAT_INFO[c.k], now = G.stats[c.k], next = Math.min(c.cap, now + c.step);
    const after = Object.assign({}, G.stats, { [c.k]: next });
    g.globalAlpha = fade(i);
    rr(r.x, r.y, r.w, r.h, 14); g.fillStyle = 'rgba(22,24,48,.95)'; g.fill(); g.strokeStyle = info.c; g.lineWidth = 2; g.stroke();
    g.fillStyle = info.c; g.beginPath(); g.arc(r.x + 34, r.y + 42, 17, 0, TAU); g.fill();
    txt(String(i + 1), r.x + 34, r.y + 48, 17, '#0b0c1c', 'center', 800);
    txt(c.n, r.x + 64, r.y + 34, 18, '#fff', 'left', 800);
    txt(c.d, r.x + 64, r.y + 56, 12, 'rgba(255,255,255,.7)', 'left', 500);
    const label = c.k === 'shield' ? now + ' → ' + next : now + '% → ' + next + '%';
    txt(label, r.x + r.w - 84, r.y + 35, 14, info.c, 'right', 800);
    drawRadar(r.x + r.w - 42, r.y + 44, 24, [{ stats: G.stats, color: 'rgba(255,255,255,.7)', dash: true, w: 1.1 }, { stats: after, color: info.c, fill: .3 }]);
  });
}
