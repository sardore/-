// EMBERFALL 규칙 엔진 — DOM 없음. 이동 하나로 전부: 부딪치면 공격/대화/문/상자/화로.
import { RNG, hash } from './rng.js';
import { T, P, DECOR, BLOCK, ZONES, MONSTERS, SPAWN, RELICS, RIDX, NAMES, TRAITS, UPGRADES, PROLOGUE, LORE, GHOSTS, BOSSTALK, ENDINGS, DEATHWORDS, FLOORS_PER_ZONE, MAXFLOOR, zoneOf, isBossFloor, floorName } from './data.js';
import { genFloor, W, H, passT, hardT } from './gen.js';
import { buildVillage } from './village.js';
import { shadowcast, collectLights, staticLightMap, opaqueAt } from './fov.js';
import { install } from './story.js';

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const I = (x, y) => y * W + x;
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const memStore = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
const META_KEY = 'emberfall_meta_v1', RUN_KEY = 'emberfall_run_v1';

function newMeta(R) {
  return { v: 1, ash: 0, up: { atk: 0, hp: 0, flame: 0, herb: 0 }, gen: 1, dead: [], remains: {}, lore: [], cleared: 0, ending: null, endings: {}, flags: {}, heirSel: 0, heirs: makeHeirs(R), best: 0, tip: 0, seed: (Math.random() * 1e9) | 0 };
}
function makeHeirs(R) { const names = R.shuffle(NAMES.slice()), traits = R.shuffle(TRAITS.slice()); return [0, 1, 2].map(i => ({ name: names[i], trait: traits[i].id })); }
export const traitOf = id => TRAITS.find(t => t.id === id);

export class Game {
  constructor(store = memStore(), seed) {
    this.store = store; this.events = []; this.log = []; this.mode = 'play'; this.dialog = null; this.uid = 0;
    this.R = RNG(seed ?? ((Math.random() * 4e9) | 0));
    let m = null; try { m = JSON.parse(store.getItem(META_KEY)); } catch (e) {}
    this.meta = m && m.v === 1 ? m : newMeta(this.R);
    this.mons = []; this.items = []; this.npcs = []; this.haz = []; this.run = null; this.f = null; this.pl = null; this.vis = new Uint8Array(W * H); this.light = new Float32Array(W * H); this.seen = new Uint8Array(W * H);
  }
  /* ---------- 이벤트/저장 ---------- */
  ev(type, d = {}) { this.events.push({ type, ...d }); }
  drain() { const e = this.events; this.events = []; return e; }
  say(text, cls = '') { this.log.push({ text, cls, turn: this.run?.turns || 0 }); if (this.log.length > 60) this.log.shift(); this.ev('log', { text, cls }); }
  saveMeta() { try { this.store.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) {} }
  hasSavedRun() { try { return !!this.store.getItem(RUN_KEY); } catch (e) { return false; } }
  saveRun() {
    if (!this.run || !this.f || this.mode === 'dead' || this.mode === 'ending') return;
    const f = this.f, a = x => Array.from(x);
    const snap = { run: this.run, pl: this.pl, f: { depth: f.depth, seed: f.seed, t: a(f.t), p: a(f.p), s: a(f.s), explored: a(f.explored), flags: f.flags, arena: f.arena, exit: f.exit, spawn: f.spawn, zone: f.zone, boss: f.boss, remains: f.remains, campUsed: f.campUsed, bossState: f.bossState, turn: f.turn },
      mons: this.mons, items: this.items, npcs: this.npcs, haz: this.haz, uid: this.uid, rs: this.R.seed };
    try { this.store.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) {}
  }
  loadRun() {
    let s; try { s = JSON.parse(this.store.getItem(RUN_KEY)); } catch (e) {} if (!s) return false;
    const base = genFloor(s.f.seed, s.f.depth); // 정적 정보(슬롯, 구역 등)를 되살린다
    const f = Object.assign(base, { ...s.f, t: Uint8Array.from(s.f.t), p: Uint8Array.from(s.f.p), s: Uint8Array.from(s.f.s), explored: Uint8Array.from(s.f.explored) });
    this.run = s.run; this.pl = s.pl; this.f = f; this.mons = s.mons; this.items = s.items; this.npcs = s.npcs; this.haz = s.haz; this.uid = s.uid; this.R.seed = s.rs;
    this.mode = 'play'; this.relight(); this.updateView(); this.ev('floor', { depth: f.depth, load: true }); return true;
  }
  clearRun() { try { this.store.removeItem(RUN_KEY); } catch (e) {} }

  /* ---------- 능력치 ---------- */
  fx(key) { let v = 0; if (!this.run) return 0; for (const id of this.run.relics) { const r = RELICS[RIDX[id]]; if (r.f[key]) v += r.f[key]; } const tr = traitOf(this.run.heir.trait); if (tr?.f[key]) v += tr.f[key]; return v; }
  recalc() {
    const pl = this.pl, up = this.meta.up;
    const hpMax = 12 + up.hp * 3 + this.fx('hp'), flMax = 100 + up.flame * 15 + this.fx('flame');
    pl.atk = 2 + up.atk + this.fx('atk'); pl.maxhp = Math.max(4, hpMax); pl.maxflame = flMax; if (pl.hp > pl.maxhp) pl.hp = pl.maxhp; if (pl.flame > pl.maxflame) pl.flame = pl.maxflame;
  }
  herbAmt() { return 4 + this.fx('herb'); }
  herbCap() { return 3 + (this.run && this.run.relics.includes('pouch') ? 2 : 0); }
  lightR() { const pl = this.pl; if (!this.run) return 7; const r = pl.flame / pl.maxflame; return (pl.flame <= 0 ? 1.6 : 2.6 + 4.6 * Math.sqrt(Math.max(0, r))) + this.fx('light'); }
  streakReq() { return Math.max(1, 3 + this.fx('streak') - 1); }
  isCharged() { return this.pl.streak >= this.streakReq(); }

  /* ---------- 마을 ---------- */
  enterVillage() {
    const v = buildVillage(this.meta); v.explored = new Uint8Array(W * H).fill(1); v.flags = {}; v.turn = 0; this.f = v; this.run = null; this.mons = []; this.items = []; this.haz = []; this.dialog = null; this.mode = 'play';
    this.npcs = v.npcs.map(n => ({ id: ++this.uid, ...n, x: n.x, y: n.y }));
    v.heirs.forEach((h, i) => { const he = this.meta.heirs[i]; this.npcs.push({ id: ++this.uid, role: 'heir', idx: i, name: he.name, x: h.x, y: h.y, look: 'heir' + i }); });
    this.pl = { x: v.spawn.x, y: v.spawn.y, hp: 12, maxhp: 12, flame: 100, maxflame: 100, atk: 2, face: 1, streak: 0, stuck: 0, dir: [0, 1] };
    this.relight(); this.updateView(); this.ev('floor', { depth: -1, village: true }); this.clearRun();
    if (!this.meta.flags.prologue) { this.meta.flags.prologue = 1; this.saveMeta(); this.openDialog(PROLOGUE.map(t => ({ w: null, t })), { after: () => this.talk(this.npcs.find(n => n.role === 'elder'), true) }); }
  }
  /* ---------- 새 탐험 ---------- */
  startRun(depth = 0) {
    const he = this.meta.heirs[this.meta.heirSel], seed = (this.R.r() * 4e9) >>> 0;
    this.run = { seed, depth, heir: he, relics: [], herbs: 2 + this.meta.up.herb, ash: 0, kills: 0, turns: 0, keys: 0, lore: 0, startDepth: depth, gen: this.meta.gen };
    this.pl = { x: 0, y: 0, hp: 12, maxhp: 12, flame: 100, maxflame: 100, atk: 2, face: 1, streak: 0, stuck: 0, dir: [1, 0], wardUsed: false, revived: false };
    if (this.run.heir.trait === 'gentle') this.run.herbs++;
    this.recalc(); this.pl.hp = this.pl.maxhp; this.pl.flame = this.pl.maxflame;
    this.enterFloor(depth); this.say(`${he.name}이(가) 등불을 들고 구덩이로 내려간다.`, 'story');
  }
  enterFloor(depth, from) {
    const run = this.run, pl = this.pl; run.depth = depth;
    const f = genFloor(hash(run.seed, depth), depth); f.explored = new Uint8Array(W * H); f.flags = {}; f.turn = 0; f.campUsed = false; f.bossState = 'none'; f.wardReset = true;
    this.f = f; this.mons = []; this.items = []; this.npcs = []; this.haz = []; pl.wardUsed = false; pl.streak = 0; pl.stuck = 0;
    if (from && from.fall) { const c = f.free.reduce((b, q) => (!b || Math.abs(q.x - from.x) + Math.abs(q.y - from.y) < Math.abs(b.x - from.x) + Math.abs(b.y - from.y) ? q : b), null); pl.x = c.x; pl.y = c.y; } else { pl.x = f.spawn.x; pl.y = f.spawn.y; }
    this.populate(); this.relight();
    if (this.fx('mapper')) { for (let k = 0; k < W * H; k++) if (f.t[k] !== T.WALL || this.R.chance(0.15)) { if (this.R.chance(0.5)) f.explored[k] = 1; } }
    this.updateView(); if (depth > this.meta.best) { this.meta.best = depth; this.saveMeta(); }
    this.ev('floor', { depth, name: floorName(depth) });
    this.say(`— ${floorName(depth)} —`, 'title');
    const fz = depth % FLOORS_PER_ZONE;
    if (fz === 0) { const Z = ZONES[f.zone]; this.openDialog([{ w: null, t: Z.en }, ...Z.intro.map(t => ({ w: null, t }))], { card: Z.name }); }
    this.saveRun();
  }
  populate() {
    const f = this.f, run = this.run, R = RNG(hash(run.seed, f.depth, 99)), z = f.zone, fz = f.depth % FLOORS_PER_ZONE;
    const far = R.shuffle(f.far.slice()), used = new Set(); const take = (pred) => { for (const c of far) { const k = I(c.x, c.y); if (used.has(k) || (pred && !pred(c))) continue; used.add(k); return c; } return null; };
    const table = SPAWN[z].filter(e => e[2] <= fz);
    const nM = f.boss ? 3 + R.ri(3) : 8 + z + fz * 2 + R.ri(4);
    const mk = (type, c, awake) => this.addMon(type, c.x, c.y, awake);
    for (const c of f.slots.E) if (R.chance(0.7)) { const e = R.wpick(table, q => q[1]); if (MONSTERS[e[0]].ai !== 'water' && !used.has(I(c.x, c.y))) { used.add(I(c.x, c.y)); mk(e[0], c, false); } }
    let guard = 0;
    while (this.mons.length < nM && guard++ < 80) {
      const e = R.wpick(table, q => q[1]), def = MONSTERS[e[0]];
      if (def.ai === 'water') { const wc = far.filter(c => f.t[I(c.x, c.y)] === T.WATER && !used.has(I(c.x, c.y))); if (!wc.length) continue; const c = R.pick(wc); used.add(I(c.x, c.y)); mk(e[0], c, false); continue; }
      const c = take(q => f.t[I(q.x, q.y)] === T.FLOOR); if (!c) break; const n = def.group ? R.range(def.group[0], def.group[1]) : 1;
      for (let i = 0; i < n; i++) { const q = i === 0 ? c : this.nearFree(c.x, c.y, 2, used); if (q) { used.add(I(q.x, q.y)); mk(e[0], q, R.chance(def.sleep ?? 0.4) ? false : true); if (i === 0) this.mons[this.mons.length - 1].awake = !R.chance(def.sleep ?? 0.6); } }
    }
    // 아이템
    const place = (kind, n, extra = {}) => { for (let i = 0; i < n; i++) { const c = take(q => f.t[I(q.x, q.y)] === T.FLOOR && !f.p[I(q.x, q.y)]); if (c) this.items.push({ id: ++this.uid, kind, x: c.x, y: c.y, ...extra, v: extra.v ?? 0 }); } };
    place('ember', 4 + R.ri(3), { v: 9 }); place('herb', 2 + (fz === 0 ? 1 : 0)); place('ash', 6 + R.ri(4), { v: 3 });
    if (f.hasVault) { const c = f.slots.K.length ? R.pick(f.slots.K) : take(); if (c) this.items.push({ id: ++this.uid, kind: 'key', x: c.x, y: c.y }); }
    // 기록 쪽지: 이 지역에서 아직 못 찾은 것
    const notes = LORE.map((l, i) => ({ l, i })).filter(q => q.l.z === z && !this.meta.lore.includes(q.i));
    if (notes.length && !f.boss) { const q = notes[0]; const c = f.slots.Q.length ? f.slots.Q[0] : take(); if (c) this.items.push({ id: ++this.uid, kind: 'note', x: c.x, y: c.y, v: q.i }); }
    // 제단 유물
    if (f.altars.length) { const pool = RELICS.filter(r => !run.relics.includes(r.id)); R.shuffle(pool); f.altars.forEach((a, i) => { if (pool[i]) this.items.push({ id: ++this.uid, kind: 'relic', x: a.x, y: a.y, v: pool[i].id, altar: 1 }); }); }
    // 상자 내용은 열 때 정한다. 유령
    if (fz === 1) { const g = GHOSTS.find(q => q.z === z); if (g) { const c = f.slots.N.length ? f.slots.N[0] : take(q => f.t[I(q.x, q.y)] === T.FLOOR && !f.p[I(q.x, q.y)]); if (c) this.npcs.push({ id: ++this.uid, role: 'ghost', name: g.name, x: c.x, y: c.y, look: 'ghost' + z, z, used: false }); } }
    // 선조의 유해
    const rem = this.meta.remains[f.depth];
    if (rem) { const c = take(q => f.t[I(q.x, q.y)] === T.FLOOR && !f.p[I(q.x, q.y)]); if (c) { f.p[I(c.x, c.y)] = P.REMAINS; f.remains = { x: c.x, y: c.y }; } }
  }
  nearFree(x, y, r, used) { const f = this.f; for (let n = 0; n < 20; n++) { const nx = x + this.R.range(-r, r), ny = y + this.R.range(-r, r), k = I(nx, ny); if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && f.t[k] === T.FLOOR && !f.p[k] && !used.has(k) && !this.monAt(nx, ny)) return { x: nx, y: ny }; } return null; }
  addMon(type, x, y, awake = false) {
    const def = MONSTERS[type]; const m = { id: ++this.uid, type, x, y, hp: def.hp, maxhp: def.hp, en: 0, awake, stun: 0, winding: 0, tick: 0, face: 1, ph: 0 };
    this.mons.push(m); return m;
  }
  monAt(x, y) { for (const m of this.mons) if (m.x === x && m.y === y) return m; return null; }
  npcAt(x, y) { for (const n of this.npcs) if (n.x === x && n.y === y) return n; return null; }
  itemAt(x, y) { for (const it of this.items) if (it.x === x && it.y === y) return it; return null; }
  relight() { const f = this.f; f.lights = collectLights(f); const { sl, sanct } = staticLightMap(f, f.lights); f.slight = sl; f.sanct = sanct; }
  walkable(x, y, fly) { if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false; const f = this.f, k = I(x, y), t = f.t[k]; if (BLOCK.has(f.p[k])) return false; if (fly) return t !== T.WALL && t !== T.LOCKED && t !== T.RUBBLE && t !== T.DOOR || t === T.DOOR; return passT(t) || t === T.DOOR; }

  /* ---------- 시야 / 빛 ---------- */
  updateView() {
    const f = this.f, pl = this.pl, vis = this.vis.fill(0), light = this.light.fill(0), seen = this.seen.fill(0);
    shadowcast(f, pl.x, pl.y, 18, (x, y) => { vis[I(x, y)] = 1; });
    const R = this.lightR();
    if (f.village) { for (let k = 0; k < W * H; k++) if (vis[k]) { light[k] = Math.max(f.slight[k], 0.55); seen[k] = 1; f.explored[k] = 1; } }
    else {
      shadowcast(f, pl.x, pl.y, Math.ceil(R + 1), (x, y, d2) => { const d = Math.sqrt(d2); if (d > R + 0.7) return; const v = Math.pow(Math.max(0, 1 - d / (R + 0.8)), 1.1); const k = I(x, y); if (v > light[k]) light[k] = v; });
      for (let k = 0; k < W * H; k++) { if (!vis[k]) continue; if (f.slight[k] > light[k]) light[k] = f.slight[k]; if (light[k] >= 0.1) { seen[k] = 1; f.explored[k] = 1; } }
      // 벽은 인접한 보이는 바닥이 있으면 보인다
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = I(x, y); if (!vis[k] || seen[k]) continue; if (f.t[k] === T.WALL || BLOCK.has(f.p[k])) for (const [dx, dy] of DIRS) if (seen[I(x + dx, y + dy)] && light[I(x + dx, y + dy)] >= 0.1) { seen[k] = 1; f.explored[k] = 1; if (light[k] < 0.1) light[k] = Math.max(light[k], light[I(x + dx, y + dy)] * 0.6); break; } }
    }
  }
  seesTile(x, y) { return !!this.seen[I(x, y)]; }
  los(x0, y0, x1, y1) { const f = this.f; let x = x0, y = y0; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0); let e = dx - dy; for (let g = 0; g < 60; g++) { if (x === x1 && y === y1) return true; if ((x !== x0 || y !== y0) && opaqueAt(f, x, y)) return false; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x += sx; } if (e2 < dx) { e += dx; y += sy; } } return false; }
  inSanct(x, y) { return !!this.f.sanct[I(x, y)]; }

  /* ---------- 대화 ---------- */
  openDialog(pages, o = {}) { this.dialog = { pages, i: 0, choices: o.choices || null, after: o.after || null, card: o.card || null, sel: 0, prev: this.mode === 'dialog' ? this.dialog?.prev : this.mode }; this.mode = 'dialog'; this.ev('dialog'); }
  dlgNext() {
    const d = this.dialog; if (!d) return; if (d.i < d.pages.length - 1) { d.i++; this.ev('dlg'); return; }
    if (d.choices) return; this.closeDialog();
  }
  closeDialog() { const d = this.dialog; this.dialog = null; this.mode = this.mode === 'dialog' ? 'play' : this.mode; if (this.mode === 'dialog') this.mode = 'play'; this.ev('dlgclose'); d?.after?.(); }
  dlgChoose(i) { const d = this.dialog; if (!d || !d.choices || d.i < d.pages.length - 1) return; const c = d.choices[i]; if (!c) return; this.dialog = null; this.mode = 'play'; this.ev('dlgclose'); c.fn?.(); d.after?.(); }

  /* ---------- 행동 ---------- */
  wait() { if (this.mode !== 'play') return false; this.pl.streak = 0; this.endTurn(); return true; }
  move(dx, dy) {
    if (this.mode !== 'play') return false; const pl = this.pl, f = this.f;
    if (dx) pl.face = dx; pl.dir = [dx, dy];
    if (pl.stuck > 0) { pl.stuck--; this.say('거미줄이 발목을 붙잡는다.'); this.ev('sfx', { n: 'web' }); pl.streak = 0; this.endTurn(); return true; }
    const nx = pl.x + dx, ny = pl.y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) return false;
    const m = this.monAt(nx, ny); if (m) return this.attack(m, dx, dy);
    const n = this.npcAt(nx, ny); if (n) { this.talk(n); pl.streak = 0; return false; }
    return this.step(nx, ny, dx, dy);
  }
  step(nx, ny, dx, dy) {
    const pl = this.pl, f = this.f, k = I(nx, ny), t = f.t[k], pr = f.p[k], run = this.run;
    const bump = () => { this.ev('bump', { x: nx, y: ny }); pl.streak = 0; return false; };
    switch (pr) {
      case P.CAMP: return f.village ? (this.say('꺼져 가는 모닥불이 가냘프게 흔들린다.'), this.ev('bump', { x: nx, y: ny }), false) : this.useCamp(nx, ny);
      case P.BRAZIER: return this.lightBrazier(nx, ny);
      case P.BRAZIERLIT: this.say('화로가 타오르고 있다.'); return bump();
      case P.ALTAR: return this.useAltar(nx, ny);
      case P.CHEST: return this.openChest(nx, ny);
      case P.CART: return this.pushCart(nx, ny, dx, dy);
      case P.SIGN: this.signText(); return bump();
      case P.GRAVE: if (f.village) { this.graveText(nx, ny); return bump(); } break;
      case P.WELLPIT: break;
    }
    if (BLOCK.has(pr)) { if (pr === P.ORE || pr === P.CRYSTAL) this.say('단단한 광맥이다.'); return bump(); }
    switch (t) {
      case T.WALL: return bump();
      case T.DOOR: f.t[k] = T.DOOROPEN; this.ev('sfx', { n: 'door' }); this.ev('door', { x: nx, y: ny }); this.endTurn(); return true;
      case T.LOCKED:
        if (f.arena && f.arena.doors.some(d => d.x === nx && d.y === ny)) { this.say('문이 굳게 닫혀 있다. 이 방의 주인이 풀려 나기 전까지는.'); return bump(); }
        if (run.keys > 0 || this.fx('skey')) { if (!this.fx('skey')) run.keys--; f.t[k] = T.DOOROPEN; this.say('열쇠로 문을 열었다.'); this.ev('sfx', { n: 'door' }); this.endTurn(); return true; }
        this.say('잠겨 있다. 열쇠가 필요하다.'); return bump();
      case T.RUBBLE: { f.flags['r' + k] = (f.flags['r' + k] || 0) + 1; if (f.flags['r' + k] >= 2) { f.t[k] = T.FLOOR; this.say('잔해를 치웠다.'); this.ev('fx', { k: 'dust', x: nx, y: ny }); } else this.say('잔해가 흔들린다.'); this.ev('sfx', { n: 'hit' }); this.endTurn(); return true; }
      case T.DEEP: this.say('물이 너무 깊다.'); return bump();
      case T.LAVA: if (this.fx('lavawalk')) break; this.say('용암이다! 지나갈 수 없다.'); return bump();
      case T.CHASM:
        if (f.village || !run) return bump();
        if (f.boss && f.bossState !== 'dead') { this.say('아래는 보이지 않지만, 이 방의 주인을 두고 갈 수는 없다.'); return bump(); }
        if (f.depth >= MAXFLOOR - 1) return bump();
        this.openDialog([{ w: null, t: '발밑이 끝없이 깊다. 뛰어내리면 한 층 아래로 떨어진다. 다치겠지만.' }], { choices: [{ t: '뛰어내린다', fn: () => this.fall(nx, ny) }, { t: '물러선다' }] }); return false;
      case T.WELL:
        if (f.village) { this.pitDialog(); return false; }
        if (f.boss && f.bossState !== 'dead') return bump();
        this.descend(); return true;
    }
    // 이동
    const ox = pl.x, oy = pl.y; pl.x = nx; pl.y = ny;
    const same = pl.dir && pl.lastDir && pl.lastDir[0] === dx && pl.lastDir[1] === dy; pl.streak = same ? pl.streak + 1 : 1; pl.lastDir = [dx, dy];
    this.ev('move', { from: [ox, oy], to: [nx, ny], charged: this.isCharged() });
    if (t === T.WATER) { this.ev('sfx', { n: 'splash' }); this.ev('fx', { k: 'splash', x: nx, y: ny }); } else this.ev('sfx', { n: 'step' });
    if (run) this.onEnterTile(nx, ny);
    this.endTurn(); return true;
  }
  onEnterTile(x, y) {
    const f = this.f, k = I(x, y), pl = this.pl;
    const it = this.itemAt(x, y); if (it && !it.altar) this.pickup(it);
    if (f.p[k] === P.SPIKE) { this.say('가시가 발을 찔렀다!', 'bad'); this.hurt(2, null, { trap: 1 }); }
    if (f.p[k] === P.WEB) { f.p[k] = 0; pl.stuck = 1; this.say('거미줄에 걸렸다!'); }
    if (f.p[k] === P.REMAINS) this.takeRemains();
    if (f.t[k] === T.LAVA && this.fx('lavawalk')) { this.say('용암이 발을 그을린다.'); this.hurt(1, null, { fire: 1 }); }
    if (f.boss && f.bossState === 'none' && f.arena) { const a = f.arena; if (x > a.x + 1 && x < a.x + a.w - 2 && y > a.y + 1 && y < a.y + a.h - 1) this.startBoss(); }
  }
  pickup(it) {
    const run = this.run, pl = this.pl; this.items.splice(this.items.indexOf(it), 1);
    switch (it.kind) {
      case 'ember': pl.flame = Math.min(pl.maxflame, pl.flame + it.v); this.say(`불씨를 주워 불꽃이 살아났다. (+${it.v})`, 'good'); this.ev('sfx', { n: 'pick' }); this.ev('fx', { k: 'spark', x: it.x, y: it.y }); break;
      case 'herb': if (run.herbs < this.herbCap()) { run.herbs++; this.say('약초를 챙겼다.', 'good'); this.ev('sfx', { n: 'pick' }); } else if (pl.hp < pl.maxhp) { const a = this.herbAmt(); pl.hp = Math.min(pl.maxhp, pl.hp + a); this.say(`약초를 바로 씹었다. 체력 +${a}`, 'good'); this.ev('sfx', { n: 'herb' }); this.ev('float', { x: pl.x, y: pl.y, text: `+${a}`, c: '#8fe08a' }); } else { this.items.push(it); } break;
      case 'ash': { const v = Math.round(it.v * (1 + this.fx('ash'))); run.ash += v; this.ev('sfx', { n: 'ash' }); this.ev('float', { x: it.x, y: it.y, text: `+${v}`, c: '#e8d8b8' }); break; }
      case 'key': run.keys++; this.say('녹슨 열쇠를 주웠다.', 'good'); this.ev('sfx', { n: 'pick' }); break;
      case 'note': { const l = LORE[it.v]; if (!this.meta.lore.includes(it.v)) { this.meta.lore.push(it.v); this.saveMeta(); } run.lore++; this.ev('sfx', { n: 'read' }); this.openDialog([{ w: l.t, t: l.x, note: true }]); break; }
      case 'relic': this.gainRelic(it.v); break;
    }
  }
  gainRelic(id) {
    const r = RELICS[RIDX[id]]; this.run.relics.push(id); this.recalc(); if (r.f.hp) this.pl.hp = Math.min(this.pl.maxhp, this.pl.hp + r.f.hp);
    this.say(`유물을 얻었다: ${r.name} — ${r.desc}`, 'rare'); this.ev('sfx', { n: 'rare' }); this.ev('relic', { id }); this.updateView();
  }
  useAltar(x, y) {
    const it = this.itemAt(x, y); if (!it) { this.say('제단은 이미 식었다.'); return false; }
    const rel = RELICS[RIDX[it.v]]; this.items = this.items.filter(q => !q.altar); // 나머지는 사라진다
    this.f.p[I(x, y)] = P.ALTAR; this.ev('altar', { x, y }); this.gainRelic(it.v); this.say('나머지 제단의 빛이 꺼졌다.'); this.endTurn(); return true;
  }
  openChest(x, y) {
    const f = this.f, k = I(x, y), R = RNG(hash(this.run.seed, f.depth, x, y)), vault = f.vaultChests.some(c => c.x === x && c.y === y);
    f.p[k] = P.CHEST_OPEN; this.ev('sfx', { n: 'chest' }); this.ev('fx', { k: 'spark', x, y });
    const r = R.r(); const relicOk = RELICS.filter(q => !this.run.relics.includes(q.id));
    if (vault && r < 0.55 && relicOk.length) this.gainRelic(R.pick(relicOk).id);
    else if (r < (vault ? 0.8 : 0.5)) { const v = Math.round((vault ? 30 : 12) * (1 + f.depth * 0.15) * (1 + this.fx('ash'))); this.run.ash += v; this.say(`재 ${v}을(를) 얻었다.`, 'good'); this.ev('float', { x, y, text: `+${v}`, c: '#e8d8b8' }); }
    else if (r < 0.75) { if (this.run.herbs < this.herbCap()) { this.run.herbs++; this.say('약초를 찾았다.', 'good'); } else this.pl.hp = Math.min(this.pl.maxhp, this.pl.hp + 3); }
    else if (r < 0.9) { this.pl.flame = Math.min(this.pl.maxflame, this.pl.flame + 30); this.say('상자 속에서 불씨가 살아났다. 불꽃 +30', 'good'); }
    else if (relicOk.length && !vault && R.chance(0.35)) this.gainRelic(R.pick(relicOk).id); else this.say('텅 비어 있다.');
    this.endTurn(); return true;
  }
  lightBrazier(x, y) {
    const f = this.f, pl = this.pl; f.p[I(x, y)] = P.BRAZIERLIT; const gain = 25 + this.fx('brazier'); pl.flame = Math.min(pl.maxflame, pl.flame + gain);
    this.relight(); this.say(`화로에 불을 옮겨 붙였다. 불꽃 +${gain}. 이 주변은 그림자가 다가오지 못한다.`, 'good'); this.ev('sfx', { n: 'ignite' }); this.ev('fx', { k: 'burst', x, y }); this.ev('lit', { x, y });
    this.updateView(); this.endTurn(); return true;
  }
  useCamp(x, y) {
    const f = this.f, pl = this.pl;
    if (!f.campUsed) {
      f.campUsed = true; pl.hp = pl.maxhp; pl.flame = pl.maxflame; this.run.herbs = Math.max(this.run.herbs, Math.min(this.herbCap(), 2));
      this.say('모닥불 곁에서 숨을 돌렸다. 체력과 불꽃이 가득 찼다.', 'good'); this.ev('sfx', { n: 'rest' }); this.ev('fx', { k: 'burst', x, y }); this.saveRun(); this.endTurn(); return true;
    }
    this.openDialog([{ w: null, t: '모닥불은 아직 따뜻하다. 마을로 돌아갈 수 있다. (모은 재는 가져가지만, 유물은 두고 가야 한다.)' }], { choices: [{ t: '마을로 돌아간다', fn: () => this.returnHome() }, { t: '계속 내려간다' }] });
    return false;
  }
  pushCart(x, y, dx, dy) {
    const f = this.f, k = I(x, y); let cx = x, cy = y, moved = 0;
    const onRail = (xx, yy) => (f.s[I(xx, yy)] === DECOR.RAIL);
    const canGo = (xx, yy) => this.walkable(xx, yy) && !this.monAt(xx, yy) && !(xx === this.pl.x && yy === this.pl.y) && f.t[I(xx, yy)] === T.FLOOR;
    if (!canGo(x + dx, y + dy)) { this.say('광차가 꿈쩍도 않는다.'); this.ev('bump', { x, y }); return false; }
    f.p[k] = 0; const rail = onRail(x, y);
    do { cx += dx; cy += dy; moved++; const m = this.monAt(cx + dx, cy + dy); if (m) { this.damageMon(m, 5, { cart: 1 }); break; } } while (rail && onRail(cx, cy) && canGo(cx + dx, cy + dy) && moved < 9);
    f.p[I(cx, cy)] = P.CART; this.ev('sfx', { n: 'cart' }); this.ev('cart', { from: [x, y], to: [cx, cy] });
    this.pl.x = x; this.pl.y = y; this.ev('move', { from: [x - dx, y - dy], to: [x, y] }); this.pl.streak = 0; this.endTurn(); return true;
  }
  signText() { this.openDialog([{ w: '안내판', t: '발걸음이 곧 말이다. 부딪치면 공격하고, 말을 걸고, 문을 열고, 불을 붙인다.' }, { w: '안내판', t: '동쪽 끝의 구덩이로 걸어 들어가면 탐험이 시작된다. 그 전에 세 아이 중 한 명을 고르자.' }]); }
  graveText(x, y) {
    const i = this.f.graves.findIndex(g => g[0] === x && g[1] === y); const d = this.meta.dead[i]; if (!d) return;
    this.openDialog([{ w: `${d.name} (${traitOf(d.trait)?.name || ''})`, t: `${d.depthName}에서 쓰러졌다. ${d.cause}` }, { w: d.name, t: `"${d.words}"` }]);
  }

  /* ---------- 전투 ---------- */
  attack(m, dx, dy) {
    const pl = this.pl, def = MONSTERS[m.type]; let dmg = pl.atk + (this.R.chance(0.2) ? 1 : 0), tag = '';
    const charged = this.isCharged(), sleeping = !m.awake && !def.boss;
    if (sleeping) { dmg *= 3; tag = '암습!'; }
    if (charged) { dmg *= this.fx('charge') ? 3 : 2; tag = tag || '돌진!'; }
    this.ev('lunge', { dx, dy, charged });
    this.hitMon(m, dmg, { dir: [dx, dy], charged, tag });
    if (this.fx('pierce')) { const b = this.monAt(m.x + dx, m.y + dy); if (b) this.hitMon(b, Math.ceil(dmg / 2), { dir: [dx, dy] }); }
    pl.streak = 0; this.endTurn(); return true;
  }
  hitMon(m, dmg, o = {}) {
    const def = MONSTERS[m.type]; m.hp -= dmg; m.awake = true; m.flash = 1; this.wakeGroup(m);
    this.ev('hit', { id: m.id, x: m.x, y: m.y, dmg, tag: o.tag, charged: o.charged }); this.ev('sfx', { n: o.charged ? 'smash' : 'hit' });
    if (m.hp > 0 && o.charged && !def.boss) {
      let kn = 1 + this.fx('knock'), mv = 0; const [dx, dy] = o.dir;
      for (let i = 0; i < kn; i++) { const nx = m.x + dx, ny = m.y + dy; if (this.walkable(nx, ny, def.fly) && !this.monAt(nx, ny) && !(nx === this.pl.x && ny === this.pl.y) && this.f.t[I(nx, ny)] !== T.DEEP && !(this.f.t[I(nx,ny)] === T.CHASM || this.f.t[I(nx,ny)] === T.LAVA) || (def.fly && this.walkable(nx, ny, true) && !this.monAt(nx, ny))) { m.x = nx; m.y = ny; mv++; } else { m.hp -= 1 + this.fx('knock'); this.ev('float', { x: m.x, y: m.y, text: '쾅!', c: '#ffd070' }); break; } }
      if (mv) this.ev('knock', { id: m.id, x: m.x, y: m.y });
      m.stun = 1 + (this.fx('knock') ? 1 : 0); this.cancelHazards(m.id);
    }
    if (m.hp <= 0) this.killMon(m, 'player');
  }
  damageMon(m, dmg, o = {}) { m.hp -= dmg; m.awake = true; m.flash = 1; this.ev('hit', { id: m.id, x: m.x, y: m.y, dmg }); this.ev('sfx', { n: 'hit' }); if (m.hp <= 0) this.killMon(m, o.cart ? 'cart' : 'hazard'); }
  wakeGroup(m) { for (const o of this.mons) if (!o.awake && o.type === m.type && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) < 6) o.awake = true; }
  cancelHazards(id) { this.haz = this.haz.filter(h => h.src !== id); const m = this.mons.find(q => q.id === id); if (m) m.winding = 0; }
  killMon(m, by) {
    const def = MONSTERS[m.type], run = this.run, pl = this.pl; const i = this.mons.indexOf(m); if (i >= 0) this.mons.splice(i, 1);
    this.cancelHazards(m.id); this.ev('kill', { id: m.id, x: m.x, y: m.y, type: m.type, big: !!def.big }); this.ev('sfx', { n: def.boss ? 'bosskill' : 'kill' });
    if (!def.boss) {
      run.kills++; const v = Math.round(def.ash * (1 + this.fx('ash'))); run.ash += v; this.ev('float', { x: m.x, y: m.y, text: `+${v}`, c: '#e8d8b8' });
      if (this.fx('soul')) pl.flame = Math.min(pl.maxflame, pl.flame + this.fx('soul'));
      const oneShot = this.fx('mark') && by === 'player' && m.hp + (pl.atk) >= m.maxhp; if (this.R.chance(def.ember) || oneShot && this.R.chance(0.9)) this.items.push({ id: ++this.uid, kind: 'ember', x: m.x, y: m.y, v: 9 });
      if (this.fx('vamp') && this.R.chance(this.fx('vamp')) && pl.hp < pl.maxhp) { pl.hp++; this.ev('float', { x: pl.x, y: pl.y, text: '+1', c: '#ff8080' }); }
      if (def.atk === 'burst' && def.wind === 2) this.addHaz(this.area(m.x, m.y, 1), 1, def.dmg, 'explode', null);
    } else this.bossDown(m);
  }
  hurt(n, src, o = {}) {
    const pl = this.pl, def = src ? MONSTERS[src.type] : null; if (this.mode === 'dead') return;
    if (this.fx('ward') && !pl.wardUsed) { pl.wardUsed = true; this.say('방패 파편이 일격을 막아 냈다.', 'good'); this.ev('float', { x: pl.x, y: pl.y, text: '막음', c: '#9ab0c8' }); return; }
    if (this.fx('dodge') && this.R.chance(this.fx('dodge'))) { this.say('매듭이 풀리며 공격이 빗나갔다.', 'good'); this.ev('float', { x: pl.x, y: pl.y, text: '회피', c: '#e0c060' }); return; }
    if (o.line && this.fx('reflect')) n = Math.ceil(n / 2);
    if (def?.lightAverse && this.fx('mothwing')) n = Math.ceil(n / 2);
    n = Math.max(1, n); pl.hp -= n; pl.streak = 0;
    this.ev('hurt', { dmg: n }); this.ev('sfx', { n: 'hurt' }); this.ev('float', { x: pl.x, y: pl.y, text: `-${n}`, c: '#ff6a5a' });
    if (def?.drain) { pl.flame = Math.max(0, pl.flame - def.drain); this.say('그림자가 불꽃을 갉아먹는다!', 'bad'); }
    if (src && !o.trap && !o.line && this.fx('thorns')) this.damageMon(src, this.fx('thorns'));
    if (pl.hp <= 0) {
      if (this.fx('revive') && !pl.revived) { pl.revived = true; pl.hp = Math.ceil(pl.maxhp / 2); this.run.relics.splice(this.run.relics.indexOf('feather'), 1); this.recalc(); this.say('불사조 깃털이 타오르며 당신을 일으켰다!', 'rare'); this.ev('sfx', { n: 'rare' }); this.ev('shake', { p: 8 }); return; }
      this.die(src ? def.name : o.cause || (o.trap ? '함정' : o.fire ? '불길' : '어둠'));
    }
  }

  /* ---------- 위험 지대(예고 공격) ---------- */
  area(cx, cy, r) { const a = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && this.f.t[I(x, y)] !== T.WALL) a.push([x, y]); return a; }
  lineTiles(x, y, dx, dy, len, stopAtPlayer = false) { const a = []; for (let i = 1; i <= len; i++) { const nx = x + dx * i, ny = y + dy * i; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) break; const k = I(nx, ny); if (this.f.t[k] === T.WALL || this.f.t[k] === T.DOOR || this.f.t[k] === T.LOCKED || BLOCK.has(this.f.p[k]) && this.f.p[k] !== P.CART) break; a.push([nx, ny]); if (stopAtPlayer && nx === this.pl.x && ny === this.pl.y) break; } return a; }
  addHaz(tiles, t, dmg, kind, src, extra = {}) { if (!tiles.length) return null; const h = { id: ++this.uid, tiles, t, t0: t, dmg, kind, src, ...extra }; this.haz.push(h); this.ev('haz', { id: h.id, kind }); return h; }
  tickHazards() {
    const keep = [];
    for (const h of this.haz) { h.t--; if (h.t > 0) { keep.push(h); continue; } this.resolveHaz(h); }
    this.haz = keep.filter(h => this.haz.includes(h) || true); this.haz = this.haz.filter(h => h.t > 0);
  }
  resolveHaz(h) {
    const pl = this.pl, src = h.src ? this.mons.find(q => q.id === h.src) : null; if (h.src && !src && h.kind !== 'explode') return;
    this.ev('boom', { tiles: h.tiles, kind: h.kind });
    const hitTile = (x, y) => {
      if (pl.x === x && pl.y === y) { if (h.kind === 'pull') { /* 아래에서 처리 */ } else this.hurt(h.dmg, src, { line: h.kind === 'line', cause: h.cause }); }
      const m = this.monAt(x, y); if (m && (!src || m.id !== src.id) && m.type !== (src && src.type) && h.kind !== 'summon' && h.kind !== 'pull' && !MONSTERS[m.type].boss) this.damageMon(m, h.dmg);
    };
    switch (h.kind) {
      case 'summon': { const c = h.tiles[0]; if (!this.monAt(c[0], c[1]) && !(pl.x === c[0] && pl.y === c[1])) { const s = this.addMon(h.summon, c[0], c[1], true); this.ev('spawn', { id: s.id, x: c[0], y: c[1] }); } break; }
      case 'charge': {
        const dir = h.dir; let x = src.x, y = src.y, last = null;
        for (const [tx, ty] of h.tiles) { if (this.monAt(tx, ty) && this.monAt(tx, ty) !== src) break; if (tx === pl.x && ty === pl.y) { this.hurt(h.dmg, src); break; } if (!this.walkable(tx, ty, MONSTERS[src.type].fly)) break; x = tx; y = ty; last = [tx, ty]; }
        if (last) { this.ev('dash', { id: src.id, from: [src.x, src.y], to: last }); src.x = x; src.y = y; }
        if (h.stunEnd) { const [ex, ey] = [x + dir[0], y + dir[1]]; if (!this.walkable(ex, ey)) { src.stun = 2; this.say('돌진이 벽에 부딪혔다! 지금이 기회다!', 'good'); this.ev('shake', { p: 6 }); } }
        break; }
      case 'pull': {
        if (h.tiles.some(([x, y]) => x === pl.x && y === pl.y)) { const dx = Math.sign(src.x - pl.x), dy = Math.sign(src.y - pl.y); let n = 0;
          while (n < 8 && (Math.abs(src.x - pl.x) + Math.abs(src.y - pl.y)) > 1) { const nx = pl.x + dx, ny = pl.y + dy; if (!this.walkable(nx, ny) || this.monAt(nx, ny) || !(dx || dy)) break; pl.x = nx; pl.y = ny; n++; }
          this.ev('pulled', { x: pl.x, y: pl.y }); this.ev('sfx', { n: 'chain' }); this.hurt(h.dmg, src, {}); pl.streak = 0; this.updateView(); }
        break; }
      case 'water': for (const [x, y] of h.tiles) { hitTile(x, y); const k = I(x, y); if (this.f.t[k] === T.FLOOR && !this.f.p[k]) this.f.t[k] = T.WATER; } break;
      default: for (const [x, y] of h.tiles) hitTile(x, y);
    }
    if (h.kind === 'explode' && src) { const i = this.mons.indexOf(src); if (i >= 0) { this.mons.splice(i, 1); this.ev('kill', { id: src.id, x: src.x, y: src.y, type: src.type }); } }
    this.ev('sfx', { n: h.kind === 'line' ? 'zap' : 'boom' });
    if (h.kind !== 'pull') this.ev('shake', { p: h.dmg > 3 ? 5 : 3 });
  }

  /* ---------- 턴 처리 ---------- */
  endTurn() {
    const run = this.run, pl = this.pl, f = this.f; if (f.village) { this.updateView(); return; }
    run.turns++; f.turn++;
    // 불꽃
    let drain = ZONES[f.zone].drain * (1 + this.fx('drain')); const k = I(pl.x, pl.y);
    if (f.t[k] === T.WATER) { if (!this.fx('dew')) drain += 1.4; }
    if (f.darkness) drain *= 2.2;
    pl.flame -= drain;
    if (this.inSanct(pl.x, pl.y)) pl.flame = Math.min(Math.max(pl.flame, 0) + 1.1, Math.max(pl.flame, pl.maxflame * 0.8));
    if (pl.flame <= 0) { pl.flame = 0; if (!f.warnedDark) { f.warnedDark = 1; this.say('불꽃이 꺼졌다…! 어둠이 살갗을 파고든다.', 'bad'); } if (run.turns % 5 === 0) this.hurt(1, null, { cause: '어둠' }); }
    else if (pl.flame < pl.maxflame * 0.2 && !f.warnedLow) { f.warnedLow = 1; this.say('불꽃이 약해진다. 불씨나 화로를 찾아야 한다.', 'bad'); }
    if (this.mode === 'dead') return;
    // 증기구멍
    if (f.zone === 3 || true) this.ventCycle();
    this.tickHazards(); if (this.mode === 'dead') return;
    // 몬스터
    this._flow = null;
    for (const m of this.mons.slice()) { if (!this.mons.includes(m)) continue; const def = MONSTERS[m.type]; m.en += (m.ph2 && def.boss ? 150 : def.spd); let g = 0; while (m.en >= 100 && g++ < 2) { m.en -= 100; if (!this.mons.includes(m)) break; this.monAct(m, g > 1); if (this.mode === 'dead') return; } }
    // 어둠이 다가온다
    if (!f.boss && f.turn > 240 && f.turn % 70 === 0 && this.mons.length < 30) this.dread();
    // 자동 약초
    if (this.mode !== 'dead' && pl.hp <= Math.ceil(pl.maxhp * 0.34) && run.herbs > 0) { run.herbs--; const a = this.herbAmt(); pl.hp = Math.min(pl.maxhp, pl.hp + a); this.say(`약초를 씹었다. 체력 +${a}`, 'good'); this.ev('sfx', { n: 'herb' }); this.ev('float', { x: pl.x, y: pl.y, text: `+${a}`, c: '#8fe08a' }); }
    for (const m of this.mons) if (m.flash) m.flash = 0;
    this.updateView();
    if (run.turns % 12 === 0) this.saveRun();
  }
  dread() {
    const f = this.f, z = f.zone, def = z === 1 ? 'candle' : z === 4 ? 'shade' : z === 2 ? 'wraith' : z === 0 ? 'bat' : 'imp';
    const c = f.far.filter(q => man(q, this.pl) > 12 && !this.monAt(q.x, q.y) && f.t[I(q.x, q.y)] === T.FLOOR); if (!c.length) return;
    const q = this.R.pick(c); this.addMon(def === 'bat' ? 'shade' : def, q.x, q.y, true); this.say('어둠이 당신을 찾아 움직인다…', 'bad');
  }
  ventCycle() {
    const f = this.f, pl = this.pl, ph = f.turn % 6; if (ph !== 3) return;
    for (let y = Math.max(1, pl.y - 13); y < Math.min(H - 1, pl.y + 14); y++) for (let x = Math.max(1, pl.x - 16); x < Math.min(W - 1, pl.x + 17); x++) if (f.p[I(x, y)] === P.VENT) {
      const tiles = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => f.t[I(a, b)] !== T.WALL && !BLOCK.has(f.p[I(a, b)]) || (a === x && b === y));
      this.addHaz(tiles, 2, 2, 'fire', null, { vent: 1 });
    }
  }
  die(cause) {
    const run = this.run, pl = this.pl, f = this.f, meta = this.meta, he = run.heir;
    this.mode = 'dead'; this.dialog = null;
    const words = this.R.pick(cause === '어둠' ? DEATHWORDS.dark : DEATHWORDS.default);
    const keep = run.relics.filter(id => id !== 'feather'); const relic = keep.length ? this.R.pick(keep) : null;
    meta.ash += run.ash; meta.dead.push({ name: he.name, trait: he.trait, depth: f.depth, depthName: floorName(f.depth), cause: ['어둠', '함정', '불길', '추락'].includes(cause) ? `${cause}에 쓰러졌다.` : `${cause}에게 쓰러졌다.`, words, gen: run.gen, ash: run.ash });
    meta.remains[f.depth] = { name: he.name, relic, words, ash: 10 + Math.floor(run.ash * 0.3) };
    meta.gen++; meta.heirs = makeHeirs(this.R); meta.heirSel = 0; this.saveMeta(); this.clearRun();
    this.ev('death', { cause, name: he.name, depth: f.depth, ash: run.ash, kills: run.kills, words }); this.ev('sfx', { n: 'death' });
  }
  returnHome() { const run = this.run; this.meta.ash += run.ash; this.meta.gen += 0; this.say(`재 ${run.ash}을(를) 가지고 마을로 돌아왔다.`); this.ev('home', { ash: run.ash }); this.run = null; this.meta.heirs = makeHeirs(this.R); this.meta.heirSel = 0; this.saveMeta(); this.enterVillage(); }
  takeRemains() {
    const f = this.f, rem = this.meta.remains[f.depth]; if (!rem) return; f.p[I(f.remains.x, f.remains.y)] = 0; delete this.meta.remains[f.depth]; this.saveMeta();
    const pages = [{ w: null, t: `${rem.name}의 유해다. 등불이 아직 희미하게 남아 있다.` }, { w: rem.name, t: `"${rem.words}"` }];
    this.run.ash += rem.ash; if (rem.relic && !this.run.relics.includes(rem.relic)) { pages.push({ w: null, t: `유품을 이어받았다: ${RELICS[RIDX[rem.relic]].name}` }); this.gainRelic(rem.relic); }
    this.openDialog(pages);
  }

  /* ---------- 층 이동 ---------- */
  descend() { const run = this.run; this.say('우물 아래로 내려간다…'); this.ev('sfx', { n: 'stairs' }); this.enterFloor(run.depth + 1); }
  fall(x, y) { this.say('발밑이 사라졌다! 한 층 아래로 떨어진다.', 'bad'); this.ev('sfx', { n: 'fall' }); this.ev('shake', { p: 8 }); const run = this.run; this.enterFloor(run.depth + 1, { fall: 1, x, y }); this.hurt(this.fx('feather') ? 0 : 2, null, { cause: '추락' }); }

  /* ---------- 몬스터 AI ---------- */
  flow(fly) {
    this._flow = this._flow || {}; const key = fly ? 'fly' : 'walk'; if (this._flow[key]) return this._flow[key];
    const d = new Int16Array(W * H).fill(999), pl = this.pl, q = [I(pl.x, pl.y)]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const k = q[h], x = k % W, y = (k / W) | 0; if (d[k] > 40) continue; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue; const nk = I(nx, ny); if (d[nk] !== 999) continue; const t = this.f.t[nk];
      const ok = fly ? (t !== T.WALL && t !== T.LOCKED && t !== T.RUBBLE && !BLOCK.has(this.f.p[nk])) : ((passT(t) || t === T.DOOR) && !BLOCK.has(this.f.p[nk])); if (ok) { d[nk] = d[k] + 1; q.push(nk); } } }
    return (this._flow[key] = d);
  }
  canStand(m, x, y) {
    const def = MONSTERS[m.type], f = this.f; if (!this.walkable(x, y, def.fly) || this.monAt(x, y) || (x === this.pl.x && y === this.pl.y)) return false;
    const t = f.t[I(x, y)]; if (def.ai === 'water') return t === T.WATER; if (!def.fly && (t === T.WATER && def.ai !== 'water' && false)) return false; if (def.lightAverse && f.sanct[I(x, y)]) return false;
    if (!def.fly && (t === T.DEEP || t === T.LAVA || t === T.CHASM)) return false; if (def.fly && t === T.WALL) return false;
    if (f.p[I(x, y)] === P.SPIKE && !def.fly) return true; return true;
  }
  stepToward(m, tx, ty, away = false) {
    const def = MONSTERS[m.type], f = this.f; const fl = this.flow(!!def.fly), cur = fl[I(m.x, m.y)]; let best = null, bv = away ? -1 : 9999;
    const opts = DIRS.map(([dx, dy]) => [m.x + dx, m.y + dy, dx, dy]).filter(([x, y]) => this.canStand(m, x, y));
    if (def.ai === 'water') { opts.sort((a, b) => (Math.abs(a[0] - tx) + Math.abs(a[1] - ty)) - (Math.abs(b[0] - tx) + Math.abs(b[1] - ty))); const o = opts[0]; if (o && (Math.abs(o[0] - tx) + Math.abs(o[1] - ty)) < (Math.abs(m.x - tx) + Math.abs(m.y - ty))) return this.moveMon(m, o[0], o[1]); return false; }
    for (const [x, y, dx, dy] of opts) { let v = away ? Math.abs(x - tx) + Math.abs(y - ty) : fl[I(x, y)] + this.R.r() * 0.4; if (!away && f.p[I(x, y)] === P.SPIKE) v += 2; if (away ? v > bv : v < bv) { bv = v; best = [x, y]; } }
    if (!best) return false; if (!away && bv >= cur + 1 && cur < 999 && opts.length && this.R.chance(0.6)) return false;
    return this.moveMon(m, best[0], best[1]);
  }
  moveMon(m, x, y) { const ox = m.x, oy = m.y; if (x !== ox) m.face = Math.sign(x - ox); m.x = x; m.y = y; this.ev('mmove', { id: m.id, from: [ox, oy], to: [x, y] }); const f = this.f; if (f.t[I(x, y)] === T.DOOR) f.t[I(x, y)] = T.DOOROPEN; return true; }
  monAct(m, second) {
    const def = MONSTERS[m.type], pl = this.pl, f = this.f;
    if (m.stun > 0) { m.stun--; return; }
    if (m.winding > 0) { m.winding--; return; }
    const d = man(m, pl);
    if (!m.awake && !def.boss) {
      const q = d <= 7 && this.los(m.x, m.y, pl.x, pl.y); const quiet = this.run.heir.trait === 'swift' ? 0.8 : 1;
      if (q && this.R.chance((0.1 + 0.09 * (7 - d)) * quiet)) { m.awake = true; this.wakeGroup(m); this.ev('alert', { id: m.id }); } else return;
    }
    if (def.boss) return this.bossAct(m);
    if (m.x !== pl.x) m.face = Math.sign(pl.x - m.x) || m.face;
    const adj = d === 1, aligned = (m.x === pl.x || m.y === pl.y) && d > 1, dir = [Math.sign(pl.x - m.x), Math.sign(pl.y - m.y)];
    if (def.lightAverse && this.inSanct(pl.x, pl.y) && d > 1 && false) return;
    if (def.ai === 'erratic' && this.R.chance(0.45)) { const o = DIRS[this.R.ri(4)]; if (this.canStand(m, m.x + o[0], m.y + o[1])) this.moveMon(m, m.x + o[0], m.y + o[1]); return; }
    switch (def.atk) {
      case 'melee1': if (adj) { this.ev('mlunge', { id: m.id, dx: pl.x - m.x, dy: pl.y - m.y }); this.hurt(def.dmg, m); } else this.stepToward(m, pl.x, pl.y); return;
      case 'slam': if (adj) { m.winding = def.wind; this.addHaz([[pl.x, pl.y]], def.wind, def.dmg, 'slam', m.id); this.ev('wind', { id: m.id, dx: pl.x - m.x, dy: pl.y - m.y }); } else this.stepToward(m, pl.x, pl.y); return;
      case 'burst': {
        if (def.wind === 2) { if (adj) { m.winding = 2; this.addHaz(this.area(m.x, m.y, def.rad), 2, def.dmg, 'explode', m.id); this.ev('wind', { id: m.id }); } else this.stepToward(m, pl.x, pl.y); return; }
        const rng = def.id === 'imp' ? 4 : 2;
        if (d <= rng && this.los(m.x, m.y, pl.x, pl.y)) { m.winding = def.wind; this.addHaz(this.area(pl.x, pl.y, def.rad), def.wind, def.dmg, 'fire', m.id); this.ev('wind', { id: m.id }); } else this.stepToward(m, pl.x, pl.y); return; }
      case 'line': case 'pull': {
        const maxR = def.range;
        if (aligned && d <= maxR && this.los(m.x, m.y, pl.x, pl.y) && d >= 2) { const tiles = this.lineTiles(m.x, m.y, dir[0], dir[1], maxR, def.atk === 'pull'); m.winding = def.wind; this.addHaz(tiles, def.wind, def.dmg, def.atk === 'pull' ? 'pull' : 'line', m.id); this.ev('wind', { id: m.id, dx: dir[0], dy: dir[1] }); return; }
        if (d < 3 && def.ai === 'keep') { if (this.stepToward(m, pl.x, pl.y, true)) return; if (adj) { this.hurt(1, m); return; } }
        if (def.ai === 'still') return;
        // 정렬을 맞추려고 움직인다
        const opts = DIRS.map(([dx, dy]) => [m.x + dx, m.y + dy]).filter(([x, y]) => this.canStand(m, x, y)).map(([x, y]) => ({ x, y, s: Math.min(Math.abs(x - pl.x), Math.abs(y - pl.y)) * 3 + Math.abs(Math.abs(x - pl.x) + Math.abs(y - pl.y) - 4) }));
        if (opts.length) { opts.sort((a, b) => a.s - b.s); const cur = Math.min(Math.abs(m.x - pl.x), Math.abs(m.y - pl.y)) * 3 + Math.abs(d - 4); if (opts[0].s < cur) { this.moveMon(m, opts[0].x, opts[0].y); return; } }
        if (d > maxR) this.stepToward(m, pl.x, pl.y); return; }
      case 'charge':
        if (aligned && d <= def.range && this.los(m.x, m.y, pl.x, pl.y)) { const tiles = this.lineTiles(m.x, m.y, dir[0], dir[1], def.range); m.winding = def.wind; this.addHaz(tiles, def.wind, def.dmg, 'charge', m.id, { dir }); this.ev('wind', { id: m.id, dx: dir[0], dy: dir[1] }); return; }
        if (adj) { m.winding = 1; this.addHaz([[pl.x, pl.y]], 1, def.dmg, 'slam', m.id); this.ev('wind', { id: m.id, dx: pl.x - m.x, dy: pl.y - m.y }); return; }
        this.stepToward(m, pl.x, pl.y); return;
      case 'summon': {
        const cnt = this.mons.filter(q => q.type === def.summon).length;
        if (d <= 9 && cnt < 3 && this.R.chance(0.5) && this.los(m.x, m.y, pl.x, pl.y)) { const c = this.nearFree(m.x, m.y, 2, new Set()); if (c) { m.winding = def.wind; this.addHaz([[c.x, c.y]], 2, 0, 'summon', m.id, { summon: def.summon }); this.ev('wind', { id: m.id }); return; } }
        if (d < 4) { this.stepToward(m, pl.x, pl.y, true); return; } if (d > 7) this.stepToward(m, pl.x, pl.y); return; }
      default: if (!adj) this.stepToward(m, pl.x, pl.y);
    }
  }
}

install(Game);
