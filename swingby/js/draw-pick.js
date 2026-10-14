/* 선택 화면: 기체 진화(상위 기체 비교 + 능력치 다각형) · 강화 카드 */
import { G, V, g } from './state.js';
import { PI, TAU, clamp } from './util.js';
import { STAT_INFO } from './data.js';
import { SHIPS, statsAfter } from './ships.js';
import { drawShip, SHIP_SC } from './ship-art.js';
import { drawRadar } from './radar.js';
import { rr, txt, chip, chipWidth } from './gfx.js';
import { statsFor } from './ops-fleet.js';
import { OPS } from './ops-data.js';

const EVO = { w: 372, h: 104, gap: 8, head: 160 };
const CARD = { w: 372, h: 84, gap: 8, head: 170 };

/** 현재 선택 화면의 위쪽 y 와 카드 사각형들. 입력 판정과 그리기가 같은 값을 쓴다 */
/** 진화 카드에 붙는 칩들(능력치 변화·특수 능력) */
function evoChips(o, after) {
  const chips = Object.keys(o.delta).map(k => k === 'shield' ? ['추진기 +' + o.delta[k], STAT_INFO[k].c] : [STAT_INFO[k].n + ' ' + after[k] + '%', STAT_INFO[k].c]);
  if (o.strong) chips.push(['강력한 돌진', '#ffb070']);
  if (o.bat) chips.push(['돌진 포대', '#ffb070']);   // 강한 돌진은 없지만 돌진하며 포탄을 쏜다
  if (G.ops && G.ops.bay && o.L.ops && o.t >= 3) chips.push(['수송 능력', '#9fe0c0']);   // 블랙쉽: Lv3 부터 갇힌 함선을 구출할 수 있다
  return chips;
}
const CHIP_X0 = 86, CHIP_W = 372 - 96 - CHIP_X0;
/** 칩을 줄바꿈해 놓은 줄 수 (카드 높이를 정하는 데 쓴다) */
function chipRows(chips) {
  let x = 0, rows = 1;
  for (const [t] of chips) { const w = chipWidth(t) + 6; if (x + w > CHIP_W && x > 4) { x = 0; rows++; } x += chipWidth(t) + 5; }
  return rows;
}
/** 진화 카드 높이: 칩이 석 줄 이상 필요한 선택지가 있으면 그만큼 키워서 테두리를 넘지 않게 한다 */
function evoH() {
  let rows = 2;
  for (const o of G.evoOpts) rows = Math.max(rows, chipRows(evoChips(o, statsAfter(G.stats, o))));
  return EVO.h + (rows - 2) * 20;
}
export function pickLayout() {
  const evo = G.pickMode === 'evo', L = evo ? Object.assign({}, EVO, { h: evoH() }) : CARD, n = evo ? G.evoOpts.length : G.cards.length;
  const total = L.head + n * L.h + (n - 1) * L.gap, top = Math.max(14, (V.VH - total) / 2);
  const rects = []; for (let i = 0; i < n; i++) rects.push({ x: V.VW / 2 - L.w / 2, y: top + L.head + i * (L.h + L.gap), w: L.w, h: L.h });
  return { top, rects };
}

export function drawPick() {
  g.fillStyle = G.pickMode === 'rescue' ? 'rgba(5,6,15,.93)' : 'rgba(5,6,15,.82)'; g.fillRect(0, 0, V.VW, V.VH);
  if (G.pickMode === 'rescue') drawRescue(); else if (G.pickMode === 'evo') drawEvo(); else drawCards();
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
    const chips = evoChips(o, after);
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

/* ---------- 블랙쉽: 함선 구출 · 동행 강화 안내 ---------- */
const easeOutBack = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** 구해낸(또는 강화된) 함선을 크게 보여 주고 아래에 능력치 다각형을 놓는다. 진화 선택 화면과 같은 그림·레이더·칩을 쓴다 */
function drawRescue() {
  const c = G.ops.card; if (!c) return;
  const T = G.pickT, up = c.kind === 'up', to = SHIPS[c.id], from = up ? SHIPS[c.from] : null;
  const col = shipHsl(to), cx = V.VW / 2, top = Math.max(14, (V.VH - 560) / 2), ap = k => clamp((T - k) * 3, 0, 1);
  const after = statsFor(c.id, {}), before = up ? statsFor(c.from, {}) : null;
  // 문구
  const a1 = ap(.15);
  g.globalAlpha = a1; txt(up ? '당신은 구해낸 우주선을' : '당신은 이 우주선을', cx, top + 30 + (1 - a1) * 14, 22, '#fff', 'center', 900);
  g.globalAlpha = ap(.35); txt(up ? '강화했습니다.' : '구해냈습니다.', cx, top + 58 + (1 - ap(.35)) * 14, 22, col, 'center', 900); g.globalAlpha = 1;
  // 함선: 퍼지는 고리 + 후광, 튀어나오듯 등장. 강화일 때는 이전 함선이 흰 빛으로 새 함선이 된다
  const sy = top + 160, pop = clamp(easeOutBack(clamp((T - .2) / .55, 0, 1)), 0, 1.4);
  g.save(); g.translate(cx, sy);
  const gg = g.createRadialGradient(0, 0, 6, 0, 0, 90); gg.addColorStop(0, 'hsla(' + to.L.h + ',90%,65%,.4)'); gg.addColorStop(1, 'hsla(' + to.L.h + ',90%,65%,0)'); g.fillStyle = gg; g.fillRect(-90, -90, 180, 180);
  for (let i = 0; i < 3; i++) { const ph = (T * .8 + i / 3) % 1; g.globalAlpha = (1 - ph) * .5 * ap(.3); g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 28 + ph * 78, 0, TAU); g.stroke(); }
  g.globalAlpha = 1; g.rotate(-.35 + .08 * Math.sin(T * 2));
  const sw = up ? clamp((T - .6) / .5, 0, 1) : 1;   // 강화: 0 → 1 이면 이전 → 새 함선
  g.shadowColor = col; g.shadowBlur = 20;
  if (up && sw < 1) { g.globalAlpha = 1 - sw; drawShip(g, from, .7, T, 3.1 * pop / SHIP_SC[from.t], { nobay: true }); }
  g.globalAlpha = sw; drawShip(g, to, .7, T, 3.1 * pop * (1 + (up ? .25 * Math.sin(sw * PI) : 0)) / SHIP_SC[to.t], { nobay: true });
  if (up && sw > 0 && sw < 1) { g.globalAlpha = Math.sin(sw * PI) * .7; g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 40 * Math.sin(sw * PI) + 6, 0, TAU); g.fill(); }
  g.restore(); g.globalAlpha = 1;
  // 이름·단계
  g.globalAlpha = ap(.7);
  txt(to.n, cx, top + 252, 18, '#fff', 'center', 800);
  txt(up ? 'Lv ' + from.t + '  →  Lv ' + to.t : 'Lv ' + to.t + ' · 동행 합류', cx, top + 272, 13, 'rgba(255,226,122,.9)', 'center', 700);
  // 능력치 다각형(강화: 이전 = 점선, 이후 = 색)
  const series = up ? [{ stats: before, color: 'rgba(255,255,255,.7)', dash: true, w: 1.2 }, { stats: after, color: col, fill: .3 }] : [{ stats: after, color: col, fill: .3 }];
  drawRadar(cx, top + 372, 66, series, { labels: true, fs: 11 });
  // 칩: 점수 배율 + (강화일 때) 오른 능력치
  const chips = [['점수 +' + Math.round((OPS.rescueMul[to.t] - (up ? OPS.rescueMul[from.t] : 0)) * 100) + '%', '#ffe27a']];
  if (up) for (const k of Object.keys(to.delta)) chips.push([k === 'shield' ? '추진기 +' + to.delta[k] : STAT_INFO[k].n + ' ' + after[k] + '%', STAT_INFO[k].c]);
  let tw = 0; for (const [t] of chips) tw += chipWidth(t) + 5;
  let x = cx - (tw - 5) / 2, y = top + 478;
  for (const [t, cc] of chips) x += chip(t, x, y, cc) + 5;
  g.globalAlpha = 1;
  if (T > .8) { g.globalAlpha = .45 + .45 * Math.sin(T * 4); txt('탭하여 계속', cx, top + 530, 13, 'rgba(255,255,255,.8)', 'center', 700); g.globalAlpha = 1; }
}
