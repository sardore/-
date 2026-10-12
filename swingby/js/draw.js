/* 한 프레임 그리기 순서: 배경 → 월드(줌/흔들림 적용) → 화면 효과 → UI → 오버레이 */
import { G, V, g } from './state.js';
import { W, rnd } from './util.js';
import { drawBackdrop } from './draw-backdrop.js';
import { BIOMES } from './data.js';
import { viewTop, viewBot } from './camera.js';
import { drawWorld, drawPlayer, drawFx } from './draw-world.js';
import { drawBoss, drawTele, drawHaz } from './draw-boss.js';
import { drawHud, drawLowO2, drawMuteButton, drawOverlays, drawScreens } from './draw-ui.js';
import { drawPick } from './draw-pick.js';

export function draw() {
  const { VW, VH, OX, S, DPR } = V;
  g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  drawBackdrop();
  g.save();
  const sx = G.shake > 0 ? rnd(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rnd(-G.shake, G.shake) : 0;
  const z = (1 + G.zoom) * G.vz;
  g.translate(VW / 2, VH / 2); g.scale(z, z); g.translate(-VW / 2 + OX + sx, -VH / 2 - G.camY + sy);
  const wc = G.biome === 'normal' ? 'rgba(125,211,255,.16)' : BIOMES[G.biome].c + '55'; g.strokeStyle = wc; g.lineWidth = G.biome === 'normal' ? 2 : 3;
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
