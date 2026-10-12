// 테스트용 봇: 우물/보스방을 향해 걷고, 인접한 적을 때리고, 예고 지대를 피한다.
import { Game, DIRS } from '../js/game.js';
import { T, P, BLOCK, MONSTERS } from '../js/data.js';
import { W, H, passT } from '../js/gen.js';
const I = (x, y) => y * W + x;
export function bfs(g, goal, opt = {}) {
  const f = g.f, pl = g.pl, d = new Int16Array(W * H).fill(-1), prev = new Int32Array(W * H).fill(-1), q = [I(pl.x, pl.y)]; d[q[0]] = 0;
  const hz = new Set(); for (const h of g.haz) for (const [x, y] of h.tiles) hz.add(I(x, y));
  for (let h = 0; h < q.length; h++) { const k = q[h], x = k % W, y = (k / W) | 0; if (goal(x, y) && k !== q[0]) return { k, d, prev };
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue; const nk = I(nx, ny); if (d[nk] >= 0) continue; const t = f.t[nk], pr = f.p[nk];
      const isGoal = goal(nx, ny); const ok = isGoal || ((passT(t) || t === T.DOOR || (t === T.LOCKED && (g.run.keys > 0))) && (!BLOCK.has(pr)) && t !== T.WELL && !(opt.avoidHaz && hz.has(nk)) && pr !== P.SPIKE && !((g.monAt(nx, ny) || g.npcAt(nx, ny)) && !isGoal));
      if (ok) { d[nk] = d[k] + 1; prev[nk] = k; q.push(nk); } } }
  return null;
}
export function firstStep(g, r) { let k = r.k, p = r.prev[k]; while (p >= 0 && r.prev[p] >= 0) { k = p; p = r.prev[p]; } const x = k % W, y = (k / W) | 0; return [x - g.pl.x, y - g.pl.y]; }
export function botTurn(g, st = {}) {
  if (g.mode === 'dialog') { const d = g.dialog; if (d.i < d.pages.length - 1) g.dlgNext(); else if (d.choices) g.dlgChoose(0); else g.dlgNext(); return 'dlg'; }
  if (g.mode !== 'play') return 'stop';
  const pl = g.pl, f = g.f;
  // 1. 위험 지대면 벗어난다
  const inHaz = g.haz.some(h => h.tiles.some(([x, y]) => x === pl.x && y === pl.y));
  if (inHaz) { const opts = DIRS.map(([dx, dy]) => [dx, dy, pl.x + dx, pl.y + dy]).filter(([dx, dy, x, y]) => g.walkable(x, y) && !g.monAt(x, y) && !g.haz.some(h => h.tiles.some(([a, b]) => a === x && b === y)) && f.p[I(x, y)] !== P.SPIKE && passT(f.t[I(x, y)])); if (opts.length) { const o = opts[g.R.ri(opts.length)]; g.move(o[0], o[1]); return 'dodge'; } }
  // 2. 인접한 적
  for (const [dx, dy] of DIRS) { const m = g.monAt(pl.x + dx, pl.y + dy); if (m) { g.move(dx, dy); return 'atk'; } }
  // 3. 목표 선택
  let goal;
  if (pl.flame < pl.maxflame * 0.45) { const r = bfs(g, (x, y) => { const k = I(x, y); return f.p[k] === P.BRAZIER || (f.p[k] === P.CAMP && !f.campUsed) || g.items.some(i => i.x === x && i.y === y && i.kind === 'ember'); }); if (r) { const [dx, dy] = firstStep(g, r); g.move(dx, dy); return 'refuel'; } }
  if (pl.hp < pl.maxhp * 0.5 && !f.campUsed && f.camp) { const r = bfs(g, (x, y) => x === f.camp.x && y === f.camp.y); if (r) { const [dx, dy] = firstStep(g, r); g.move(dx, dy); return 'camp'; } }
  const near = bfs(g, (x, y) => g.items.some(i => i.x === x && i.y === y && !i.altar && (i.kind === 'ember' || (i.kind === 'herb' && (g.run.herbs < g.herbCap() || pl.hp < pl.maxhp)) || i.kind === 'ash' || i.kind === 'key' || i.kind === 'note')) && (Math.abs(x - pl.x) + Math.abs(y - pl.y) < 14));
  if (near && near.d[near.k] < 16) { const [dx, dy] = firstStep(g, near); g.move(dx, dy); return 'loot'; }
  if (f.altars?.length && g.items.some(i => i.altar)) { const r = bfs(g, (x, y) => f.p[I(x, y)] === P.ALTAR && g.items.some(i => i.altar && i.x === x && i.y === y)); if (r) { const [dx, dy] = firstStep(g, r); g.move(dx, dy); return 'altar'; } }
  if (f.boss && f.bossState === 'none') { const a = f.arena; const r = bfs(g, (x, y) => x === a.cx && y === a.y + 5); if (r) { const [dx, dy] = firstStep(g, r); g.move(dx, dy); return 'arena'; } }
  if (f.boss && f.bossState === 'fight') { const b = g.mons.find(q => MONSTERS[q.type].boss) || g.mons[0]; if (b) { const r = bfs(g, (x, y) => x === b.x && y === b.y, { avoidHaz: true }); if (r) { const [dx, dy] = firstStep(g, r); g.move(dx, dy); return 'boss'; } g.wait(); return 'wait'; } }
  const ex = f.exit; const r = bfs(g, (x, y) => x === ex.x && y === ex.y); if (r) { const [dx, dy] = firstStep(g, r); const nx = pl.x + dx, ny = pl.y + dy; g.move(dx, dy); return 'exit'; }
  g.wait(); return 'wait';
}
export function runBot(seed, maxTurns = 4000, startDepth = 0) {
  const g = new Game(undefined, seed); g.enterVillage(); while (g.mode === 'dialog') g.dlgNext();
  g.meta.heirSel = 0; g.startRun(startDepth); let n = 0, maxD = startDepth; const stats = { acts: {} };
  while (n++ < maxTurns && g.mode !== 'dead' && g.mode !== 'ending') { const a = botTurn(g); stats.acts[a] = (stats.acts[a] || 0) + 1; if (g.run) maxD = Math.max(maxD, g.run.depth); if (g.mode === 'dead') break; g.drain(); }
  return { g, maxD, turns: n, stats };
}
