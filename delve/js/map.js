// 지형, 던전/마을 생성, 시야, 경로
export const T = { FLOOR: 0, WALL: 1, PERM: 2, DOOR: 3, OPEN: 4, DOWN: 5, UP: 6, RUBBLE: 7, TRAP: 8, GRASS: 9, TREE: 10, SHOP: 11, WATER: 20, LAVA: 21, FOUNTAIN: 22, ALTAR: 23, CHEST: 24 };
export const isShop = t => t >= 11 && t <= 18;
export const MW = 84, MH = 46;
export const F = { KNOWN: 1, LIT: 2, ROOM: 4, VAULT: 8 };
export const walk = t => t === 0 || t === 4 || t === 5 || t === 6 || t === 8 || t === 9 || t >= 11;
export const opaque = t => t === 1 || t === 2 || t === 3 || t === 7;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const VAULTS = [
  ['XXXXXXXXXXX', 'X*.&...&.*X', 'X.XXX+XXX.X', 'X.X&.9.&X.X', 'X.XXXXXXX.X', 'X....^....X', 'XXXXX+XXXXX'],
  ['XXXXXXXXX', 'X&..^..&X', 'X.XX+XX.X', 'X.X*.*X.X', 'X^+.9.+^X', 'X.X*.*X.X', 'X.XX+XX.X', 'X&.....&X', 'XXXX+XXXX'],
  ['XXXXXXXXXXXXXXX', 'X*&.X.&*&.X.&*X', 'X.X.+.XXX.+.X.X', 'X...X..^..X...X', 'XXXXXXX+XXXXXXX'],
];

export function genDungeon(depth, R, opt = {}) {
  const cave = !opt.noCave && R.r() < (opt.caveP ?? 0.2);
  for (let attempt = 0; attempt < 60; attempt++) { const m = cave && attempt < 20 ? tryCave(depth, R, opt) : tryGen(depth, R, opt); if (m) { m.cave = cave && attempt < 20; return m; } }
  throw new Error('dungeon generation failed');
}
const passK = t => walk(t) || t === T.DOOR || t === T.RUBBLE;
// 용암을 막힌 칸으로 볼 때도 전부 이어져 있는지
function connected(w, h, t, start, noLava) {
  const ok = k => passK(t[k]) && !(noLava && t[k] === T.LAVA); let total = 0;
  for (let k = 0; k < w * h; k++) if (ok(k)) total++;
  const seen = new Uint8Array(w * h), st = [start]; seen[start] = 1; let cnt = 1;
  while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; for (const [dx, dy] of DIRS) { const n = (y + dy) * w + x + dx; if (!seen[n] && ok(n)) { seen[n] = 1; cnt++; st.push(n); } } }
  return cnt === total;
}
function pools(w, h, t, f, R, opt, cells) {
  if (!opt.pool || R.r() >= (opt.poolP || 0)) return;
  const tt = opt.pool === 'lava' ? T.LAVA : T.WATER, done = [];
  for (let b = 0, nb = 2 + R.ri(4); b < nb; b++) {
    let k = cells(); if (k < 0) continue; let x = k % w, y = (k / w) | 0;
    for (let n = 0, len = 6 + R.ri(18); n < len; n++) { const q = y * w + x; if (t[q] === T.FLOOR && !(f[q] & F.VAULT)) { t[q] = tt; done.push(q); } const d = DIRS[R.ri(4)]; const nx = x + d[0], ny = y + d[1]; if (nx > 1 && ny > 1 && nx < w - 2 && ny < h - 2 && (t[ny * w + nx] === T.FLOOR || t[ny * w + nx] === tt)) { x = nx; y = ny; } }
  }
  if (tt === T.LAVA && done.length) { const start = t.findIndex((v, k) => passK(v) && v !== T.LAVA); if (start < 0 || !connected(w, h, t, start, true)) for (const q of done) t[q] = T.FLOOR; }
}
function features(t, f, R, depth, cell) {
  const put = tt => { for (let n = 0; n < 30; n++) { const k = cell(); if (k >= 0 && t[k] === T.FLOOR && !(f[k] & F.VAULT)) { t[k] = tt; return; } } };
  if (R.r() < 0.3) put(T.FOUNTAIN); if (R.r() < 0.2) put(T.ALTAR);
  for (let n = 0, c = R.r() < 0.45 ? 1 + (R.r() < 0.25 ? 1 : 0) : 0; n < c; n++) put(T.CHEST);
}
function tryCave(depth, R, opt) {
  const w = MW, h = MH, n = w * h; let t = new Uint8Array(n).fill(T.WALL); const f = new Uint8Array(n), I = (x, y) => y * w + x;
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if (R.r() > 0.44) t[I(x, y)] = T.FLOOR;
  for (let it = 0; it < 5; it++) { const nt = t.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let c = 0; for (const [dx, dy] of DIRS) if (t[I(x + dx, y + dy)] !== T.FLOOR) c++; nt[I(x, y)] = c >= 5 || (it < 2 && c <= 1) ? T.WALL : T.FLOOR; } t = nt; }
  for (let x = 0; x < w; x++) { t[I(x, 0)] = T.PERM; t[I(x, h - 1)] = T.PERM; t[I(x, 1)] = t[I(x, h - 2)] = T.WALL; }
  for (let y = 0; y < h; y++) { t[I(0, y)] = T.PERM; t[I(w - 1, y)] = T.PERM; t[I(1, y)] = t[I(w - 2, y)] = T.WALL; }
  // 가장 큰 덩어리만 남긴다
  const comp = new Int32Array(n).fill(-1); let best = -1, bs = 0, id = 0;
  for (let k = 0; k < n; k++) { if (t[k] !== T.FLOOR || comp[k] >= 0) continue; const st = [k]; comp[k] = id; let c = 1; while (st.length) { const q = st.pop(), x = q % w, y = (q / w) | 0; for (const [dx, dy] of DIRS) { const m = I(x + dx, y + dy); if (t[m] === T.FLOOR && comp[m] < 0) { comp[m] = id; c++; st.push(m); } } } if (c > bs) { bs = c; best = id; } id++; }
  if (bs < 700) return null;
  const open = []; for (let k = 0; k < n; k++) { if (t[k] === T.FLOOR && comp[k] !== best) t[k] = T.WALL; else if (t[k] === T.FLOOR) open.push(k); }
  for (let i = 0; i < 6 + R.ri(6); i++) { const c = open[R.ri(open.length)], cx = c % w, cy = (c / w) | 0, rad = 2 + R.ri(3); if (R.r() < 0.5) for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) f[I(x, y)] |= F.LIT; }
  const plain = () => { for (let i = 0; i < 300; i++) { const k = open[R.ri(open.length)]; if (t[k] === T.FLOOR) return k; } return open[0]; };
  pools(w, h, t, f, R, opt, plain); features(t, f, R, depth, plain);
  for (let i = 0; i < 10 + R.ri(10); i++) { const k = plain(); if (R.r() < 0.5) t[k] = T.RUBBLE; }
  if (!connected(w, h, t, open.find(k => t[k] === T.FLOOR), false)) return null;
  const downs = [], ups = [];
  if (!opt.noDown) for (let i = 0; i < 2 + R.ri(2); i++) { const k = plain(); t[k] = T.DOWN; downs.push(k); }
  for (let i = 0; i < 1 + R.ri(2); i++) { const k = plain(); t[k] = T.UP; ups.push(k); }
  return { w, h, t, f, rooms: [], spots: { treasure: [], great: [], mon: [], trap: [] }, downs, ups, plain, pit: null };
}
function tryGen(depth, R, opt) {
  const w = MW, h = MH, t = new Uint8Array(w * h).fill(T.WALL), f = new Uint8Array(w * h), I = (x, y) => y * w + x;
  for (let x = 0; x < w; x++) { t[I(x, 0)] = T.PERM; t[I(x, h - 1)] = T.PERM; }
  for (let y = 0; y < h; y++) { t[I(0, y)] = T.PERM; t[I(w - 1, y)] = T.PERM; }
  const rooms = [], spots = { treasure: [], great: [], mon: [], trap: [] };
  const clash = (x, y, rw, rh) => rooms.some(r => x < r.x + r.w + 2 && x + rw + 2 > r.x && y < r.y + r.h + 2 && y + rh + 2 > r.y);
  if (depth >= 4 && R.r() < 0.12 + depth * 0.008) {
    const v = VAULTS[R.ri(VAULTS.length)], vw = v[0].length, vh = v.length, x = 3 + R.ri(w - vw - 6), y = 3 + R.ri(h - vh - 8);
    for (let j = 0; j < vh; j++) for (let i = 0; i < vw; i++) {
      const c = v[j][i], k = I(x + i, y + j); f[k] |= F.VAULT;
      t[k] = c === 'X' ? T.PERM : c === '+' ? T.DOOR : T.FLOOR;
      if (c === '*') spots.treasure.push(k); else if (c === '9') spots.great.push(k); else if (c === '&') spots.mon.push(k); else if (c === '^') spots.trap.push(k);
    }
    const dx = x + v[vh - 1].indexOf('+'); t[I(dx, y + vh)] = T.FLOOR;
    rooms.push({ x, y, w: vw, h: vh, vault: 1, cx: dx, cy: y + vh });
  }
  const want = 11 + R.ri(7);
  for (let n = 0; n < 200 && rooms.length < want + (rooms[0] && rooms[0].vault ? 1 : 0); n++) {
    const big = R.r() < 0.12, rw = big ? 12 + R.ri(8) : 4 + R.ri(9), rh = big ? 7 + R.ri(4) : 3 + R.ri(5), x = 2 + R.ri(w - rw - 4), y = 2 + R.ri(h - rh - 4);
    if (clash(x, y, rw, rh)) continue;
    const lit = R.r() < Math.max(0.12, 0.85 - depth * 0.035), kind = R.r();
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) { t[I(i, j)] = T.FLOOR; f[I(i, j)] |= F.ROOM; }
    if (kind < 0.14 && rw >= 5 && rh >= 5) { for (let j = y + 1; j < y + rh - 1; j += 2) for (let i = x + 1; i < x + rw - 1; i += 2) t[I(i, j)] = T.WALL; }
    else if (kind < 0.24 && rw >= 7 && rh >= 5) {            // 안쪽 방
      for (let j = y + 1; j < y + rh - 1; j++) for (let i = x + 1; i < x + rw - 1; i++) if (j === y + 1 || j === y + rh - 2 || i === x + 1 || i === x + rw - 2) t[I(i, j)] = T.WALL;
      t[I(x + 2 + R.ri(rw - 4), R.r() < 0.5 ? y + 1 : y + rh - 2)] = T.DOOR;
      const k = I(x + (rw >> 1), y + (rh >> 1)); if (rh >= 5 && t[k] === T.FLOOR) { spots.treasure.push(k); spots.mon.push(k + 1 < w * h && t[k + 1] === T.FLOOR ? k + 1 : k); }
    }
    if (lit) for (let j = y - 1; j <= y + rh; j++) for (let i = x - 1; i <= x + rw; i++) f[I(i, j)] |= F.LIT;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1), plain: kind >= 0.24 });
  }
  if (rooms.length < 5) return null;
  const order = rooms.slice().sort((a, b) => a.cx - b.cx);
  const carve = (x, y, px, py) => {
    const k = I(x, y);
    if (t[k] === T.PERM) return false;
    if (t[k] === T.WALL || t[k] === T.RUBBLE) {
      const nearRoom = DIRS.slice(0, 4).some(([dx, dy]) => (f[I(x + dx, y + dy)] & F.ROOM) && t[I(x + dx, y + dy)] === T.FLOOR);
      const horiz = px !== x, a = horiz ? I(x, y - 1) : I(x - 1, y), b = horiz ? I(x, y + 1) : I(x + 1, y);
      t[k] = nearRoom && !(f[k] & F.ROOM) && !walk(t[a]) && !walk(t[b]) && R.r() < 0.35 ? T.DOOR : T.FLOOR;
    }
    return true;
  };
  const tunnel = (a, b) => {
    let x = a.cx, y = a.cy; const hf = R.r() < 0.5;
    const stepX = () => { while (x !== b.cx) { const nx = x + Math.sign(b.cx - x); if (!carve(nx, y, x, y)) return false; x = nx; } return true; };
    const stepY = () => { while (y !== b.cy) { const ny = y + Math.sign(b.cy - y); if (!carve(x, ny, x, y)) return false; y = ny; } return true; };
    return hf ? stepX() && stepY() : stepY() && stepX();
  };
  for (let i = 0; i + 1 < order.length; i++) tunnel(order[i], order[i + 1]);
  for (let i = 0; i < 3; i++) tunnel(rooms[R.ri(rooms.length)], rooms[R.ri(rooms.length)]);
  for (let i = 0; i < 6 + R.ri(8); i++) { const x = 2 + R.ri(w - 4), y = 2 + R.ri(h - 4), k = I(x, y); if (t[k] === T.FLOOR && !(f[k] & (F.ROOM | F.VAULT)) && R.r() < 0.5) t[k] = T.RUBBLE; }
  // 연결성 검사: 모든 통행 가능 칸이 하나로 이어져야 한다
  let start = -1, total = 0;
  for (let k = 0; k < w * h; k++) if (walk(t[k]) || t[k] === T.DOOR || t[k] === T.RUBBLE) { total++; if (start < 0 && (f[k] & F.ROOM) && t[k] === T.FLOOR) start = k; }
  const seen = new Uint8Array(w * h), st = [start]; seen[start] = 1; let cnt = 1;
  while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; for (const [dx, dy] of DIRS) { const n = I(x + dx, y + dy); if (!seen[n] && (walk(t[n]) || t[n] === T.DOOR || t[n] === T.RUBBLE)) { seen[n] = 1; cnt++; st.push(n); } } }
  if (cnt !== total) return null;
  const plain = () => { for (let n = 0; n < 500; n++) { const r = rooms[R.ri(rooms.length)]; if (r.vault || r.pit) continue; const k = I(r.x + R.ri(r.w), r.y + R.ri(r.h)); if (t[k] === T.FLOOR) return k; } return start; };
  let pit = null;
  if (depth >= 5 && R.r() < 0.14) { const c = rooms.filter(r => !r.vault && r.plain && r.w >= 6 && r.h >= 4 && r.w * r.h <= 90); if (c.length) { const r = c[R.ri(c.length)]; r.pit = 1; pit = []; for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) if (t[I(i, j)] === T.FLOOR) pit.push(I(i, j)); } }
  pools(w, h, t, f, R, opt, plain); features(t, f, R, depth, plain);
  const downs = [], ups = [];
  if (!opt.noDown) for (let i = 0; i < 1 + R.ri(3); i++) { const k = plain(); t[k] = T.DOWN; downs.push(k); }
  for (let i = 0; i < 1 + R.ri(2); i++) { const k = plain(); t[k] = T.UP; ups.push(k); }
  return { w, h, t, f, rooms, spots, downs, ups, plain, pit };
}

export function genTown(R) {
  const w = 62, h = 24, t = new Uint8Array(w * h).fill(T.GRASS), f = new Uint8Array(w * h).fill(F.LIT | F.KNOWN), I = (x, y) => y * w + x;
  for (let x = 0; x < w; x++) { t[I(x, 0)] = T.PERM; t[I(x, h - 1)] = T.PERM; }
  for (let y = 0; y < h; y++) { t[I(0, y)] = T.PERM; t[I(w - 1, y)] = T.PERM; }
  const shops = [];
  for (let s = 0; s < 8; s++) {
    const bx = 4 + (s % 4) * 14, by = s < 4 ? 3 : 15, top = s < 4;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) t[I(bx + i, by + j)] = T.PERM;
    const ex = bx + 4, ey = top ? by + 4 : by; t[I(ex, ey)] = T.SHOP + s; shops.push(I(ex, ey));
  }
  for (let n = 0; n < 36; n++) { const x = 1 + R.ri(w - 2), y = 1 + R.ri(h - 2); if (t[I(x, y)] === T.GRASS && (y < 9 || y > 13) ) t[I(x, y)] = T.TREE; }
  for (const k of shops) { const x = k % w, y = (k / w) | 0; for (const [dx, dy] of DIRS) if (t[I(x + dx, y + dy)] === T.TREE) t[I(x + dx, y + dy)] = T.GRASS; }
  const down = I(w >> 1, 11); t[down] = T.DOWN;
  return { w, h, t, f, rooms: [{ x: 1, y: 9, w: w - 2, h: 5, cx: w >> 1, cy: 11 }], spots: { treasure: [], great: [], mon: [], trap: [] }, downs: [down], ups: [], plain: () => I(2 + R.ri(w - 4), 9 + R.ri(5)), town: 1 };
}

// 재귀 섀도캐스팅. out[k]=1 이면 시선이 닿는다.
const OCT = [[1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1], [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1]];
export function fov(m, px, py, rad, out) {
  out.fill(0); out[py * m.w + px] = 1;
  const cast = (row, s, e, xx, xy, yx, yy) => {
    if (s < e) return; let ns = 0;
    for (let d = row; d <= rad; d++) {
      let blocked = false;
      for (let dx = -d, dy = -d; dx <= 0; dx++) {
        const x = px + dx * xx + dy * xy, y = py + dx * yx + dy * yy, l = (dx - 0.5) / (dy + 0.5), r = (dx + 0.5) / (dy - 0.5);
        if (s < r) continue; if (e > l) break;
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        if (dx * dx + dy * dy <= rad * rad) out[y * m.w + x] = 1;
        const op = opaque(m.t[y * m.w + x]);
        if (blocked) { if (op) { ns = r; continue; } blocked = false; s = ns; }
        else if (op && d < rad) { blocked = true; cast(d + 1, s, l, xx, xy, yx, yy); ns = r; }
      }
      if (blocked) break;
    }
  };
  for (const o of OCT) cast(1, 1, 0, o[0], o[1], o[2], o[3]);
}
export function line(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy, x = x0, y = y0;
  for (let n = 0; n < 200 && (x !== x1 || y !== y1); n++) { const e2 = 2 * e; if (e2 > -dy) { e -= dy; x += sx; } if (e2 < dx) { e += dx; y += sy; } out.push([x, y]); }
  return out;
}
// 목표 칸들에서 퍼지는 거리장. pass(k)=통과 가능 여부.
export function flow(m, srcs, pass, max, out) {
  out.fill(32000); const q = new Int32Array(m.w * m.h); let qh = 0, qt = 0;
  for (const s of srcs) { out[s] = 0; q[qt++] = s; }
  while (qh < qt) {
    const k = q[qh++], d = out[k]; if (d >= max) continue; const x = k % m.w, y = (k / m.w) | 0;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue; const n = ny * m.w + nx; if (out[n] > d + 1 && pass(n)) { out[n] = d + 1; q[qt++] = n; } }
  }
  return out;
}
