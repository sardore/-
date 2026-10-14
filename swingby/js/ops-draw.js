/* 블랙쉽 모드의 화면: 월드에 그리는 것(벽·소형함·포탄·선단), HUD(작전 시간·동행·점수 배율), 클리어/실패 화면 */
import { G, V, g } from './state.js';
import { clamp } from './util.js';
import { OPS, OPS_BOSSES, fleetBonus } from './ops-data.js';
import { SHIPS } from './ships.js';
import { viewTop, viewBot } from './camera.js';
import { txt } from './gfx.js';
import { drawWallList } from './ops-walls.js';
import { drawMookList } from './ops-mook-art.js';
import { drawFleet, hasBay } from './ops-fleet.js';
import { drawShells } from './ops-battery.js';
import { drawShip } from './ship-art.js';
import { OPSREC, fmtTime } from './ops.js';
import { drawDeadShopBtn } from './shop-ui.js';

/** 월드 좌표 안에서: 벽 · 소형함 · 포탄 */
export function drawOpsWorld() {
  const top = viewTop(), bot = viewBot();
  drawWallList(g, top, bot, G.T); drawMookList(g, top, bot, G.T); drawShells();
}
/** 본체 바로 뒤에 선단을 그린다 */
export const drawOpsFleet = () => drawFleet(g, G.T, G.ship.mode === 'free');

const BONE = '#e6dcc0';
/** HUD 오른쪽 열: 최고 점수(일반 항해와 같은 자리·같은 글씨) · 추진기 · 작전 시간 · 점수 배율 · 수송 능력 */
export function drawOpsHud() {
  const { OX } = V, o = G.ops, R = OX + 420 - 14, b = G.boss;
  txt('최고 ' + OPSREC.best, R, 30, 14, 'rgba(255,255,255,.75)', 'right', 600);
  let y = 50;
  if (G.stats.shield > 0) { txt('추진기 ×' + G.stats.shield, R, y, 12, '#ff9d7a', 'right', 600); y += 18; }
  txt(fmtTime(o.t) + (OPSREC.time > 0 ? '  / 기록 ' + fmtTime(OPSREC.time) : ''), R, y, 12, BONE, 'right', 700); y += 18;
  const n = o.fol.length;
  if (n) { txt('점수 ×' + (1 + fleetBonus(o.fol)).toFixed(2), R, y, 12, '#fff', 'right', 700); y += 18; }   // 점수 배율만(동행 수는 왼쪽 아래 아이콘으로 안다)
  if (!b && G.tier >= OPS.bayTier) txt(hasBay() ? '수송 능력' : '수송 불가', R, y, 11, hasBay() ? '#9fe0c0' : 'rgba(255,255,255,.4)', 'right', 700);
  // 동행 함선 아이콘: 왼쪽 아래
  if (n) {
    const yy = V.VH - 34;
    o.fol.forEach((f, i) => { const d = SHIPS[f.id]; g.save(); g.translate(OX + 24 + i * 22, yy); g.rotate(-Math.PI / 2); g.scale(.55, .55); drawShip(g, d, .5, G.T, .8); g.restore(); });
  }
}

/** 클리어 · 실패 화면(블랙쉽): 일반 항해와 같은 배치 — 큰 점수, 최고 기록, 한 줄 요약, 별 조각. 작전 시간(최단 기록)만 이 모드의 덧붙임 */
export function drawOpsEnd() {
  const { VW, VH } = V, T = G.T, o = G.ops, clear = G.st === 'clear', k = clear ? G.clearT : G.deadT;
  const a = clamp(k * (clear ? 1.5 : 2), 0, 1); g.fillStyle = 'rgba(5,6,15,' + (clear ? .7 : .72) * a + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
  const y = VH * (clear ? .28 : .3), sc = G.score;
  if (clear) { txt('작전 완료', VW / 2, y, 44, '#ffe27a', 'center', 900); txt('기함도, 그 핵도 침묵했다', VW / 2, y + 32, 15, 'rgba(255,255,255,.8)', 'center', 500); }
  else {
    txt('항해 종료', VW / 2, y, 40, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, y + 30, 15, '#ff8f8f', 'center', 500);
    const b = G.boss; if (b && b.state === 'fight') txt(b.d.n + ' 남은 체력 ' + Math.max(1, Math.round(b.hp / b.max * 100)) + '%', VW / 2, y + 52, 13, 'rgba(255,200,170,.85)', 'center', 600);
  }
  txt(String(sc), VW / 2, y + (clear ? 112 : 110), 64, '#fff', 'center', 900);
  txt(o.newBest ? '★ 신기록 ★' : '최고 ' + OPSREC.best, VW / 2, y + (clear ? 142 : 140), 16, o.newBest ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
  txt('행성 ' + G.hops + '개  ·  최대 콤보 x' + G.maxCombo + '  ·  보스 ' + G.kills + '회 격파', VW / 2, y + 172, 14, 'rgba(255,255,255,.75)', 'center', 500);
  txt(G.debug ? '(디버그판: 별 조각 저장 안 함)' : '별 조각 +' + G.shardGain, VW / 2, y + 198, 14, '#ffe27a', 'center', 800);
  txt('작전 시간 ' + fmtTime(o.t) + (clear ? (o.newTime ? '  ★ 최단 기록' : OPSREC.time > 0 ? '  (최단 ' + fmtTime(OPSREC.time) + ')' : '') : ''), VW / 2, y + 220, 12, 'rgba(230,220,192,.8)', 'center', 600);
  if (k > (clear ? 1 : .7)) {
    if (!clear) drawDeadShopBtn();
    g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt(clear ? '터치해서 타이틀로' : '터치해서 다시 출발', VW / 2, VH - 80, clear ? 16 : 19, '#fff');
  }
  g.globalAlpha = 1;
}
