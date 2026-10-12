// 시야(재귀 그림자 캐스팅)와 빛 계산
import { T, P } from './data.js';
import { W, H } from './gen.js';
export const OPAQUE_PROP = new Set([P.SHELF, P.ROOT, P.HOUSE, P.TREE, P.ORE, P.CRYSTAL, P.TORCH, P.FURNACE]);
export const opaqueAt = (f, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return true; const k = y * W + x; const t = f.t[k]; return t === T.WALL || t === T.DOOR || t === T.LOCKED || t === T.RUBBLE || OPAQUE_PROP.has(f.p[k]); };
const MULT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
// cb(x,y,dist2) 를 보이는 칸마다 호출
export function shadowcast(f, ox, oy, radius, cb) {
  cb(ox, oy, 0);
  for (let oct = 0; oct < 8; oct++) cast(f, ox, oy, radius, 1, 1.0, 0.0, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct], cb);
}
function cast(f, cx, cy, radius, row, start, end, xx, xy, yx, yy, cb) {
  if (start < end) return; const r2 = radius * radius; let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1, dy = -j, blocked = false;
    while (dx <= 0) {
      dx++; const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy, lS = (dx - 0.5) / (dy + 0.5), rS = (dx + 0.5) / (dy - 0.5);
      if (start < rS) continue; if (end > lS) break;
      const d2 = dx * dx + dy * dy; if (d2 <= r2 && X >= 0 && Y >= 0 && X < W && Y < H) cb(X, Y, d2);
      const op = opaqueAt(f, X, Y);
      if (blocked) { if (op) { newStart = rS; continue; } else { blocked = false; start = newStart; } }
      else if (op && j < radius) { blocked = true; cast(f, cx, cy, radius, j + 1, start, lS, xx, xy, yx, yy, cb); newStart = rS; }
    }
    if (blocked) break;
  }
}
// 고정 광원 목록 (소품/지형에서 추출)
export function collectLights(f) {
  const L = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, p = f.p[k], t = f.t[k];
    switch (p) {
      case P.BRAZIERLIT: L.push({ x, y, r: 6, i: 1.0, c: [255, 170, 80], fl: 1, sanct: 1 }); break;
      case P.CAMP: L.push({ x, y, r: 6, i: 0.95, c: [255, 160, 70], fl: 1, sanct: 1 }); break;
      case P.TORCH: L.push({ x, y: y + 1 > H - 1 ? y : y + 1, r: 4, i: 0.75, c: [255, 180, 90], fl: 1, wallsrc: y }); break;
      case P.FURNACE: L.push({ x, y, r: 5, i: 0.9, c: [255, 100, 40], fl: 1 }); break;
      case P.CRYSTAL: L.push({ x, y, r: 3, i: 0.6, c: f.zone === 4 ? [170, 130, 255] : [110, 200, 255], fl: 0, nolos: 1 }); break;
      case P.FUNGUS: L.push({ x, y, r: 3, i: 0.55, c: [120, 255, 150], fl: 0, nolos: 1 }); break;
      case P.CANDLE: L.push({ x, y, r: 3, i: 0.6, c: [255, 220, 130], fl: 1, nolos: 1 }); break;
      case P.ALTAR: L.push({ x, y, r: 3, i: 0.6, c: [255, 220, 120], fl: 0, nolos: 1 }); break;
      case P.LAMPPOST: L.push({ x, y, r: 6, i: 0.9, c: [255, 190, 100], fl: 1 }); break;
      case P.HOUSE: if (f.s[k] === 20) L.push({ x, y, r: 4, i: 0.65, c: [255, 190, 100], fl: 0, nolos: 1 }); break;
      case P.BRAZIER: break;
    }
    if (t === T.LAVA && ((x + y * 3) % 3 === 0)) L.push({ x, y, r: 3, i: 0.55, c: [255, 110, 40], fl: 0, nolos: 1 });
    if (t === T.WELL) L.push({ x, y, r: 5, i: 0.8, c: f.zone === 4 ? [190, 150, 255] : [255, 200, 120], fl: 1 });
    if (p === P.WELLPIT) L.push({ x, y, r: 6, i: 0.9, c: [255, 120, 50], fl: 1 });
    if (p === P.REMAINS) L.push({ x, y, r: 3, i: 0.55, c: [150, 200, 255], fl: 0, nolos: 1 });
  }
  return L;
}
// 고정광이 닿는 정도(0~1)와 성역(화로/모닥불 주변) 표시
export function staticLightMap(f, lights) {
  const sl = new Float32Array(W * H), sanct = new Uint8Array(W * H);
  for (const l of lights) {
    const add = (x, y, d2) => { const d = Math.sqrt(d2); if (d > l.r) return; const v = l.i * Math.pow(1 - d / (l.r + 0.01), 1.3); const k = y * W + x; if (v > sl[k]) sl[k] = v; if (l.sanct && d <= 3.2) sanct[k] = 1; };
    if (l.nolos) { for (let y = l.y - l.r; y <= l.y + l.r; y++) for (let x = l.x - l.r; x <= l.x + l.r; x++) if (x >= 0 && y >= 0 && x < W && y < H) add(x, y, (x - l.x) ** 2 + (y - l.y) ** 2); }
    else shadowcast(f, l.x, l.y, l.r, add);
  }
  return { sl, sanct };
}
