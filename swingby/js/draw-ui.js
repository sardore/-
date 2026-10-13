/* 화면 위 UI: HUD, 보스 체력·산소, 배너·시전 문구·토스트, 타이틀/사망/클리어 화면, 음소거 버튼 */
import { G, V, g } from './state.js';
import { W0, TAU, FONT, clamp, easeOut } from './util.js';
import { STAGES, ATK, BIOMES, BOSSES, EVOLVE_AT } from './data.js';
import { SHIPS } from './ships.js';
import { isMuted } from './audio.js';
import { rr, txt, GFX } from './gfx.js';
import { drawTitle2 } from './draw-title2.js';

export const MUTE_HIT = 58;      // 오른쪽 아래 음소거 버튼의 터치 영역(월드 단위)

export function drawHud() {
  const { VW, OX } = V, b = G.boss;
  if (G.st !== 'play' && G.st !== 'pick') return;
  if (b) txt(String(G.score), OX + 14, 74, 20, '#fff', 'left', 800);   // 보스전: 점수를 작게 왼쪽으로 옮겨 가운데 위쪽을 보스에게 내준다
  else txt(String(G.score), VW / 2, 54, 40, '#fff', 'center', 800);
  if (G.combo > 1 && !b) txt('x' + G.combo + ' 콤보', VW / 2, 78, 15, '#7dd3ff');
  const sd = SHIPS[G.shipId];
  txt('Lv ' + G.tier + '  ' + sd.n, OX + 14, 30, 14, 'hsl(' + sd.L.h + ',90%,75%)', 'left', 700);
  if (!b) {
    const nx = G.tier === 1 ? '진화까지 ' + Math.max(0, 8 - G.hops) + '행성' : EVOLVE_AT[G.tier] ? '다음 진화: 보스 ' + EVOLVE_AT[G.tier] + ' 격파' : '다음 강화 ' + Math.max(0, G.nextOffer - G.hops) + '행성';
    txt(nx, OX + 14, 48, 12, 'rgba(255,255,255,.55)', 'left', 500);
    const bl = G.nextBoss - G.hops;
    txt(bl > 0 ? '보스까지 ' + bl : '', OX + 14, 66, 12, 'rgba(255,150,130,.75)', 'left', 600);
    if (G.biome !== 'normal') { const bm = BIOMES[G.biome]; g.fillStyle = bm.c; g.beginPath(); g.arc(OX + 18, 82, 4, 0, TAU); g.fill(); txt(bm.n, OX + 28, 86, 12, bm.c, 'left', 700); }
  } else txt('보스 ' + (b.stage + 1) + ' / ' + STAGES.length, OX + 14, 48, 12, 'rgba(255,255,255,.6)', 'left', 600);
  txt('최고 ' + G.best, OX + W0 - 14, 30, 14, 'rgba(255,255,255,.75)', 'right', 600);
  if (G.stats.shield > 0) txt('추진기 ×' + G.stats.shield, OX + W0 - 14, 50, 12, '#ff9d7a', 'right', 600);
  if (b && b.state !== 'intro') drawBossHud();
}

function drawBossHud() {
  const b = G.boss, { VW, VH, OX } = V, T = G.T, bw = 240, bx = VW / 2 - bw / 2, by = 52;   // 보스전 HUD: 이름·체력·예고 칩을 위쪽에 촘촘히
  txt(b.d.n, VW / 2 - 6, by - 8, 14, '#fff', 'center', 800);
  g.font = '800 14px ' + FONT; txt('공격 ' + b.d.atk + '초', VW / 2 + 6 + g.measureText(b.d.n).width / 2, by - 8, 11, 'rgba(255,150,130,.9)', 'left', 700);
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(bx, by, bw, 10, 5); g.fill();
  const f = clamp(b.hp / b.max, 0, 1); g.fillStyle = b.hitT > 0 ? '#fff' : 'hsl(' + b.d.hue + ',90%,58%)'; rr(bx, by, Math.max(8, bw * f), 10, 5); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; for (const q of (b.d.kind === 'quasar' ? [.66, .33] : [.5])) { g.beginPath(); g.moveTo(bx + bw * q, by); g.lineTo(bx + bw * q, by + 10); g.stroke(); }
  txt(Math.max(0, Math.ceil(b.hp)) + ' / ' + b.max, VW / 2, by + 21, 10, 'rgba(255,255,255,.6)', 'center', 600);
  if (b.state !== 'fight') return;
  const cy = by + 30;
  let x = VW / 2 - (b.q.length * 70) / 2 + 35;
  for (const a of b.q) {
    const at = ATK[a.k]; rr(x - 32, cy, 64, 20, 8); g.fillStyle = 'rgba(10,8,24,.75)'; g.fill(); g.strokeStyle = a.t <= 1 ? '#ff6a6a' : at.c; g.lineWidth = 1.5; g.stroke();
    txt(at.n + ' ' + a.t, x, cy + 14, 11, a.t <= 1 ? '#ff9a9a' : at.c, 'center', 700); x += 70;
  }
  if (G.bcombo > 0) txt('연속 x' + G.bcombo, OX + 14, 92, 12, '#ff9d7a', 'left', 700);
  // 산소 게이지: 보스전에서는 회복되지 않는다
  const ow = 280, ox = VW / 2 - ow / 2, oy = VH - 44, of = clamp(G.bo2 / G.bo2max, 0, 1), low = G.bo2 < 6;
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(ox, oy, ow, 12, 6); g.fill();
  g.fillStyle = low ? 'rgba(255,' + Math.floor(80 + 80 * Math.sin(T * 10)) + ',80,1)' : '#b8a8ff'; rr(ox, oy, Math.max(6, ow * of), 12, 6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; rr(ox, oy, ow, 12, 6); g.stroke();
  txt('산소 ' + G.bo2.toFixed(1) + '초', VW / 2, oy - 8, 12, low ? '#ff9a9a' : 'rgba(220,210,255,.85)', 'center', 700);
}

/** 산소가 얼마 안 남았을 때 화면 가장자리가 붉게 */
export function drawLowO2() {
  const b = G.boss, { VW, VH } = V;
  if (!(b && b.state === 'fight' && G.bo2 < 6)) return;
  G.lowO2 = clamp(.5 + .5 * Math.sin(G.T * 9), 0, 1) * (1 - G.bo2 / 6);
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
  if (G.st === 'title') {
    g.fillStyle = 'rgba(5,6,15,.55)'; g.fillRect(0, 0, VW, VH);
    if (GFX.v >= 2) drawTitle2();
    else { txt('스윙바이', VW / 2, VH * .22, 58, '#fff', 'center', 900); txt('S W I N G B Y', VW / 2, VH * .22 + 30, 16, '#7dd3ff', 'center', 600); }
    g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('화면을 터치해서 출발', VW / 2, VH - 86, 19, '#fff'); g.globalAlpha = 1;
    if (G.debug) txt('DEBUG · ' + BOSSES[G.nextBi].n, VW / 2, VH - 120, 14, '#ffd24a', 'center', 800);
    if (G.best > 0) txt('최고 기록 ' + G.best + (G.bestBoss > 0 ? '  ·  보스 ' + Math.min(G.bestBoss, STAGES.length) + '/' + STAGES.length + (G.bestBoss >= STAGES.length ? ' 클리어' : '') : ''), VW / 2, VH - 52, 14, 'rgba(255,255,255,.6)', 'center', 500);
  }
  if (G.st === 'clear') {
    const a = clamp(G.clearT * 1.5, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.7 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('TON 618 격파', VW / 2, VH * .28, 44, '#ffe27a', 'center', 900); txt('우주의 끝에서 살아 돌아왔다', VW / 2, VH * .28 + 32, 15, 'rgba(255,255,255,.8)', 'center', 500);
    txt(String(G.score), VW / 2, VH * .28 + 112, 64, '#fff', 'center', 900); txt(G.newBest ? '★ 신기록 ★' : '최고 ' + G.best, VW / 2, VH * .28 + 142, 16, G.newBest ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
    txt('행성 ' + G.hops + '개  ·  보스 ' + G.kills + '회 격파', VW / 2, VH * .28 + 172, 14, 'rgba(255,255,255,.75)', 'center', 500);
    if (G.clearT > 1) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 계속', VW / 2, VH - 80, 16, '#fff'); }
    g.globalAlpha = 1;
  }
  if (G.st === 'dead') {
    const a = clamp(G.deadT * 2, 0, 1); g.fillStyle = 'rgba(5,6,15,' + (.72 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
    txt('항해 종료', VW / 2, VH * .3, 40, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, VH * .3 + 30, 15, '#ff8f8f', 'center', 500);
    const b = G.boss; if (b && b.state === 'fight') txt(b.d.n + ' 남은 체력 ' + Math.max(1, Math.round(b.hp / b.max * 100)) + '%', VW / 2, VH * .3 + 52, 13, 'rgba(255,200,170,.85)', 'center', 600);
    txt(String(G.score), VW / 2, VH * .3 + 110, 64, '#fff', 'center', 900); txt(G.newBest ? '★ 신기록 ★' : '최고 ' + G.best, VW / 2, VH * .3 + 140, 16, G.newBest ? '#ffe27a' : 'rgba(255,255,255,.6)', 'center', 700);
    txt('행성 ' + G.hops + '개  ·  최대 콤보 x' + G.maxCombo + '  ·  보스 ' + G.kills + '회 격파', VW / 2, VH * .3 + 172, 14, 'rgba(255,255,255,.75)', 'center', 500);
    if (G.deadT > .7) { g.globalAlpha = .6 + .4 * Math.sin(T * 4); txt('터치해서 다시 출발', VW / 2, VH - 80, 19, '#fff'); }
    g.globalAlpha = 1;
  }
}
