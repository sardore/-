// 던전 생성: 동굴 위에 구조물을 "찍고", 벽을 허물고, 물/용암을 흘리고, 막힌 곳은 터널·다리로 잇는다.
import { RNG } from './rng.js';
import { T, P, DECOR, ZONES, zoneOf, isBossFloor, FLOORS_PER_ZONE, BLOCK } from './data.js';
import { PREFABS, BOSS_ARENAS } from './prefabs.js';

export const W = 52, H = 36;
const I = (x, y) => y * W + x;
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const D8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;

export const passT = t => t === T.FLOOR || t === T.DOOR || t === T.DOOROPEN || t === T.BRIDGE || t === T.WATER || t === T.WELL || t === T.GROUND;
export const hardT = t => t === T.LAVA || t === T.DEEP || t === T.CHASM;   // 지나갈 수 없는 지형(다리는 놓을 수 있다)

function xform(rows, op) {
  let g = rows.map(r => r.split(''));
  if (op & 4) { const h = g.length, w = g[0].length, n = []; for (let x = 0; x < w; x++) { const row = []; for (let y = 0; y < h; y++) row.push(g[y][x]); n.push(row); } g = n; }
  if (op & 1) g = g.map(r => r.slice().reverse());
  if (op & 2) g = g.slice().reverse();
  return g;
}
function charCell(c) {
  switch (c) {
    case '#': return { t: T.WALL }; case '.': return { t: T.FLOOR }; case ',': return { t: T.FLOOR, s: DECOR.CRACK }; case ';': return { t: T.FLOOR, s: DECOR.BONES };
    case 'x': return { t: T.FLOOR, s: DECOR.CARPET }; case 'r': return { t: T.FLOOR, s: DECOR.RAIL };
    case '+': return { t: T.DOOR }; case 'L': return { t: T.LOCKED }; case '~': return { t: T.WATER }; case '=': return { t: T.DEEP }; case '%': return { t: T.LAVA }; case "'": return { t: T.CHASM }; case ':': return { t: T.BRIDGE };
    case 'p': return { t: T.FLOOR, p: P.PILLAR }; case 's': return { t: T.FLOOR, p: P.STATUE }; case 'b': return { t: T.FLOOR, p: P.SHELF }; case 'B': return { t: T.FLOOR, p: P.BRAZIER };
    case 'f': return { t: T.FLOOR, p: P.CAMP }; case 'a': return { t: T.FLOOR, p: P.ALTAR }; case 'c': return { t: T.FLOOR, p: P.CHEST }; case 'g': return { t: T.FLOOR, p: P.GRAVE };
    case 'A': return { t: T.FLOOR, p: P.ANVIL }; case 'F': return { t: T.FLOOR, p: P.FURNACE }; case 'm': return { t: T.FLOOR, p: P.CART, s: DECOR.RAIL }; case 'n': return { t: T.FLOOR, p: P.BARREL };
    case 'e': return { t: T.FLOOR, p: P.PEW }; case 't': return { t: T.FLOOR, p: P.TABLE }; case 'v': return { t: T.FLOOR, p: P.VENT }; case '^': return { t: T.FLOOR, p: P.SPIKE };
    case 'w': return { t: T.FLOOR, p: P.WEB }; case 'k': return { t: T.FLOOR, p: P.CANDLE }; case 'u': return { t: T.FLOOR, p: P.FUNGUS }; case 'R': return { t: T.FLOOR, p: P.ROOT };
    case 'M': return { t: T.FLOOR, p: P.MIRROR }; case 'l': return { t: T.FLOOR, p: P.BELL }; case 'W': return { t: T.WELL };
    case 'T': return { t: T.WALL, p: P.TORCH }; case 'C': return { t: T.WALL, p: P.CRYSTAL }; case 'o': return { t: T.WALL, p: P.ORE };
    case 'N': case 'E': case 'Q': case 'K': return { t: T.FLOOR, slot: c };
  }
  return null;
}

class MinHeap { constructor() { this.a = []; } push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; } }

export function genFloor(seed, depth, opt = {}) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const f = tryGen(seed + attempt * 7919, depth, attempt);
    if (f) { f.attempt = attempt; return f; }
  }
  throw new Error('floor generation failed: depth ' + depth);
}

function tryGen(seed, depth, attempt) {
  const R = RNG(seed), z = zoneOf(depth), Z = ZONES[z], boss = isBossFloor(depth), fz = depth % FLOORS_PER_ZONE;
  const t = new Uint8Array(W * H).fill(T.WALL), p = new Uint8Array(W * H), s = new Uint8Array(W * H), fixed = new Uint8Array(W * H);
  const slots = { E: [], N: [], Q: [], K: [] };
  const placed = []; // {x,y,w,h,kind,name}
  const f = { depth, zone: z, boss, w: W, h: H, t, p, s, slots, boxes: placed, seed, arena: null };

  /* 1. 동굴 */
  const open = z === 4 ? 0.27 : z === 2 ? 0.24 : 0.30 + R.r() * 0.03;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (R.r() < open + 0.12) t[I(x, y)] = T.FLOOR;
  for (let it = 0; it < 4; it++) { const n = t.slice(); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let c = 0; for (const [dx, dy] of D8) if (t[I(x + dx, y + dy)] === T.WALL) c++; n[I(x, y)] = c >= 5 ? T.WALL : T.FLOOR; } t.set(n); }
  for (let x = 0; x < W; x++) { t[I(x, 0)] = t[I(x, H - 1)] = T.WALL; } for (let y = 0; y < H; y++) { t[I(0, y)] = t[I(W - 1, y)] = T.WALL; }

  /* 2. 구조물 찍기 */
  const stamp = (pf, x0, y0, op) => {
    const g = xform(pf.rows, op), h = g.length, w = g[0].length;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const c = g[yy][xx]; if (c === ' ') continue; const cell = charCell(c); if (!cell) continue; const k = I(x0 + xx, y0 + yy);
      t[k] = cell.t; p[k] = cell.p || 0; s[k] = cell.s || 0; fixed[k] = 1; if (cell.slot) slots[cell.slot].push({ x: x0 + xx, y: y0 + yy });
    }
    return { x: x0, y: y0, w, h };
  };
  const tryPlace = (pf, region, tries = 60) => {
    for (let n = 0; n < tries; n++) {
      const op = pf.kind === 'boss' ? 0 : R.ri(8), g = xform(pf.rows, op), h = g.length, w = g[0].length;
      const [rx0, ry0, rx1, ry1] = region(w, h); if (rx1 < rx0 || ry1 < ry0) continue;
      const x0 = R.range(rx0, rx1), y0 = R.range(ry0, ry1);
      if (x0 < 2 || y0 < 2 || x0 + w > W - 2 || y0 + h > H - 2) continue;
      if (placed.some(b => x0 < b.x + b.w + 2 && x0 + w + 2 > b.x && y0 < b.y + b.h + 2 && y0 + h + 2 > b.y)) continue;
      const bb = stamp(pf, x0, y0, op); const rec = { ...bb, kind: pf.kind, name: pf.name, op }; placed.push(rec); return rec;
    }
    return null;
  };
  const byName = n => PREFABS.find(q => q.name === n);
  const anywhere = () => [2, 2, W - 3, H - 3];
  let exitBox = null, arenaBox = null;
  if (boss) {
    const rows = BOSS_ARENAS[Z.boss], pf = { name: 'arena', kind: 'boss', rows: rows.map(r => r.padEnd(rows[0].length)) };
    arenaBox = tryPlace(pf, (w, h) => [W - w - 4, 4, W - w - 3, H - h - 4], 80); if (!arenaBox) return null;
    f.arena = { ...arenaBox, cx: arenaBox.x + (arenaBox.w >> 1), cy: arenaBox.y + 4, doors: [] };
    for (let y = arenaBox.y; y < arenaBox.y + arenaBox.h; y++) for (let x = arenaBox.x; x < arenaBox.x + arenaBox.w; x++) if (t[I(x, y)] === T.DOOR) f.arena.doors.push({ x, y });
    // 보스방 바닥 가운데는 비워 둔다(우물이 나중에 솟는다)
    f.exit = { x: f.arena.cx, y: f.arena.cy + 1 };
  } else {
    exitBox = tryPlace(byName('exit_shrine'), (w, h) => [W - w - 4, 3, W - w - 3, H - h - 3], 120); if (!exitBox) return null;
  }
  tryPlace(byName('camp_nook'), (w, h) => [Math.floor(W * 0.28), 3, Math.floor(W * 0.6), H - h - 3]);
  if (!boss && R.chance(0.7)) tryPlace(byName('altar_hall'), anywhere);
  if (!boss && R.chance(0.45)) tryPlace(byName('vault'), anywhere);
  const pool = PREFABS.filter(q => q.kind === 'normal' && (!q.zones || q.zones.includes(z)));
  const want = boss ? 2 + R.ri(2) : 4 + R.ri(3);
  const used = {};
  for (let i = 0, got = 0, guard = 0; got < want && guard < 60; guard++) {
    const pf = R.wpick(pool, q => (used[q.name] || 0) >= 2 ? 0.0001 : q.weight); if ((used[pf.name] || 0) >= 2) continue; if (tryPlace(pf, anywhere)) { got++; used[pf.name] = (used[pf.name] || 0) + 1; }
  }

  /* 3. 구조물 벽 침식 — 창문/균열로 동굴과 이어진다 */
  const ruin = [0.10, 0.08, 0.12, 0.07, 0.04][z];
  for (const b of placed) {
    if (b.kind === 'exit' || b.kind === 'vault' || b.kind === 'boss') continue;
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      const k = I(x, y); if (t[k] !== T.WALL || p[k]) continue;
      const ns = passT(t[I(x, y - 1)]) && passT(t[I(x, y + 1)]), ew = passT(t[I(x - 1, y)]) && passT(t[I(x + 1, y)]);
      if ((ns || ew) && R.chance(ruin)) { t[k] = T.FLOOR; s[k] = DECOR.CRACK; fixed[k] = 0; }
    }
  }
  // 문 앞은 반드시 열어 둔다
  for (const b of placed) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const k = I(x, y); if (t[k] !== T.DOOR && t[k] !== T.LOCKED) continue;
    for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const nk = I(nx, ny); if (t[nk] === T.WALL && !fixed[nk]) { t[nk] = T.FLOOR; } }
  }

  /* 4. 지역 지형 */
  const cells = (pred) => { const a = []; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (pred(x, y, I(x, y))) a.push([x, y]); return a; };
  const free = (x, y, k = I(x, y)) => t[k] === T.FLOOR && !p[k] && !fixed[k];
  const blob = (cx, cy, n, set) => { let x = cx, y = cy; for (let i = 0; i < n; i++) { if (inb(x, y) && !fixed[I(x, y)]) set(x, y); const [dx, dy] = D4[R.ri(4)]; x = Math.max(2, Math.min(W - 3, x + dx)); y = Math.max(2, Math.min(H - 3, y + dy)); } };
  const river = (type, shore, width) => { // 가로 또는 세로로 굽이치는 강
    const vert = R.chance(0.5); let a = vert ? R.range(W * 0.35, W * 0.65) | 0 : R.range(H * 0.3, H * 0.7) | 0; const len = vert ? H : W;
    for (let u = 1; u < len - 1; u++) { a += R.ri(3) - 1; a = Math.max(4, Math.min((vert ? W : H) - 5, a));
      for (let d = -width; d <= width; d++) { const x = vert ? a + d : u, y = vert ? u : a + d; if (!inb(x, y) || fixed[I(x, y)]) continue; const k = I(x, y);
        if (Math.abs(d) === width && shore != null) { if (t[k] === T.WALL) t[k] = T.FLOOR; if (t[k] === T.FLOOR) t[k] = shore; } else { if (t[k] === T.WALL) t[k] = T.FLOOR; t[k] = type; } } }
  };
  if (z === 0) {
    // 레일: 서로 먼 두 바닥 칸을 잇는 선
    for (let r = 0, n = 1 + R.ri(2); r < n; r++) { const fl = cells(free); if (fl.length < 20) break; const a = R.pick(fl), b = R.pick(fl); let x = a[0], y = a[1], guard = 0;
      while ((x !== b[0] || y !== b[1]) && guard++ < 120) { const k = I(x, y); if (free(x, y) && !s[k]) s[k] = DECOR.RAIL; if (R.chance(0.5) && x !== b[0]) x += Math.sign(b[0] - x); else if (y !== b[1]) y += Math.sign(b[1] - y); else x += Math.sign(b[0] - x); if (!inb(x, y)) break; if (t[I(x, y)] !== T.FLOOR) { /* 벽이면 멈춘다 */ break; } } }
    for (const [x, y] of R.shuffle(cells((x, y, k) => t[k] === T.WALL && !fixed[k] && D4.some(([dx, dy]) => passT(t[I(x + dx, y + dy)])))).slice(0, 14)) { p[I(x, y)] = R.chance(0.6) ? P.ORE : P.CRYSTAL; }
    for (let i = 0, n = R.range(1, 2); i < n; i++) { const c = R.pick(cells(free)); if (c) blob(c[0], c[1], 9 + R.ri(8), (x, y) => { if (free(x, y)) t[I(x, y)] = T.CHASM; }); }
  } else if (z === 1) {
    if (R.chance(0.7)) river(T.DEEP, T.WATER, 1 + R.ri(2));
    for (let i = 0, n = 2 + R.ri(3); i < n; i++) { const c = R.pick(cells(free)); if (c) blob(c[0], c[1], 18 + R.ri(24), (x, y) => { if (free(x, y)) t[I(x, y)] = T.WATER; }); }
    for (const [x, y] of cells(free)) if (t[I(x, y)] === T.WATER && D8.every(([dx, dy]) => t[I(x + dx, y + dy)] === T.WATER) && R.chance(0.7)) t[I(x, y)] = T.DEEP;
  } else if (z === 2) {
    for (const [x, y] of R.shuffle(cells((x, y, k) => free(x, y, k) && D4.some(([dx, dy]) => t[I(x + dx, y + dy)] === T.WALL))).slice(0, 26)) p[I(x, y)] = R.chance(0.55) ? P.ROOT : P.FUNGUS;
    for (let i = 0; i < 3; i++) { const c = R.pick(cells(free)); if (c) blob(c[0], c[1], 14, (x, y) => { if (free(x, y)) s[I(x, y)] = DECOR.MOSS; }); }
  } else if (z === 3) {
    if (R.chance(0.8)) river(T.LAVA, T.FLOOR, 1 + R.ri(2));
    for (let i = 0, n = 1 + R.ri(2); i < n; i++) { const c = R.pick(cells(free)); if (c) blob(c[0], c[1], 14 + R.ri(10), (x, y) => { if (free(x, y)) t[I(x, y)] = T.LAVA; }); }
    for (const [x, y] of R.shuffle(cells((x, y, k) => free(x, y, k) && D4.some(([dx, dy]) => t[I(x + dx, y + dy)] === T.LAVA))).slice(0, 4)) p[I(x, y)] = P.VENT;
  } else {
    for (let i = 0, n = 3 + R.ri(3); i < n; i++) { const c = R.pick(cells(free)); if (c) blob(c[0], c[1], 26 + R.ri(30), (x, y) => { if (free(x, y)) t[I(x, y)] = T.CHASM; }); }
  }
  // 공통 장식
  for (const [x, y] of R.shuffle(cells(free)).slice(0, 22)) s[I(x, y)] = R.pick([DECOR.BONES, DECOR.CRACK, DECOR.PUDDLE, DECOR.MOSS, DECOR.CRACK]);
  for (const [x, y] of R.shuffle(cells(free)).slice(0, 6 + z)) p[I(x, y)] = P.STALAG;
  for (const [x, y] of R.shuffle(cells(free)).slice(0, 3 + (fz > 0 ? 2 : 0) + z)) p[I(x, y)] = P.SPIKE;
  for (const [x, y] of R.shuffle(cells((x, y, k) => free(x, y, k))).slice(0, 8)) if (!p[I(x, y)] && z !== 1) p[I(x, y)] = P.WEB;
  // 벽 횃불
  for (const [x, y] of R.shuffle(cells((x, y, k) => t[k] === T.WALL && !p[k] && !fixed[k] && passT(t[I(x, y + 1)]))).slice(0, 7)) p[I(x, y)] = P.TORCH;

  /* 5. 연결 — 막힌 곳은 터널을 파고, 강/심연은 다리를 놓는다 */
  const key = (x, y) => I(x, y);
  const walkableForConn = (k) => passT(t[k]) && !BLOCK.has(p[k]);
  for (let iter = 0; iter < 30; iter++) {
    const reg = new Int32Array(W * H).fill(-1); const sizes = []; let rn = 0;
    for (let k = 0; k < W * H; k++) { if (reg[k] >= 0 || !walkableForConn(k)) continue; const st = [k]; reg[k] = rn; let c = 0;
      while (st.length) { const q = st.pop(); c++; const x = q % W, y = (q / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const nk = I(nx, ny); if (reg[nk] < 0 && walkableForConn(nk)) { reg[nk] = rn; st.push(nk); } } } sizes.push(c); rn++; }
    if (rn <= 1) break;
    let main = 0; for (let i = 1; i < rn; i++) if (sizes[i] > sizes[main]) main = i;
    // 가장 작은 분리 지역부터 잇는다
    let tgt = -1; for (let i = 0; i < rn; i++) if (i !== main && (tgt < 0 || sizes[i] < sizes[tgt])) tgt = i;
    const dist = new Float64Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1), hp = new MinHeap();
    for (let k = 0; k < W * H; k++) if (reg[k] === tgt) { dist[k] = 0; hp.push(0, k); }
    let goal = -1;
    while (hp.size) { const [d, k] = hp.pop(); if (d > dist[k]) continue; if (reg[k] === main) { goal = k; break; } const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const nk = I(nx, ny); let c;
        if (walkableForConn(nk)) c = 1; else if (hardT(t[nk])) c = 5; else if (BLOCK.has(p[nk]) && t[nk] !== T.WALL) c = fixed[nk] ? 400 : 12; else if (t[nk] === T.WALL) c = fixed[nk] ? 40 : (p[nk] ? 6 : 3); else c = 2;
        c += R.r() * 0.7; const nd = d + c; if (nd < dist[nk]) { dist[nk] = nd; prev[nk] = k; hp.push(nd, nk); } } }
    if (goal < 0) return null;
    for (let k = goal; k >= 0 && reg[k] !== tgt; k = prev[k]) {
      if (walkableForConn(k)) continue;
      if (hardT(t[k])) { t[k] = T.BRIDGE; p[k] = 0; } else if (t[k] === T.WALL && fixed[k] && t[k] !== T.DOOR) { t[k] = T.DOOR; } else { if (t[k] === T.WALL || t[k] === T.RUBBLE || t[k] === T.LOCKED) t[k] = T.FLOOR; if (!fixed[k]) p[k] = 0; }
      if (!fixed[k] && R.chance(0.35)) { const [dx, dy] = D4[R.ri(4)], nk = I(k % W + dx, ((k / W) | 0) + dy); if (inb(k % W + dx, ((k / W) | 0) + dy) && t[nk] === T.WALL && !fixed[nk] && !p[nk]) t[nk] = T.FLOOR; }
    }
  }

  /* 6. 출발점 */
  const spawnCands = cells((x, y, k) => x < W * 0.3 && free(x, y, k) && D8.every(([dx, dy]) => passT(t[I(x + dx, y + dy)]) || t[I(x + dx, y + dy)] === T.WALL));
  if (!spawnCands.length) return null;
  const sp = R.pick(spawnCands); f.spawn = { x: sp[0], y: sp[1] };
  // 출구 (우물)
  if (!boss) { const ex = placed.find(b => b.kind === 'exit'); for (let y = ex.y; y < ex.y + ex.h; y++) for (let x = ex.x; x < ex.x + ex.w; x++) if (t[I(x, y)] === T.WELL) f.exit = { x, y }; }
  if (!f.exit) return null;

  /* 7. 검증: 도달 가능한가 */
  const reach = reachable(f, f.spawn);
  const adj = (x, y) => D4.some(([dx, dy]) => reach[I(x + dx, y + dy)]) || reach[I(x, y)];
  if (!boss && !adj(f.exit.x, f.exit.y)) return null;
  if (boss) { if (!f.arena.doors.some(d => adj(d.x, d.y))) return null; }
  const camp = placed.find(b => b.kind === 'camp'); if (!camp) return null;
  // 슬롯/상호작용 위치 수집
  f.reach = reach;
  const eList = [], iList = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const k = I(x, y); if (!reach[k] || t[k] !== T.FLOOR && t[k] !== T.BRIDGE) continue; if (p[k]) continue;
    const d = Math.abs(x - f.spawn.x) + Math.abs(y - f.spawn.y);
    iList.push({ x, y }); if (d > 9) eList.push({ x, y });
  }
  f.free = iList; f.far = eList;
  // 접근 가능한 슬롯만
  for (const kk of ['E', 'N', 'Q', 'K']) f.slots[kk] = f.slots[kk].filter(q => reach[I(q.x, q.y)]);
  // 추가 화로 (큰 빈터)
  f.braziers = [];
  for (const b of placed) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (p[I(x, y)] === P.BRAZIER) f.braziers.push({ x, y });
  const extra = R.shuffle(iList.filter(c => D8.every(([dx, dy]) => t[I(c.x + dx, c.y + dy)] === T.FLOOR && !BLOCK.has(p[I(c.x + dx, c.y + dy)])) && (Math.abs(c.x - f.spawn.x) + Math.abs(c.y - f.spawn.y) > 6)));
  for (const c of extra) { if (f.braziers.length >= (boss ? 3 : 5)) break; if (f.braziers.some(b => Math.abs(b.x - c.x) + Math.abs(b.y - c.y) < 11)) continue; p[I(c.x, c.y)] = P.BRAZIER; f.braziers.push({ x: c.x, y: c.y }); }
  // 근처 안전한 시작 화로
  f.camp = null; for (let y = camp.y; y < camp.y + camp.h; y++) for (let x = camp.x; x < camp.x + camp.w; x++) if (p[I(x, y)] === P.CAMP) f.camp = { x, y };
  // 제단/상자/무덤 목록
  f.altars = []; f.chests = []; f.vaultChests = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = I(x, y); if (p[k] === P.ALTAR) f.altars.push({ x, y }); else if (p[k] === P.CHEST) { const vb = placed.find(b => b.kind === 'vault' && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); (vb ? f.vaultChests : f.chests).push({ x, y }); } }
  f.hasVault = placed.some(b => b.kind === 'vault');
  return f;
}

// 열쇠 없이 걸어갈 수 있는 곳 (잠긴 문, 용암, 심연, 깊은 물, 막는 소품 제외)
export function reachable(f, from, extra) {
  const { t, p } = f, seen = new Uint8Array(W * H), st = [I(from.x, from.y)]; seen[st[0]] = 1;
  while (st.length) { const k = st.pop(), x = k % W, y = (k / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const nk = I(nx, ny); if (seen[nk]) continue;
    const ok = passT(t[nk]) && !BLOCK.has(p[nk]) || (extra && extra(nk)); if (ok) { seen[nk] = 1; st.push(nk); } } }
  return seen;
}
export function ascii(f) {
  const ch = { [T.WALL]: '#', [T.FLOOR]: '.', [T.DOOR]: '+', [T.DOOROPEN]: '/', [T.LOCKED]: 'L', [T.WATER]: '~', [T.DEEP]: '=', [T.LAVA]: '%', [T.CHASM]: ' ', [T.BRIDGE]: ':', [T.RUBBLE]: 'x', [T.WELL]: 'W' };
  const pc = { [P.PILLAR]: 'p', [P.STATUE]: 's', [P.SHELF]: 'b', [P.BRAZIER]: 'B', [P.CAMP]: 'f', [P.ALTAR]: 'a', [P.CHEST]: 'c', [P.GRAVE]: 'g', [P.ANVIL]: 'A', [P.FURNACE]: 'F', [P.CART]: 'm', [P.BARREL]: 'n', [P.PEW]: 'e', [P.TABLE]: 't', [P.STALAG]: 'i', [P.ROOT]: 'R', [P.CRYSTAL]: 'C', [P.TORCH]: 'T', [P.VENT]: 'v', [P.SPIKE]: '^', [P.WEB]: 'w', [P.BELL]: 'l', [P.CANDLE]: 'k', [P.FUNGUS]: 'u', [P.MIRROR]: 'M', [P.ORE]: 'o' };
  const out = [];
  for (let y = 0; y < H; y++) { let r = ''; for (let x = 0; x < W; x++) { const k = I(x, y); r += (f.spawn.x === x && f.spawn.y === y) ? '@' : pc[f.p[k]] || ch[f.t[k]] || '?'; } out.push(r); }
  return out.join('\n');
}
