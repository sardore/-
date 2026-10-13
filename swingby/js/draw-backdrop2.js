/* 배경 v2: 예전 배경(하늘·구름·먼지) 위에 깜빡이는 별 층을 얹고, 보스전 스크롤에는 속도선을, 필드 양옆에는 빛 번짐을 더한다 */
import { G, V, g } from './state.js';
import { TAU } from './util.js';
import { BIOMES } from './data.js';
import { viewTop, viewBot } from './camera.js';
import { drawBackdrop } from './draw-backdrop.js';

const TINT = ['255,255,255', '200,225,255', '255,240,210', '215,205,255'];
// 별 배치는 고정 시드로 만든다(Math.random 을 쓰지 않아 다른 난수 흐름을 건드리지 않는다)
let seed = 20261013; const R = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const stars = [];
for (let i = 0; i < 130; i++) stars.push({ x: R(), y: R() * 4000, z: i < 70 ? .06 : i < 118 ? .14 : .26, s: .6 + R() * .8, ph: R() * TAU, sp: .8 + R() * 1.8, c: TINT[Math.floor(R() * TINT.length)], big: i >= 118 });

export function drawBackdrop2() {
  drawBackdrop();
  const { VW, VH } = V, T = G.T, dm = VH + 20;
  for (const s of stars) {
    const tw = .5 + .5 * Math.sin(T * s.sp + s.ph), a = Math.min(1, (.28 + s.z * 2) * (.45 + .55 * tw));
    const x = s.x * VW, y = (((s.y - G.camY * s.z) % dm) + dm) % dm - 10, sz = s.s * (.8 + s.z * 3);
    g.fillStyle = 'rgba(' + s.c + ',' + a + ')';
    if (!s.big) { g.fillRect(x, y, sz, sz); continue; }
    g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(' + s.c + ',' + a * .55 + ')'; g.lineWidth = 1; const L = 3 + 5 * tw;
    g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
  }
  const b = G.boss;
  if (b && b.state === 'fight' && b.sv > 1) { // 맵이 밀려나는 속도선
    const v = b.sv * G.vz;
    for (let i = 0; i < 18; i++) {
      const z = .3 + (i % 4) * .2, len = 10 + z * v * 1.6, x = (i * .6180339 % 1) * VW, y = ((i * 137.5 + T * v * z * 4) % (VH + 80)) - 40;
      g.strokeStyle = 'rgba(190,220,255,' + (.07 + .08 * z) + ')'; g.lineWidth = 1 + z; g.beginPath(); g.moveTo(x, y - len); g.lineTo(x, y); g.stroke();
    }
  }
}

/** 필드 양옆 벽: 선 안쪽으로 번지는 빛 (월드 좌표) */
export function drawWalls2() {
  const hex = BIOMES[G.biome].c, rgb = G.biome === 'normal' ? [125, 211, 255] : [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const top = viewTop() - 20, h = viewBot() - top + 20, bw = 26;
  for (const side of [0, 1]) {
    const x = side ? G.w : 0, gr = g.createLinearGradient(x, 0, x + (side ? -bw : bw), 0);
    gr.addColorStop(0, 'rgba(' + rgb.join(',') + ',.22)'); gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
    g.fillStyle = gr; g.fillRect(side ? G.w - bw : 0, top, bw, h);
  }
}
