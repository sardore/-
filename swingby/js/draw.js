/* 한 프레임 그리기 순서: 배경 → 월드(줌/흔들림 적용) → 화면 효과 → UI → 오버레이 */
import { G, V, g } from './state.js';
import { W, rnd } from './util.js';
import { BIOMES } from './data.js';
import { viewTop, viewBot } from './camera.js';
import { drawWorld, drawPlayer, drawFx } from './draw-world.js';
import { drawBoss, drawTele, drawHaz } from './draw-boss.js';
import { drawHud, drawLowO2, drawMuteButton, drawOverlays, drawScreens } from './draw-ui.js';
import { drawPick } from './draw-pick.js';

const dust = []; for (let i = 0; i < 110; i++) dust.push({ x: Math.random(), y: Math.random() * 2000, z: rnd(.08, .5), s: rnd(.5, 1.7) });

function drawBackdrop() {
  const { VW, VH } = V, bm = BIOMES[G.biome];
  const gr = g.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, '#070818'); gr.addColorStop(1, '#0c0a1f'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  if (G.biome !== 'normal' && !G.boss) { // 바이옴 색으로 은은하게 물들인다
    const tg = g.createLinearGradient(0, 0, 0, VH); tg.addColorStop(0, 'hsla(' + bm.hue + ',70%,45%,.16)'); tg.addColorStop(1, 'hsla(' + bm.hue + ',70%,45%,.03)'); g.fillStyle = tg; g.fillRect(0, 0, VW, VH);
  }
  const m = VH + 20, tint = G.biome === 'normal' || G.boss ? '#cfd8ff' : bm.c;
  g.fillStyle = tint;
  for (const b of dust) { g.globalAlpha = .25 + b.z * 1.2; g.fillRect(b.x * VW, (((b.y - G.camY * b.z) % m) + m) % m - 10, b.s, b.s); }
  g.globalAlpha = 1;
  if (G.boss) { const hh = G.boss.d.hue, rg = g.createRadialGradient(VW / 2, 0, 0, VW / 2, 0, VH * .9); rg.addColorStop(0, 'hsla(' + hh + ',90%,50%,.16)'); rg.addColorStop(1, 'hsla(' + hh + ',90%,50%,0)'); g.fillStyle = rg; g.fillRect(0, 0, VW, VH); }
}

export function draw() {
  const { VW, VH, OX, S, DPR } = V;
  g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  drawBackdrop();
  g.save();
  const sx = G.shake > 0 ? rnd(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rnd(-G.shake, G.shake) : 0;
  const z = (1 + G.zoom) * G.vz;
  g.translate(VW / 2, VH / 2); g.scale(z, z); g.translate(-VW / 2 + OX + sx, -VH / 2 - G.camY + sy);
  g.strokeStyle = 'rgba(125,211,255,.16)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, viewTop() - 20); g.lineTo(0, viewBot() + 20); g.moveTo(W, viewTop() - 20); g.lineTo(W, viewBot() + 20); g.stroke();
  drawWorld();
  const b = G.boss;
  if (b) { if (b.state === 'fight') for (const a of b.q) drawTele(a, b); drawBoss(b); for (const h of G.haz) drawHaz(h); }
  if (G.st !== 'dead') drawPlayer();
  drawFx();
  g.restore();

  if (G.flashA > 0) { g.globalAlpha = Math.min(1, G.flashA); g.fillStyle = G.flashC; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
  drawLowO2();
  drawHud();
  drawMuteButton();
  drawOverlays();
  drawScreens();
  if (G.st === 'pick') drawPick();
}
