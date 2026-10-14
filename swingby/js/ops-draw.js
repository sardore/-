/* 블랙쉽 모드의 화면: 월드에 그리는 것(벽·소형함·포탄·선단), HUD(작전 시간·동행·점수 배율), 클리어/실패 화면 */
import { G, V, g } from './state.js';
import { clamp } from './util.js';
import { OPS, OPS_BOSSES } from './ops-data.js';
import { SHIPS } from './ships.js';
import { viewTop, viewBot } from './camera.js';
import { txt } from './gfx.js';
import { drawWallList } from './ops-walls.js';
import { drawMookList } from './ops-mook-art.js';
import { drawFleet, hasBay } from './ops-fleet.js';
import { drawShip } from './ship-art.js';
import { OPSREC, fmtTime } from './ops.js';

/** 월드 좌표 안에서: 벽 · 소형함 · 포탄 */
export function drawOpsWorld() {
  const top = viewTop(), bot = viewBot();
  drawWallList(g, top, bot, G.T); drawMookList(g, top, bot, G.T);
}
/** 본체 바로 뒤에 선단을 그린다 */
export const drawOpsFleet = () => drawFleet(g, G.T, G.ship.mode === 'free');

const BONE = '#e6dcc0';
/** HUD 오른쪽 열: 작전 시간 · 점수 배율 · 추진기 · 수송 능력 */
export function drawOpsHud() {
  const { OX } = V, o = G.ops, R = OX + 420 - 14, b = G.boss;
  txt(fmtTime(o.t), R, 30, 17, BONE, 'right', 800);
  if (OPSREC.time > 0) txt('기록 ' + fmtTime(OPSREC.time), R, 46, 11, 'rgba(255,255,255,.45)', 'right', 600);
  const n = o.fol.length;
  if (n) txt('×' + (1 + OPS.rescueMul * n).toFixed(2), R, 64, 12, '#fff', 'right', 700);   // 점수 배율만(동행 수는 왼쪽 아래 아이콘으로 안다)
  if (G.stats.shield > 0) txt('추진기 ×' + G.stats.shield, R, 80, 12, '#ff9d7a', 'right', 600);
  if (!b) {
    const y = G.stats.shield > 0 ? 96 : 80;
    if (G.tier >= OPS.bayTier) txt(hasBay() ? '수송 능력' : '수송 불가', R, y, 11, hasBay() ? '#9fe0c0' : 'rgba(255,255,255,.4)', 'right', 700);
  }
  // 동행 함선 아이콘: 왼쪽 아래
  if (n) {
    const y = V.VH - 34;
    o.fol.forEach((f, i) => { const d = SHIPS[f.id]; g.save(); g.translate(OX + 24 + i * 22, y); g.rotate(-Math.PI / 2); g.scale(.55, .55); drawShip(g, d, .5, G.T, .8); g.restore(); });
  }
}

/** 클리어 · 실패 화면(블랙쉽) */
export function drawOpsEnd() {
  const { VW, VH } = V, T = G.T, o = G.ops, clear = G.st === 'clear', k = clear ? G.clearT : G.deadT;
  const a = clamp(k * (clear ? 1.5 : 2), 0, 1); g.fillStyle = 'rgba(5,6,12,' + (.74 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
  const y = VH * .26;
  txt(clear ? '작전 완료' : '작전 실패', VW / 2, y, 40, clear ? BONE : '#fff', 'center', 900);
  if (clear) txt('기함도, 그 핵도 침묵했다', VW / 2, y + 28, 14, 'rgba(255,255,255,.75)', 'center', 500);
  else { txt(G.deadWhy, VW / 2, y + 30, 15, '#ff8f8f', 'center', 500); const b = G.boss; if (b && b.state === 'fight') txt(b.d.n + ' 남은 체력 ' + Math.max(1, Math.round(b.hp / b.max * 100)) + '%', VW / 2, y + 52, 13, 'rgba(255,200,170,.85)', 'center', 600); }
  if (clear) {
    txt(fmtTime(o.t), VW / 2, y + 112, 58, '#fff', 'center', 900);
    txt(o.newTime ? '★ 최단 기록 ★' : OPSREC.time > 0 ? '최단 ' + fmtTime(OPSREC.time) : '', VW / 2, y + 140, 16, o.newTime ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
  } else {
    txt('보스 ' + G.kills + ' / ' + OPS_BOSSES.length + ' 격파', VW / 2, y + 100, 30, '#fff', 'center', 900);
    txt('작전 시간 ' + fmtTime(o.t), VW / 2, y + 126, 15, 'rgba(255,255,255,.7)', 'center', 600);
  }
  const y2 = y + 172;
  txt('점수 ' + G.score + (o.newBest ? '  ★' : OPSREC.best > 0 ? '  (최고 ' + OPSREC.best + ')' : ''), VW / 2, y2, 18, '#fff', 'center', 800);
  txt('구출 ' + o.rescued + '척  ·  승계 ' + o.succ + '회' + (clear ? '  ·  함께 돌아온 함선 ' + o.fol.length + '척' : ''), VW / 2, y2 + 26, 14, 'rgba(255,255,255,.75)', 'center', 500);
  if (!G.debug && G.shardGain > 0) txt('별 조각 +' + G.shardGain, VW / 2, y2 + 50, 14, '#ffe27a', 'center', 800);
  else if (G.debug) txt('(디버그: 기록·별 조각 저장 안 함)', VW / 2, y2 + 50, 12, 'rgba(255,226,122,.7)', 'center', 600);
  if (k > (clear ? 1 : .7)) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt(clear ? '터치해서 타이틀로' : '터치해서 다시 출격', VW / 2, VH - 80, 18, '#fff'); }
  g.globalAlpha = 1;
}
