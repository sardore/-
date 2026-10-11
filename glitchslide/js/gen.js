// 미로 생성 + 슬라이드 그래프 검증. DOM 의존 없음(노드에서 테스트 가능).
export const COLS = 13, CH = 13;            // 가로 칸 수(양끝은 벽), 청크 높이
export const DX = [0, 1, 0, -1], DY = [1, 0, -1, 0]; // 0위 1오른쪽 2아래 3왼쪽 (r은 위로 증가)
export const IT = { DOT: 1, GOLD: 2, POWER: 3, ALTAR: 10, SHOP: 11, REST: 12, VAULT: 13 };
const MID = (COLS - 1) / 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = [
  [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
];

function blank() {
  const g = [];
  for (let y = 0; y < CH; y++) { const row = new Uint8Array(COLS); row[0] = row[COLS - 1] = 1; g.push(row); }
  return g;
}

// 청크 후보 하나. y=0이 아래, y=CH-1은 게이트(구멍)만 뚫린 벽 줄.
export function makeCandidate(rand, inGates) {
  const g = blank();
  const sym = rand() < 0.7;
  const put = (x, y) => {
    if (x >= 1 && x <= COLS - 2 && y >= 0 && y <= CH - 2) { g[y][x] = 1; if (sym) g[y][COLS - 1 - x] = 1; }
  };
  const count = () => { let k = 0; for (let y = 0; y <= CH - 2; y++) for (let x = 1; x <= COLS - 2; x++) k += g[y][x]; return k; };
  const target = (0.22 + rand() * 0.1) * (COLS - 2) * (CH - 1);
  let guard = 0;
  while (count() < target && guard++ < 300) {
    const s = SHAPES[(rand() * SHAPES.length) | 0];
    const x = 1 + ((rand() * (COLS - 2)) | 0), y = (rand() * (CH - 1)) | 0;
    for (const [a, b] of s) put(x + a, y + b);
  }
  // 3x3 빈 공간은 가운데에 기둥을 세워 미로 느낌 유지
  for (let y = 0; y <= CH - 4; y++) for (let x = 1; x <= COLS - 4; x++) {
    let open = true;
    for (let b = 0; b < 3 && open; b++) for (let a = 0; a < 3; a++) if (g[y + b][x + a]) { open = false; break; }
    if (open) put(x + 1, y + 1);
  }
  const k = rand() < 0.5 ? 2 : 3;
  let gates;
  if (sym) { const a = 1 + ((rand() * (MID - 1)) | 0); gates = k === 2 ? [a, COLS - 1 - a] : [a, MID, COLS - 1 - a]; }
  else { const s = new Set(); while (s.size < k) s.add(1 + ((rand() * (COLS - 2)) | 0)); gates = [...s].sort((a, b) => a - b); }
  for (let x = 1; x < COLS - 1; x++) g[CH - 1][x] = 1;
  for (const x of gates) { g[CH - 1][x] = 0; g[CH - 2][x] = 0; }
  for (const x of inGates || [MID]) g[0][x] = 0;
  return { g, gates };
}

function fallback(inGates) {
  const g = blank(), gates = (inGates || [MID]).slice();
  for (let x = 1; x < COLS - 1; x++) g[CH - 1][x] = 1;
  for (const x of gates) { g[CH - 1][x] = 0; const w = x + 1 <= COLS - 2 && !gates.includes(x + 1) ? x + 1 : x - 1; g[CH - 2][w] = 1; g[5][x] = 1; }
  return { g, gates };
}

// 슬라이드 그래프 분석. 조건을 모두 만족하면 ok.
//  - 입구에서 들어오면 어딘가에 멈춘다(직통 금지)
//  - 도달 가능한 모든 정지 지점에서 위쪽 출구로 나갈 수 있다(막다른 함정 없음)
//  - 바닥이 전부 이어져 있고, 대부분의 바닥을 실제로 지나갈 수 있다
export function analyze(g, inGates, gates) {
  const ent = inGates || [], entSet = new Set(ent);
  const id = (x, y) => y * COLS + x;
  const slide = (x, y, d) => {
    const cells = [];
    for (;;) {
      const nx = x + DX[d], ny = y + DY[d];
      if (ny >= CH) return { out: 1, cells };
      if (ny < 0) { if (entSet.has(x)) return { out: -1, cells }; break; }
      if (g[ny][nx]) break;
      x = nx; y = ny; cells.push(id(x, y));
    }
    return { out: 0, x, y, cells };
  };
  const depth = new Map(), cellDepth = new Map(), moves = new Map();
  let queue = [], straight = false;
  const mark = (cells, d) => { for (const c of cells) if (!cellDepth.has(c) || cellDepth.get(c) > d) cellDepth.set(c, d); };
  const add = (x, y, d) => { const k = id(x, y); if (!depth.has(k)) { depth.set(k, d); queue.push([x, y]); } };
  const run = () => {
    while (queue.length) {
      const [x, y] = queue.shift(), k = id(x, y), d = depth.get(k), mv = [];
      for (let dir = 0; dir < 4; dir++) {
        const s = slide(x, y, dir);
        mark(s.cells, d + 1);
        if (s.out) mv.push({ out: s.out, to: -1 });
        else { mv.push({ out: 0, to: id(s.x, s.y) }); add(s.x, s.y, d + 1); }
      }
      moves.set(k, mv);
    }
  };
  if (!inGates) { mark([id(MID, 0)], 0); add(MID, 0, 0); }
  else for (const x of ent) {
    const s = slide(x, -1, 0);
    if (s.out) { straight = true; continue; }
    mark(s.cells, 0); add(s.x, s.y, 0);
  }
  run();
  for (const x of gates) { const s = slide(x, CH, 2); if (!s.out) add(s.x, s.y, 99); }
  run();
  const good = new Set();
  for (let ch = true; ch;) {
    ch = false;
    for (const [k, mv] of moves) if (!good.has(k) && mv.some(m => m.out === 1 || good.has(m.to))) { good.add(k); ch = true; }
  }
  // 바닥 연결성
  let floors = 0, start = null;
  for (let y = 0; y < CH; y++) for (let x = 1; x < COLS - 1; x++) if (!g[y][x]) { floors++; if (!start) start = [x, y]; }
  const seen = new Set([id(start[0], start[1])]), st = [start];
  while (st.length) {
    const [x, y] = st.pop();
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (ny < 0 || ny >= CH || g[ny][nx] || seen.has(id(nx, ny))) continue;
      seen.add(id(nx, ny)); st.push([nx, ny]);
    }
  }
  const ok = !straight && moves.size > 0 && good.size === moves.size && seen.size === floors && cellDepth.size / floors >= 0.8;
  return { ok, depth, cellDepth };
}

export class World {
  constructor(seed) {
    this.rand = rng(seed); this.rows = []; this.items = new Map(); this.chunks = []; this.gates = null;
    this.spawns = []; this.stats = { tries: 0, fallbacks: 0 };
  }
  key(c, r) { return r * 16 + c; }
  wall(c, r) {
    if (c <= 0 || c >= COLS - 1 || r < 0) return true;
    const row = this.rows[r];
    return row ? row[c] === 1 : true;
  }
  ensure(r) { while (this.rows.length <= r) this.genChunk(); }
  zoneOf(r) { return Math.floor(Math.max(0, Math.floor(r / CH)) / 4); }
  genChunk() {
    const idx = this.chunks.length, base = idx * CH, inG = this.gates, rand = this.rand;
    let cand = null, info = null;
    for (let t = 0; t < 4000; t++) {
      this.stats.tries++;
      const c = makeCandidate(rand, inG), a = analyze(c.g, inG, c.gates);
      if (a.ok) { cand = c; info = a; break; }
    }
    if (!cand) { this.stats.fallbacks++; cand = fallback(inG); info = analyze(cand.g, inG, cand.gates); }
    for (let y = 0; y < CH; y++) this.rows.push(cand.g[y]);
    this.gates = cand.gates;
    const cell = k => [k % COLS, base + ((k / COLS) | 0)];
    for (const k of info.cellDepth.keys()) { const [c, r] = cell(k); this.items.set(this.key(c, r), IT.DOT); }
    // 깊은 정지 지점 = 본선에서 가장 돌아가야 하는 곳 → 특별한 장소 후보
    const stops = [...info.depth].filter(([k, d]) => d < 50 && d >= 2 && ((k / COLS) | 0) >= 1 && ((k / COLS) | 0) <= CH - 2)
      .sort((a, b) => b[1] - a[1]);
    let place = null;
    if (idx >= 1 && stops.length) {
      const roll = rand();
      const type = idx === 1 ? IT.ALTAR : idx % 5 === 0 ? IT.SHOP : roll < 0.3 ? IT.ALTAR : roll < 0.48 ? IT.SHOP : roll < 0.64 ? IT.REST : roll < 0.8 ? IT.VAULT : 0;
      if (type) {
        const [k] = stops.splice((rand() * Math.min(3, stops.length)) | 0, 1)[0], [c, r] = cell(k);
        this.items.set(this.key(c, r), type); place = { c, r, type };
      }
    }
    if (idx >= 1 && stops.length && rand() < 0.65) {
      const [k] = stops.splice((rand() * Math.min(5, stops.length)) | 0, 1)[0], [c, r] = cell(k);
      this.items.set(this.key(c, r), IT.POWER);
    }
    if (idx >= 1) {
      const pool = [...info.cellDepth.keys()].filter(k => { const y = (k / COLS) | 0; return y >= 5 && y <= CH - 2; });
      const n = Math.min(1 + (((idx + 1) / 3) | 0), 4);
      for (let i = 0; i < n && pool.length; i++) {
        const [c, r] = cell(pool.splice((rand() * pool.length) | 0, 1)[0]);
        this.spawns.push({ kind: idx < 2 || rand() < 0.5 ? 'dash' : 'chase', c, r });
      }
    }
    this.chunks.push({ idx, base, gates: cand.gates, place });
  }
}
