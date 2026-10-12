// 지형 타일 — 지역마다 다른 바닥/벽 질감을 코드로 만든다
import { mk, shade, mix, Pix, finish } from './pix.js';
import { ZONES } from './data.js';
const rnd = seed => { let s = seed * 2654435761 >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const cache = {};
const make = (key, fn, w = 32, h = 32) => { if (cache[key]) return cache[key]; const c = mk(w, h), g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, new Pix(w, h), c); cache[key] = c; return c; };
const fill = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const speck = (g, r, base, n, spread = 0.18) => { for (let i = 0; i < n; i++) { const x = (r() * 32) | 0, y = (r() * 32) | 0, d = (r() - 0.5) * 2 * spread; g.fillStyle = shade(base, d); g.fillRect(x, y, 1 + (r() < 0.3 ? 1 : 0), 1); } };
export function floorTile(z, v) {
  return make(`F${z}:${v}`, g => {
    const r = rnd(z * 97 + v * 31 + 5), Z = ZONES[z], base = Z.floor[v % 2];
    fill(g, base, 0, 0, 32, 32); speck(g, r, base, 70);
    if (z === 0) { // 흙길과 자갈
      for (let i = 0; i < 4; i++) { const x = (r() * 28) | 0, y = (r() * 28) | 0; fill(g, shade(base, 0.12), x, y, 3, 2); fill(g, shade(base, -0.22), x, y + 2, 3, 1); }
      if (v === 2) { g.strokeStyle = shade(base, -0.3); g.beginPath(); g.moveTo(4, 24); g.lineTo(12, 18); g.lineTo(20, 22); g.stroke(); }
    } else if (z === 1) { // 젖은 석판
      g.strokeStyle = shade(base, -0.35); g.lineWidth = 1; g.strokeRect(0.5, 0.5, 31, 31); g.beginPath(); g.moveTo(16.5, 0); g.lineTo(16.5, 14); g.moveTo(0, 14.5); g.lineTo(32, 14.5); g.moveTo(8.5, 14); g.lineTo(8.5, 32); g.moveTo(24.5, 14); g.lineTo(24.5, 32); g.stroke();
      fill(g, shade(base, 0.1), 1, 1, 14, 1); fill(g, shade(base, 0.1), 17, 1, 14, 1); if (v === 3) { g.fillStyle = 'rgba(80,140,190,0.3)'; g.fillRect(4, 18, 10, 6); }
    } else if (z === 2) { // 나무 바닥
      for (let y = 0; y < 32; y += 8) { fill(g, shade(base, ((y / 8 + v) % 2 ? -0.08 : 0.04)), 0, y, 32, 7); fill(g, shade(base, -0.4), 0, y + 7, 32, 1); const off = ((y / 8) * 11 + v * 7) % 28; fill(g, shade(base, -0.4), off, y, 1, 7); }
    } else if (z === 3) { // 쇠 격판
      for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) { fill(g, shade(base, ((x + y) / 16 + v) % 2 ? 0.06 : -0.06), x, y, 15, 15); fill(g, shade(base, -0.45), x + 15, y, 1, 16); fill(g, shade(base, -0.45), x, y + 15, 16, 1); fill(g, shade(base, 0.3), x + 2, y + 2, 2, 2); fill(g, shade(base, 0.3), x + 12, y + 12, 2, 2); }
    } else { // 룬 타일
      g.strokeStyle = shade(base, -0.4); g.strokeRect(0.5, 0.5, 31, 31); g.strokeStyle = shade(base, 0.25); g.beginPath(); g.moveTo(16, 8); g.lineTo(22, 16); g.lineTo(16, 24); g.lineTo(10, 16); g.closePath(); g.stroke();
      if (v === 1) fill(g, '#8a6aff', 15, 15, 2, 2);
    }
  });
}
export function wallFace(z, v) { // 정면 벽 (아래가 바닥)
  return make(`WF${z}:${v}`, g => {
    const r = rnd(z * 53 + v * 17 + 9), Z = ZONES[z], [mid, lite, dark] = Z.wall; fill(g, dark, 0, 0, 32, 32);
    if (z === 0 || z === 4) { // 거친 바위
      fill(g, mid, 0, 4, 32, 28); for (let i = 0; i < 9; i++) { const x = (r() * 28) | 0, y = 6 + ((r() * 20) | 0), w = 5 + ((r() * 8) | 0); fill(g, i % 2 ? lite : shade(mid, -0.14), x, y, w, 3); fill(g, dark, x, y + 3, w, 1); }
      speck(g, r, mid, 60, 0.22); if (z === 4) { for (let i = 0; i < 3; i++) fill(g, '#8a6aff', (r() * 28) | 0, 8 + ((r() * 18) | 0), 1, 3); }
    } else if (z === 1) { // 푸른 석벽
      for (let y = 4; y < 32; y += 8) for (let x = ((y / 8) % 2) * 8 - 8; x < 32; x += 16) { fill(g, mid, x + 1, y, 14, 7); fill(g, lite, x + 1, y, 14, 1); fill(g, dark, x + 1, y + 7, 14, 1); }
      fill(g, 'rgba(100,170,220,0.25)', 0, 20, 32, 12); speck(g, r, mid, 40, 0.18);
    } else if (z === 2) { // 나무 판자와 뿌리
      for (let x = 0; x < 32; x += 8) { fill(g, shade(mid, ((x / 8 + v) % 2) ? -0.06 : 0.05), x, 4, 7, 28); fill(g, dark, x + 7, 4, 1, 28); }
      g.strokeStyle = '#5a4228'; g.lineWidth = 2; g.beginPath(); g.moveTo(4 + v * 6, 4); g.quadraticCurveTo(14, 16, 8 + v * 4, 31); g.stroke(); fill(g, '#6ab058', 6, 22, 2, 2);
    } else { // 대장간 벽돌
      for (let y = 4; y < 32; y += 7) for (let x = ((y / 7 | 0) % 2) * 6 - 6; x < 32; x += 12) { fill(g, shade(mid, (r() - 0.5) * 0.18), x + 1, y, 11, 6); fill(g, lite, x + 1, y, 11, 1); } fill(g, 'rgba(255,100,40,0.18)', 0, 22, 32, 10);
    }
    fill(g, shade(lite, 0.2), 0, 4, 32, 2); fill(g, dark, 0, 0, 32, 4); fill(g, shade(dark, -0.2), 0, 29, 32, 3);
  });
}
export function wallTop(z, v) { // 위에서 본 벽 (아래도 벽)
  return make(`WT${z}:${v}`, g => { const r = rnd(z * 71 + v * 13 + 3), [mid, lite, dark] = ZONES[z].wall, b = shade(dark, -0.15); fill(g, b, 0, 0, 32, 32); speck(g, r, b, 50, 0.3); for (let i = 0; i < 3; i++) fill(g, shade(b, 0.18), (r() * 26) | 0, (r() * 26) | 0, 5, 3); });
}
export function villageGround(v) {
  return make(`VG${v}`, g => { const r = rnd(v * 11 + 3); fill(g, '#4a4034', 0, 0, 32, 32); speck(g, r, '#4a4034', 60, 0.14); for (let i = 0; i < 5; i++) fill(g, '#3a3226', (r() * 28) | 0, (r() * 28) | 0, 3, 2); });
}
export const decorTile = (id, z) => {
  return make(`D${id}:${z}`, g => {
    const r = rnd(id * 19 + z);
    switch (id) {
      case 1: fill(g, 'rgba(120,32,40,0.9)', 2, 0, 28, 32); fill(g, 'rgba(190,150,60,0.9)', 2, 0, 28, 2); fill(g, 'rgba(190,150,60,0.9)', 2, 30, 28, 2); for (let y = 6; y < 28; y += 8) fill(g, 'rgba(160,60,60,0.8)', 14, y, 4, 4); break;
      case 2: fill(g, '#2e2620', 0, 8, 32, 3); fill(g, '#2e2620', 0, 21, 32, 3); for (let x = 2; x < 32; x += 8) fill(g, '#6a4a2a', x, 6, 4, 20); fill(g, '#9aa0aa', 0, 9, 32, 1); fill(g, '#9aa0aa', 0, 22, 32, 1); break;
      case 3: for (let i = 0; i < 26; i++) fill(g, r() < 0.5 ? 'rgba(80,130,60,0.7)' : 'rgba(60,100,50,0.7)', (r() * 28) | 0, (r() * 28) | 0, 3, 2); break;
      case 4: g.fillStyle = 'rgba(220,214,196,0.9)'; g.fillRect(6, 20, 9, 2); g.fillRect(9, 17, 2, 7); g.fillRect(20, 10, 3, 3); g.fillRect(21, 13, 1, 6); break;
      case 5: fill(g, 'rgba(70,110,150,0.45)', 6, 10, 18, 10); fill(g, 'rgba(140,190,230,0.35)', 8, 11, 8, 2); break;
      case 6: g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, 6); g.lineTo(11, 12); g.lineTo(9, 21); g.lineTo(20, 27); g.moveTo(11, 12); g.lineTo(22, 10); g.stroke(); break;
      case 7: for (let i = 0; i < 22; i++) fill(g, 'rgba(70,64,60,0.6)', (r() * 28) | 0, (r() * 28) | 0, 2, 1); break;
      case 8: for (let y = 0; y < 32; y += 8) { fill(g, '#7a5a34', 0, y, 32, 7); fill(g, '#4a341c', 0, y + 7, 32, 1); } break;
      case 9: for (let i = 0; i < 60; i++) { const c = ['#5a7a3a', '#4a6a30', '#6a8a44'][i % 3]; fill(g, c, (r() * 31) | 0, (r() * 29) | 0, 1, 3); } break;
      case 10: fill(g, '#6a5a44', 0, 0, 32, 32); for (let i = 0; i < 18; i++) fill(g, r() < 0.5 ? '#7a6a52' : '#564836', (r() * 28) | 0, (r() * 28) | 0, 4, 3); break;
    }
  });
};
export function waterTile(fr, deep) {
  return make(`WA${fr}:${deep ? 1 : 0}`, g => {
    const base = deep ? '#14304a' : '#285a7e'; fill(g, base, 0, 0, 32, 32); const t = fr * 8;
    for (let y = 3; y < 32; y += 7) { const off = ((y * 5 + t) % 32); fill(g, deep ? '#1e4666' : '#4a8ab0', off, y, 10, 1); fill(g, deep ? '#1e4666' : '#4a8ab0', (off + 18) % 32, y + 3, 7, 1); }
    if (!deep) fill(g, 'rgba(200,230,250,0.25)', (fr * 9 + 6) % 28, 12, 3, 1);
  });
}
export function lavaTile(fr) {
  return make(`LV${fr}`, g => {
    fill(g, '#8a2208', 0, 0, 32, 32); const r = rnd(5 + fr);
    for (let i = 0; i < 12; i++) { const x = (r() * 28) | 0, y = (r() * 28) | 0; fill(g, i % 3 ? '#e85a1a' : '#ffb040', x, y, 4 + ((r() * 5) | 0), 2); }
    for (let y = 2 + fr * 2; y < 32; y += 9) fill(g, '#ffd060', (y * 7) % 26, y, 6, 1);
    fill(g, '#5a1204', ((fr * 11) % 24), 20, 5, 3);
  });
}
export function chasmTile() { return make('CH', (g) => { fill(g, '#050308', 0, 0, 32, 32); const r = rnd(2); for (let i = 0; i < 20; i++) fill(g, '#0e0a14', (r() * 30) | 0, (r() * 30) | 0, 2, 2); }); }
export function cliffTile(z) { return make(`CL${z}`, g => { const [mid, lite, dark] = ZONES[z].wall; fill(g, dark, 0, 0, 32, 14); for (let x = 0; x < 32; x += 6) fill(g, shade(mid, -0.1), x, 0, 5, 10 + ((x * 7) % 4)); fill(g, lite, 0, 0, 32, 2); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 14, 32, 4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 18, 32, 4); }); }
export function bridgeTile() { return make('BR', g => { fill(g, '#050308', 0, 0, 32, 32); for (let x = 0; x < 32; x += 8) { fill(g, '#8a6a3a', x, 2, 7, 28); fill(g, '#5a4220', x + 7, 2, 1, 28); fill(g, '#a8844a', x, 2, 7, 2); } fill(g, '#4a341c', 0, 0, 32, 3); fill(g, '#4a341c', 0, 29, 32, 3); }); }
export function doorTile(state) { // closed / open / locked
  return make(`DR${state}`, g => {
    fill(g, '#2a1a10', 0, 0, 32, 32);
    if (state === 'open') { fill(g, '#0a0604', 6, 6, 20, 26); fill(g, '#5a3a1e', 3, 4, 4, 28); fill(g, '#5a3a1e', 25, 4, 4, 28); fill(g, '#4a2e18', 3, 2, 26, 4); return; }
    fill(g, '#6a4424', 5, 6, 22, 26); for (let x = 5; x < 27; x += 5) fill(g, '#4a2e18', x + 4, 6, 1, 26); fill(g, '#8a5e32', 5, 6, 22, 2); fill(g, '#3a3a40', 5, 12, 22, 2); fill(g, '#3a3a40', 5, 24, 22, 2); fill(g, '#5a3a1e', 3, 4, 3, 28); fill(g, '#5a3a1e', 26, 4, 3, 28); fill(g, '#4a2e18', 3, 2, 26, 4);
    if (state === 'locked') { fill(g, '#d8b050', 12, 15, 8, 8); fill(g, '#2a1a08', 15, 17, 2, 4); fill(g, '#9a8a60', 13, 11, 6, 4); fill(g, '#2a2a30', 14, 12, 4, 3); } else { fill(g, '#d8b050', 22, 17, 3, 3); }
  });
}
export function rubbleTile(z) { return make(`RB${z}`, g => { const r = rnd(8); const base = ZONES[z].wall[0]; fill(g, ZONES[z].floor[0], 0, 0, 32, 32); for (let i = 0; i < 9; i++) { const x = 3 + ((r() * 22) | 0), y = 8 + ((r() * 18) | 0), w = 4 + ((r() * 7) | 0), h = 3 + ((r() * 5) | 0); fill(g, shade(base, 0.1 + r() * 0.2), x, y, w, h); fill(g, shade(base, -0.3), x, y + h - 1, w, 1); } }); }
export function wellTile(z) { return make(`WL${z}`, g => { const c = z === 4 ? ['#6a4ab8', '#a88aff'] : ['#7a4018', '#ffb050']; fill(g, ZONES[Math.max(0, z)]?.floor[0] || '#444', 0, 0, 32, 32); const p = new Pix(32, 32); p.ell(16, 18, 14, 11, '#6a645c'); p.ell(16, 18, 11, 8, '#2a2622'); p.ell(16, 19, 9, 6, c[0]); p.ell(16, 20, 5, 3, c[1]); finish(p, { shade: false }); g.drawImage(p.c, 0, 0); }); }
export function shadowGrad() { return make('SG', g => { const gr = g.createLinearGradient(0, 0, 0, 14); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 14); }); }
export function houseTile(kind, lit) {
  return make(`HS${kind}:${lit ? 1 : 0}`, g => {
    if (kind === 1) { fill(g, '#5a2e22', 0, 4, 32, 28); for (let y = 6; y < 32; y += 6) fill(g, '#7a4030', 0, y, 32, 4); fill(g, '#3a1e16', 0, 28, 32, 4); fill(g, '#8a5040', 0, 4, 32, 2); }
    else { fill(g, '#8a7a62', 0, 0, 32, 32); for (let x = 0; x < 32; x += 8) fill(g, '#6a5c48', x + 7, 0, 1, 32); fill(g, '#4a3e30', 0, 0, 32, 3); if (kind === 3) { fill(g, '#2a1a10', 8, 6, 16, 26); fill(g, '#5a3a1e', 9, 7, 14, 25); fill(g, '#d8b050', 19, 20, 2, 2); } if (lit) { fill(g, '#3a2a18', 8, 8, 16, 14); fill(g, '#ffd27a', 9, 9, 14, 12); fill(g, '#c08a3a', 15, 9, 2, 12); fill(g, '#c08a3a', 9, 14, 14, 2); } else if (kind !== 3) { fill(g, '#2a2a30', 10, 10, 12, 10); } }
  });
}
