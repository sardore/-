// 게임 규칙 전체. DOM 의존 없음(노드에서 그대로 시뮬레이션 가능).
import { RACES, CLASSES, PEXP, MAXLV, MAXDEPTH, QUEST1, MONSTERS, MIDX, KINDS, KIDX, TVW, FLAVORS, EGOS, ARTS, SPELLS, SHOPS, TVNAME, FEEL_D, FEEL_L } from './data.js';
import { T, F, walk, opaque, DIRS, genDungeon, genTown, fov, line, flow } from './map.js';

for (const m of MONSTERS) { m.F = new Set(m.f.split(' ')); const e = m.f.match(/erratic(\d+)/); m.err = e ? +e[1] : 0; }
const EGO = Object.fromEntries(EGOS.map(e => [e.id, e])), ART = Object.fromEntries(ARTS.map(a => [a.id, a]));
const EQUIP = new Set(['weapon', 'bow', 'body', 'shield', 'helm', 'gloves', 'boots', 'cloak', 'light', 'ring', 'amulet']);
const ARMOR = new Set(['body', 'shield', 'helm', 'gloves', 'boots', 'cloak']);
const TVORD = ['weapon', 'bow', 'ammo', 'body', 'shield', 'helm', 'gloves', 'boots', 'cloak', 'light', 'ring', 'amulet', 'book', 'potion', 'scroll', 'wand', 'rod', 'flask', 'food'];
const ELN = { fire: '화염', cold: '냉기', pois: '독', magic: '마력', dark: '암흑', elec: '번개' }, ELC = { fire: '#ff7a2b', cold: '#9fe0ff', pois: '#8fe05a', magic: '#c9a8ff', dark: '#8a5ad6', elec: '#ffe14a' };
const TM = { fast: '가속', slow: '둔화', blind: '실명', conf: '혼란', afraid: '공포', para: '마비', pois: '중독', hero: '영웅심', bers: '광전사', bless: '축복', oppFire: '화염 저항', oppCold: '냉기 저항', seeInv: '투명 감지' };
export const TMNAME = TM;
const sg = n => (n >= 0 ? '+' : '') + n;
export function josa(w, pair) {
  const [a, b] = pair.split('/'); let has = false;
  for (let i = w.length - 1; i >= 0; i--) { const c = w.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) { const j = (c - 0xAC00) % 28; has = j !== 0 && !(pair === '으로/로' && j === 8); break; } }
  return w + (has ? a : b);
}
const gain = s => s >= 0 ? 10 + s : Math.max(2, 10 + s / 2);
const dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export class Game {
  constructor(o = {}) { this.fx = []; this.auto = null; this.shop = -1; this.onSave = null; if (o.load) this.fromJSON(o.load); else this.init(o); }
  /* ---------- 난수 ---------- */
  r() { const a = this.seed = (this.seed + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  ri(n) { return n <= 0 ? 0 : Math.floor(this.r() * n); }
  rr(a, b) { return a + this.ri(b - a + 1); }
  dice(d, s) { let t = 0; for (let i = 0; i < d; i++) t += 1 + this.ri(s); return t; }
  msg(s, c) { const l = this.log; if (l.length && l[l.length - 1].s === s) l[l.length - 1].n = (l[l.length - 1].n || 1) + 1; else l.push({ s, c: c || '', t: this.pturn }); if (l.length > 160) l.splice(0, 40); this.fresh = (this.fresh || 0) + 1; }

  init(o) {
    this.seed = (o.seed ?? (Date.now() & 0x7fffffff)) | 0; this.turn = 0; this.pturn = 0; this.depth = 0; this.maxDepth = 0; this.log = []; this.known = {}; this.deadU = {}; this.arts = {}; this.recall = 0; this.deep = 0; this.won = false; this.dead = false; this.cause = ''; this.mid = 1; this.kills = 0; this.pfrac = 0;
    this.flav = {};
    for (const tv in FLAVORS) { const pool = FLAVORS[tv].slice(); for (const k of KINDS) if (k.tv === tv) this.flav[k.id] = pool.splice(this.ri(pool.length), 1)[0] || '낡은'; }
    const rc = RACES[o.race] || RACES.human, cl = CLASSES[o.cls] || CLASSES.warrior, st = {};
    for (const s of ['str', 'int', 'dex', 'con']) st[s] = 12 + rc[s] + cl[s];
    this.p = { name: o.name || '이름 없는 자', race: o.race || 'human', cls: o.cls || 'warrior', lv: 1, exp: 0, gold: 150, st, hp: 1, mp: 0, x: 0, y: 0, energy: 100, food: 9000, inv: [], eq: {}, tm: {}, target: 0, hpf: 0, mpf: 0, fx: 0, fy: -1 };
    for (const [id, n] of cl.kit) { const it = this.mk(id, n || 1), k = KINDS[it.k]; this.known[id] = 1; if (EQUIP.has(k.tv) && !this.p.eq[this.slotFor(it)]) this.p.eq[this.slotFor(it)] = it; else this.p.inv.push(it); }
    this.calc(); this.p.hp = this.p.d.mhp; this.p.mp = this.p.d.mmp;
    this.msg(`${this.p.name}, ${rc.name} ${cl.name}. 구덩이 아래 30층에 어둠의 군주가 있다.`, 'y');
    this.enter(0, 'start');
  }

  /* ---------- 아이템 ---------- */
  mk(id, n = 1) { const k = KINDS[KIDX[id]], it = { k: KIDX[id], n }; if (k.ch) it.ch = this.rr(k.ch[0], k.ch[1]); if (k.pv) it.pv = k.pv[0]; return it; }
  kind(it) { return KINDS[it.k]; }
  slotFor(it) { const tv = KINDS[it.k].tv; if (tv !== 'ring') return tv; return !this.p.eq.ring1 ? 'ring1' : !this.p.eq.ring2 ? 'ring2' : 'ring1'; }
  isKnown(it) { const k = KINDS[it.k]; return it.a || !FLAVORS[k.tv] || !!this.known[k.id]; }
  props(it) { const k = KINDS[it.k], o = {}; const add = p => { if (p) for (const x in p) o[x] = (o[x] || 0) + p[x]; }; add(k.props); if (k.pp && it.pv) o[k.pp] = (o[k.pp] || 0) + it.pv; if (it.e) add(EGO[it.e].props); if (it.a) add(ART[it.a].props); return o; }
  wdice(it) { const k = KINDS[it.k], a = it.a && ART[it.a]; return [(a && a.dd) || k.dd + (it.e && EGO[it.e].dd || 0), (a && a.ds) || k.ds]; }
  name(it, noCount) {
    const k = KINDS[it.k], tv = k.tv, a = it.a && ART[it.a], e = it.e && EGO[it.e]; let s;
    if (a) s = `『${a.name}』`;
    else if (FLAVORS[tv]) { const kn = this.known[k.id]; s = tv === 'scroll' ? (kn ? `${k.name}의 두루마리` : `「${this.flav[k.id]}」 두루마리`) : tv === 'potion' ? (kn ? `${k.name}의 물약` : `${this.flav[k.id]} 물약`) : (kn ? `${k.name}의 ${TVNAME[tv]}` : `${this.flav[k.id]} ${TVNAME[tv]}`); }
    else s = (e ? e.name + ' ' : '') + k.name;
    if (tv === 'weapon' || tv === 'ammo') { const [d, sd] = this.wdice(it); s += ` (${d}d${sd})`; }
    if (tv === 'bow') s += ` (x${k.mult + (e && e.mult || 0) + (a && a.mult || 0)})`;
    if (tv === 'weapon' || tv === 'bow' || tv === 'ammo' || it.th || it.td) s += ` (${sg(it.th || 0)},${sg(it.td || 0)})`;
    if (ARMOR.has(tv)) s += ` [${k.ac + (e && e.ac || 0)},${sg(it.ta || 0)}]`;
    if (k.pp && it.pv && this.isKnown(it)) s += ` (${sg(it.pv)})`;
    if (tv === 'wand' && this.isKnown(it)) s += ` (충전 ${it.ch})`;
    if (tv === 'rod' && it.t > 0) s += ' (충전 중)';
    if (!noCount && it.n > 1) s += ` ${it.n}개`;
    return s;
  }
  describe(it) {
    const k = KINDS[it.k], out = [], P = this.props(it), a = it.a && ART[it.a], e = it.e && EGO[it.e];
    if (!this.isKnown(it)) return ['써 보기 전에는 무엇인지 알 수 없다.'];
    const br = (a && a.brand) || (e && e.brand), sl = [...(a && a.slay || []), ...(e && e.slay || [])];
    if (br) out.push(`${ELN[br]} 속성 공격(저항 없는 적에게 2.5배)`);
    if (sl.length) out.push('특효: ' + sl.map(s => ({ orc: '오크', troll: '트롤', giant: '거인', dragon: '용', undead: '망자', demon: '악마', evil: '악한 존재', animal: '짐승' })[s]).join(', '));
    const N = { speed: '속도', stealth: '은밀', light: '광원', str: '힘', int: '지능', dex: '민첩', con: '체질', ac: '방어', th: '명중', td: '피해' }, FL = { rFire: '화염 저항', rCold: '냉기 저항', rPois: '독 저항', freeAct: '마비·둔화 면역', seeInv: '투명 감지', regen: '재생', telepathy: '텔레파시', pConf: '혼란 면역', pBlind: '실명 면역', teleport: '가끔 제멋대로 순간이동' };
    const nums = Object.keys(P).filter(x => N[x]).map(x => `${N[x]} ${sg(P[x])}`), fl = Object.keys(P).filter(x => FL[x]).map(x => FL[x]);
    if (nums.length) out.push(nums.join(', ')); if (fl.length) out.push(fl.join(', '));
    const D = { p_clw: '체력 20 회복, 실명·중독 치료', p_csw: '체력 50 회복, 혼란·중독 치료', p_heal: '체력 300 회복, 모든 상태이상 치료', p_mana: '마나 완전 회복', p_speed: '잠시 속도 +10', p_hero: '공포 면역, 명중 상승', p_bers: '명중 대폭 상승, 방어 감소', p_enl: '층 전체 지도', s_phase: '가까이 순간이동', s_tele: '멀리 순간이동', s_recall: '잠시 뒤 마을↔최대 도달층 이동', s_deep: '잠시 뒤 3층 아래로', s_map: '주변 지도', s_treas: '주변 물건 탐지', s_life: '주변 괴물 탐지', s_light: '방을 밝힘', s_weapon: '들고 있는 무기 강화', s_armor: '입은 방어구 강화', s_bless: '방어·명중 소폭 상승', s_charge: '마법봉 재충전', w_mud: '벽을 허문다', w_tele: '대상을 멀리 보낸다', ration: '허기를 채운다', flask: '던지면 화염 피해(2d6, 범위)', rod_light: '방을 밝힘(재사용)', rod_det: '괴물 탐지(재사용)', rod_treas: '물건 탐지(재사용)' };
    if (D[k.id]) out.push(D[k.id]); if (k.tv === 'book') out.push(SPELLS.filter(s => s.book === k.id).map(s => `${s.name}(Lv${s.lv})`).join(', '));
    return out;
  }
  value(it) {
    const k = KINDS[it.k]; if (it.a) return 25000; let v = k.cost; if (it.e) v += EGO[it.e].cost; v += ((it.th || 0) + (it.td || 0) + (it.ta || 0)) * (k.tv === 'ammo' ? 2 : 60);
    if (k.pv && it.pv) v *= 0.4 + it.pv / k.pv[1]; if (k.ch) v *= 0.4 + 0.6 * it.ch / k.ch[1]; return Math.round(v);
  }
  same(a, b) { const tv = KINDS[a.k].tv; return a.k === b.k && !EQUIP.has(tv) && tv !== 'wand' && tv !== 'rod' && (a.th || 0) === (b.th || 0) && (a.td || 0) === (b.td || 0) && !a.e && !b.e; }
  addInv(it) {
    const inv = this.p.inv, s = inv.find(o => this.same(o, it));
    if (s) { s.n += it.n; return true; }
    if (inv.length >= 22) return false;
    inv.push(it); inv.sort((a, b) => TVORD.indexOf(KINDS[a.k].tv) - TVORD.indexOf(KINDS[b.k].tv) || a.k - b.k); return true;
  }
  makeItem(level, q = 0, tvs) {
    if ((q >= 1 && this.r() < (q === 2 ? 0.22 : 0.05)) || this.r() < level / 900) { const c = ARTS.filter(a => !this.arts[a.id] && a.lv <= level + 2); if (c.length) { const a = c[this.ri(c.length)]; this.arts[a.id] = 1; return { k: KIDX[a.k], n: 1, a: a.id, th: a.th || 0, td: a.td || 0, ta: a.ta || 0, pv: a.pv }; } }
    if (this.r() < 0.06) level += 2 + this.ri(6);
    const good = ['weapon', 'bow', 'body', 'shield', 'helm', 'gloves', 'boots', 'cloak', 'ring', 'amulet', 'wand', 'rod'];
    const c = KINDS.filter(k => k.lv <= level && (!tvs || tvs.includes(k.tv)) && (q < 1 || (good.includes(k.tv) && k.lv >= level - 14)));
    let tot = 0; const ws = c.map(k => { let w = (k.w ?? 10) / TVW[k.tv]; if (EQUIP.has(k.tv) && k.lv < level - 12) w *= 0.3; tot += w; return w; });
    let x = this.r() * tot, i = 0; while (i < c.length - 1 && (x -= ws[i]) > 0) i++;
    const k = c[i] || KINDS[KIDX.p_clw], tv = k.tv, it = this.mk(k.id, 1);
    if (tv === 'ammo') it.n = 12 + this.ri(24); else if (tv === 'flask') it.n = 1 + this.ri(4); else if ((tv === 'potion' || tv === 'scroll') && k.cost < 50 && this.r() < 0.35) it.n = 2;
    const mb = max => Math.min(max, Math.round(max * Math.min(1, level / 30) * (0.3 + this.r())));
    if (tv === 'weapon' || tv === 'bow' || tv === 'ammo') { if (q >= 1 || this.r() < 0.18 + level * 0.015) { it.th = 1 + this.ri(3) + mb(tv === 'ammo' ? 5 : 9); it.td = 1 + this.ri(3) + mb(tv === 'ammo' ? 5 : 9); } }
    else if (ARMOR.has(tv)) { if (q >= 1 || this.r() < 0.18 + level * 0.015) it.ta = 1 + this.ri(3) + mb(9); }
    if (k.pv) it.pv = Math.min(k.pv[1], k.pv[0] + mb(k.pv[1] - k.pv[0]) + (q ? 1 : 0));
    if (EQUIP.has(tv) && (q === 2 || (q === 1 && this.r() < 0.35) || this.r() < 0.02 + level * 0.004)) {
      const es = EGOS.filter(e => e.on.includes(tv) && e.lv <= level + (q ? 5 : 0));
      if (es.length) { let t2 = 0; for (const e of es) t2 += e.w ?? 1; let y = this.r() * t2, j = 0; while (j < es.length - 1 && (y -= es[j].w ?? 1) > 0) j++; const e = es[j]; it.e = e.id; if (e.th) it.th = (it.th || 0) + e.th; if (e.td) it.td = (it.td || 0) + e.td; if (ARMOR.has(tv) && !it.ta) it.ta = 1 + this.ri(5); if ((tv === 'weapon' || tv === 'bow') && !it.th) { it.th = 2 + this.ri(6); it.td = 2 + this.ri(6); } }
    }
    return it;
  }

  /* ---------- 능력치 ---------- */
  need(lv) { return Math.floor(PEXP[lv - 1] * RACES[this.p.race].expf / 100); }
  calc() {
    const p = this.p, rc = RACES[p.race], cl = CLASSES[p.cls], tm = p.tm, fl = {}, d = { ac: 0, speed: 0, light: 0, stealth: 1 + rc.stealth + cl.stealth, fl, th: 0, td: 0, wth: 0, wtd: 0, bth: 0, btd: 0 };
    const st = { ...p.st };
    for (const s in p.eq) { const it = p.eq[s]; if (!it) continue; const k = KINDS[it.k], P = this.props(it);
      d.ac += (k.ac || 0) + (it.ta || 0) + (it.e && EGO[it.e].ac || 0);
      for (const x in P) { if (x in st) st[x] += P[x]; else if (x === 'speed' || x === 'light' || x === 'stealth' || x === 'ac' || x === 'th' || x === 'td') d[x] += P[x]; else fl[x] = (fl[x] || 0) + P[x]; }
      if (s === 'weapon') { d.wth = it.th || 0; d.wtd = it.td || 0; } else if (s === 'bow') { d.bth = it.th || 0; d.btd = it.td || 0; } else if (k.tv !== 'ring' && k.tv !== 'amulet') { d.th += it.th || 0; d.td += it.td || 0; }
    }
    for (const x of ['seeInv', 'pBlind', 'regen']) if (rc[x]) fl[x] = 1;
    Object.assign(d, st);
    d.th += Math.floor((st.dex - 12) / 2); d.td += Math.max(-2, Math.floor((st.str - 12) / 2));
    if (tm.fast > 0) d.speed += 10; if (tm.slow > 0) d.speed -= 10;
    if (tm.hero > 0) d.th += 12; if (tm.bers > 0) { d.th += 24; d.ac -= 10; } if (tm.bless > 0) { d.th += 3; d.ac += 5; }
    if (tm.seeInv > 0) fl.seeInv = 1;
    if (p.food < 1000) d.speed -= 5;
    d.ac = Math.max(0, d.ac);
    d.mhp = Math.max(1, Math.round(20 + p.lv * (cl.hd + rc.hd + (st.con - 10) * 0.25)));
    d.mmp = cl.mp ? Math.max(0, Math.round(3 + p.lv * (cl.mp + (st.int - 10) * 0.14))) : 0;
    d.mel = cl.mel[0] + cl.mel[1] * p.lv; d.bow = cl.bow[0] + cl.bow[1] * p.lv; d.save = Math.min(90, cl.save[0] + cl.save[1] * p.lv);
    d.blows = p.cls === 'warrior' ? 2 + (p.lv >= 15) + (p.lv >= 30) + (st.dex >= 18) : 1 + (p.cls === 'ranger' && p.lv >= 25) + (st.dex >= 20);
    d.shots = p.cls === 'ranger' ? 1 + p.lv / 20 : 1;
    const w = p.eq.weapon; if (w) { [d.dd, d.ds] = this.wdice(w); d.brand = (w.a && ART[w.a].brand) || (w.e && EGO[w.e].brand); d.slay = [...(w.a && ART[w.a].slay || []), ...(w.e && EGO[w.e].slay || [])]; } else { d.dd = 1; d.ds = 2; d.brand = null; d.slay = []; }
    p.d = d; if (p.hp > d.mhp) p.hp = d.mhp; if (p.mp > d.mmp) p.mp = d.mmp;
  }
  gainExp(n) {
    const p = this.p; p.exp += n;
    while (p.lv < MAXLV && p.exp >= this.need(p.lv)) { const old = p.d.mhp; p.lv++; this.calc(); p.hp += p.d.mhp - old; this.msg(`레벨 ${p.lv}!`, 'y'); const nw = SPELLS.filter(s => s.lv === p.lv && p.cls === 'mage'); for (const s of nw) this.msg(`새 주문을 익힐 수 있다: ${s.name}`, 'b'); }
  }

  /* ---------- 층 ---------- */
  I(x, y) { return y * this.map.w + x; }
  enter(depth, how) {
    this.depth = depth; if (depth > this.maxDepth) this.maxDepth = depth;
    const quest = depth === QUEST1 && !this.deadU['검은 부관 모르단'];
    const g = depth === 0 ? genTown(this) : genDungeon(depth, this, { noDown: depth >= MAXDEPTH || quest });
    this.map = { w: g.w, h: g.h, t: g.t, f: g.f, town: depth === 0 }; this.traps = {}; this.mons = []; this.items = []; this.mmap = new Map(); this.alloc(); this.auto = null; this.shop = -1; this.changed = true;
    const p = this.p; let k = how === 'down' && g.downs.length ? g.downs[this.ri(g.downs.length)] : (how === 'up' || how === 'down') && g.ups.length ? g.ups[this.ri(g.ups.length)] : depth === 0 ? g.downs[0] : g.plain();
    p.x = k % g.w; p.y = (k / g.w) | 0; p.target = 0;
    if (depth === 0) this.stock();
    else {
      const far = () => { for (let n = 0; n < 60; n++) { const c = this.randCell(); if (c >= 0 && dist(c % g.w, (c / g.w) | 0, p.x, p.y) > 9) return c; } return -1; };
      for (let n = 0, cnt = 7 + Math.floor(depth / 3) + this.ri(6); n < cnt; n++) { const c = far(); if (c >= 0) this.spawn(this.pickRace(depth), c % g.w, (c / g.w) | 0, true); }
      for (const name of ['검은 부관 모르단', '어둠의 군주 아즈라크']) { const r = MONSTERS[MIDX[name]]; if (r.lv === depth && !this.deadU[name]) { const c = far(); if (c >= 0) this.spawn(MIDX[name], c % g.w, (c / g.w) | 0, false); } }
      for (const c of g.spots.mon) this.spawn(this.pickRace(depth + (depth < 4 ? 0 : 2 + this.ri(4))), c % g.w, (c / g.w) | 0, true, true);
      for (let n = 0, cnt = 4 + this.ri(5); n < cnt; n++) { const c = this.randCell(); if (c >= 0) this.items.push({ x: c % g.w, y: (c / g.w) | 0, it: this.makeItem(depth) }); }
      for (let n = 0, cnt = 3 + this.ri(4); n < cnt; n++) { const c = this.randCell(); if (c >= 0) this.items.push({ x: c % g.w, y: (c / g.w) | 0, gold: this.goldAmt(depth) }); }
      for (const c of g.spots.treasure) this.items.push({ x: c % g.w, y: (c / g.w) | 0, it: this.makeItem(depth + 3, 1) });
      for (const c of g.spots.great) this.items.push({ x: c % g.w, y: (c / g.w) | 0, it: this.makeItem(depth + 6, 2) });
      const TR = ['door', 'tele', 'dart', 'summon', 'fire'];
      for (let n = 0, cnt = 2 + this.ri(3 + (depth >> 2)); n < cnt; n++) { const c = this.randCell(); if (c >= 0 && g.t[c] === T.FLOOR && dist(c % g.w, (c / g.w) | 0, p.x, p.y) > 2) { g.t[c] = T.TRAP; this.traps[c] = TR[this.ri(TR.length)]; } }
      for (const c of g.spots.trap) { g.t[c] = T.TRAP; this.traps[c] = TR[1 + this.ri(4)]; }
      let dg = g.spots.mon.length ? 20 : 0, lt = 0;
      for (const m of this.mons) { const r = MONSTERS[m.r]; dg += Math.max(0, r.lv - depth + 2) ** 2 * (r.F.has('unique') ? 3 : 1); }
      for (const o of this.items) if (o.it) lt += o.it.a ? 4000 : Math.min(3000, this.value(o.it));
      this.feel = { d: dg < 6 ? 0 : dg < 20 ? 1 : dg < 45 ? 2 : dg < 90 ? 3 : dg < 180 ? 4 : 5, l: lt < 300 ? 0 : lt < 1200 ? 1 : lt < 3500 ? 2 : lt < 8000 ? 3 : 4, shown: false };
      this.msg(`지하 ${depth}층. ${FEEL_D[this.feel.d]}.`, this.feel.d >= 4 ? 'r' : 'd');
      if (quest) this.msg('무거운 기척이 이 층을 누르고 있다. 내려가는 계단이 보이지 않는다.', 'v');
      if (depth === MAXDEPTH) this.msg('구덩이의 바닥이다. 어둠의 군주가 여기 있다.', 'v');
    }
    this.calc(); this.updateView(); if (this.onSave) this.onSave();
  }
  alloc() { const n = this.map.w * this.map.h; this.los = new Uint8Array(n); this.seen = new Uint8Array(n); this.fl = new Int16Array(n); this.tmpf = new Int16Array(n); }
  randCell() { const m = this.map; for (let n = 0; n < 300; n++) { const k = this.ri(m.w * m.h); if ((m.t[k] === T.FLOOR || m.t[k] === T.GRASS) && !(m.f[k] & F.VAULT) && !this.mmap.has(k) && !(k === this.I(this.p.x, this.p.y))) return k; } return -1; }
  goldAmt(lv) { return Math.round((12 + this.ri(30)) * (1 + lv * 0.55)); }
  pickRace(level) {
    const base = level; if (this.r() < 0.1) level += 1 + this.ri(2 + (level >> 2));
    const c = [], ws = []; let tot = 0;
    for (let i = 0; i < MONSTERS.length; i++) { const r = MONSTERS[i]; if (r.lv > level || r.F.has('quest')) continue; if (r.F.has('unique') && (r.lv > base + 1 || this.deadU[r.name] || this.mons.some(m => m.r === i))) continue;
      const w = (1 / r.rar) * (r.F.has('unique') ? 0.3 : 1) * (r.lv < level - 9 ? 0.25 : r.lv >= level - 3 ? 1.7 : 1); c.push(i); ws.push(w); tot += w; }
    let x = this.r() * tot, i = 0; while (i < c.length - 1 && (x -= ws[i]) > 0) i++; return c[i];
  }
  spawn(ri, x, y, sleepy, solo) {
    const r = MONSTERS[ri], k = this.I(x, y); if (this.mmap.has(k) || !walk(this.map.t[k])) return null;
    const m = { id: this.mid++, r: ri, x, y, hp: r.hp, mhp: r.hp, energy: this.ri(100), sleep: sleepy && r.sleep ? r.sleep * 2 + this.ri(r.sleep + 1) : 0, fear: 0, conf: 0, slow: 0, det: 0, vis: false };
    this.mons.push(m); this.mmap.set(k, m);
    if (!solo) { const extra = (n, rj) => { for (let i = 0; i < n; i++) { const c = this.near(x, y, 3); if (c >= 0) this.spawn(rj, c % this.map.w, (c / this.map.w) | 0, sleepy, true); } };
      if (r.grp) extra(r.grp - 1 + this.ri(2), ri); if (r.esc && MIDX[r.esc[0]] !== undefined) extra(r.esc[1], MIDX[r.esc[0]]); }
    return m;
  }
  near(x, y, rad) { const m = this.map; for (let n = 0; n < 40; n++) { const nx = x + this.rr(-rad, rad), ny = y + this.rr(-rad, rad); if (nx < 1 || ny < 1 || nx >= m.w - 1 || ny >= m.h - 1) continue; const k = this.I(nx, ny); if (walk(m.t[k]) && m.t[k] !== T.TRAP && !this.mmap.has(k) && !(nx === this.p.x && ny === this.p.y)) return k; } return -1; }
  monAt(x, y) { return this.mmap.get(this.I(x, y)); }
  stock() {
    this.shops = SHOPS.map((s, i) => { if (!s.stock) { const out = [], lv = Math.max(8, this.maxDepth + 4); for (let n = 0; n < 7; n++) out.push({ it: this.makeItem(lv, 1), bm: 1 }); return out; }
      return s.stock.filter(() => this.r() < 0.9).map(([id, n]) => { const it = this.mk(id, n); if (EQUIP.has(KINDS[it.k].tv) && KINDS[it.k].pv) it.pv = KINDS[it.k].pv[0] + 2; return { it }; }); });
    for (let n = 0; n < 3; n++) { const c = this.randCell(); if (c >= 0) this.spawn(MIDX[['자칼', '좀도둑', '과일박쥐'][n]], c % this.map.w, (c / this.map.w) | 0, true, true); }
  }

  /* ---------- 시야 ---------- */
  updateView() {
    const m = this.map, p = this.p, n = m.w * m.h, lr = p.d.light, pk = this.I(p.x, p.y);
    if (p.tm.blind > 0) { this.los.fill(0); this.seen.fill(0); this.seen[pk] = 1; }
    else {
      fov(m, p.x, p.y, 20, this.los); const l2 = (lr + 0.5) ** 2;
      for (let k = 0; k < n; k++) { if (!this.los[k]) { this.seen[k] = 0; continue; } const dx = (k % m.w) - p.x, dy = ((k / m.w) | 0) - p.y; const lit = (m.f[k] & F.LIT) || dx * dx + dy * dy <= l2; this.seen[k] = lit ? 1 : 0; if (lit) m.f[k] |= F.KNOWN; }
    }
    for (const [dx, dy] of DIRS) m.f[this.I(p.x + dx, p.y + dy)] |= F.KNOWN;
    for (const o of this.items) if (this.seen[this.I(o.x, o.y)]) o.seen = 1;
    for (const mo of this.mons) { const r = MONSTERS[mo.r]; let v = !!this.seen[this.I(mo.x, mo.y)] && (!r.F.has('invis') || !!p.d.fl.seeInv); const direct = v;
      if (!v && (mo.det > 0 || (p.d.fl.telepathy && dist(mo.x, mo.y, p.x, p.y) <= 16 && !r.F.has('nofear')))) v = true;
      if (direct && !mo.seenOnce) { mo.seenOnce = 1; if (mo.sleep <= 0 || r.F.has('unique')) this.disturb(); if (r.F.has('unique')) this.msg(`${josa(r.name, '이/가')} 나타났다!`, 'v'); }
      mo.vis = v; mo.direct = direct; }
  }
  disturb() { this.auto = null; this.p.resting = false; }

  /* ---------- 턴 진행 ---------- */
  endTurn(cost = 100) {
    const p = this.p; p.energy -= cost; this.pfrac += cost;
    while (this.pfrac >= 100 && !this.dead && !this.changed) { this.pfrac -= 100; this.upkeep(); }
    for (let guard = 0; !this.dead && !this.changed && guard < 4000; guard++) {
      if (p.energy >= 100) { if (p.tm.para > 0) { p.energy -= 100; this.upkeep(); continue; } break; }
      this.tick();
    }
    if (this.changed) { p.energy = 100; this.pfrac = 0; }
    this.mons = this.mons.filter(m => !m.dead);
    this.updateView();
  }
  upkeep() {
    const p = this.p, tm = p.tm, d = p.d; this.pturn++;
    let exp = false; for (const k in tm) if (tm[k] > 0 && --tm[k] <= 0) { delete tm[k]; exp = true; if (TM[k] && k !== 'para') this.msg(`${TM[k]} 효과가 끝났다.`, 'd'); if (k === 'para') { tm.paraImm = 4; this.msg('다시 움직일 수 있다.'); } }
    if (exp) this.calc();
    if (tm.pois > 0) { p.hp -= 1; if (p.hp <= 0) return this.die('중독'); }
    p.food -= 1 + (d.fl.regen ? 1 : 0);
    if (p.food === 2000 || p.food === 1999) this.msg('배가 고프다.', 'o'); if (p.food === 1000 || p.food === 999) { this.msg('굶주려서 몸이 느려진다.', 'r'); this.calc(); }
    if (p.food <= 0) { p.food = 0; p.hp -= 1; if (this.pturn % 10 === 0) this.msg('굶어 죽어 간다!', 'r'); if (p.hp <= 0) return this.die('굶주림'); }
    const rate = (p.food < 1000 ? 0.2 : 1) * (p.resting ? 2 : 1) * (d.fl.regen ? 2 : 1);
    if (p.hp < d.mhp) { p.hpf += d.mhp * 0.006 * rate + 0.03; const a = Math.floor(p.hpf); p.hpf -= a; p.hp = Math.min(d.mhp, p.hp + a); }
    if (p.mp < d.mmp) { p.mpf += d.mmp * 0.008 * rate + 0.02; const a = Math.floor(p.mpf); p.mpf -= a; p.mp = Math.min(d.mmp, p.mp + a); }
    for (const it of p.inv) if (it.t > 0) it.t--;
    if (d.fl.teleport && this.ri(120) === 0) { this.msg('반지가 당신을 끌어당긴다.'); this.tele(40); }
    const st = Math.max(0, Math.min(9, d.stealth)) + (p.resting ? 1 : 0);
    for (const m of this.mons) { if (m.det > 0) m.det--; if (m.sleep <= 0) continue; const dd = dist(m.x, m.y, p.x, p.y); if (dd > 30) continue;
      m.sleep -= Math.round((36 - dd) * (10 - st) / 30 * this.r()); if (m.sleep <= 0) { m.sleep = 0; if (m.vis) { this.msg(`${josa(MONSTERS[m.r].name, '이/가')} 깨어났다.`, 'o'); this.disturb(); } } }
    if (this.recall > 0 && --this.recall === 0) { this.msg('몸이 위로 끌려 올라간다…', 'b'); if (this.depth > 0) this.enter(0, 'recall'); else this.enter(Math.max(1, this.maxDepth), 'recall'); return; }
    if (this.deep > 0 && --this.deep === 0) { const lim = this.deadU['검은 부관 모르단'] ? MAXDEPTH : QUEST1, nd = Math.min(lim, Math.max(this.depth, 0) + 3); if (nd > this.depth) { this.msg('바닥이 꺼진다!', 'b'); this.enter(nd, 'fall'); return; } this.msg('아무 일도 일어나지 않았다.'); }
    if (this.feel && !this.feel.shown && this.depth > 0 && this.pturn % 15 === 0) { let kn = 0; const f = this.map.f; for (let k = 0; k < f.length; k++) if ((f[k] & F.KNOWN) && walk(this.map.t[k])) kn++; if (kn > 260) { this.feel.shown = true; this.msg(`${FEEL_L[this.feel.l]}.`, this.feel.l >= 3 ? 'y' : 'd'); } }
    if (this.onSave && this.pturn % 40 === 0) this.onSave();
  }
  tick() {
    this.turn++; const p = this.p;
    if (!this.flT || this.flT !== this.pturn + ':' + p.x + ':' + p.y) { const t = this.map.t; flow(this.map, [this.I(p.x, p.y)], k => walk(t[k]) || t[k] === T.DOOR, 36, this.fl); this.flT = this.pturn + ':' + p.x + ':' + p.y; }
    for (let i = 0, n = this.mons.length; i < n; i++) { const m = this.mons[i]; if (m.dead || m.sleep > 0) continue;
      m.energy += gain(MONSTERS[m.r].spd - (m.slow > 0 ? 10 : 0));
      for (let g = 0; m.energy >= 100 && !m.dead && !this.dead && !this.changed && g < 4; g++) { m.energy -= 100; this.monTurn(m); } }
    p.energy += gain(p.d.speed);
    if (this.turn % 10 === 0) {
      for (const m of this.mons) if (!m.dead && m.hp < m.mhp) m.hp = Math.min(m.mhp, m.hp + Math.max(1, m.mhp >> 7));
      if (this.depth > 0 && this.mons.length < 55 && this.ri(220) === 0) { for (let n = 0; n < 20; n++) { const c = this.randCell(); if (c >= 0 && !this.seen[c] && dist(c % this.map.w, (c / this.map.w) | 0, p.x, p.y) > 14) { this.spawn(this.pickRace(this.depth), c % this.map.w, (c / this.map.w) | 0, false); break; } } }
    }
  }

  /* ---------- 플레이어 피해/상태 ---------- */
  hurt(dmg, el, src, verb) {
    const p = this.p, fl = p.d.fl, tm = p.tm; dmg = Math.max(0, dmg);
    if (el === 'fire') { if (fl.rFire) dmg /= 3; if (tm.oppFire > 0) dmg /= 3; } else if (el === 'cold') { if (fl.rCold) dmg /= 3; if (tm.oppCold > 0) dmg /= 3; } else if (el === 'pois') { if (fl.rPois) dmg /= 3; else tm.pois = Math.min(9, (tm.pois || 0) + 2 + this.ri(3)); }
    dmg = Math.round(dmg); p.hp -= dmg; this.disturb(); this.fx.push({ t: 'num', x: p.x, y: p.y, s: '-' + dmg, c: '#ff6a6a' }); if (verb) this.msg(`${verb} (${dmg}).`, 'o');
    if (p.hp <= 0) { this.die(src); return dmg; }
    if (p.hp < p.d.mhp * 0.3 && !this.warned) { this.warned = true; this.msg('*** 체력이 위험하다! ***', 'r'); } else if (p.hp >= p.d.mhp * 0.3) this.warned = false;
    return dmg;
  }
  save() { return this.ri(100) < this.p.d.save; }
  setTm(k, n, text) { const tm = this.p.tm, fl = this.p.d.fl;
    if (k === 'para' && (fl.freeAct || tm.paraImm > 0 || tm.para > 0)) return false; if (k === 'slow' && fl.freeAct) return false; if (k === 'conf' && fl.pConf) return false; if (k === 'blind' && fl.pBlind) return false; if (k === 'afraid' && (tm.hero > 0 || tm.bers > 0)) return false;
    tm[k] = Math.max(tm[k] || 0, n); if (text) this.msg(text, ['fast', 'hero', 'bers', 'bless', 'oppFire', 'oppCold', 'seeInv'].includes(k) ? 'b' : 'r'); this.calc(); if (k !== 'fast' && k !== 'hero' && k !== 'bers' && k !== 'bless' && k !== 'oppFire' && k !== 'oppCold' && k !== 'seeInv') this.disturb(); return true; }
  heal(n) { const p = this.p, b = p.hp; p.hp = Math.min(p.d.mhp, p.hp + n); if (p.hp > b) this.fx.push({ t: 'num', x: p.x, y: p.y, s: '+' + (p.hp - b), c: '#7dffb0' }); }
  cure(...ks) { for (const k of ks) delete this.p.tm[k]; this.calc(); }
  die(src) { if (this.dead) return; this.dead = true; this.cause = src; this.auto = null; this.p.hp = Math.min(this.p.hp, 0); this.msg(`당신은 죽었다. (${src})`, 'r'); }
  tele(d, who) {
    const m = this.map, e = who || this.p; let best = -1;
    for (let n = 0; n < 200; n++) { const k = this.randCell(); if (k < 0) continue; const dd = dist(k % m.w, (k / m.w) | 0, e.x, e.y); if (dd <= d && dd >= Math.min(d / 2, 6)) { best = k; break; } if (best < 0) best = k; }
    if (best < 0) return;
    if (who) { this.mmap.delete(this.I(who.x, who.y)); who.x = best % m.w; who.y = (best / m.w) | 0; this.mmap.set(best, who); }
    else { e.x = best % m.w; e.y = (best / m.w) | 0; this.disturb(); this.flT = null; }
  }

  /* ---------- 전투 ---------- */
  mult(r, brand, slay) { let m = 1; if (brand) m = r.F.has('im' + brand) ? 1 : r.F.has('hurt' + brand) ? 3.5 : 2.5; for (const s of slay || []) if (r.F.has(s)) m = Math.max(m, s === 'evil' || s === 'animal' ? 2 : 3); return m; }
  hitRoll(chance, ac) { const k = this.ri(100); if (k < 12) return true; if (k >= 95) return false; return chance > 0 && this.ri(Math.max(1, chance)) >= ac * 0.67; }
  attack(m) {
    const p = this.p, d = p.d, r = MONSTERS[m.r];
    if (p.tm.afraid > 0) { this.msg('겁에 질려 공격할 수 없다!', 'r'); return false; }
    for (let b = 0; b < d.blows && !m.dead; b++) {
      if (!this.hitRoll(d.mel + (d.th + d.wth) * 3, r.ac)) { this.msg(`${josa(r.name, '을/를')} 빗맞혔다.`, 'd'); continue; }
      let dmg = this.dice(d.dd, d.ds) * this.mult(r, d.brand, d.slay) + d.td + d.wtd, crit = this.ri(100) < 4 + p.lv * 0.4;
      if (crit) dmg = dmg * 1.5 + 5; dmg = Math.max(1, Math.round(dmg));
      this.hitMon(m, dmg, null, `${josa(r.name, '을/를')} ${crit ? '강하게 ' : ''}공격했다`);
    }
    return true;
  }
  hitMon(m, dmg, el, verb) {
    const r = MONSTERS[m.r]; if (m.dead) return;
    if (el) { if (r.F.has('im' + el)) { dmg = Math.round(dmg / 6); } else if (r.F.has('hurt' + el)) dmg = Math.round(dmg * 1.5); if ((el === 'dark') && r.F.has('undead')) dmg = Math.round(dmg / 4); }
    m.hp -= dmg; if (m.sleep > 0) { m.sleep = 0; } m.energy = Math.min(m.energy, 99);
    this.fx.push({ t: 'num', x: m.x, y: m.y, s: String(dmg), c: '#ffffff' });
    if (m.hp <= 0) { this.msg(`${verb} (${dmg}). ${josa(r.name, '이/가')} ${r.F.has('undead') || r.F.has('nofear') && !r.F.has('evil') ? '부서졌다' : '죽었다'}.`, 'g'); this.kill(m); return; }
    this.msg(`${verb} (${dmg}).`);
    if (!r.F.has('nofear') && !m.fear && m.hp < m.mhp * 0.2 && this.ri(100) < 45) { m.fear = 8 + this.ri(10); if (m.vis) this.msg(`${josa(r.name, '이/가')} 겁에 질려 달아난다!`, 'o'); }
  }
  kill(m) {
    const r = MONSTERS[m.r], p = this.p; m.dead = true; this.mmap.delete(this.I(m.x, m.y)); this.kills++; if (p.target === m.id) p.target = 0;
    this.gainExp(Math.max(r.exp ? 1 : 0, Math.round(r.exp * r.lv / p.lv * 10) / 10));
    if (r.F.has('unique')) { this.deadU[r.name] = 1; this.msg(`${josa(r.name, '을/를')} 쓰러뜨렸다!`, 'y'); }
    const n = r.dr && this.r() < r.dr ? (r.n || 1) : 0;
    for (let i = 0; i < n; i++) { const c = i === 0 ? this.I(m.x, m.y) : this.near(m.x, m.y, 2); if (c < 0) continue; const x = c % this.map.w, y = (c / this.map.w) | 0;
      if (r.gold || (!r.q && this.r() < 0.55)) this.items.push({ x, y, gold: this.goldAmt(r.lv) * (r.gold ? 3 : 1), seen: 1 }); else this.items.push({ x, y, it: this.makeItem(Math.max(this.depth, r.lv), r.q || 0), seen: 1 }); }
    if (r.F.has('final')) { this.won = true; this.msg('어둠의 군주가 무너졌다. 구덩이에 처음으로 빛이 든다. 당신이 이겼다!', 'y'); if (this.onSave) this.onSave(); }
    else if (r.F.has('quest')) { const k = this.I(m.x, m.y); this.map.t[k] = T.DOWN; delete this.traps[k]; this.msg('아래로 내려가는 계단이 모습을 드러냈다.', 'y'); }
  }
  target() {
    const p = this.p; let m = this.mons.find(o => o.id === p.target && !o.dead && o.direct);
    if (!m) { let bd = 99; for (const o of this.mons) if (!o.dead && o.direct) { const dd = dist(o.x, o.y, p.x, p.y); if (dd < bd) { bd = dd; m = o; } } if (m) p.target = m.id; }
    return m || null;
  }
  // 발사체. src: 'p' 또는 몬스터. o: {el, dmg, rad, beam, name}
  project(src, tx, ty, o) {
    const p = this.p, byP = src === 'p', sx = byP ? p.x : src.x, sy = byP ? p.y : src.y, cells = [], hits = [], c = ELC[o.el] || '#fff';
    let ex = sx, ey = sy;
    for (const [x, y] of line(sx, sy, tx, ty)) { if (opaque(this.map.t[this.I(x, y)])) break; ex = x; ey = y; cells.push([x, y]); const mm = this.monAt(x, y); if (byP && mm) { if (o.beam) hits.push([mm, 1]); else break; } if (!byP && x === p.x && y === p.y) break; }
    this.fx.push({ t: 'bolt', cells, c });
    if (o.rad) { this.fx.push({ t: 'ball', x: ex, y: ey, r: o.rad, c });
      if (byP) { for (const m of this.mons) { if (m.dead) continue; const dd = dist(m.x, m.y, ex, ey); if (dd <= o.rad && this.clear(ex, ey, m.x, m.y)) hits.push([m, dd === 0 ? 1 : dd === 1 ? 0.65 : 0.4]); } }
      else { const dd = dist(p.x, p.y, ex, ey); if (dd <= o.rad) this.hurt(o.dmg * (dd === 0 ? 1 : dd === 1 ? 0.65 : 0.4), o.el, o.name, `${ELN[o.el] || '충격'}에 휩싸였다`); } }
    else if (byP) { const mm = this.monAt(ex, ey); if (mm && !o.beam) hits.push([mm, 1]); }
    else if (ex === p.x && ey === p.y) this.hurt(o.dmg, o.el, o.name, o.el ? `${ELN[o.el]}에 맞았다` : '맞았다');
    for (const [m, f] of hits) this.hitMon(m, Math.max(1, Math.round(o.dmg * f)), o.el, `${josa(MONSTERS[m.r].name, '이/가')} ${ELN[o.el] || '충격'}에 휩싸였다`);
    return hits.length;
  }
  clear(ax, ay, bx, by) { for (const [x, y] of line(ax, ay, bx, by)) { if (x === bx && y === by) return true; if (opaque(this.map.t[this.I(x, y)])) return false; } return true; }

  /* ---------- 몬스터 ---------- */
  monTurn(m) {
    const r = MONSTERS[m.r], p = this.p, t = this.map.t, dd = dist(m.x, m.y, p.x, p.y);
    if (m.slow > 0) m.slow--; if (m.fear > 0) m.fear--;
    if (r.F.has('breed') && this.mons.length < 60 && this.ri(100) < 2 && this.mons.reduce((n, o) => n + (o.r === m.r && !o.dead ? 1 : 0), 0) < 14) { const c = this.near(m.x, m.y, 1); if (c >= 0) { this.spawn(m.r, c % this.map.w, (c / this.map.w) | 0, false, true); return; } }
    if (m.conf > 0) { m.conf--; return this.monStep(m, DIRS[this.ri(8)]); }
    const sees = dd <= 18 && this.los[this.I(m.x, m.y)] && (this.clear(m.x, m.y, p.x, p.y));
    if (r.sp && sees && this.ri(r.sp[0]) === 0 && !(m.fear > 0 && dd <= 1)) return this.monCast(m, r, r.sp[1 + this.ri(r.sp.length - 1)], dd);
    if (r.F.has('never')) { if (dd <= 1) this.monAttack(m, r); return; }
    if (r.err && this.ri(100) < r.err) return this.monStep(m, DIRS[this.ri(8)]);
    if (dd <= 1 && !(m.fear > 0)) return this.monAttack(m, r);
    if (r.F.has('pass')) { const dx = Math.sign(p.x - m.x), dy = Math.sign(p.y - m.y); return this.monStep(m, [m.fear > 0 ? -dx : dx, m.fear > 0 ? -dy : dy], true); }
    const cur = this.fl[this.I(m.x, m.y)];
    if (cur >= 32000) { if (this.ri(4) === 0) this.monStep(m, DIRS[this.ri(8)]); return; }
    let best = null, bv = m.fear > 0 ? cur : cur, ties = 0; const canOpen = !r.F.has('animal');
    for (const dir of DIRS) { const nx = m.x + dir[0], ny = m.y + dir[1], k = this.I(nx, ny), tt = t[k];
      if (!(walk(tt) || (tt === T.DOOR && canOpen)) || this.mmap.has(k) || (nx === p.x && ny === p.y)) continue;
      const v = this.fl[k]; if (v >= 32000) continue;
      if (m.fear > 0 ? v > bv : v < bv) { bv = v; best = dir; ties = 1; } else if (v === bv && best && this.ri(++ties) === 0) best = dir; }
    if (best) this.monStep(m, best); else if (dd <= 1) this.monAttack(m, r);
  }
  monStep(m, dir, pass) {
    const nx = m.x + dir[0], ny = m.y + dir[1], mp = this.map; if (nx < 1 || ny < 1 || nx >= mp.w - 1 || ny >= mp.h - 1) return;
    const k = this.I(nx, ny), tt = mp.t[k], r = MONSTERS[m.r];
    if (nx === this.p.x && ny === this.p.y) return this.monAttack(m, r);
    if (this.mmap.has(k)) return;
    if (tt === T.DOOR && !r.F.has('animal') && !pass) { mp.t[k] = T.OPEN; if (this.seen[k]) this.msg('문이 열렸다.', 'd'); return; }
    if (!walk(tt) && !(pass && tt !== T.PERM)) return;
    this.mmap.delete(this.I(m.x, m.y)); m.x = nx; m.y = ny; this.mmap.set(k, m);
  }
  monAttack(m, r) {
    const p = this.p; if (dist(m.x, m.y, p.x, p.y) > 1) return;
    for (const [bd, bs, eff] of r.bl) {
      if (this.dead || this.changed) return;
      if (!this.hitRoll(60 + r.lv * 4, p.d.ac)) { if (m.vis && bd) this.msg(`${josa(r.name, '이/가')} 헛쳤다.`, 'd'); continue; }
      let dmg = bd ? this.dice(bd, bs) : 0; const el = eff === 'fire' || eff === 'cold' || eff === 'pois' ? eff : null;
      if (!el) dmg -= dmg * Math.min(p.d.ac, 240) / 400;
      if (bd) { this.hurt(dmg, el, r.name, `${josa(r.name, '이/가')} 당신을 공격했다`); if (this.dead) return; }
      if (eff === 'para') { if (!this.save() && this.setTm('para', 3 + this.ri(3), `${r.name}의 눈과 마주쳤다. 몸이 굳는다!`)) return; }
      else if (eff === 'drain') { const lose = Math.min(p.exp, Math.round(20 + p.lv * p.lv * 0.6)); if (lose > 0 && !this.save()) { p.exp -= lose; this.msg('생명력이 빨려 나간다!', 'r'); } }
      else if (eff === 'steal') { if (p.gold > 0 && this.ri(100) > p.d.dex * 3) { const g = Math.max(1, Math.min(p.gold, Math.round(p.gold / 10) + 25)); p.gold -= g; this.msg(`${josa(r.name, '이/가')} 금화 ${g}닢을 훔쳐 달아났다!`, 'r'); this.tele(60, m); return; } }
      else if (eff === 'scare') { if (!this.save()) this.setTm('afraid', 4 + this.ri(4), '소름이 끼친다. 공격할 수 없다!'); }
      else if (eff === 'conf') { if (!this.save()) this.setTm('conf', 3 + this.ri(4), '머리가 어지럽다.'); }
      else if (eff === 'blind') { if (!this.save()) this.setTm('blind', 4 + this.ri(4), '눈이 보이지 않는다!'); }
    }
  }
  monCast(m, r, sp, dd) {
    const p = this.p, [kind, a, b] = sp.split(':'), nm = josa(r.name, '이/가'), dz = s => { const [x, y] = s.split('d'); return this.dice(+x, +y); };
    const say = s => { if (m.vis) this.msg(`${nm} ${s}`, 'o'); else this.msg(`무언가가 ${s}`, 'o'); };
    if (kind === 'blink') { say('순간이동했다.'); return this.tele(8, m); }
    if (kind === 'tport') { say('멀리 사라졌다.'); return this.tele(60, m); }
    if (kind === 'teleto') { const c = this.near(m.x, m.y, 1); if (c >= 0) { say('당신을 끌어당겼다!'); p.x = c % this.map.w; p.y = (c / this.map.w) | 0; this.disturb(); this.flT = null; } return; }
    if (kind === 'heal') { say('상처를 치유했다.'); m.hp = Math.min(m.mhp, m.hp + r.lv * 12); return; }
    if (kind === 'scare' || kind === 'conf' || kind === 'blind' || kind === 'hold' || kind === 'slow') {
      const k = { scare: 'afraid', conf: 'conf', blind: 'blind', hold: 'para', slow: 'slow' }[kind], tx = { scare: '무시무시한 환영을 보여준다.', conf: '기묘한 주문을 읊는다.', blind: '눈을 향해 손짓한다.', hold: '당신을 노려본다.', slow: '시간을 늘어뜨린다.' }[kind];
      say(tx); if (this.save() || !this.setTm(k, kind === 'hold' ? 3 + this.ri(3) : 5 + this.ri(6), { afraid: '공포에 사로잡혔다!', conf: '혼란스럽다!', blind: '눈이 멀었다!', para: '몸이 굳었다!', slow: '몸이 무거워졌다!' }[k])) this.msg('당신은 견뎌냈다.', 'd'); return; }
    if (kind === 'drain_mana') { if (p.mp > 0) { say('마나를 빨아들였다.'); const n = Math.min(p.mp, 10 + this.ri(r.lv)); p.mp -= n; m.hp = Math.min(m.mhp, m.hp + n * 6); } return; }
    if (kind.startsWith('summon')) { say('동료를 불러냈다!'); const flag = kind === 'summon_undead' ? 'undead' : kind === 'summon_demon' ? 'demon' : null; let n = 0;
      for (let i = 0; i < 12 && n < 2 + this.ri(2); i++) { const ri = this.pickRace(Math.max(this.depth, r.lv - 4) + 1), rr = MONSTERS[ri]; if (flag && !rr.F.has(flag)) continue; if (rr.F.has('unique')) continue; const c = this.near(p.x, p.y, 2); if (c >= 0 && this.spawn(ri, c % this.map.w, (c / this.map.w) | 0, false, true)) n++; }
      return; }
    if (kind === 'wound') { say('당신을 가리키며 저주했다.'); if (this.save()) this.msg('당신은 견뎌냈다.', 'd'); else this.hurt(dz(a), null, r.name, '상처가 벌어진다'); return; }
    if (kind === 'mind') { say('당신의 정신을 짓눌렀다.'); if (this.save()) this.msg('당신은 견뎌냈다.', 'd'); else { this.hurt(dz(a), null, r.name, '머릿속이 터질 것 같다'); if (!this.dead) this.setTm('conf', 3 + this.ri(3)); } return; }
    if (kind === 'arrow') { say('화살을 쐈다.'); this.project(m, p.x, p.y, { el: null, dmg: dz(a), name: r.name }); return; }
    if (kind === 'bolt') { say(`${ELN[a]}의 화살을 날렸다.`); this.project(m, p.x, p.y, { el: a, dmg: dz(b), name: r.name }); return; }
    if (kind === 'ball') { say(`${ELN[a]}의 구를 던졌다.`); this.project(m, p.x, p.y, { el: a, dmg: +b, rad: 2, name: r.name }); return; }
    if (kind === 'breath') { const cap = { fire: 280, cold: 280, pois: 200, dark: 180 }[a] || 200; say(`${ELN[a]}의 숨결을 내뿜었다!`); this.project(m, p.x, p.y, { el: a, dmg: Math.min(cap, Math.max(1, Math.round(m.hp / 3))), rad: 2, name: r.name + '의 숨결' }); return; }
  }
  describeMon(m) {
    const r = MONSTERS[m.r], hp = m.hp / m.mhp, out = [];
    out.push(`${r.name} (${r.g}) — ${r.lv}층 수준${r.F.has('unique') ? ' · 유니크' : ''}`);
    out.push(`상태: ${m.sleep > 0 ? '잠들어 있음' : m.fear > 0 ? '도망치는 중' : '깨어 있음'} · ${hp >= 1 ? '멀쩡함' : hp > 0.6 ? '조금 다침' : hp > 0.3 ? '크게 다침' : '빈사'} (${Math.max(0, Math.round(m.hp))}/${m.mhp})`);
    out.push(`속도 ${sg(r.spd)} · 방어 ${r.ac} · 공격 ${r.bl.map(([d, s, e]) => (d ? `${d}d${s}` : '') + (e ? `[${({ pois: '독', fire: '화염', cold: '냉기', para: '마비', drain: '흡수', steal: '절도', scare: '공포', conf: '혼란', blind: '실명' })[e]}]` : '')).join(', ')}`);
    if (r.sp) out.push(`주문(1/${r.sp[0]}): ` + r.sp.slice(1).map(s => { const [k, a] = s.split(':'); return ({ blink: '점멸', tport: '도주', teleto: '끌어당김', heal: '치유', scare: '공포', conf: '혼란', blind: '실명', hold: '마비', slow: '둔화', drain_mana: '마나 흡수', summon: '소환', summon_undead: '망자 소환', summon_demon: '악마 소환', wound: '저주', mind: '정신 공격', arrow: '화살', bolt: ELN[a] + ' 화살', ball: ELN[a] + ' 구', breath: ELN[a] + ' 숨결' })[k]; }).join(', '));
    const tags = [['invis', '투명'], ['pass', '벽 통과'], ['breed', '증식'], ['never', '움직이지 않음'], ['undead', '망자'], ['imfire', '화염 면역'], ['imcold', '냉기 면역'], ['impois', '독 면역'], ['hurtcold', '냉기에 약함']].filter(([f]) => r.F.has(f)).map(x => x[1]);
    if (tags.length) out.push(tags.join(' · ')); if (r.desc) out.push(r.desc);
    return out;
  }

  /* ---------- 플레이어 행동 ---------- */
  move(dx, dy) {
    const p = this.p, mp = this.map; if (this.dead) return false; this.changed = false;
    if (p.tm.conf > 0 && this.ri(100) < 40) [dx, dy] = DIRS[this.ri(8)];
    const nx = p.x + dx, ny = p.y + dy, k = this.I(nx, ny), tt = mp.t[k], m = this.mmap.get(k); p.fx = dx; p.fy = dy;
    if (m) { if (!this.attack(m)) { this.disturb(); return false; } this.endTurn(); return true; }
    if (tt === T.DOOR) { mp.t[k] = T.OPEN; this.msg('문을 열었다.', 'd'); this.endTurn(); return true; }
    if (tt === T.RUBBLE) { if (this.ri(3) === 0) { mp.t[k] = T.FLOOR; this.msg('돌무더기를 치웠다.', 'd'); } else this.msg('돌무더기를 치우는 중…', 'd'); this.endTurn(); return true; }
    if (!walk(tt)) { mp.f[k] |= F.KNOWN; this.disturb(); return false; }
    p.x = nx; p.y = ny; this.arrive(); if (!this.changed) this.endTurn(); return true;
  }
  arrive() {
    const p = this.p, k = this.I(p.x, p.y), tt = this.map.t[k];
    if (tt === T.TRAP) this.trap(k);
    if (this.changed || this.dead) return;
    for (let i = this.items.length - 1; i >= 0; i--) { const o = this.items[i]; if (o.x !== p.x || o.y !== p.y) continue;
      if (o.gold) { p.gold += o.gold; this.msg(`금화 ${o.gold}닢을 주웠다.`, 'y'); this.items.splice(i, 1); }
      else { const nm = this.name(o.it); if (this.addInv(o.it)) { this.msg(`${josa(nm, '을/를')} 주웠다.`, o.it.a || o.it.e ? 'y' : ''); this.items.splice(i, 1); if (o.it.a || o.it.e) this.disturb(); } else { this.msg(`${josa(nm, '이/가')} 있지만 가방이 가득 찼다.`, 'o'); o.skip = 1; this.disturb(); } } }
    const t2 = this.map.t[k];
    if (t2 >= T.SHOP) { this.shop = t2 - T.SHOP; this.disturb(); }
    else if (t2 === T.DOWN && this.auto !== 'travel') this.msg('내려가는 계단이 있다.', 'd'); else if (t2 === T.UP && this.auto !== 'travel') this.msg('올라가는 계단이 있다.', 'd');
  }
  trap(k) {
    const kind = this.traps[k], p = this.p; delete this.traps[k]; this.map.t[k] = T.FLOOR; this.disturb();
    if (kind === 'door') { const lock = this.depth >= MAXDEPTH || (this.depth === QUEST1 && !this.deadU['검은 부관 모르단']); if (lock) { this.msg('발밑이 흔들렸지만 버텼다.'); return; } this.msg('함정문이다! 아래층으로 떨어진다.', 'r'); this.hurt(this.dice(2, 8), null, '추락'); if (!this.dead) this.enter(this.depth + 1, 'fall'); }
    else if (kind === 'tele') { this.msg('순간이동 함정을 밟았다.', 'o'); this.tele(60); }
    else if (kind === 'dart') this.hurt(this.dice(1, 8) + this.depth, 'pois', '독침 함정', '독침이 날아왔다');
    else if (kind === 'fire') this.hurt(this.dice(4, 6) + this.depth, 'fire', '화염 함정', '불길이 치솟았다');
    else { this.msg('소환 함정이다!', 'r'); for (let i = 0; i < 2 + this.ri(2); i++) { const c = this.near(p.x, p.y, 2); if (c >= 0) this.spawn(this.pickRace(this.depth + 1), c % this.map.w, (c / this.map.w) | 0, false, true); } }
  }
  wait() { if (this.dead) return; this.changed = false; this.endTurn(); }
  stairs() {
    const p = this.p, tt = this.map.t[this.I(p.x, p.y)];
    if (tt === T.DOWN) { this.msg('계단을 내려간다.', 'd'); this.enter(this.depth + 1, 'down'); return true; }
    if (tt === T.UP) { this.msg('계단을 올라간다.', 'd'); this.enter(this.depth - 1, 'up'); return true; }
    this.msg('여기엔 계단이 없다.'); return false;
  }
  pickup() { const p = this.p; let any = false; this.changed = false; for (const o of this.items) if (o.x === p.x && o.y === p.y) { o.skip = 0; any = true; } if (!any) { this.msg('주울 것이 없다.'); return; } this.arrive(); this.endTurn(); }
  fire() {
    this.changed = false; const p = this.p, bow = p.eq.bow; if (!bow) { this.msg('활이 없다.'); return false; }
    const bk = KINDS[bow.k], ai = p.inv.findIndex(i => KINDS[i.k].tv === 'ammo' && KINDS[i.k].ammo === bk.ammo); if (ai < 0) { this.msg(`${josa(bk.name, '으로/로')} 쏠 ${bk.ammo === 'arrow' ? '화살' : '쇠구슬'}이 없다.`); return false; }
    if (p.tm.blind > 0 || p.tm.conf > 0) { this.msg('지금은 조준할 수 없다.'); return false; }
    const m = this.target(); if (!m) { this.msg('보이는 대상이 없다.'); return false; }
    const am = p.inv[ai], r = MONSTERS[m.r], d = p.d, dd = dist(m.x, m.y, p.x, p.y), [ad, as] = this.wdice(am), mult = bk.mult + (bow.e && EGO[bow.e].mult || 0) + (bow.a && ART[bow.a].mult || 0);
    this.fx.push({ t: 'bolt', cells: line(p.x, p.y, m.x, m.y), c: '#e8d8a8' });
    const one = { ...am, n: 1 }; am.n--; if (am.n <= 0) p.inv.splice(ai, 1);
    if (this.hitRoll(d.bow + (d.th + d.bth + (am.th || 0)) * 3 - dd, r.ac)) { const crit = this.ri(100) < 5 + p.lv * 0.3; let dmg = (this.dice(ad, as) + (am.td || 0) + d.btd) * mult; if (crit) dmg = dmg * 1.5 + 5; this.hitMon(m, Math.max(1, Math.round(dmg)), null, `${josa(r.name, '을/를')} ${crit ? '정통으로 ' : ''}맞혔다`); }
    else this.msg(`${KINDS[am.k].name}이 빗나갔다.`, 'd');
    if (this.ri(100) >= 35) { const c = m.dead ? this.I(m.x, m.y) : this.near(m.x, m.y, 1); if (c >= 0) { const x = c % this.map.w, y = (c / this.map.w) | 0, ex = this.items.find(o => o.x === x && o.y === y && o.it && this.same(o.it, one)); if (ex) ex.it.n++; else this.items.push({ x, y, it: one, seen: 1 }); } }
    this.endTurn(Math.round(100 / d.shots)); return true;
  }
  spellFail(s) { const p = this.p; return Math.max(5, Math.min(95, Math.round(s.fail - 3 * (p.lv - s.lv) - (p.d.int - 12) * 2))); }
  spellsKnown() { const p = this.p; if (p.cls !== 'mage') return []; return SPELLS.filter(s => p.inv.some(i => KINDS[i.k].id === s.book)); }
  cast(id) {
    this.changed = false; const p = this.p, s = SPELLS.find(x => x.id === id); if (!s || p.cls !== 'mage') return false;
    if (!p.inv.some(i => KINDS[i.k].id === s.book)) { this.msg('그 주문이 적힌 마법서가 없다.'); return false; }
    if (p.lv < s.lv) { this.msg(`레벨 ${s.lv}가 되어야 쓸 수 있다.`); return false; }
    if (p.tm.blind > 0 || p.tm.conf > 0) { this.msg('지금은 마법서를 읽을 수 없다.'); return false; }
    if (p.mp < s.mp) { this.msg('마나가 부족하다.'); return false; }
    let m = null; if (s.aim) { m = this.target(); if (!m) { this.msg('보이는 대상이 없다.'); return false; } }
    p.mp -= s.mp;
    if (this.ri(100) < this.spellFail(s)) { this.msg('주문에 집중하지 못했다.', 'o'); this.endTurn(); return true; }
    const L = p.lv;
    if (id === 'missile') this.project('p', m.x, m.y, { el: 'magic', dmg: this.dice(3 + Math.floor(L / 5), 4) });
    else if (id === 'detect') this.detect();
    else if (id === 'phase') this.tele(8);
    else if (id === 'light') this.lightRoom();
    else if (id === 'stink') this.project('p', m.x, m.y, { el: 'pois', dmg: 10 + (L >> 1), rad: 2 });
    else if (id === 'frost') this.project('p', m.x, m.y, { el: 'cold', dmg: this.dice(6 + Math.floor(L / 4), 8) });
    else if (id === 'fireball') this.project('p', m.x, m.y, { el: 'fire', dmg: 55 + L * 2, rad: 2 });
    else if (id === 'teleport') this.tele(80);
    else if (id === 'lightning') this.project('p', m.x, m.y, { el: 'elec', dmg: this.dice(6 + Math.floor(L / 4), 8), beam: 1 });
    else if (id === 'haste') this.setTm('fast', 20 + L, '몸이 가벼워졌다!');
    else if (id === 'resist') { this.setTm('oppFire', 20 + this.ri(20)); this.setTm('oppCold', 20 + this.ri(20), '원소에 대한 저항력이 생겼다.'); }
    else if (id === 'mana') this.project('p', m.x, m.y, { el: 'magic', dmg: 150 + L * 3, rad: 3 });
    else if (id === 'banish') { this.msg(`${josa(MONSTERS[m.r].name, '이/가')} 사라졌다.`); this.tele(80, m); }
    else if (id === 'enlight') this.mapAll();
    this.endTurn(); return true;
  }
  detect() { let n = 0; for (const m of this.mons) if (dist(m.x, m.y, this.p.x, this.p.y) <= 26) { m.det = 4; n++; } this.msg(n ? `괴물 ${n}마리의 기척을 느꼈다.` : '주변에 괴물이 없다.', 'b'); }
  detectItems() { let n = 0; for (const o of this.items) if (dist(o.x, o.y, this.p.x, this.p.y) <= 26) { o.seen = 1; n++; } this.msg(n ? `물건 ${n}개의 위치를 알았다.` : '주변에 아무것도 없다.', 'b'); }
  mapArea(rad) { const m = this.map, p = this.p; for (let y = Math.max(1, p.y - rad); y < Math.min(m.h - 1, p.y + rad); y++) for (let x = Math.max(1, p.x - rad * 2); x < Math.min(m.w - 1, p.x + rad * 2); x++) { const k = this.I(x, y); if (m.f[k] & F.VAULT) continue; if (!opaque(m.t[k]) || m.t[k] === T.DOOR || m.t[k] === T.RUBBLE) { m.f[k] |= F.KNOWN; for (const [dx, dy] of DIRS) m.f[this.I(x + dx, y + dy)] |= F.KNOWN; } } this.msg('주변 지형이 머릿속에 그려진다.', 'b'); }
  mapAll() { const m = this.map; for (let k = 0; k < m.t.length; k++) m.f[k] |= F.KNOWN | F.LIT; for (const o of this.items) o.seen = 1; this.msg('이 층의 모든 것이 환히 보인다.', 'b'); }
  lightRoom() { const m = this.map, p = this.p, st = [this.I(p.x, p.y)], seen = new Set(st); let n = 0;
    while (st.length && n < 400) { const k = st.pop(), x = k % m.w, y = (k / m.w) | 0; m.f[k] |= F.LIT | F.KNOWN; n++; for (const [dx, dy] of DIRS) { const q = this.I(x + dx, y + dy); m.f[q] |= F.LIT | F.KNOWN; if (!seen.has(q) && walk(m.t[q]) && (m.f[q] & F.ROOM) && dist(x + dx, y + dy, p.x, p.y) < 14) { seen.add(q); st.push(q); } } }
    this.msg('주위가 환해졌다.', 'b'); }
  use(i) {
    this.changed = false; const p = this.p, it = p.inv[i]; if (!it || this.dead) return false; const k = KINDS[it.k], tv = k.tv, id = k.id, L = p.lv;
    if (EQUIP.has(tv)) return this.wield(i);
    if (tv === 'book') { this.msg(p.cls === 'mage' ? '주문 버튼으로 시전한다.' : '무슨 뜻인지 알 수 없다.'); return false; }
    if (tv === 'ammo') { this.msg('활을 들고 사격한다.'); return false; }
    if (tv === 'scroll' && (p.tm.blind > 0 || p.tm.conf > 0)) { this.msg('지금은 읽을 수 없다.'); return false; }
    if (tv === 'rod' && it.t > 0) { this.msg('아직 충전 중이다.'); return false; }
    const aimed = ['w_missile', 'w_stink', 'w_slow', 'w_sleep', 'w_cold', 'w_tele', 'w_fire', 'w_dragon', 'flask'].includes(id);
    let m = null; if (aimed) { m = this.target(); if (!m) { this.msg('보이는 대상이 없다.'); return false; } }
    if (tv === 'wand') { if (it.ch <= 0) { this.msg('충전이 남아 있지 않다.'); return false; } it.ch--; }
    const was = this.isKnown(it); this.known[id] = 1; const nm = this.name({ ...it, n: 1 }, true);
    this.msg(tv === 'potion' ? `${josa(nm, '을/를')} 마셨다.` : tv === 'scroll' ? `${josa(nm, '을/를')} 읽었다.` : tv === 'food' ? `${josa(nm, '을/를')} 먹었다.` : tv === 'flask' ? '기름병을 던졌다.' : `${josa(nm, '을/를')} 사용했다.`, was ? '' : 'b');
    const stat = (s, n) => { p.st[s] = Math.min(25, p.st[s] + 1); this.calc(); this.msg(`${n}이 영구히 올랐다!`, 'y'); };
    switch (id) {
      case 'p_clw': this.heal(20); this.cure('blind', 'pois'); break; case 'p_csw': this.heal(50); this.cure('blind', 'conf', 'pois'); break;
      case 'p_heal': this.heal(300); this.cure('blind', 'conf', 'pois', 'afraid', 'slow'); break; case 'p_mana': p.mp = p.d.mmp; this.msg('마나가 차오른다.', 'b'); break;
      case 'p_speed': this.setTm('fast', 20 + this.ri(15), '몸이 가벼워졌다!'); break; case 'p_hero': this.cure('afraid'); this.heal(10); this.setTm('hero', 25 + this.ri(25), '용기가 솟는다!'); break;
      case 'p_bers': this.cure('afraid'); this.heal(15); this.setTm('bers', 25 + this.ri(25), '피가 끓어오른다!'); break;
      case 'p_rfire': this.setTm('oppFire', 30 + this.ri(20), '불이 두렵지 않다.'); break; case 'p_rcold': this.setTm('oppCold', 30 + this.ri(20), '추위가 두렵지 않다.'); break;
      case 'p_see': this.setTm('seeInv', 60 + this.ri(40), '보이지 않던 것이 보인다.'); break;
      case 'p_str': stat('str', '힘'); break; case 'p_int': stat('int', '지능'); break; case 'p_dex': stat('dex', '민첩'); break; case 'p_con': stat('con', '체질'); break;
      case 'p_enl': this.mapAll(); break; case 'p_sleep': if (!this.setTm('para', 4 + this.ri(4), '깊은 잠에 빠져든다…')) this.msg('잠깐 졸렸다.'); break; case 'p_conf': if (!this.setTm('conf', 8 + this.ri(8), '세상이 빙글빙글 돈다.')) this.msg('잠깐 어지러웠다.'); break;
      case 's_phase': this.tele(8); break; case 's_tele': this.tele(80); break;
      case 's_recall': if (this.recall) { this.recall = 0; this.msg('끌어당기던 힘이 사라졌다.'); } else { this.recall = 15 + this.ri(20); this.msg('공기가 팽팽해진다. 곧 끌려갈 것이다.', 'b'); } break;
      case 's_deep': this.deep = 5; this.msg('발밑이 흔들리기 시작한다.', 'b'); break;
      case 's_map': this.mapArea(15); break; case 's_treas': case 'rod_treas': this.detectItems(); break; case 's_life': case 'rod_det': this.detect(); break; case 's_light': case 'rod_light': this.lightRoom(); break;
      case 's_weapon': { const w = p.eq.weapon || p.eq.bow; if (!w) { this.msg('강화할 무기가 없다.'); break; } const cur = Math.max(w.th || 0, w.td || 0); if (this.ri(100) < Math.max(10, 100 - cur * 7)) { w.th = (w.th || 0) + 1; w.td = (w.td || 0) + 1; this.msg(`${josa(this.name(w), '이/가')} 빛난다.`, 'y'); } else this.msg('강화에 실패했다.'); this.calc(); break; }
      case 's_armor': { const c = Object.values(p.eq).filter(x => x && ARMOR.has(KINDS[x.k].tv)); if (!c.length) { this.msg('강화할 방어구가 없다.'); break; } const a = c[this.ri(c.length)]; if (this.ri(100) < Math.max(10, 100 - (a.ta || 0) * 7)) { a.ta = (a.ta || 0) + 1; this.msg(`${josa(this.name(a), '이/가')} 빛난다.`, 'y'); } else this.msg('강화에 실패했다.'); this.calc(); break; }
      case 's_bless': this.setTm('bless', 20 + this.ri(20), '가호가 느껴진다.'); break;
      case 's_charge': { const w = p.inv.filter(x => KINDS[x.k].tv === 'wand').sort((a, b) => a.ch - b.ch)[0]; if (w) { w.ch += 3 + this.ri(5); this.msg(`${josa(this.name(w), '이/가')} 충전되었다.`, 'b'); } else this.msg('충전할 마법봉이 없다.'); break; }
      case 's_summon': this.msg('주위에서 괴물이 솟아난다!', 'r'); for (let n = 0; n < 3; n++) { const c = this.near(p.x, p.y, 2); if (c >= 0) this.spawn(this.pickRace(this.depth + 1), c % this.map.w, (c / this.map.w) | 0, false, true); } break;
      case 's_dark': this.msg('어둠이 덮친다.', 'r'); this.setTm('blind', 4 + this.ri(4)); break;
      case 'w_missile': this.project('p', m.x, m.y, { el: 'magic', dmg: this.dice(3, 4) + 2 }); break; case 'w_stink': this.project('p', m.x, m.y, { el: 'pois', dmg: 14, rad: 2 }); break;
      case 'w_cold': this.project('p', m.x, m.y, { el: 'cold', dmg: this.dice(6, 8) }); break; case 'w_fire': this.project('p', m.x, m.y, { el: 'fire', dmg: this.dice(9, 8) }); break;
      case 'w_dragon': this.project('p', m.x, m.y, { el: ['fire', 'cold', 'pois'][this.ri(3)], dmg: 130, rad: 3 }); break;
      case 'w_slow': if (MONSTERS[m.r].F.has('unique') && this.ri(2)) this.msg('효과가 없다.'); else { m.slow = 20; this.msg(`${josa(MONSTERS[m.r].name, '이/가')} 느려졌다.`); } break;
      case 'w_sleep': if (MONSTERS[m.r].F.has('unique') || MONSTERS[m.r].F.has('nofear')) this.msg('효과가 없다.'); else { m.sleep = 80; this.msg(`${josa(MONSTERS[m.r].name, '이/가')} 잠들었다.`); } break;
      case 'w_tele': this.msg(`${josa(MONSTERS[m.r].name, '이/가')} 사라졌다.`); this.tele(80, m); break;
      case 'w_mud': { const t = this.target(), dx = t ? Math.sign(t.x - p.x) : p.fx, dy = t ? Math.sign(t.y - p.y) : p.fy; let x = p.x, y = p.y, done = 0; for (let n = 0; n < 12; n++) { x += dx; y += dy; const q = this.I(x, y), tt = this.map.t[q]; if (tt === T.PERM || x < 1 || y < 1 || x >= this.map.w - 1 || y >= this.map.h - 1) break; if (tt === T.WALL || tt === T.RUBBLE || tt === T.DOOR) { this.map.t[q] = T.FLOOR; done = 1; break; } } this.msg(done ? '벽이 진흙이 되어 무너졌다.' : '아무 일도 없었다.'); break; }
      case 'ration': p.food = Math.min(15000, p.food + 6000); this.calc(); break;
      case 'flask': this.project('p', m.x, m.y, { el: 'fire', dmg: this.dice(2, 6), rad: 1 }); break;
    }
    if (tv === 'rod') it.t = 20 + this.ri(15); else if (tv !== 'wand') { it.n--; if (it.n <= 0) p.inv.splice(p.inv.indexOf(it), 1); }
    if (!this.changed && !this.dead) this.endTurn(); return true;
  }
  wield(i) {
    this.changed = false; const p = this.p, it = p.inv[i]; if (!it) return false; const s = this.slotFor(it), old = p.eq[s]; p.inv.splice(i, 1); p.eq[s] = it; if (old) this.addInv(old);
    if (FLAVORS[KINDS[it.k].tv]) this.known[KINDS[it.k].id] = 1;
    this.msg(`${josa(this.name(it), '을/를')} 장착했다.`); this.calc(); this.endTurn(); return true;
  }
  takeoff(s) { this.changed = false; const p = this.p, it = p.eq[s]; if (!it) return false; if (p.inv.length >= 22) { this.msg('가방이 가득 찼다.'); return false; } delete p.eq[s]; this.addInv(it); this.msg(`${josa(this.name(it), '을/를')} 벗었다.`); this.calc(); this.endTurn(); return true; }
  drop(i) { this.changed = false; const p = this.p, it = p.inv[i]; if (!it) return false; p.inv.splice(i, 1); this.items.push({ x: p.x, y: p.y, it, seen: 1, skip: 1 }); this.msg(`${josa(this.name(it), '을/를')} 내려놓았다.`); this.endTurn(); return true; }
  /* ---------- 상점 ---------- */
  price(e) { return Math.max(1, Math.round(this.value(e.it) * (e.bm ? 3 : 1.15))); }
  sellPrice(it) { return Math.min(4000, Math.round(this.value(it) * 0.25)); }
  buy(si, i) {
    const e = this.shops[si][i], p = this.p; if (!e) return false; const pr = this.price(e), tv = KINDS[e.it.k].tv, q = tv === 'ammo' ? Math.min(20, e.it.n) : 1, cost = tv === 'ammo' ? pr * q : pr;
    if (p.gold < cost) { this.msg('금화가 모자란다.'); return false; }
    const one = { ...e.it, n: q }; if (!this.addInv(one)) { this.msg('가방이 가득 찼다.'); return false; }
    p.gold -= cost; e.it.n -= q; if (e.it.n <= 0) this.shops[si].splice(i, 1); this.known[KINDS[one.k].id] = 1; this.msg(`${josa(this.name(one), '을/를')} ${cost}닢에 샀다.`, 'y'); if (this.onSave) this.onSave(); return true;
  }
  sell(i) {
    const p = this.p, it = p.inv[i]; if (!it) return false; const tv = KINDS[it.k].tv, q = tv === 'ammo' ? it.n : 1, pr = this.sellPrice(it) * q;
    this.known[KINDS[it.k].id] = 1; p.gold += pr; this.msg(`${josa(this.name({ ...it, n: q }), '을/를')} ${pr}닢에 팔았다.`, 'y'); it.n -= q; if (it.n <= 0) p.inv.splice(i, 1); if (this.onSave) this.onSave(); return true;
  }

  /* ---------- 자동 행동 ---------- */
  danger() { return this.mons.some(m => !m.dead && m.direct && dist(m.x, m.y, this.p.x, this.p.y) < 14 && !(this.depth === 0 && m.sleep > 0)); }
  start(kind, dest) {
    if (this.dead) return; if (this.danger() && kind !== 'travel') { this.msg('괴물이 보이는 동안에는 할 수 없다.', 'o'); return; }
    this.auto = kind; this.dest = dest; this.autoN = 0; if (kind === 'rest') this.p.resting = true; this.continue();
  }
  continue() {
    if (!this.auto || this.dead) return false; const p = this.p, kind = this.auto;
    if (++this.autoN > 600 || p.tm.blind > 0 || p.tm.conf > 0) { this.disturb(); return false; }
    if (kind === 'rest') { const bad = ['pois', 'afraid', 'slow'].some(k => p.tm[k] > 0); if (p.hp >= p.d.mhp && p.mp >= p.d.mmp && !bad) { this.disturb(); this.msg('휴식을 마쳤다.', 'd'); return false; } if (p.food < 1000) { this.disturb(); this.msg('배가 고파 쉴 수 없다.', 'o'); return false; } p.resting = true; this.auto = 'rest'; this.changed = false; this.endTurn(); return !!this.auto; }
    const m = this.map, t = m.t, f = m.f, srcs = [], pk = this.I(p.x, p.y), full = p.inv.length >= 22;
    const ok = k => (f[k] & F.KNOWN) && (walk(t[k]) || t[k] === T.DOOR || t[k] === T.RUBBLE) && t[k] !== T.TRAP;
    if (kind === 'travel') srcs.push(this.dest);
    else { for (const o of this.items) if (o.seen && !o.skip && (o.gold || !full)) { const k = this.I(o.x, o.y); if (k !== pk && !(f[k] & F.VAULT && false)) srcs.push(k); }
      for (let k = m.w; k < t.length - m.w; k++) { if (!ok(k) || k === pk) continue; const x = k % m.w, y = (k / m.w) | 0; for (const [dx, dy] of DIRS) { const q = this.I(x + dx, y + dy); if (!(f[q] & F.KNOWN)) { srcs.push(k); break; } } } }
    if (!srcs.length) { this.disturb(); if (kind === 'explore') this.msg('더 탐험할 곳이 없다. 계단으로 가자.', 'd'); return false; }
    flow(m, srcs, k => ok(k) || k === pk, 400, this.tmpf);
    const cur = this.tmpf[pk]; if (cur >= 32000) { this.disturb(); this.msg(kind === 'travel' ? '거기까지 가는 길을 모른다.' : '더 탐험할 곳이 없다. 계단으로 가자.', 'd'); return false; }
    if (cur === 0) { this.disturb(); return false; }
    let best = null, bv = cur; for (const dir of DIRS) { const k = this.I(p.x + dir[0], p.y + dir[1]); if (this.tmpf[k] < bv && !this.mmap.has(k)) { bv = this.tmpf[k]; best = dir; } }
    if (!best) { this.disturb(); return false; }
    this.auto = kind; this.move(best[0], best[1]);
    if (kind === 'travel' && this.I(p.x, p.y) === this.dest) this.disturb();
    return !!this.auto;
  }
  nearest(tt) { const m = this.map, p = this.p; let best = -1, bd = 1e9; for (let k = 0; k < m.t.length; k++) if (m.t[k] === tt && (m.f[k] & F.KNOWN)) { const d = dist(k % m.w, (k / m.w) | 0, p.x, p.y); if (d < bd) { bd = d; best = k; } } return best; }

  /* ---------- 저장 ---------- */
  toJSON() {
    const o = {}; for (const k of ['seed', 'turn', 'pturn', 'depth', 'maxDepth', 'known', 'deadU', 'arts', 'recall', 'deep', 'won', 'dead', 'cause', 'mid', 'kills', 'pfrac', 'flav', 'p', 'traps', 'items', 'shops', 'feel']) o[k] = this[k];
    o.mons = this.mons.filter(m => !m.dead); o.log = this.log.slice(-40); o.map = { w: this.map.w, h: this.map.h, town: this.map.town, t: Array.from(this.map.t), f: Array.from(this.map.f) }; o.v = 1;
    return JSON.parse(JSON.stringify(o));
  }
  fromJSON(o) {
    Object.assign(this, JSON.parse(JSON.stringify(o))); this.map.t = Uint8Array.from(o.map.t); this.map.f = Uint8Array.from(o.map.f); this.mmap = new Map(); for (const m of this.mons) this.mmap.set(this.I(m.x, m.y), m);
    this.alloc(); this.calc(); this.updateView();
  }
}
