/* 화면 위 UI: HUD, 보스 체력·산소, 배너·시전 문구·토스트, 타이틀/사망/클리어 화면, 음소거 버튼 */
import { G, V, g } from './state.js';
import { W0, TAU, FONT, clamp, easeOut } from './util.js';
import { STAGES, ATK, BIOMES, BOSSES, EVOLVE_AT } from './data.js';
import { SHIPS } from './ships.js';
import { isMuted } from './audio.js';
import { rr, txt, GFX, reducedMotion, telemetry } from './gfx.js';
import { drawTitleMenu, drawDeadShopBtn } from './shop-ui.js';
import { drawTitle2 } from './draw-title2.js';
import { OPSREC, fmtTime, MODE } from './ops.js';
import { drawOpsHud, drawOpsEnd } from './ops-draw.js';
import { OPS_BOSSES } from './ops-data.js';

export const MUTE_HIT = 58;      // 오른쪽 아래 음소거 버튼의 터치 영역(월드 단위)

export function drawHud() {
  const { VW, OX } = V, b = G.boss;
  if (G.st !== 'play' && G.st !== 'pick') return;
  const age = G.scoreCue ? G.T - G.scoreCue.at : Infinity, motion = !reducedMotion();
  if (b) telemetry(String(G.score), OX + 14, 74, 18, age < .22 ? '#ffb46f' : '#f1f1e9', 'left', 72);
  else {
    const settle = motion ? 1 - easeOut(age / .24) : 0;
    telemetry(String(G.score), VW / 2, 54, 38 + 5 * settle, '#f1f1e9', 'center', 158);
    if (age < .72) {
      g.globalAlpha = motion ? 1 - easeOut(Math.max(0, age - .36) / .36) : 1;
      telemetry('+' + G.scoreCue.gain, VW / 2, 77 - (motion ? easeOut(age / .72) * 4 : 0), 13, '#ffb46f');
      g.globalAlpha = 1;
    }
    if (G.combo > 1) {
      const comboY = 96;
      telemetry('×' + G.combo, VW / 2 - 5, comboY, 15, '#99e1f0', 'right');
      txt('콤보', VW / 2 + 3, comboY, 11, '#b5c7ce', 'left', 700);
    }
  }
  const sd = SHIPS[G.shipId];
  txt('Lv ' + G.tier + '  ' + sd.n, OX + 14, 30, 14, 'hsl(' + sd.L.h + ',90%,75%)', 'left', 700);
  if (!b) {
    const nx = G.ops ? '' : G.tier === 1 ? '진화까지 ' + Math.max(0, (G.tuto ? 4 : 8) - G.hops) + '행성' : EVOLVE_AT[G.tier] ? '다음 진화: 보스 ' + EVOLVE_AT[G.tier] + ' 격파' : '다음 강화 ' + Math.max(0, G.nextOffer - G.hops) + '행성';
    txt(nx, OX + 14, 48, 12, 'rgba(255,255,255,.55)', 'left', 500);
    const bl = G.nextBoss - G.hops;
    txt(bl > 0 ? '보스까지 ' + bl : '', OX + 14, 66, 12, 'rgba(255,150,130,.75)', 'left', 600);
    if (G.biome !== 'normal') { const bm = BIOMES[G.biome]; g.fillStyle = bm.c; g.beginPath(); g.arc(OX + 18, 82, 4, 0, TAU); g.fill(); txt(bm.n, OX + 28, 86, 12, bm.c, 'left', 700); }
  } else txt(G.tuto ? '튜토리얼' : G.ops ? '보스 ' + (b.stage + 1) + ' / ' + OPS_BOSSES.length : b.d.endless ? 'ENDLESS ' + b.d.endless : '보스 ' + (b.stage + 1) + ' / ' + STAGES.length, OX + 14, 48, 12, 'rgba(255,255,255,.6)', 'left', 600);
  if (G.ops) drawOpsHud();
  else if (!G.tuto) {
    txt('최고 ' + G.best, OX + W0 - 14, 30, 14, 'rgba(255,255,255,.75)', 'right', 600);
    if (G.stats.shield > 0) txt('추진기 ×' + G.stats.shield, OX + W0 - 14, 50, 12, '#ff9d7a', 'right', 600);
  }
  if (b && b.state !== 'intro') drawBossHud();
}

function drawBossHud() {
  const b = G.boss, { VW, VH, OX } = V, T = G.T, bw = 240, bx = VW / 2 - bw / 2, by = 52;   // 보스전 HUD: 이름·체력·예고 칩을 위쪽에 촘촘히
  txt(b.d.n, VW / 2 - 6, by - 8, 14, '#fff', 'center', 800);
  g.font = '800 14px ' + FONT; txt('공격 ' + b.d.atk + '초', VW / 2 + 6 + g.measureText(b.d.n).width / 2, by - 8, 11, 'rgba(255,150,130,.9)', 'left', 700);
  const now = clamp(b.hp / b.max, 0, 1);
  if (hpReadout.boss !== b || G.T < hpReadout.at) {
    Object.assign(hpReadout, { boss: b, shown: now, at: G.T });
  }
  const elapsed = G.T - hpReadout.at;
  const shown = reducedMotion() ? now : Math.max(now, hpReadout.shown - elapsed * .66);
  hpReadout.shown = shown; hpReadout.at = G.T;
  drawGauge(bx, by, bw, 8, now, b.hitT > 0 ? '#fff' : 'hsl(' + b.d.hue + ',70%,65%)', shown);
  g.fillStyle = '#111821';
  for (const q of (b.d.kind === 'quasar' ? [.66, .33] : [.5])) g.fillRect(bx + bw * q - 1, by, 2, 8);
  telemetry(Math.max(0, Math.ceil(b.hp)) + ' / ' + b.max, VW / 2, by + 20, 10, '#c6d0da');
  if (b.state !== 'fight') return;
  const cy = by + 30;
  let x = VW / 2 - (b.q.length * 70) / 2 + 35;
  for (const a of b.q) {
    const at = ATK[a.k]; rr(x - 32, cy, 64, 20, 8); g.fillStyle = 'rgba(10,8,24,.75)'; g.fill(); g.strokeStyle = a.t <= 1 ? '#ff6a6a' : at.c; g.lineWidth = 1.5; g.stroke();
    txt((b.d.endless ? '???' : at.n) + ' ' + a.t, x, cy + 14, 11, a.t <= 1 ? '#ff9a9a' : at.c, 'center', 700); x += 70;
  }
  if (G.bcombo > 0) txt('연속 x' + G.bcombo, OX + 14, 92, 12, '#ff9d7a', 'left', 700);
  if (G.haz.some(h => h.k === 'horizon')) { g.globalAlpha = .65 + .35 * Math.sin(T * 5); txt('▼ 사건의 지평선  맵 ×2', VW / 2, cy + 38, 11, '#c090ff', 'center', 800); g.globalAlpha = 1; }
  // 산소 게이지: 보스전에서는 회복되지 않는다
  const ow = 244, ox = VW / 2 - ow / 2, oy = VH - 38, of = clamp(G.bo2 / G.bo2max, 0, 1), low = G.bo2 < 6;
  const oxygen = low ? '#ff8a75' : '#90d9e7';
  drawGauge(ox, oy, ow, 7, of, oxygen);
  const warningX = ox + ow * clamp(6 / G.bo2max, 0, 1);
  g.fillStyle = '#d0e0e6'; g.fillRect(warningX - 1, oy - 2, 1, 11);
  txt(low ? '산소 부족' : '산소', ox, oy - 8, 12, oxygen, 'left', 800);
  telemetry(Math.max(0, G.bo2).toFixed(1) + ' s', ox + ow, oy - 8, 14, oxygen, 'right');
}

const hpReadout = { boss: null, shown: 0, at: 0 };

function drawGauge(x, y, w, h, fraction, color, trail = fraction) {
  g.fillStyle = '#101923'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#6a7f8a'; g.lineWidth = 1; g.strokeRect(x - .5, y - .5, w + 1, h + 1);
  if (trail > fraction) { g.fillStyle = '#b57e64'; g.fillRect(x, y, w * trail, h); }
  g.fillStyle = color; g.fillRect(x, y, w * fraction, h);
}

/** 산소가 얼마 안 남았을 때 화면 가장자리가 붉게 */
export function drawLowO2() {
  const b = G.boss, { VW, VH } = V;
  if (!(b && b.state === 'fight' && G.bo2 < 6)) return;
  G.lowO2 = (reducedMotion() ? .65 : .5 + .5 * Math.sin(G.T * 9)) * clamp(1 - G.bo2 / 6, 0, 1);
  const vg = g.createRadialGradient(VW / 2, VH / 2, VH * .3, VW / 2, VH / 2, VH * .8);
  vg.addColorStop(0, 'rgba(255,40,40,0)'); vg.addColorStop(1, 'rgba(255,40,40,' + (.45 * G.lowO2) + ')'); g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
}

export function drawMuteButton() {
  const bx = V.VW - 30, by = V.VH - 30, muted = isMuted();
  g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(bx, by, 15, 0, TAU); g.fill();
  g.strokeStyle = muted ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.8)'; g.fillStyle = g.strokeStyle; g.lineWidth = 1.8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(bx - 7, by - 3); g.lineTo(bx - 3, by - 3); g.lineTo(bx + 1, by - 7); g.lineTo(bx + 1, by + 7); g.lineTo(bx - 3, by + 3); g.lineTo(bx - 7, by + 3); g.closePath(); g.fill();
  if (muted) { g.beginPath(); g.moveTo(bx + 4, by - 4); g.lineTo(bx + 10, by + 4); g.moveTo(bx + 10, by - 4); g.lineTo(bx + 4, by + 4); g.stroke(); }
  else { g.beginPath(); g.arc(bx + 1, by, 5, -.9, .9); g.stroke(); g.beginPath(); g.arc(bx + 1, by, 9, -.8, .8); g.stroke(); }
  g.lineCap = 'butt';
}

/** 토스트 · 큰 배너 · 보스 공격 시전 문구 */
export function drawOverlays() {
  const { VW, VH } = V, t = G.toastO, bn = G.banner, co = G.castO;
  if (t) { const k = t.t; g.globalAlpha = clamp(1.6 - k, 0, 1) * clamp(k * 8, 0, 1); txt(t.s, VW / 2, VH * .5 - k * 6, 18, t.c, 'center', 800); g.globalAlpha = 1; }
  if (bn) {
    const k = bn.t / bn.dur, a = clamp(Math.min(k * 6, (1 - k) * 3), 0, 1), y = VH * .34;
    g.globalAlpha = a; g.fillStyle = 'rgba(5,6,15,' + (.55 * a) + ')'; g.fillRect(0, y - 52, VW, 128);
    txt(bn.a, VW / 2, y - 22, 14, 'rgba(255,255,255,.7)', 'center', 700);
    txt(bn.b, VW / 2, y + 22, bn.b.length > 6 ? 34 : 44, bn.c, 'center', 900);
    if (bn.sub) txt(bn.sub, VW / 2, y + 52, 13, 'rgba(255,255,255,.75)', 'center', 500);
    g.globalAlpha = 1;
  }
  if (co) {
    const k = co.t / co.dur, a = clamp(Math.min(k * 9, (1 - k) * 3.5), 0, 1), pop = 1 + (1 - easeOut(Math.min(k * 6, 1))) * .7, y = VH * .43;
    g.globalAlpha = a * .85; g.fillStyle = 'rgba(8,4,16,.6)'; const bh = 46 * easeOut(k * 8); g.fillRect(0, y - bh / 2 - 6, VW, bh);
    g.fillStyle = co.c; g.globalAlpha = a; g.fillRect(0, y - bh / 2 - 6, VW * easeOut(k * 5), 2); g.fillRect(VW - VW * easeOut(k * 5), y + bh / 2 + 4, VW * easeOut(k * 5), 2);
    g.save(); g.translate(VW / 2, y); g.scale(pop, pop); g.shadowColor = co.c; g.shadowBlur = 18; g.globalAlpha = a; txt(co.name, 0, 10, 30, co.c, 'center', 900); g.shadowBlur = 0; g.restore(); g.globalAlpha = 1;
  }
}

/** 타이틀 · 클리어 · 사망 화면 */
export function drawScreens() {
  const { VW, VH } = V, T = G.T;
  if (G.ops && (G.st === 'clear' || G.st === 'dead')) { drawOpsEnd(); return; }
  if (G.st === 'title') {
    const shade = g.createLinearGradient(0, 0, 0, VH);
    shade.addColorStop(0, 'rgba(5,6,15,.56)');
    shade.addColorStop(.36, 'rgba(5,6,15,.48)');
    shade.addColorStop(.65, 'rgba(5,6,15,.31)');
    shade.addColorStop(1, 'rgba(5,6,15,.68)');
    g.fillStyle = shade; g.fillRect(0, 0, VW, VH);
    if (MODE.ops) { g.fillStyle = 'rgba(14,12,8,.19)'; g.fillRect(0, 0, VW, VH); }
    if (GFX.v >= 2) drawTitle2();
    else { txt('스윙바이', VW / 2, VH * .22, 58, '#fff', 'center', 900); txt('S W I N G B Y', VW / 2, VH * .22 + 30, 16, '#7dd3ff', 'center', 600); }
    if (MODE.ops) telemetry('BLACK SHIP MODE', VW / 2, VH - 115, 12, '#e6dcc0');
    g.save();
    g.globalAlpha = reducedMotion() ? 1 : .9 + .1 * Math.sin(T * 2.8);
    g.shadowBlur = 12; g.shadowColor = 'rgba(125,211,255,.52)';
    txt('화면을 터치해서 출발', VW / 2, VH - 86, 19, '#eef7ff');
    g.restore();
    drawTitleMenu();
    if (window.__BUILD) txt('build ' + window.__BUILD, 10, VH - 10, 10, 'rgba(255,255,255,.32)', 'left', 600);   // 어느 버전을 받았는지 확인용
    if (G.debug && BOSSES[G.nextBi]) txt('DEBUG · ' + BOSSES[G.nextBi].n, VW / 2, VH - (MODE.ops ? 138 : 116), 12, '#ffd24a', 'center', 800);
    const rec = MODE.ops ? { best: OPSREC.best, boss: OPSREC.boss, n: OPS_BOSSES.length, extra: OPSREC.time > 0 ? '  ·  최단 ' + fmtTime(OPSREC.time) : '' } : { best: G.best, boss: G.bestBoss, n: STAGES.length, extra: '' };   // 고른 모드의 기록을 같은 표기로
    if (rec.best > 0) txt('최고 기록 ' + rec.best + (rec.boss > 0 ? '  ·  보스 ' + Math.min(rec.boss, rec.n) + '/' + rec.n + (rec.boss >= rec.n ? ' 클리어' : '') : '') + rec.extra, VW / 2, VH - 52, 14, 'rgba(255,255,255,.6)', 'center', 500);
  }
  if (G.st === 'clear' && G.tuto) { // 튜토리얼 클리어: 태양 격파와 보상
    const a = clamp(G.clearT * 1.5, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.7 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('튜토리얼 완료', VW / 2, VH * .3, 40, '#ffe27a', 'center', 900);
    txt('별 조각 +' + G.shardGain, VW / 2, VH * .3 + 76, 34, '#ffe27a', 'center', 900);
    txt(G.tuto.cleared + '번째 클리어', VW / 2, VH * .3 + 106, 14, 'rgba(255,255,255,.6)', 'center', 600);
    if (G.clearT > 1) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 타이틀로', VW / 2, VH - 80, 16, '#fff'); }
    g.globalAlpha = 1;
  } else if (G.st === 'clear') {
    const a = clamp(G.clearT * 1.5, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.7 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('TON 618 격파', VW / 2, VH * .28, 44, '#ffe27a', 'center', 900); txt('우주의 끝에서 살아 돌아왔다', VW / 2, VH * .28 + 32, 15, 'rgba(255,255,255,.8)', 'center', 500);
    telemetry(String(G.score), VW / 2, VH * .28 + 112, 64, '#f1f1e9', 'center', 360); txt(G.newBest ? '★ 신기록 ★' : '최고 ' + G.best, VW / 2, VH * .28 + 142, 16, G.newBest ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
    txt('행성 ' + G.hops + '개  ·  보스 ' + G.kills + '회 격파', VW / 2, VH * .28 + 172, 14, 'rgba(255,255,255,.75)', 'center', 500);
    if (G.shardGain > 0) txt('별 조각 +' + G.shardGain, VW / 2, VH * .28 + 198, 14, '#ffe27a', 'center', 800);
    txt('이제부터 무한 모드 — 궤도가 점점 빨리 무너지고 보스는 끝없이 강해져', VW / 2, VH * .28 + 218, 12, 'rgba(255,255,255,.55)', 'center', 500);
    if (G.clearT > 1) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 계속', VW / 2, VH - 80, 16, '#fff'); }
    g.globalAlpha = 1;
  }
  if (G.st === 'dead' && G.tuto) {
    const a = clamp(G.deadT * 2, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.72 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('튜토리얼 실패', VW / 2, VH * .32, 36, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, VH * .32 + 30, 15, '#ff8f8f', 'center', 500);
    if (G.deadT > .7) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 다시 도전', VW / 2, VH - 80, 19, '#fff'); }
    g.globalAlpha = 1;
  } else if (G.st === 'dead') {
    const a = clamp(G.deadT * 2, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.72 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('항해 종료', VW / 2, VH * .3, 40, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, VH * .3 + 30, 15, '#ff8f8f', 'center', 500);
    const b = G.boss; if (b && b.state === 'fight') txt(b.d.n + ' 남은 체력 ' + Math.max(1, Math.round(b.hp / b.max * 100)) + '%', VW / 2, VH * .3 + 52, 13, 'rgba(255,200,170,.85)', 'center', 600);
    telemetry(String(G.score), VW / 2, VH * .3 + 110, 64, '#f1f1e9', 'center', 360); txt(G.newBest ? '★ 신기록 ★' : '최고 ' + G.best, VW / 2, VH * .3 + 140, 16, G.newBest ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
    txt('행성 ' + G.hops + '개  ·  최대 콤보 x' + G.maxCombo + '  ·  보스 ' + G.kills + '회 격파', VW / 2, VH * .3 + 172, 14, 'rgba(255,255,255,.75)', 'center', 500);
    txt(G.debug ? '(디버그판: 별 조각 저장 안 함)' : '별 조각 +' + G.shardGain, VW / 2, VH * .3 + 198, 14, '#ffe27a', 'center', 800);
    if (G.deadT > .7) { drawDeadShopBtn(); g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 다시 출발', VW / 2, VH - 80, 19, '#fff'); }
    g.globalAlpha = 1;
  }
}
