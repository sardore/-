// 메가리그 전투 엔진 — DOM 없는 순수 JS. 상태는 전부 평범한 객체라 structuredClone 으로 복제할 수 있다.
// 카드 데이터/기술 구현은 cards.js 가 register() 로 등록한다.
export const COLORS = ['R', 'W', 'B'];
export const STATUS_NAME = { poison: '독', slow: '감속', paralyze: '마비', burn: '화상', freeze: '냉동', traitSeal: '특성봉인', skillSeal: '기술봉인', healSeal: '회복봉인' };
export const CRIT_MULT = 1.5;
const REG = {};
export const register = list => { for (const c of list) REG[c.id] = c; };
export const allCards = () => Object.values(REG);
export const def = u => REG[typeof u === 'string' ? u : u.id];
export const other = t => (t === 'P' ? 'A' : 'P');

/* ───────── 난수 / 보조 ───────── */
export function hashSeed(s) { let h = 2166136261 >>> 0; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rnd(g) { let t = (g.rs = (g.rs + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const rint = (g, a, b) => a + Math.floor(rnd(g) * (b - a + 1));
export const pick = (g, arr) => arr[Math.floor(rnd(g) * arr.length)];
export function peekRng(g) { const s = g.rs, v = rnd(g); g.rs = s; return v; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R1 = n => Math.round(n);
export const clone = o => structuredClone(o);

/* ───────── 조회 ───────── */
export const U = (g, uid) => g.u[uid];
export const unitAt = (g, team, slot) => { const id = g.t[team].field[slot]; return id ? g.u[id] : null; };
export const fieldUnits = (g, team) => g.t[team].field.map(id => (id ? g.u[id] : null)).filter(u => u && !u.dead);
export const benchUnits = (g, team) => g.t[team].bench.map(id => (id ? g.u[id] : null)).filter(u => u && !u.dead);
export const teamUnits = (g, team) => ['field', 'bench'].flatMap(k => g.t[team][k]).map(id => (id ? g.u[id] : null)).filter(u => u && !u.dead);
export const slotOf = (g, u) => g.t[u.team].field.indexOf(u.uid);
export const onField = (g, u) => slotOf(g, u) >= 0;
export const status = (u, s) => u.st[s] || 0;
export const traitOn = (g, u) => !!u && !u.dead && !u.st.traitSeal && !(HK?.suppressed && HK.suppressed(g, u));
export const hasTag = (u, tag) => (def(u).tags || []).includes(tag);
export function log(g, text, cls = '') { g.logs.push({ text, cls, n: g.stats.turns }); if (g.logs.length > 400) g.logs.shift(); g.ev.push({ type: 'log', text, cls }); }
export const ev = (g, type, d = {}) => { g.ev.push({ type, ...d }); };
export const notice = (g, u, text, cls = '') => ev(g, 'notice', { uid: u.uid, text, cls });

/* ───────── 생성 ───────── */
function mkUnit(g, id, team, idx) {
  const c = REG[id];
  const u = { uid: team + idx, id, team, idx, name: c.name, hp: c.hp, maxHp: c.hp, shield: c.shield || 0, baseDef: c.def || 0, defMod: 0, atkMod: 0, e: [], st: {}, seal: {}, bar: [], dead: false,
    deployed: false, delay: 0, last: null, lastSkill: null, lastTarget: null, turns: 0, used: {}, noAtk: false, invul: false, hide: 0, sched: null, costCut: 0, nextCostCut: 0, fx: {}, forms: null,
    stat: { dealt: 0, taken: 0, skills: 0, healed: 0, status: 0 } };
  def(u).init?.(g, u);
  return u;
}
export function newGame(deckP, deckA, o = {}) {
  const g = { v: 1, rs: hashSeed(o.seed ?? Math.random()), variance: o.variance !== false, mode: o.mode || 'human', u: {}, t: { P: { field: [], bench: [], dead: [], sw: 0, trap: [null, null], rev: [] }, A: { field: [], bench: [], dead: [], sw: 0, trap: [null, null], rev: [] } },
    order: [], turn: 0, round: 1, serial: 0, field: null, winner: null, ev: [], logs: [], stats: { turns: 0 }, noDmg: 0, lastDealt: 0, prep: null, chain: null };
  for (const [team, deck] of [['P', deckP], ['A', deckA]]) {
    deck.forEach((id, i) => { const u = mkUnit(g, id, team, i); g.u[u.uid] = u; });
    g.t[team].field = [team + 0, team + 1]; g.t[team].bench = [team + 2, team + 3];
  }
  const first = o.first || (rnd(g) < 0.5 ? 'P' : 'A'); g.first = first;
  g.order = first === 'P' ? [['P', 0], ['A', 0], ['P', 1], ['A', 1]] : [['A', 0], ['P', 0], ['A', 1], ['P', 1]];
  for (const team of ['P', 'A']) for (const uid of g.t[team].field) deployInit(g, g.u[uid], true);
  return g;
}
function deployInit(g, u, start = false) {
  u.deployed = true; if (!g.t[u.team].rev.includes(u.uid)) g.t[u.team].rev.push(u.uid);
  const sp = def(u).speed || 0; u.delay = sp < 0 ? -sp : 0;
  def(u).onDeploy?.(g, u, start); HK?.onDeploy?.(g, u, start);
}

export function transform(g, u, toId) { // 형태 변화: 같은 유닛이 다른 카드로 바뀐다 (HP·에너지·상태는 유지)
  const c = REG[toId]; if (!c) return; const from = u.name; u.id = toId; u.name = c.name; u.maxHp = c.hp; u.hp = Math.min(u.hp, u.maxHp); u.baseDef = c.def || 0;
  log(g, `${from} → ${c.name} 로 변화!`, 'turn'); ev(g, 'transform', { uid: u.uid, to: toId }); c.onTransformIn?.(g, u);
}

/* ───────── 에너지 ───────── */
export const eTotal = u => u.e.reduce((n, x) => n + x.a, 0);
export const eCount = (u, c) => u.e.reduce((n, x) => n + (x.c === c ? x.a : 0), 0);
export const eWhole = (u, c) => u.e.reduce((n, x) => n + (x.c === c ? Math.floor(x.a + 1e-6) : 0), 0);
export const maxE = u => def(u).maxE || 4;
export function normE(u) {
  u.e = u.e.filter(x => x.a > 0.01);
  for (const c of COLORS) { const hs = u.e.filter(x => x.c === c && x.a < 1); if (hs.length >= 2) { hs[0].a = 1; u.e.splice(u.e.indexOf(hs[1]), 1); } }
}
export function gain(g, u, c, a = 1, replace = null) {
  if (u.fx.noExternalE && replace === 'ext') return false;
  if (eTotal(u) + a > maxE(u) + 0.001) {
    if (replace == null) return false;
    const idx = [...new Set((Array.isArray(replace) ? replace : [replace]).filter(i => Number.isInteger(i) && i >= 0 && i < u.e.length))];
    const over = eTotal(u) + a - maxE(u); const rem = idx.reduce((s, i) => s + u.e[i].a, 0);
    if (!idx.length || rem + 0.001 < over) return false;
    for (const i of idx.sort((x, y) => y - x)) u.e.splice(i, 1);
  }
  u.e.push({ c, a }); normE(u); ev(g, 'energy', { uid: u.uid, c, a, kind: 'gain' });
  def(u).onEnergy?.(g, u);
  return true;
}
export function removeE(g, u, amount, by = null) { // 반에너지를 먼저, 없으면 앞에서부터
  if (!u.e.length) return 0; if (u.fx.noExternalE && by && by.team !== u.team) { log(g, `${u.name}: 외부 에너지 조작을 차단.`); return 0; }
  let i = u.e.findIndex(e => e.a === 0.5); if (i < 0) i = 0; const e = u.e[i], x = Math.min(e.a, amount); e.a -= x; normE(u);
  ev(g, 'energy', { uid: u.uid, c: e.c, a: -x, kind: 'lose' }); log(g, `${u.name}의 에너지 ${x === 0.5 ? '½' : x}개 제거.`); def(u).onEnergy?.(g, u); return x;
}
export function removeEntry(g, u, idx, by = null) { // 선택한 에너지 하나를 통째로
  if (u.fx.noExternalE && by && by.team !== u.team) return null; const e = u.e[idx]; if (!e) return null; u.e.splice(idx, 1); ev(g, 'energy', { uid: u.uid, c: e.c, a: -e.a, kind: 'lose' }); def(u).onEnergy?.(g, u); return e;
}
export function clearE(g, u, by = null) { if (u.fx.noExternalE && by && by.team !== u.team) return 0; const n = eTotal(u); if (n) { u.e = []; ev(g, 'energy', { uid: u.uid, kind: 'clear' }); def(u).onEnergy?.(g, u); } return n; }
export function recolor(g, u, to, all = false, by = null, idx = null) {
  if (!u.e.length) return 0; if (u.fx.noExternalE && by && by.team !== u.team) return 0; let ch = 0;
  if (all) u.e.forEach(e => { if (e.c !== to) { ch += e.a; e.c = to; } });
  else { const e = idx != null ? u.e[idx] : u.e.find(x => x.c !== to); if (e && e.c !== to) { ch = e.a; e.c = to; } }
  normE(u); if (ch) { ev(g, 'energy', { uid: u.uid, c: to, a: 0, kind: 'recolor' }); log(g, `${u.name}의 에너지 ${ch === 0.5 ? '½' : ch}개가 ${to}로 변경.`); } return ch;
}
export function gatherColors(g, u) { // 이번 자연 수급에서 나올 수 있는 색
  let c = ['R', 'W', 'B']; const t = u.team;
  for (const x of fieldUnits(g, t)) { const d = def(x); if (d.gatherFilter && traitOn(g, x)) c = d.gatherFilter(g, x, c, u); }
  if (def(u).gatherColors && traitOn(g, u)) c = def(u).gatherColors(g, u, c);
  return c.length ? c : ['R', 'W', 'B'];
}
export function peekGather(g, u) {
  const half = status(u, 'slow') ? 0.5 : 1, ex = half === 0.5 ? u.e.find(e => e.a === 0.5) : null;
  const cs = gatherColors(g, u); const c = ex ? ex.c : cs[Math.floor(peekRng(g) * cs.length)];
  return { c, a: half, merged: !!ex };
}

/* ───────── 코스트 / 결제 ───────── */
export function tokensOf(str = '') { const o = []; for (let i = 0; i < str.length;) { if (str.startsWith('WorB', i)) { o.push('WorB'); i += 4; } else if (str.startsWith('RorB', i)) { o.push('RorB'); i += 4; } else if ('RWB*'.includes(str[i])) { o.push(str[i]); i++; } else i++; } return o; }
export function effCost(g, u, sk, tgt = null) {
  let raw = typeof sk.cost === 'function' ? sk.cost(g, u, tgt) : sk.cost; let tk = tokensOf(raw);
  if (u.costCut > 0) { let r = u.costCut; while (r-- > 0 && tk.length) tk.pop(); }
  const gf = g.field; if (gf && gf.kind === 'grand') { if (gf.team === u.team) tk = tk.map(x => (x === 'W' || x === 'B' ? '*' : x)); else tk = tk.map(x => (x === '*' ? 'WorB' : x)); }
  if (status(u, 'poison')) { const pressure = HK?.downPressure?.(g, u.team); tk.push(pressure ? 'B' : gf && gf.kind === 'grand' && gf.team !== u.team ? 'WorB' : '*'); }
  return tk;
}
export function pool(u) { const p = { R: 0, W: 0, B: 0 }; for (const c of COLORS) p[c] = eWhole(u, c); return p; }
export function planPays(u, tokens, flex = false) { // 가능한 결제 조합 (색별 개수) 전체. flex: W 를 R/B 대신 낼 수 있음
  if (flex && eWhole(u, 'W') > 0) {
    const nR = tokens.filter(t => t === 'R').length, nB = tokens.filter(t => t === 'B').length, seen = new Set(), out = [];
    for (let kr = 0; kr <= nR; kr++) for (let kb = 0; kb <= nB; kb++) { let r = kr, b = kb; const tk = tokens.map(t => { if (t === 'R' && r > 0) { r--; return 'W'; } if (t === 'B' && b > 0) { b--; return 'W'; } return t; });
      for (const p of planPays0(u, tk)) { const k = p.R + ',' + p.W + ',' + p.B; if (!seen.has(k)) { seen.add(k); out.push(p); } } }
    return out;
  }
  return planPays0(u, tokens);
}
export const payPlans = (g, u, tk) => planPays(u, tk, flexOf(g, u));
const flexOf = (g, u) => !!def(u).flexW && traitOn(g, u);
function planPays0(u, tokens) {
  const p = pool(u), need = { R: 0, W: 0, B: 0 }; let any = 0, wb = 0, rb = 0;
  for (const t of tokens) { if (t === '*') any++; else if (t === 'WorB') wb++; else if (t === 'RorB') rb++; else need[t]++; }
  for (const c of COLORS) if (p[c] < need[c]) return [];
  const rest = { R: p.R - need.R, W: p.W - need.W, B: p.B - need.B }, out = [];
  for (let w = 0; w <= wb; w++) for (let rr0 = 0; rr0 <= rb; rr0++) { const b = (wb - w) + (rb - rr0); const r2 = { R: rest.R - rr0, W: rest.W - w, B: rest.B - b }; if (r2.R < 0 || r2.W < 0 || r2.B < 0) continue;
    for (let r = 0; r <= any; r++) for (let ww = 0; ww + r <= any; ww++) { const bb = any - r - ww; if (r2.R < r || r2.W < ww || r2.B < bb) continue; out.push({ R: need.R + rr0 + r, W: need.W + w + ww, B: need.B + b + bb }); } }
  return out;
}
export const canPay = (u, tokens, flex = false) => planPays(u, tokens, flex).length > 0;
export function autoPlan(g, u, tokens, prefer = null) {
  const plans = planPays(u, tokens, flexOf(g, u)); if (!plans.length) return null; if (plans.length === 1) return plans[0];
  const sks = def(u).skills; let best = null, bs = -1e9;
  for (const p of plans) {
    const left = { R: eWhole(u, 'R') - p.R, W: eWhole(u, 'W') - p.W, B: eWhole(u, 'B') - p.B };
    let s = 0; for (const sk of sks) { const tk = tokensOf(typeof sk.cost === 'function' ? sk.cost(g, u) : sk.cost); if (affordable(left, tk)) s += 10 + tk.length; }
    s += Math.min(left.R, 2) * 0.4 + Math.min(left.W, 2) * 0.4 + Math.min(left.B, 2) * 0.4; if (prefer) s += (left[prefer] || 0) * 0.5; if (s > bs) { bs = s; best = p; }
  }
  return best;
}
function affordable(left, tk) { const l = { ...left }; let any = 0, wb = 0, rb = 0; for (const t of tk) { if (t === '*') any++; else if (t === 'WorB') wb++; else if (t === 'RorB') rb++; else { if (l[t] < 1) return false; l[t]--; } }
  for (let i = 0; i < wb; i++) { if (l.W >= 1) l.W--; else if (l.B >= 1) l.B--; else return false; }
  for (let i = 0; i < rb; i++) { if (l.R >= 1) l.R--; else if (l.B >= 1) l.B--; else return false; } return l.R + l.W + l.B >= any; }
export function spend(g, u, plan) { // 새로 얻은 에너지부터 소비
  const paid = []; for (const c of COLORS) { let n = plan[c] || 0; for (let i = u.e.length - 1; i >= 0 && n > 0; i--) { const e = u.e[i]; if (e.c !== c || e.a < 1 - 1e-6) continue; u.e.splice(i, 1); n--; paid.push(c); } }
  normE(u); ev(g, 'energy', { uid: u.uid, kind: 'spend', plan }); def(u).onEnergy?.(g, u); return paid;
}
export const planText = p => COLORS.filter(c => p[c]).map(c => c.repeat(p[c])).join('') || '0';

/* ───────── 상태이상 / 보조효과 ───────── */
export function statusImmune(g, u, s) {
  const d = def(u); if (!traitOn(g, u)) return false;
  if (d.immune && d.immune.includes(s)) return true;
  if (d.immuneFn && d.immuneFn(g, u, s)) return true; return false;
}
export function addStatus(g, src, u, s, turns) {
  if (!u || u.dead) return false;
  if (u.sched?.noStatus) { log(g, `${u.name}: 대기 중이라 ${STATUS_NAME[s]} 무효.`); notice(g, u, `${STATUS_NAME[s]} 무효`, 'immune'); return false; }
  const dd = def(u); if (dd.statusFilter) { const r = dd.statusFilter(g, u, s, turns, src); if (r === false) return false; }
  if (statusImmune(g, u, s)) { log(g, `${u.name}: 특성으로 ${STATUS_NAME[s]} 면역.`); notice(g, u, `${STATUS_NAME[s]} 면역`, 'immune'); return false; }
  u.st[s] = Math.max(status(u, s), turns); log(g, `${u.name}에게 ${STATUS_NAME[s]} ${turns}턴.`); ev(g, 'status', { uid: u.uid, s, turns }); notice(g, u, `${STATUS_NAME[s]} ${turns}`, 'status');
  if (src) src.stat.status += turns;
  const ir = fieldUnits(g, u.team).find(x => def(x).cleanse && traitOn(g, x));
  if (ir) { delete u.st[s]; log(g, `${ir.name} 특성 · 즉시 상태이상 치료: ${u.name}의 ${STATUS_NAME[s]} 제거.`); notice(g, u, `${STATUS_NAME[s]} 치료`, 'cure'); heal(g, ir, u, 20, 'cleanse'); def(ir).onCleansed?.(g, ir, u, src); }
  return true;
}
export function clearStatuses(g, u, only = null) { for (const s of Object.keys(u.st)) if (!only || only.includes(s)) delete u.st[s]; u.seal = {}; ev(g, 'cure', { uid: u.uid }); }
export function heal(g, src, u, n, why = 'heal', o = {}) {
  if (!u || u.dead) return 0; if (status(u, 'healSeal')) { log(g, `${u.name}: 회복봉인으로 회복 실패.`); return 0; }
  let base = Math.max(0, R1(n)); const adj = HK?.healAdjust ? HK.healAdjust(g, u, base, src) : base;
  const miss = Math.max(0, u.maxHp - u.hp), got = Math.max(0, Math.min(adj, miss));
  u.hp += got; if (src && src.stat) src.stat.healed += got;
  log(g, `${u.name} HP ${got} 회복.`, 'heal'); if (got > 0) ev(g, 'heal', { uid: u.uid, n: got });
  if (o.overflowShield && adj > got) { const ex = adj - got; addBarrier(g, u, ex, { cap: o.overflowShield, keep: true, kind: 'elixian' }); }
  if (got > 0 && src && !o.noSplash) { const sp = def(src).healSplash; if (sp && traitOn(g, src) && src.team === u.team) { const part = Math.floor(miss * sp); if (part > 0) { log(g, `${src.name} 특성 · 회복 확산: 필드 아군 전체 ${part} 회복.`, 'heal'); for (const a of fieldUnits(g, u.team)) heal(g, src, a, part, 'splash', { noSplash: true }); } } }
  return got;
}
export function addShield(g, u, n, max = 999) { n = Math.max(0, R1(n)); const got = Math.min(n, Math.max(0, max - u.shield)); u.shield += got; if (got) { log(g, `${u.name} 실드 +${got}${got < n ? ' (상한)' : ''}.`); ev(g, 'shield', { uid: u.uid, n: got }); notice(g, u, `실드 +${got}`, 'shield'); } return got; }
export function addBarrier(g, u, n, o = {}) { // HP 보호막 (실드 뒤, HP 앞). 총량은 최대 HP 를 넘지 못하고, keep 이 아니면 자기 차례마다 절반으로 줄어든다
  const kind = o.kind || 'std', total = u.bar.reduce((s, b) => s + b.n, 0), kindTotal = u.bar.filter(b => b.kind === kind).reduce((s, b) => s + b.n, 0);
  let room = u.maxHp - total; if (o.cap != null) room = Math.min(room, o.cap - kindTotal);
  const got = Math.max(0, Math.min(Math.round(n), room)); if (got <= 0) return 0; u.bar.push({ n: got, keep: !!o.keep, kind }); log(g, `${u.name} HP 보호막 +${got}.`); ev(g, 'shield', { uid: u.uid, n: got, bar: true }); notice(g, u, `보호막 +${got}`, 'shield'); return got;
}

/* ───────── 피해 ───────── */
export const ignoresStats = (src, tgt) => !!(src && def(src).ignoreMods) || !!(tgt && def(tgt).ignoreMods);
export function defOf(g, src, tgt, eff = {}) {
  const ig = src ? ignoresStats(src, tgt) : false, d = def(tgt);
  if (d.baseDefTrait && (!traitOn(g, tgt) || ig)) return 0;
  let v = tgt.baseDef + (ig ? 0 : tgt.defMod * (eff.defModMult ?? 1));
  if (eff.defCap != null) v = Math.min(v, eff.defCap);
  if (!ig && HK?.defAdjust) v += HK.defAdjust(g, tgt);
  return v;
}
function incoming(g, src, tgt, n, eff) { // 개별 피해 경감 단계
  const d = def(tgt);
  if (tgt.invul && !eff.pierceInvul) return 0; if (tgt.noAtk && eff.kind !== 'effect') return 0;
  if (d.reduce && traitOn(g, tgt)) n = Math.max(0, n - d.reduce);
  if (HK?.finalAdjust) n = HK.finalAdjust(g, src, tgt, n, eff);
  return Math.max(0, n);
}
export function protectorOf(g, tgt) { return fieldUnits(g, tgt.team).find(x => x !== tgt && def(x).protector && traitOn(g, x) && x.shield > 0) || null; }
function applyPacket(g, src, tgt, n, eff) {
  let dealt = 0; const ab = def(tgt).absorb; if (ab && n > 0 && eff.kind !== 'effect') { n = ab(g, tgt, n, eff); if (n <= 0) { ev(g, 'dmg', { uid: tgt.uid, n: 0 }); return 0; } } const pr = !eff.noProtect ? protectorOf(g, tgt) : null;
  if (pr && n > 0) { const toP = Math.floor(n / 2); const old = pr.shield, ab = Math.min(old, toP); pr.shield -= ab; dealt += ab; log(g, `${pr.name} 특성 · 실드 대신피해: ${tgt.name} ${n - toP}D / 실드 ${toP}D${toP > old ? ' (초과 소멸)' : ''}.`); ev(g, 'dmg', { uid: pr.uid, n: ab, shield: true }); n -= toP; }
  if (tgt.shield > 0) { const old = tgt.shield, ab = Math.min(old, n); tgt.shield -= ab; dealt += ab; ev(g, 'dmg', { uid: tgt.uid, n: ab, shield: true, crit: eff.crit });
    if (eff.shieldMelt && n > old) dealt += hpPortion(g, tgt, n - old, eff); else log(g, `${tgt.name} 실드 ${old} → ${tgt.shield}${n > old ? ' (초과 소멸)' : ''}.`); }
  else dealt += hpPortion(g, tgt, n, eff, eff.crit);
  return dealt;
}
function hpPortion(g, tgt, n, eff = {}, crit = false) {
  if (n <= 0) { ev(g, 'dmg', { uid: tgt.uid, n: 0 }); return 0; } let abs = 0;
  for (let i = 0; i < tgt.bar.length && n > 0; i++) { const b = tgt.bar[i], x = Math.min(b.n, n); b.n -= x; n -= x; abs += x; } tgt.bar = tgt.bar.filter(b => b.n > 0);
  if (abs) { log(g, `${tgt.name} HP 보호막 ${abs} 소모.`); ev(g, 'dmg', { uid: tgt.uid, n: abs, shield: true }); }
  const old = tgt.hp; tgt.hp -= n; if (n) ev(g, 'dmg', { uid: tgt.uid, n, crit }); log(g, `${tgt.name} HP ${old} → ${Math.max(0, tgt.hp)}.`, 'damage'); def(tgt).onHp?.(g, tgt, old); return abs + n;
}
export function fixed(g, u, n, label = '피해', o = {}) { // 비공격 고정 피해: 방어·난수 없이 실드 → 보호막 → HP
  if (!u || u.dead) return 0; let raw = R1(n); let fin = raw; const d = def(u); if (d.reduce && traitOn(g, u)) fin = Math.max(0, fin - d.reduce);
  if (u.invul && !o.pierce) fin = 0; log(g, `${u.name}: ${label} 피해 ${raw}${raw !== fin ? ` → ${fin}` : ''}.`, 'damage'); if (fin > 0) g.noDmg = 0;
  const got = applyPacket(g, null, u, fin, { kind: 'effect', noProtect: true, shieldMelt: !!o.shieldMelt }); u.stat.taken += got; checkDeath(g, u); return got;
}
export function hit(g, src, tgt, eff, sk = null) {
  const sname = sk?.name || eff.label || '공격'; let total = 0;
  if (!tgt || tgt.dead) return 0;
  const ev0 = def(tgt).evade; if (ev0 && traitOn(g, tgt) && eff.kind !== 'effect' && rnd(g) < ev0) { log(g, `${tgt.name} 특성 · 회피!`); notice(g, tgt, '회피', 'dodge'); ev(g, 'dodge', { uid: tgt.uid }); return 0; }
  const hits = eff.hits || 1;
  for (let h = 1; h <= hits; h++) {
    if (src.dead || tgt.dead) break;
    const ig = ignoresStats(src, tgt); let base = eff.amount;
    if (!ig && !eff.ignoreAtk) base += src.atkMod;
    const sd = def(src); if (sd.dmgBonus && traitOn(g, src) && !eff.noTraitBonus) base += sd.dmgBonus(g, src, tgt, eff, sk) || 0;
    if (eff.bonus) base += eff.bonus(g, src, tgt) || 0;
    const td = def(tgt);
    let cc = eff.forceCrit ? 1 : eff.crit ?? (sd.crit && traitOn(g, src) ? sd.crit : 0), crit = cc >= 1 ? true : cc > 0 && rnd(g) < cc;
    let pct = g.variance && !eff.noVar ? rint(g, 66, 100) : 100; let after;
    if (crit) { const b2 = (eff.amount + (ig ? 0 : Math.max(0, src.atkMod)) + (sd.dmgBonus && traitOn(g, src) ? sd.dmgBonus(g, src, tgt, eff, sk) || 0 : 0)) * CRIT_MULT; after = Math.round((b2 * pct) / 100); log(g, `${sname}: 크리티컬!`); }
    else { const dfn = eff.ignoreDef ? 0 : defOf(g, src, tgt, eff); after = Math.max(0, (base * pct) / 100 - dfn); }
    if (HK?.sweetProt) after = Math.max(0, after - HK.sweetProt(g, src, tgt));
    if (tgt.hide > 0 && !eff.ignoreHide) { after = Math.max(0, after - 30); tgt.hide--; log(g, `${tgt.name} 효과 · 모래숨기 -30 (남은 ${tgt.hide}회).`); }
    after = incoming(g, src, tgt, Math.round(after), eff);
    const fin = Math.round(after);
    if (eff.failUnlessKill && !(fin >= tgt.hp + tgt.shield)) { log(g, `${sname}: ${tgt.name}이 버텨 기술 실패.`); notice(g, tgt, '버팀', 'dodge'); return total; }
    log(g, `${sname}${hits > 1 ? ` ${h}/${hits}` : ''}: ${R1(base)}D${g.variance && !eff.noVar ? ` ×${pct}%` : ''}${crit ? ' (치명)' : ''} → ${fin}D`, 'damage');
    ev(g, 'hitfx', { src: src.uid, tgt: tgt.uid, skill: sk?.id || null, i: h, crit });
    const got = applyPacket(g, src, tgt, fin, { ...eff, crit }); total += got; src.stat.dealt += got; tgt.stat.taken += got; if (got > 0) g.noDmg = 0;
    if (traitOn(g, tgt) && td.onHit) td.onHit(g, tgt, src, fin, eff);
    if (got > 0) for (const x of fieldUnits(g, tgt.team)) if (x !== tgt && def(x).onAllyHit && traitOn(g, x)) def(x).onAllyHit(g, x, tgt, got);
    if (td.reflect && traitOn(g, tgt) && eff.kind !== 'effect' && !src.dead) { log(g, `${tgt.name} 특성 · 반사 ${td.reflect}.`); fixed(g, src, td.reflect, `${tgt.name} 반사`); }
    checkDeath(g, tgt, src); checkDeath(g, src, tgt);
  }
  return total;
}
export function hpPct(g, src, tgt, n, kind = 'cur', label = '비례 피해') { // 방어·난수 없이 대상 HP 비율 피해
  const amt = Math.round(n); log(g, `${label}: ${amt}D (방어·난수 무시).`, 'damage'); ev(g, 'hitfx', { src: src?.uid, tgt: tgt.uid });
  const got = applyPacket(g, src, tgt, incoming(g, src, tgt, amt, { kind: 'attack', pierceInvul: false }), { kind: 'attack' }); if (src) src.stat.dealt += got; tgt.stat.taken += got; if (got > 0) g.noDmg = 0; checkDeath(g, tgt, src); return got;
}

/* ───────── 사망 / 승패 ───────── */
export function checkDeath(g, u, killer = null) {
  if (!u || u.dead || u.hp > 0) return false; u.hp = 0; u.dead = true; u.sched = null; const t = g.t[u.team]; const si = t.field.indexOf(u.uid);
  if (si >= 0) { t.field[si] = null; } const bi = t.bench.indexOf(u.uid); if (bi >= 0) t.bench[bi] = null; t.dead.push(u.uid);
  log(g, `${u.name} 쓰러졌다!`, 'death'); ev(g, 'death', { uid: u.uid, team: u.team, slot: si });
  def(u).onDeath?.(g, u, killer, si);
  for (const x of teamUnits(g, u.team)) def(x).onAllyDeath?.(g, x, u);
  checkWinner(g); return true;
}
export function checkWinner(g) {
  if (g.winner) return g.winner; const a = teamUnits(g, 'P').length, b = teamUnits(g, 'A').length;
  if (!a && !b) g.winner = g.order[g.turn][0] === 'P' ? 'A' : 'P'; else if (!a) g.winner = 'A'; else if (!b) g.winner = 'P';
  if (g.winner) { log(g, g.winner === 'P' ? '플레이어 승리!' : 'AI 승리!', 'win'); ev(g, 'win', { team: g.winner }); } return g.winner;
}

/* ───────── 대상 / 기술 상태 ───────── */
export const tgtKind = (g, u, sk) => (typeof sk.target === 'function' ? sk.target(g, u) : sk.target || 'enemy');
export function resolveTargets(g, u, sk) {
  const t = u.team, e = other(t), tgt = tgtKind(g, u, sk);
  const ref = x => ({ team: x.team, slot: slotOf(g, x), uid: x.uid });
  switch (tgt) {
    case 'enemy': return fieldUnits(g, e).map(ref);
    case 'ally': return fieldUnits(g, t).map(ref);
    case 'allyOther': case 'allyOtherAny': return fieldUnits(g, t).filter(x => x !== u).map(ref);
    case 'anyCharacter': return [...fieldUnits(g, t), ...fieldUnits(g, e)].map(ref);
    case 'enemySlot': return [0, 1].map(i => ({ team: e, slot: i, uid: g.t[e].field[i] || null, slotOnly: true }));
    case 'enemyField': case 'field': case 'self': case 'none': return [{ team: t, slot: slotOf(g, u), uid: u.uid, virtual: true }];
    case 'lowestEnergyEnemy': { const es = fieldUnits(g, e); if (!es.length) return []; const m = Math.min(...es.map(eTotal)); return es.filter(x => eTotal(x) === m).map(ref).slice(0, 1).concat([]); }
    default: return [{ team: t, slot: slotOf(g, u), uid: u.uid, virtual: true }];
  }
}
export function skillBlock(g, u, sk) { // 사용할 수 없는 이유 (없으면 null)
  if (status(u, 'freeze')) return '냉동'; if (status(u, 'skillSeal')) return '기술봉인';
  if (u.seal && u.seal[sk.id] > 0) return '기술봉인'; if (sk.once && u.used[sk.id]) return '1회 사용';
  if (sk.req && !sk.req(g, u)) return sk.reqText || '조건 미충족';
  const tk = effCost(g, u, sk); if (!canPay(u, tk, flexOf(g, u))) return '에너지 부족';
  if (resolveTargets(g, u, sk).length === 0) return '대상 없음'; return null;
}
export function switchCost(u) { return Math.max(0, 1 - (def(u).speed || 0) + Object.values(u.st).reduce((n, d) => n + Math.max(0, d), 0) + Object.values(u.seal || {}).reduce((n, d) => n + Math.max(0, d), 0)); }
export function canSwitch(g, u) { const t = g.t[u.team]; if (t.sw >= 3) return false; if (HK?.switchLocked?.(g, u.team)) return false; if (status(u, 'freeze')) return false; return canPay(u, Array(switchCost(u)).fill('*')); }

/* ───────── 차례 흐름 ───────── */
export const cur = g => { const [team, slot] = g.order[g.turn]; return { team, slot, u: unitAt(g, team, slot) }; };
function prepTurn(g) {
  const key = g.serial; if (g.prep === key) return; g.prep = key; const { u } = cur(g); if (!u || u.dead) return;
  if (u.invul) { u.invul = false; log(g, `${u.name}: 무적 종료.`); } if (u.noAtk && u.noAtkUntil != null && u.turns >= u.noAtkUntil) { u.noAtk = false; u.noAtkUntil = null; log(g, `${u.name}: 방어 효과 종료.`); }
  if (u.bar.length) { for (const b of u.bar) if (!b.keep) b.n = Math.floor(b.n / 2); u.bar = u.bar.filter(b => b.n > 0); }
  u.costCut = u.nextCostCut || 0; u.nextCostCut = 0; if (u.costCut) log(g, `${u.name}: 이번 차례 기술 코스트 ${u.costCut} 감소.`);
  def(u).turnStart?.(g, u); HK?.turnStart?.(g, u);
  // 장벽(보호막 층) 처리는 카드 훅이 담당
}
export function info(g) { // UI/AI 가 쓰는 현재 차례 설명
  if (g.winner) return { kind: 'over', winner: g.winner };
  prepTurn(g); const { team, slot, u } = cur(g), t = g.t[team];
  if (!u || u.dead) return { kind: 'deploy', team, slot, options: benchUnits(g, team).map(b => b.uid) };
  if (u.delay > 0) return { kind: 'auto', why: 'delay', team, slot, uid: u.uid };
  if (u.sched) return { kind: 'auto', why: 'sched', team, slot, uid: u.uid };
  const o = { kind: 'input', team, slot, uid: u.uid, gather: !status(u, 'paralyze') && !(def(u).noGather?.(g, u)), skills: [], switches: [] };
  if (canSwitch(g, u)) for (let i = 0; i < t.bench.length; i++) { const b = t.bench[i] && g.u[t.bench[i]]; if (b && !b.dead) o.switches.push({ bench: i, uid: b.uid, cost: switchCost(u) }); }
  for (const sk of def(u).skills) {
    let why = skillBlock(g, u, sk); const tk = effCost(g, u, sk); let targets = why ? [] : resolveTargets(g, u, sk);
    if (!why && sk.dynCost) { targets = targets.filter(t => canPay(u, effCost(g, u, sk, t.uid ? g.u[t.uid] : null), flexOf(g, u))); if (!targets.length) why = '에너지 부족'; }
    o.skills.push({ id: sk.id, ok: !why, why, tokens: tk, plans: why ? [] : planPays(u, tk, flexOf(g, u)), targets: why ? [] : targets, sk, plus: sk.plus || null }); }
  o.pass = !o.gather && !o.switches.length && !o.skills.some(x => x.ok);
  return o;
}
function endTurn(g, u, usedSkill) {
  if (u && !u.dead) {
    if (status(u, 'burn') && !usedSkill) fixed(g, u, 30, '화상');
    if (!u.dead) {
      const regen = def(u).regen && traitOn(g, u); if (regen) for (const s of Object.keys(u.st)) if (s !== 'traitSeal' && u.st[s] > 1) u.st[s] -= 1;
      for (const s of Object.keys(u.st)) { if (u.st[s] > 0) { u.st[s]--; if (u.st[s] <= 0) { delete u.st[s]; notice(g, u, `${STATUS_NAME[s]} 종료`, 'cure'); } } }
      for (const k of Object.keys(u.seal)) { u.seal[k]--; if (u.seal[k] <= 0) delete u.seal[k]; }
      u.turns++; u.costCut = 0; def(u).turnEnd?.(g, u, usedSkill); HK?.turnEnd?.(g, u);
    }
  }
  g.stats.turns++;
  let dealt = 0; for (const x of Object.values(g.u)) dealt += x.stat.dealt; if (dealt > g.lastDealt) { g.lastDealt = dealt; g.noDmg = 0; } else g.noDmg++;
  if (!g.winner && u && !u.dead) { // 교착 방지
    if (g.noDmg >= 120) { const s = g.noDmg; fixed(g, u, 10 + Math.floor((s - 120) / 8) * 10, '교착 압박', { pierce: true }); g.noDmg = s; }
    if (g.stats.turns >= 800) { const s = g.noDmg; fixed(g, u, 40 + Math.floor((g.stats.turns - 800) / 16) * 40, '결판 압박', { pierce: true }); g.noDmg = s; }
  }
  g.turn = (g.turn + 1) % 4; g.serial++; if (g.turn === 0) g.round++; checkWinner(g);
  if (g.chain && !g.winner) { const c = g.chain; const x = g.u[c.uid]; if (x && !x.dead && onField(g, x) && c.left > 0) { c.left--; g.turn = g.order.findIndex(o => o[0] === x.team && o[1] === slotOf(g, x)); log(g, `${x.name}: 추가 차례! (남은 ${c.left}회)`, 'turn'); } else g.chain = null; }
}
function skipEmpty(g) { // 후열도 없고 슬롯도 빈 차례는 건너뛴다
  for (let n = 0; n < 4; n++) { const { team, u } = cur(g); if ((!u || u.dead) && !benchUnits(g, team).length) { g.turn = (g.turn + 1) % 4; g.serial++; } else break; }
}
function autoAdvance(g) {
  for (let guard = 0; guard < 30 && !g.winner; guard++) {
    skipEmpty(g); const i = info(g); if (i.kind !== 'auto') return; const u = g.u[i.uid];
    if (i.why === 'delay') { u.delay--; log(g, `${u.name}: 출전 지연 (Speed ${def(u).speed}).`); ev(g, 'turn', { uid: u.uid, auto: 'delay' }); endTurn(g, u, false); }
    else { const s = u.sched; ev(g, 'turn', { uid: u.uid, auto: 'sched' }); def(u).runSched(g, u, s); if (!u.dead) endTurn(g, u, true); else endTurn(g, null, false); }
  }
}
export function begin(g) { g.ev = []; autoAdvance(g); return g.ev; }

export function deployUnit(g, team, slot, uid) {
  const t = g.t[team], bi = t.bench.indexOf(uid); if (bi < 0) return false; const b = g.u[uid]; t.bench[bi] = null; t.field[slot] = uid; deployInit(g, b); ev(g, 'deploy', { uid, team, slot });
  const trap = t.trap[slot]; if (trap) { t.trap[slot] = null; log(g, `${b.name}: 함정 발동!`); addStatus(g, null, b, trap.status, trap.turns); } log(g, `${b.name} 출전!`, 'turn'); return true;
}
function switchReal(g, u, benchIdx, plan) {
  const t = g.t[u.team], slot = slotOf(g, u), bid = t.bench[benchIdx], b = bid && g.u[bid]; if (!b || b.dead) return false;
  const c = switchCost(u), tk = Array(c).fill('*'), pl = plan || autoPlan(g, u, tk); if (!pl) return false; spend(g, u, pl); t.sw++;
  u.noAtk = false; u.invul = false; u.sched = null; u.lastTarget = null; def(u).onLeave?.(g, u);
  t.field[slot] = b.uid; t.bench[benchIdx] = u.uid; log(g, `${u.name} → ${b.name} 교체 (${t.sw}/3).`, 'turn'); ev(g, 'switch', { out: u.uid, in: b.uid, team: u.team, slot });
  deployInit(g, b); const trap = t.trap[slot]; if (trap) { t.trap[slot] = null; log(g, `${b.name}: 함정 발동!`); addStatus(g, null, b, trap.status, trap.turns); }
  return true;
}

/* ───────── 행동 실행 ───────── */
export function doGather(g, u, replace = null) {
  const amt = status(u, 'slow') ? 0.5 : 1, ex = amt === 0.5 ? u.e.find(e => e.a === 0.5) : null; const cs = gatherColors(g, u);
  const c = ex ? ex.c : pick(g, cs);
  if (def(u).onGatherDraw && traitOn(g, u)) { const r = def(u).onGatherDraw(g, u, c, amt, replace); if (r === true) { u.last = 'gather'; return true; } }
  if (eTotal(u) + amt > maxE(u) + 0.001) {
    let ri = replace; if (ri == null) ri = bestReplace(g, u, c, amt);
    if (ri == null || (Array.isArray(ri) && !ri.length)) { log(g, `${u.name}: ${c} 에너지 포기 (최대치).`); u.last = 'gather'; ev(g, 'energy', { uid: u.uid, c, a: 0, kind: 'skip' }); return true; }
    const old = [].concat(ri).map(i => u.e[i]).filter(Boolean).map(e => e.c + (e.a === 0.5 ? '½' : '')).join('+'); const ok = gain(g, u, c, amt, ri);
    log(g, ok ? `${u.name}: ${old} 버리고 ${c}${amt === 0.5 ? '½' : ''} 획득.` : `${u.name}: ${c} 에너지 포기.`);
  } else { gain(g, u, c, amt); log(g, `${u.name}: ${c} 에너지 ${amt === 0.5 ? '½' : 1} 획득.`); }
  u.last = 'gather'; def(u).afterGather?.(g, u, c, amt); HK?.afterGather?.(g, u, c, amt); return true;
}
export function bestReplace(g, u, col, amt) { // 가득 찼을 때 버릴 에너지 (AI/기본값)
  const need = eTotal(u) + amt - maxE(u); if (need <= 0) return null;
  const want = {}; for (const sk of def(u).skills) for (const t of tokensOf(typeof sk.cost === 'function' ? sk.cost(g, u) : sk.cost)) if (COLORS.includes(t)) want[t] = (want[t] || 0) + 1;
  const sc = e => (want[e.c] ? 2 : 0) + (eCount(u, e.c) > 1 ? -1 : 0) + e.a * 0.1; const idx = u.e.map((e, i) => i).sort((a, b) => sc(u.e[a]) - sc(u.e[b]));
  let acc = 0; const out = []; for (const i of idx) { out.push(i); acc += u.e[i].a; if (acc + 0.001 >= need) break; }
  if (acc + 0.001 < need) return null; if (sc({ c: col, a: amt }) <= Math.min(...out.map(i => sc(u.e[i])))) return null; return out;
}
function runSkill(g, u, sk, a) {
  const tk = a.tokens || effCost(g, u, sk); const plan = a.pay || autoPlan(g, u, tk); if (!plan) return false;
  const tref = a.target || resolveTargets(g, u, sk)[0]; const X = { plan, tokens: tk, extra: a.extra || {}, target: tref, plus: a.plus || null };
  const T = targetObj(g, u, sk, tref);
  const paidBefore = { R: eWhole(u, 'R'), W: eWhole(u, 'W'), B: eWhole(u, 'B') }; X.paidBefore = paidBefore; X.eBefore = eTotal(u); X.eSnap = u.e.map(x => ({ ...x }));
  if (!sk.freeze) spend(g, u, plan);
  if (X.plus && (X.plus.R || X.plus.W || X.plus.B)) spend(g, u, X.plus);
  u.stat.skills++; ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, target: tref?.uid || null, team: u.team, slot: slotOf(g, u), kind: sk.kind || 'attack' });
  log(g, `${u.name} · ${sk.name}${tref && tref.uid && !tref.virtual ? ` → ${g.u[tref.uid].name}` : ''}`, 'skill');
  if (sk.once) u.used[sk.id] = true;
  u.lastTargetPrev = u.lastTarget;
  sk.exec(g, u, T, X, sk);
  u.last = 'skill'; u.lastSkill = sk.id; if (T && T.uid && !tref.virtual) u.lastTarget = T.uid;
  def(u).onSkill?.(g, u, sk, X); HK?.onSkill?.(g, u, sk, X); return true;
}
function targetObj(g, u, sk, tref) {
  const tg = tgtKind(g, u, sk);
  if (tg === 'enemyField') return fieldUnits(g, other(u.team)); if (tg === 'field' || tg === 'self' || tg === 'none') return u; if (tg === 'enemySlot') return { team: tref.team, slot: tref.slot };
  return tref && tref.uid ? g.u[tref.uid] : u;
}
export function act(g, a) {
  g.ev = []; if (g.winner) return g.ev;
  const i = info(g); const { team, slot } = cur(g); const u = unitAt(g, team, slot);
  if (i.kind === 'deploy') { if (a.type !== 'deploy' || !i.options.includes(a.uid)) return g.ev; deployUnit(g, team, slot, a.uid); endTurn(g, null, false); autoAdvance(g); return g.ev; }
  if (i.kind !== 'input') return g.ev; let used = false;
  if (a.type === 'gather') { if (!i.gather) return g.ev; ev(g, 'turn', { uid: u.uid, act: 'gather' }); doGather(g, u, a.replace); }
  else if (a.type === 'pass') { if (!i.pass) return g.ev; ev(g, 'turn', { uid: u.uid, act: 'pass' }); log(g, `${u.name}: 할 수 있는 행동이 없어 차례를 넘긴다.`); u.last = 'pass'; }
  else if (a.type === 'switch') { const s = i.switches.find(x => x.bench === a.bench); if (!s) return g.ev; ev(g, 'turn', { uid: u.uid, act: 'switch' }); if (!switchReal(g, u, a.bench, a.pay)) return g.ev; u.last = 'switch'; }
  else if (a.type === 'skill') { const e = i.skills.find(x => x.id === a.skill); if (!e || !e.ok) return g.ev; const sk = e.sk; let tref = a.target || e.targets[0]; if (!e.targets.some(t => t.slot === tref.slot && t.team === tref.team)) return g.ev;
    let tk = e.tokens, plans = e.plans; if (sk.dynCost) { tk = effCost(g, u, sk, tref.uid ? g.u[tref.uid] : null); plans = payPlans(g, u, tk); if (!plans.length) return g.ev; }
    if (a.pay && !plans.some(p => COLORS.every(c => p[c] === a.pay[c]))) return g.ev;
    let pay = a.pay || null, plus = null;
    if (sk.plus) { plus = normPlus(sk, a.plus); const cand = pay ? [pay] : [autoPlan(g, u, tk), ...plans].filter(Boolean); pay = cand.find(p => plusFits(u, p, plus)) || null; if (!pay) return g.ev; }
    if (!runSkill(g, u, sk, { target: tref, pay, plus, extra: a.extra, tokens: tk })) return g.ev; used = true; }
  else return g.ev;
  endTurn(g, u, used); autoAdvance(g); return g.ev;
}

export function normPlus(sk, p) { const o = { R: 0, W: 0, B: 0 }; let n = 0; for (const c of sk.plus.colors) { const v = Math.max(0, Math.floor((p && p[c]) || 0)); const take = Math.min(v, sk.plus.max - n); o[c] = take; n += take; } return o; }
export function plusFits(u, pay, plus) { const p = pool(u); return COLORS.every(c => p[c] - (pay[c] || 0) >= (plus[c] || 0)); }
export function plusCombos(u, sk, pay) { const p = pool(u), out = []; const cs = sk.plus.colors;
  const rec = (i, left, cur) => { if (i === cs.length) { out.push({ R: 0, W: 0, B: 0, ...cur }); return; } const c = cs[i], lim = Math.min(left, p[c] - (pay[c] || 0)); for (let v = 0; v <= lim; v++) rec(i + 1, left - v, { ...cur, [c]: v }); };
  rec(0, sk.plus.max, {}); return out; }
/* ───────── AI 용 열거 ───────── */
export function enumerate(g) {
  const i = info(g); const out = []; if (i.kind === 'deploy') return i.options.map(uid => ({ type: 'deploy', uid }));
  if (i.kind !== 'input') return out; const u = g.u[i.uid];
  if (i.pass) out.push({ type: 'pass' });
  if (i.gather) out.push({ type: 'gather' });
  for (const s of i.switches) out.push({ type: 'switch', bench: s.bench });
  for (const e of i.skills) { if (!e.ok) continue; const sk = e.sk;     let pluses = [null]; if (sk.plus) { const base = autoPlan(g, u, e.tokens); const all = plusCombos(u, sk, base); pluses = all.length > 8 ? [all[0], ...all.filter(p => p.R + p.W + p.B === Math.max(...all.map(q => q.R + q.W + q.B))).slice(0, 3), all[Math.floor(all.length / 2)]] : all; }
    for (const t of e.targets) { const ex2 = sk.choices ? enumChoices(g, u, sk, t) : [{}]; for (const x of ex2) for (const pl of pluses) out.push({ type: 'skill', skill: sk.id, target: t, extra: x, plus: pl }); } }
  return out;
}
function enumChoices(g, u, sk, t) { // 앞선 답에 따라 선택지가 달라지는 선택도 순서대로 펼친다
  const tu = t && t.uid ? g.u[t.uid] : null; let combos = [{}];
  for (let depth = 0; depth < 6; depth++) { const nx = []; let progressed = false;
    for (const b of combos) { const list = sk.choices(g, u, tu, b) || []; const c = list.find(x => !(x.key in b)); if (!c) { nx.push(b); continue; } progressed = true;
      const vals = c.options ? (c.options.length ? c.options.map(o => o.v) : [-1]) : range(c.min, c.max, c.step || 1).slice(0, 6); for (const v of vals) nx.push({ ...b, [c.key]: v }); }
    combos = nx.slice(0, 24); if (!progressed) break; }
  return combos;
}
const range = (a, b, s = 1) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(2)); return o; };
export let HK = null; export const setHooks = h => { HK = h; };
export function remapIdx(u, snap, idx) { // 지불 전 에너지 목록의 idx 번째가 지불 뒤에는 몇 번째인지 (지불로 사라졌으면 -1)
  const o = snap[idx]; if (!o) return -1; let k = 0; for (let i = 0; i < idx; i++) if (snap[i].c === o.c && snap[i].a === o.a) k++;
  const cand = []; u.e.forEach((x, i) => { if (x.c === o.c && x.a === o.a) cand.push(i); }); return cand[k] ?? -1;
}
export const API = { COLORS, STATUS_NAME, register, def, other, rnd, rint, pick, U, unitAt, fieldUnits, benchUnits, teamUnits, slotOf, onField, status, traitOn, hasTag, log, ev, notice, eTotal, eCount, eWhole, maxE, normE, gain, removeE, removeEntry, clearE, recolor, tokensOf, effCost, pool, planPays, canPay, autoPlan, spend, addStatus, clearStatuses, heal, addShield, addBarrier, hit, hpPct, fixed, checkDeath, checkWinner, defOf, resolveTargets, protectorOf, ignoresStats, deployUnit };
