// 생물/인물/소품 스프라이트 — 모두 코드로 그린다 (외부 에셋 없음)
import { Pix, finish, mk, shade, mix, tint, flipH } from './pix.js';

/* ---------- 불꽃 ---------- */
export function flame(g, cx, cy, s, fr, c = [255, 190, 80]) {
  const w = s * (0.9 + 0.12 * Math.sin(fr * 1.7)), h = s * 1.6 * (0.9 + 0.15 * Math.sin(fr * 2.3 + 1)), sway = Math.sin(fr * 1.3) * s * 0.18;
  const layer = (k, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx - w * k, cy); g.quadraticCurveTo(cx - w * k, cy - h * k * 0.6, cx + sway * k, cy - h * k); g.quadraticCurveTo(cx + w * k, cy - h * k * 0.6, cx + w * k, cy); g.quadraticCurveTo(cx, cy + w * k * 0.5, cx - w * k, cy); g.fill(); };
  layer(1, `rgb(${c[0]},${Math.max(0, c[1] - 90)},${Math.max(0, c[2] - 50)})`); layer(0.74, `rgb(${c[0]},${c[1]},${c[2] - 20 > 0 ? c[2] - 20 : 0})`); layer(0.4, '#fff4c8');
}
/* ---------- 사람 ---------- */
function person(p, o = {}, fr = 0) {
  const sk = o.skin || '#e6b48a', hair = o.hair || '#4a2f1f', c1 = o.c1 || '#7a5a9a', c2 = o.c2 || '#463060', boot = o.boot || '#2d1f18', eye = o.eye || '#241818';
  const bob = fr ? 1 : 0, dy = o.small ? 4 : 0, big = o.big;
  p.rect(12, 24 + dy, 3, 5 - bob - dy / 2, c2); p.rect(17, 24 + dy, 3, 4 + bob - dy / 2, c2); p.rect(11, 28 - bob, 4, 2, boot); p.rect(17, 27 + bob, 4, 2, boot);
  if (o.cape) p.poly([[10, 14 + dy], [22, 14 + dy], [24, 27], [8, 27]], o.cape);
  p.poly([[11, 14 + dy], [21, 14 + dy], [22, 25], [10, 25]], c1); p.rect(10, 22, 12, 2, c2);
  p.rect(8, 15 + dy, 3, 8 - dy / 2, c1); p.rect(21, 15 + dy, 3, 8 - dy / 2, c1); p.rect(8, 22, 3, 2, sk); p.rect(21, 22, 3, 2, sk);
  p.disc(16, 9 + dy, 5, sk);
  if (o.hood) { p.ell(16, 8 + dy, 6.6, 6.3, o.hood); p.ell(16, 10 + dy, 3.6, 3.6, sk); p.rect(11, 12 + dy, 10, 3, o.hood); }
  else if (o.wimple) { p.ell(16, 8 + dy, 6.5, 6, '#e8e6e0'); p.ell(16, 10 + dy, 3.7, 3.6, sk); p.rect(12, 14 + dy, 8, 3, '#e8e6e0'); }
  else if (o.bald) { /* 없음 */ } else { p.ell(16, 5.8 + dy, 5.6, 3.2, hair); if (o.long) { p.rect(10, 7 + dy, 2, 7, hair); p.rect(20, 7 + dy, 2, 7, hair); } }
  if (o.helmet) { p.ell(16, 5.5 + dy, 6, 3.6, o.helmet); p.rect(10, 6 + dy, 12, 2, shade(o.helmet, -0.2)); if (o.lamp) { p.disc(16, 4.5 + dy, 1.6, o.lamp); } }
  if (o.beard) { p.ell(16, 13 + dy, 4, 3, o.beard); }
  p.px(14, 10 + dy, eye); p.px(18, 10 + dy, eye); if (o.eyeGlow) { p.px(14, 10 + dy, o.eyeGlow); p.px(18, 10 + dy, o.eyeGlow); p.px(14, 9 + dy, o.eyeGlow); p.px(18, 9 + dy, o.eyeGlow); }
  if (o.goggles) { p.rect(12, 9 + dy, 8, 3, '#3a3a44'); p.px(13, 10 + dy, '#9fe0ff'); p.px(14, 10 + dy, '#9fe0ff'); p.px(18, 10 + dy, '#9fe0ff'); p.px(17, 10 + dy, '#9fe0ff'); }
  if (o.scarf) { p.rect(11, 13 + dy, 10, 2, o.scarf); }
  if (o.apron) { p.poly([[12, 16 + dy], [20, 16 + dy], [21, 26], [11, 26]], o.apron); }
}
function lantern(p, x, y, lit = true) { p.rect(x + 1, y - 3, 1, 3, '#7a6a4a'); p.rect(x - 1, y, 5, 6, '#3a3024'); p.rect(x, y + 1, 3, 4, lit ? '#ffd27a' : '#2a2a30'); p.rect(x, y + 6, 3, 1, '#3a3024'); }
const LOOKS = {
  player: (p, fr) => { person(p, { c1: '#a8442e', c2: '#5a2a22', hair: '#3a2418', cape: '#6a2a20' }, fr); lantern(p, 24, 19); p.rect(23, 21, 2, 3, '#e6b48a'); },
  heir0: (p, fr) => { person(p, { c1: '#a8442e', c2: '#5a2a22', hair: '#5a3a22', small: 1 }, fr); },
  heir1: (p, fr) => { person(p, { c1: '#3a6aa8', c2: '#26406a', hair: '#e8d8a0', small: 1 }, fr); },
  heir2: (p, fr) => { person(p, { c1: '#4a8a5a', c2: '#2a5a3a', hair: '#2a2a30', small: 1, long: 1 }, fr); },
  elder: (p, fr) => { person(p, { c1: '#8a7a6a', c2: '#5a4a3a', hair: '#d8d8d8', cape: '#6a5a4a' }, fr); p.line(26, 18, 26, 29, '#6a4a2a'); p.rect(25, 17, 3, 2, '#6a4a2a'); },
  smith: (p, fr) => { person(p, { c1: '#6a5a50', c2: '#3a2e2a', hair: '#7a3a1a', beard: '#7a3a1a', apron: '#2e2622', skin: '#d8a078' }, fr); p.rect(24, 12, 3, 12, '#6a4a2a'); p.rect(22, 10, 7, 4, '#8a8f9a'); },
  nun: (p, fr) => { person(p, { c1: '#3a3a4a', c2: '#26262e', wimple: 1 }, fr); p.rect(15, 16, 2, 5, '#d8c890'); p.rect(14, 18, 4, 1, '#d8c890'); },
  lamp: (p, fr) => { person(p, { c1: '#c47a2a', c2: '#6a4018', hair: '#2a2a30', goggles: 1, scarf: '#e0a040' }, fr); lantern(p, 24, 20); },
  herb: (p, fr) => { person(p, { c1: '#4a8a4a', c2: '#2e5a2e', hair: '#6a3a1a', long: 1 }, fr); p.ell(24, 24, 4, 3, '#a0783c'); p.rect(21, 20, 6, 2, '#6aa050'); },
  scribe: (p, fr) => { person(p, { c1: '#3a4a7a', c2: '#26305a', hair: '#9a9a9a', bald: 0 }, fr); p.rect(22, 18, 6, 7, '#8a2a2a'); p.rect(23, 19, 4, 5, '#e8dcb8'); },
  kid: (p, fr) => { person(p, { c1: '#c4a24a', c2: '#6a5a2a', hair: '#8a4a1a', small: 1 }, fr); },
  miner: (p, fr) => { person(p, { c1: '#6a5a40', c2: '#3a3020', hair: '#b0b0b0', helmet: '#8a8a60', lamp: '#ffd070', beard: '#c8c8c8' }, fr); p.line(24, 14, 27, 26, '#6a4a2a'); p.rect(22, 12, 7, 2, '#8a8f9a'); },
  ghost0: ghostLook, ghost1: ghostLook, ghost2: ghostLook, ghost3: ghostLook, ghost4: ghostLook,
};
function ghostLook(p, fr) { person(p, { c1: '#b8d0e8', c2: '#98b0c8', skin: '#d8e8f4', hair: '#c8d8e8', eye: '#506078' }, fr); }
/* ---------- 몬스터 ---------- */
const snuff = { skin: '#9aa0a2', eye: '#e8f0e8', hair: '#3a3a3e' };
const MON = {
  rat: (p, fr) => { p.ell(15, 24, 7, 4, '#7a5a42'); p.ell(22, 22, 3.5, 3, '#8a6a50'); p.px(24, 21, '#ff4040'); p.disc(21, 19, 1.5, '#a07a5a'); p.disc(24, 19, 1.5, '#a07a5a'); p.line(8, 25, 3, 21 + fr * 2, '#b08a7a'); p.rect(11, 27 + fr, 2, 2, '#4a3224'); p.rect(18, 27 - fr, 2, 2, '#4a3224'); p.px(26, 23, '#e8d0c0'); },
  bat: (p, fr) => { const f = fr ? 4 : 0; p.poly([[16, 14], [3, 8 + f], [7, 17], [12, 15]], '#4a3a6a'); p.poly([[16, 14], [29, 8 + f], [25, 17], [20, 15]], '#4a3a6a'); p.ell(16, 15, 3.5, 4, '#5a4a7a'); p.poly([[13, 11], [14, 8], [16, 11]], '#5a4a7a'); p.poly([[19, 11], [18, 8], [16, 11]], '#5a4a7a'); p.px(14, 14, '#ff5050'); p.px(18, 14, '#ff5050'); },
  grub: (p, fr) => { for (let i = 0; i < 4; i++) p.ell(8 + i * 5, 24 - (i === 2 ? 1 + fr : 0), 4.4, 4, i % 2 ? '#c8b890' : '#d8c8a0'); p.ell(25, 22, 5, 4.5, '#b8a070'); p.rect(28, 21, 3, 1, '#4a3020'); p.rect(28, 24, 3, 1, '#4a3020'); p.px(25, 20, '#201814'); },
  miner: (p, fr) => { person(p, { ...snuff, c1: '#5a5448', c2: '#2e2a22', helmet: '#6a6858', eyeGlow: '#d8f0e0' }, fr); p.line(24, 12, 27, 25, '#5a4a38'); p.rect(21, 10, 8, 3, '#7a7f88'); },
  bloat: (p, fr) => { const r = 9 + fr * 0.8; p.disc(16, 17, r, '#a8b050'); p.disc(13, 13, 2.5, '#c8d070'); p.px(13, 17, '#2a2a10'); p.px(19, 17, '#2a2a10'); p.rect(13, 21, 6, 1, '#4a5018'); p.line(10, 12, 14, 16, '#7a8030'); p.line(22, 22, 18, 18, '#7a8030'); p.rect(15, 26, 2, 3, '#7a8030'); },
  drowned: (p, fr) => { person(p, { skin: '#7a9aa0', eye: '#d8f4f0', hair: '#2a4a40', c1: '#3a5a5a', c2: '#26403f', eyeGlow: '#bff' }, fr); p.line(9, 14, 7, 25, '#2e6a4a'); p.line(23, 13, 25, 24, '#2e6a4a'); p.px(10, 20, '#2e6a4a'); },
  eel: (p, fr) => { p.ell(16, 26, 11, 4, '#1c3a4a'); p.ell(16, 26, 11, 1.5, '#4a8aa0'); for (let i = 0; i < 3; i++) p.disc(7 + i * 8, 20 + ((i + fr) % 2) * 2, 3.2, '#2a5a6a'); p.ell(25, 16, 4, 5, '#2a5a6a'); p.px(26, 14, '#ffe060'); p.rect(27, 18, 3, 1, '#d8d8d0'); p.rect(27, 20, 3, 1, '#d8d8d0'); },
  acolyte: (p, fr) => { person(p, { hood: '#2a5a6a', c1: '#2a5a6a', c2: '#18404a', eye: '#bff' }, fr); p.disc(25, 18, 3, '#6ad0f0'); p.disc(24, 17, 1.2, '#e8fbff'); },
  candle: (p, fr) => { p.rect(11, 14, 10, 14, '#e8dcc0'); p.rect(11, 14, 3, 14, '#fff6dc'); p.poly([[11, 28], [13, 31], [15, 28]], '#e8dcc0'); p.poly([[17, 28], [19, 31], [21, 28]], '#e8dcc0'); p.px(14, 20, '#2a2a30'); p.px(18, 20, '#2a2a30'); p.rect(14, 23, 4, 1, '#2a2a30'); const g = p.g; flame(g, 16, 13, 4.5, fr * 2, [140, 200, 255]); },
  worm: (p, fr) => { for (let i = 0; i < 4; i++) p.ell(9 + i * 5, 26 - ((i + fr) % 2) * 2, 3.4, 3, i ? '#d8c490' : '#e8d8a0'); p.px(27, 24, '#201814'); p.rect(12, 23, 3, 4, '#f0e8d0'); },
  wraith: (p, fr) => { for (let i = 0; i < 6; i++) { const x = 6 + (i % 3) * 7, y = 8 + ((i / 3) | 0) * 9 + (fr && i % 2 ? 1 : 0); p.rect(x, y, 6, 7, i % 2 ? '#e8dcb8' : '#d8cca0'); p.rect(x + 1, y + 2, 4, 1, '#8a7a50'); p.rect(x + 1, y + 4, 3, 1, '#8a7a50'); } p.px(14, 14, '#ff6a4a'); p.px(18, 14, '#ff6a4a'); p.rect(12, 16, 8, 1, '#4a3a20'); p.poly([[10, 24], [16, 30 + fr], [22, 24]], '#cfc09a'); },
  scribe: (p, fr) => { person(p, { hood: '#5a3a7a', c1: '#5a3a7a', c2: '#3a2450', eyeGlow: '#ffd070' }, fr); p.rect(21, 17, 7, 8, '#2a1a3a'); p.rect(22, 18, 5, 6, '#e8dcb8'); p.px(24, 20, '#6a4a20'); },
  armor: (p, fr) => { p.rect(11, 13, 10, 12, '#8a8f9c'); p.rect(11, 13, 4, 12, '#b0b6c4'); p.disc(16, 9, 5, '#9aa0ae'); p.rect(12, 8, 8, 2, '#1a1a22'); p.px(14, 9, '#ffa040'); p.px(18, 9, '#ffa040'); p.rect(8, 14, 4, 9, '#7a808c'); p.rect(20, 14, 4, 9, '#7a808c'); p.rect(12, 25, 3, 4 - fr, '#6a707c'); p.rect(17, 25, 3, 3 + fr, '#6a707c'); p.line(26, 10, 26, 27, '#aab0bc'); p.rect(24, 10, 5, 2, '#aab0bc'); p.rect(15, 5, 2, 3, '#a03030'); },
  imp: (p, fr) => { p.ell(16, 19, 5, 6, '#c8402a'); p.disc(16, 11, 4.5, '#d8503a'); p.poly([[11, 9], [9, 3], [14, 7]], '#3a1a14'); p.poly([[21, 9], [23, 3], [18, 7]], '#3a1a14'); p.px(14, 11, '#ffe040'); p.px(18, 11, '#ffe040'); p.rect(14, 14, 4, 1, '#3a1a14'); p.poly([[9, 15], [2, 11 + fr * 3], [10, 20]], '#8a2a1a'); p.poly([[23, 15], [30, 11 + fr * 3], [22, 20]], '#8a2a1a'); p.rect(13, 24, 2, 4, '#a83020'); p.rect(18, 24, 2, 4, '#a83020'); flame(p.g, 25, 28, 3.2, fr * 2, [255, 150, 60]); },
  golem: (p, fr) => { p.rect(8, 10, 16, 16, '#4a3a38'); p.rect(5, 12, 5, 12, '#5a4846'); p.rect(22, 12, 5, 12, '#5a4846'); p.rect(11, 3, 10, 8, '#5a4846'); p.rect(11, 25, 4, 4 - fr, '#3a2c2a'); p.rect(17, 25, 4, 3 + fr, '#3a2c2a'); p.line(10, 12, 14, 20, '#ff7a30'); p.line(14, 20, 12, 25, '#ff7a30'); p.line(22, 13, 18, 19, '#ffb040'); p.rect(13, 6, 2, 2, '#ffd040'); p.rect(17, 6, 2, 2, '#ffd040'); p.rect(14, 15, 4, 3, '#ff9040'); },
  smith: (p, fr) => { person(p, { ...snuff, c1: '#4a3a34', c2: '#2a201c', apron: '#26201c', beard: '#4a4a4e', eyeGlow: '#ffb060' }, fr); p.rect(23, 10, 3, 14, '#5a4a38'); p.rect(21, 7, 8, 5, '#6a707c'); },
  chain: (p, fr) => { p.poly([[10, 6], [22, 6], [24, 28 + fr], [8, 28]], '#4a5a78'); p.ell(16, 10, 5, 5.5, '#6a7a98'); p.rect(12, 9, 8, 3, '#101420'); p.px(14, 10, '#9fd0ff'); p.px(18, 10, '#9fd0ff'); for (let i = 0; i < 5; i++) { p.rect(5 + i * 5, 17 + (i % 2) * 3 + fr, 3, 3, '#8a8f9a'); } p.line(6, 18, 2, 26, '#8a8f9a'); p.line(26, 18, 30, 26, '#8a8f9a'); },
  shade: (p, fr) => { p.poly([[10, 8], [22, 8], [25, 26 + fr], [21, 22], [16, 29], [11, 22], [7, 26 + fr]], '#1a1626'); p.ell(16, 9, 5, 5.5, '#26203a'); p.rect(12, 8, 3, 2, '#f0e8ff'); p.rect(17, 8, 3, 2, '#f0e8ff'); p.poly([[8, 16], [3, 22 + fr * 2], [9, 20]], '#26203a'); p.poly([[24, 16], [29, 22 + fr * 2], [23, 20]], '#26203a'); },
  husk: (p, fr) => { person(p, { skin: '#8a8a94', c1: '#4a4658', c2: '#2a2634', hair: '#2a2a34', eyeGlow: '#c8b0ff' }, fr); p.rect(12, 16, 8, 6, '#14101c'); p.px(14, 18, '#a88aff'); p.px(17, 19, '#a88aff'); p.line(7, 14, 5, 26, '#6a667a'); },
  maw: (p, fr) => { p.ell(16, 20, 12, 9, '#2a1a3a'); p.ell(16, 20, 9, 6, '#0c0614'); for (let i = 0; i < 7; i++) { p.poly([[6 + i * 3.4, 15], [8 + i * 3.4, 15], [7 + i * 3.4, 19 + fr]], '#e8e0f0'); p.poly([[6 + i * 3.4, 26], [8 + i * 3.4, 26], [7 + i * 3.4, 22 - fr]], '#e8e0f0'); } p.px(16, 20, '#c090ff'); p.px(15, 20, '#c090ff'); },
};
/* 보스는 48x48 */
const BOSS = {
  otol: (p, fr) => { const o = 8; person48(p, { ...snuff, c1: '#6a5a40', c2: '#3a3020', helmet: '#8a8a60', lamp: '#2a2a20', beard: '#8a8a8a', eyeGlow: '#ff6040' }, fr); p.line(38, 10, 42, 40, '#5a4a38'); p.poly([[34, 8], [46, 8], [46, 14], [40, 12], [34, 14]], '#9aa0aa'); },
  marga: (p, fr) => { person48(p, { hood: '#2a6a7a', c1: '#2a6a7a', c2: '#184450', eye: '#bff', skin: '#a8c8c8', cape: '#1a4a56' }, fr); p.line(38, 4, 38, 42, '#6a8a8a'); p.disc(38, 5, 4, '#6ad8f0'); p.disc(37, 4, 1.6, '#f0ffff'); },
  isil: (p, fr) => { p.poly([[10, 14], [38, 14], [40, 40 + fr], [8, 40 + fr]], '#3a2a5a'); p.ell(24, 14, 8, 8, '#d8c8a0'); p.rect(18, 12, 12, 4, '#2a1a3a'); p.px(21, 14, '#ffd070'); p.px(27, 14, '#ffd070'); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + fr * 0.4, x = 24 + Math.cos(a) * 18, y = 22 + Math.sin(a) * 10; p.rect(x - 3, y - 4, 6, 8, i % 2 ? '#e8dcb8' : '#d0c090'); p.rect(x - 2, y - 2, 4, 1, '#8a7a50'); } p.rect(14, 22, 20, 12, '#5a2a2a'); p.rect(15, 23, 18, 10, '#e8dcb8'); p.rect(23, 23, 2, 10, '#8a7a50'); },
  borkai: (p, fr) => { person48(p, { skin: '#a87850', c1: '#4a3a34', c2: '#2a1e1a', hair: '#1a1210', beard: '#6a2a1a', apron: '#1e1814', eyeGlow: '#ffb030', cape: '#2a1e1a' }, fr); p.rect(36, 6, 4, 30, '#5a4a38'); p.rect(30, 2, 16, 10, '#6a707c'); p.rect(30, 2, 5, 10, '#9aa0ac'); flame(p.g, 8, 36, 4, fr * 2, [255, 120, 40]); },
  hollow: (p, fr) => { p.poly([[14, 6], [34, 6], [40, 44 + fr], [34, 38], [24, 46], [14, 38], [8, 44 + fr]], '#18122a'); p.ell(24, 12, 8, 9, '#221a3a'); p.rect(17, 11, 5, 3, '#f0e8ff'); p.rect(27, 11, 5, 3, '#f0e8ff'); p.rect(20, 18, 9, 1, '#6a50a0'); p.poly([[10, 20], [2, 30 + fr * 2], [12, 28]], '#221a3a'); p.poly([[38, 20], [46, 30 + fr * 2], [36, 28]], '#221a3a'); p.rect(34, 24, 2, 7, '#9a8ac0'); p.rect(31, 29, 8, 9, '#3a3050'); p.rect(33, 31, 4, 5, '#c8b0ff'); },
};
function person48(p, o, fr) { // 32px 인물을 1.5배로 그린다
  const t = new Pix(32, 32); person(t, o, fr); const c = t.c; const g = p.g; g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 32, 32, 0, 0, 48, 48);
}
/* ---------- 소품 ---------- */
const PROP = {
  pillar: (p, z) => { p.rect(9, 6, 14, 3, '#8a8478'); p.rect(11, 9, 10, 17, '#74706a'); p.rect(11, 9, 3, 17, '#948f86'); p.rect(8, 25, 16, 4, '#8a8478'); p.noise(11, 10, 10, 14, '#5a5650', 0.12, 3); },
  statue: (p, z) => { p.rect(10, 24, 12, 5, '#6a6862'); p.poly([[11, 24], [21, 24], [20, 11], [12, 11]], '#8a8880'); p.disc(16, 8, 4.5, '#9a9890'); p.rect(11, 6, 10, 3, '#74726c'); p.rect(8, 14, 3, 8, '#7a7870'); p.rect(21, 14, 3, 8, '#7a7870'); p.px(14, 9, '#3a3a40'); p.px(18, 9, '#3a3a40'); },
  shelf: (p, z) => { p.rect(5, 4, 22, 25, '#5a3a22'); p.rect(7, 6, 18, 21, '#2e1c10'); for (let r = 0; r < 3; r++) { const y = 7 + r * 7; p.rect(7, y + 6, 18, 1, '#6a4428'); let x = 8; for (let i = 0; i < 6; i++) { const w = 2 + ((i + r) % 3), h = 4 + ((i * 2 + r) % 3); p.rect(x, y + 6 - h, w, h, ['#8a3a2a', '#3a5a8a', '#4a7a4a', '#a8883a', '#6a3a7a'][(i + r * 2) % 5]); x += w + 0; } } },
  brazier: (p, z) => { p.poly([[9, 14], [23, 14], [20, 20], [12, 20]], '#3a3632'); p.rect(14, 20, 4, 6, '#2e2a26'); p.rect(10, 26, 12, 3, '#3a3632'); p.rect(9, 13, 14, 2, '#5a554e'); p.noise(11, 14, 10, 4, '#1a1612', 0.5, 5); },
  altar: (p, z) => { p.rect(7, 18, 18, 11, '#7a766e'); p.rect(5, 26, 22, 3, '#6a665e'); p.rect(9, 14, 14, 5, '#8a867e'); p.rect(12, 12, 8, 2, '#a8a49a'); p.px(16, 20, '#ffd070'); p.px(10, 22, '#ffd070'); p.px(22, 22, '#ffd070'); },
  chest: (p, z) => { p.rect(6, 15, 20, 13, '#7a4a22'); p.rect(6, 12, 20, 5, '#8a5a2a'); p.rect(6, 17, 20, 2, '#3a2a1a'); p.rect(14, 16, 4, 5, '#d8b050'); p.rect(6, 12, 2, 16, '#3a3a40'); p.rect(24, 12, 2, 16, '#3a3a40'); p.rect(7, 13, 18, 1, '#a8703a'); },
  chestopen: (p, z) => { p.rect(6, 17, 20, 11, '#7a4a22'); p.rect(7, 18, 18, 5, '#1a100a'); p.rect(6, 7, 20, 6, '#8a5a2a'); p.rect(6, 7, 2, 6, '#3a3a40'); p.rect(24, 7, 2, 6, '#3a3a40'); p.rect(6, 17, 2, 11, '#3a3a40'); p.rect(24, 17, 2, 11, '#3a3a40'); p.rect(12, 19, 8, 2, '#d8b050'); },
  grave: (p, z) => { p.poly([[10, 28], [22, 28], [22, 12], [16, 8], [10, 12]], '#8a8880'); p.rect(14, 12, 4, 1, '#5a5850'); p.rect(15, 11, 2, 7, '#5a5850'); p.rect(8, 27, 16, 2, '#4a6a3a'); },
  anvil: (p, z) => { p.rect(8, 14, 16, 5, '#5a606c'); p.poly([[24, 14], [30, 15], [24, 18]], '#5a606c'); p.rect(12, 19, 8, 6, '#4a505a'); p.rect(9, 25, 14, 4, '#3e4450'); p.rect(8, 14, 16, 1, '#8a909c'); },
  furnace: (p, z) => { p.rect(5, 7, 22, 22, '#4a3e3a'); p.rect(5, 7, 22, 3, '#6a5a52'); p.rect(9, 15, 14, 12, '#1a0e0a'); p.rect(12, 5, 8, 4, '#3a2e2a'); p.noise(5, 10, 22, 4, '#2e2420', 0.3, 7); },
  cart: (p, z) => { p.poly([[5, 14], [27, 14], [24, 25], [8, 25]], '#6a5a4a'); p.rect(5, 13, 22, 2, '#8a7a68'); p.disc(10, 27, 2.6, '#3a3a40'); p.disc(22, 27, 2.6, '#3a3a40'); p.ell(12, 13, 4, 2.6, '#7a7a82'); p.ell(20, 12, 5, 3, '#6a6a72'); p.px(11, 12, '#ffd070'); p.px(21, 11, '#ffd070'); },
  barrel: (p, z) => { p.rect(8, 9, 16, 19, '#7a4e26'); p.ell(16, 9, 8, 3, '#9a6a36'); p.ell(16, 28, 8, 2.5, '#6a4220'); p.rect(8, 13, 16, 2, '#3a3a40'); p.rect(8, 22, 16, 2, '#3a3a40'); p.rect(10, 9, 2, 19, '#9a6a36'); },
  pew: (p, z) => { p.rect(3, 18, 26, 4, '#6a4428'); p.rect(3, 12, 26, 3, '#7a5030'); p.rect(4, 22, 3, 7, '#4a2e18'); p.rect(25, 22, 3, 7, '#4a2e18'); p.rect(4, 12, 3, 10, '#5a3a20'); p.rect(25, 12, 3, 10, '#5a3a20'); },
  table: (p, z) => { p.rect(3, 14, 26, 5, '#8a5e32'); p.rect(3, 14, 26, 1, '#b08046'); p.rect(5, 19, 3, 10, '#5a3a20'); p.rect(24, 19, 3, 10, '#5a3a20'); p.rect(10, 11, 7, 3, '#e8dcb8'); p.rect(20, 10, 4, 4, '#a83a30'); },
  stalag: (p, z) => { p.poly([[8, 29], [24, 29], [19, 8], [16, 3], [13, 9]], '#6a625a'); p.poly([[8, 29], [14, 29], [14, 10], [16, 3]], '#8a8176'); p.poly([[22, 29], [28, 29], [25, 17]], '#5a524a'); },
  root: (p, z) => { p.poly([[10, 29], [22, 29], [20, 14], [16, 4], [12, 14]], '#4a3622'); p.line(10, 28, 6, 20, '#5a4228'); p.line(22, 28, 27, 22, '#5a4228'); p.line(16, 5, 9, 12, '#5a4228'); p.line(16, 5, 24, 11, '#5a4228'); p.rect(14, 12, 2, 14, '#6a4e30'); p.px(12, 20, '#7ac060'); p.px(20, 18, '#7ac060'); },
  vent: (p, z) => { p.rect(7, 17, 18, 12, '#2a2220'); p.rect(9, 19, 14, 8, '#0e0806'); for (let i = 0; i < 4; i++) p.rect(10 + i * 4, 19, 1, 8, '#4a3e3a'); p.rect(7, 17, 18, 1, '#5a4e4a'); },
  spike: (p, z) => { p.rect(5, 24, 22, 5, '#3a3a40'); for (let i = 0; i < 4; i++) { p.poly([[6 + i * 6, 25], [9 + i * 6, 25], [7.5 + i * 6, 15]], '#b8bcc8'); } },
  web: (p, z) => { p.g.fillStyle = '#e8e8f0'; const c = p; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI; c.line(16 - Math.cos(a) * 12, 16 - Math.sin(a) * 12, 16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12, '#d8d8e4'); } for (const r of [4, 8, 12]) { for (let a = 0; a < 6.28; a += 0.25) c.px(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, '#c8c8d8'); } },
  bell: (p, z) => { p.rect(6, 2, 20, 3, '#5a4028'); p.line(16, 5, 16, 9, '#3a3a40'); p.poly([[9, 24], [23, 24], [21, 10], [11, 10]], '#c8a040'); p.ell(16, 24, 9, 2, '#a88030'); p.disc(16, 27, 2, '#6a5020'); p.rect(11, 12, 3, 10, '#e8c868'); },
  candle: (p, z) => { for (const [x, h] of [[9, 7], [15, 11], [21, 8]]) { p.rect(x, 26 - h, 3, h, '#ece0c0'); p.px(x + 1, 25 - h, '#2a2a30'); } },
  fungus: (p, z) => { for (const [x, y, r] of [[10, 24, 4], [18, 22, 5], [24, 26, 3]]) { p.rect(x - 1, y, 2, 29 - y, '#c8f0d0'); p.ell(x, y, r + 1, r - 1, '#50d890'); p.px(x - 1, y - 1, '#d8ffe8'); } },
  bones: (p, z) => { p.line(8, 22, 20, 26, '#d8d0c0'); p.line(10, 26, 22, 22, '#c8c0b0'); p.disc(22, 21, 3, '#e0d8c8'); p.px(21, 20, '#2a2a30'); p.px(23, 20, '#2a2a30'); },
  remains: (p, z) => { p.line(8, 24, 20, 28, '#c8d0d8'); p.line(10, 28, 22, 24, '#b8c0c8'); p.disc(11, 21, 3, '#d8e0e8'); p.px(10, 20, '#304050'); p.px(12, 20, '#304050'); lantern(p, 20, 15, true); },
  lamppost: (p, z) => { p.rect(15, 8, 2, 21, '#2e2a28'); p.rect(11, 4, 10, 6, '#2e2a28'); p.rect(12, 5, 8, 4, '#ffd27a'); p.rect(10, 3, 12, 2, '#3e3a38'); p.rect(12, 27, 8, 2, '#3e3a38'); },
  sign: (p, z) => { p.rect(15, 14, 2, 15, '#5a3a22'); p.rect(5, 6, 22, 10, '#8a6a3a'); p.rect(6, 7, 20, 8, '#a88a52'); p.rect(8, 9, 16, 1, '#4a3418'); p.rect(8, 12, 12, 1, '#4a3418'); },
  tree: (p, z) => { p.rect(14, 18, 4, 11, '#4a3220'); p.disc(16, 12, 9, '#2e4a2e'); p.disc(11, 15, 6, '#365a36'); p.disc(21, 14, 6, '#274027'); p.disc(14, 8, 4.5, '#3e6a3e'); },
  fence: (p, z) => { p.rect(3, 12, 26, 3, '#6a4a2a'); p.rect(3, 19, 26, 3, '#6a4a2a'); for (const x of [4, 15, 26]) p.rect(x, 8, 3, 20, '#7a5a34'); },
  bed: (p, z) => { p.rect(4, 14, 24, 13, '#5a3a22'); p.rect(5, 15, 22, 10, '#c8b890'); p.rect(5, 15, 8, 10, '#e8e0d0'); },
  wellpit: (p, z) => { p.ell(16, 20, 14, 8, '#3a3430'); p.ell(16, 20, 11, 6, '#0a0604'); p.ell(16, 21, 7, 3.5, '#5a1a08'); },
  ore: (p, z) => { for (const [x, y] of [[9, 12], [20, 10], [15, 21], [24, 22]]) { p.disc(x, y, 2.4, '#d8a040'); p.px(x - 1, y - 1, '#fff0b0'); } },
  crystal: (p, z) => { p.poly([[10, 28], [14, 6], [18, 28]], '#58b8e8'); p.poly([[16, 28], [22, 12], [26, 28]], '#7ad0ff'); p.poly([[5, 28], [8, 16], [11, 28]], '#4a9ac8'); p.px(14, 10, '#e8fbff'); p.px(22, 16, '#e8fbff'); },
  torch: (p, z) => { p.rect(15, 14, 3, 12, '#5a3a22'); p.rect(13, 11, 7, 4, '#3a3a40'); },
  mirror: (p, z) => { p.rect(7, 3, 18, 26, '#5a4a6a'); p.rect(9, 5, 14, 22, '#8a98c8'); p.rect(10, 6, 4, 18, '#c8d4f4'); p.line(12, 24, 22, 8, '#b8c4e8'); },
  lit: null,
};
const ITEM = {
  ember: (p, fr) => { p.disc(16, 17, 5, '#ff9a3a'); p.disc(16, 17, 3, '#ffd070'); p.disc(15, 16, 1.3, '#fff6dc'); },
  herb: (p) => { p.line(16, 26, 16, 12, '#3a8a3a'); p.ell(11, 15, 5, 3, '#58b858'); p.ell(21, 11, 5, 3, '#58b858'); p.ell(12, 21, 4.5, 2.6, '#48a048'); p.ell(20, 19, 4.5, 2.6, '#48a048'); },
  ash: (p) => { p.ell(16, 24, 8, 3.6, '#7a766e'); p.ell(14, 22, 5, 3, '#9a968c'); p.px(18, 21, '#ffb060'); p.px(12, 24, '#d8d0c0'); },
  key: (p) => { p.disc(11, 14, 4, '#d8b050'); p.disc(11, 14, 1.8, '#3a2a10'); p.rect(14, 13, 12, 3, '#d8b050'); p.rect(22, 16, 2, 4, '#d8b050'); p.rect(25, 16, 2, 3, '#d8b050'); },
  note: (p) => { p.rect(8, 8, 16, 18, '#e8dcb8'); p.rect(8, 8, 16, 3, '#c8b888'); p.rect(11, 14, 10, 1, '#6a5a3a'); p.rect(11, 17, 8, 1, '#6a5a3a'); p.rect(11, 20, 10, 1, '#6a5a3a'); p.disc(22, 24, 2.4, '#a83030'); },
};
/* ---------- 캐시 ---------- */
const cache = {};
function build(key, w, h, fn, o) { if (cache[key]) return cache[key]; const p = new Pix(w, h); fn(p); cache[key] = finish(p, o); return cache[key]; }
export function personSprite(look, fr = 0) { const f = LOOKS[look] || LOOKS.kid; return build(`L:${look}:${fr}`, 32, 32, p => f(p, fr)); }
export function monSprite(type, fr = 0) {
  if (BOSS[type]) return build(`B:${type}:${fr}`, 48, 48, p => BOSS[type](p, fr));
  const f = MON[type]; if (!f) return personSprite('kid', fr); return build(`M:${type}:${fr}`, 32, 32, p => f(p, fr));
}
export const isBigSprite = t => !!BOSS[t];
export function propSprite(name, z = 0) { const f = PROP[name]; if (!f) return null; return build(`P:${name}:${z}`, 32, 32, p => f(p, z)); }
export function itemSprite(kind, fr = 0) { const f = ITEM[kind]; if (!f) return null; return build(`I:${kind}:${fr}`, 32, 32, p => f(p, fr), { shade: false }); }
export function relicIcon(color) { return build(`R:${color}`, 32, 32, p => { p.disc(16, 16, 7, color); p.disc(16, 16, 4.5, shade(color, 0.35)); p.disc(14, 14, 1.8, '#ffffff'); p.ring = 1; }, { shade: false }); }
export const MONLIST = Object.keys(MON).concat(Object.keys(BOSS)), PROPLIST = Object.keys(PROP).filter(k => PROP[k]), LOOKLIST = Object.keys(LOOKS);
