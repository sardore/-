// 전투 시뮬레이션. DOM 의존 없음, 시드가 같으면 결과가 같다.
import { UNITS } from './data.js';

export const DT = 1 / 60;
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const lvMul = lv => 1 + 0.1 * (lv - 1);

export class Battle {
  // A, B: [{id, lv}] (빈 칸은 null). opt: {manualA, limit}
  constructor(A, B, seed = 1, opt = {}) {
    this.rand = rng(seed); this.t = 0; this.limit = opt.limit || 90; this.manual = [!!opt.manualA, false];
    this.units = []; this.ev = []; this.q = []; this.over = false; this.winner = -1; this.timeout = false;
    this.spawn(A, 0); this.spawn(B, 1);
  }
  spawn(list, team) {
    const cnt = {};
    list.forEach((e, i) => {
      if (!e || !UNITS[e.id]) return;
      const d = UNITS[e.id], lv = e.lv || 1, m = lvMul(lv), n = cnt[d.pos] = (cnt[d.pos] || 0) + 1;
      const bx = { front: 370, mid: 255, rear: 140 }[d.pos] - (n - 1) * 36, x = team ? 1000 - bx : bx, hp = Math.round(d.hp * m);
      this.units.push({ uid: this.units.length, id: e.id, d, lv, team, slot: i, x, y: i, face: team ? -1 : 1, hp, maxHp: hp, atk: d.atk * m, def: d.def, as: d.as, range: d.range, spd: d.spd || 120,
        cd: d.skill ? d.skill.cd * 0.5 : 1e9, atkT: 0.3 + this.rand() * 0.4, lock: 0, st: [], alive: true, want: false, moving: false,
        stats: { dmg: 0, taken: 0, heal: 0, kills: 0, casts: 0 }, anim: { atk: 0, hit: 0, cast: 0, dead: 0 } });
    });
  }
  team(t) { return this.units.filter(u => u.alive && u.team === t); }
  foes(u) { return this.units.filter(o => o.alive && o.team !== u.team); }
  allies(u) { return this.units.filter(o => o.alive && o.team === u.team); }
  nearest(u, list) { let b = null, bd = 1e9; for (const o of list) { const d = Math.abs(o.x - u.x) + Math.abs(o.y - u.y) * 0.01; if (d < bd) { bd = d; b = o; } } return b; }
  has(u, k) { for (const s of u.st) if (s.k === k) return true; return false; }
  mod(u, k) { let m = 1; for (const s of u.st) if (s.mods && s.mods[k]) m *= 1 + s.mods[k]; return Math.max(0.2, m); }
  fx(e) { this.ev.push(e); }
  after(delay, fn) { this.q.push({ t: this.t + delay, fn }); }
  add(t, s) {
    if (!t.alive) return;
    if (s.k === 'stun' || s.k === 'taunt' || s.k === 'wound' || s.k === 'evade') {
      const o = t.st.find(x => x.k === s.k);
      if (o) { o.t = Math.max(o.t, s.t); if (s.src) o.src = s.src; if (s.ice) o.ice = 1; return; }
    }
    t.st.push(s);
  }
  dot(src, tgt, kind, dur, ratio) { this.add(tgt, { k: 'dot', kind, t: dur, tick: 0.5, v: src.atk * this.mod(src, 'atk') * ratio, src }); }
  hit(src, tgt, mult, o = {}) {
    if (!tgt.alive) return 0;
    if (this.has(tgt, 'evade')) { this.ev.push({ t: 'num', u: tgt, s: '회피', kind: 'miss' }); return 0; }
    const crit = !!o.crit || this.rand() < 0.1;
    const dmg = src.atk * this.mod(src, 'atk') * mult * (100 / (100 + tgt.def * this.mod(tgt, 'def'))) * (crit ? 1.5 : 1) * (0.95 + this.rand() * 0.1);
    return this.damage(src, tgt, dmg, crit ? 'crit' : o.skill ? 'skill' : 'hit');
  }
  damage(src, tgt, dmg, kind) {
    if (!tgt.alive) return 0;
    let left = dmg;
    for (const s of tgt.st) if (s.k === 'shield' && s.v > 0 && left > 0) { const a = Math.min(s.v, left); s.v -= a; left -= a; }
    const dealt = Math.min(left, tgt.hp);
    tgt.hp -= left; tgt.anim.hit = 1;
    src.stats.dmg += dealt; tgt.stats.taken += dealt;
    this.ev.push({ t: 'num', u: tgt, s: left < 0.5 ? '막음' : String(Math.round(left)), kind: left < 0.5 ? 'miss' : kind });
    if (dealt > 0 && src.alive) { let ls = 0; for (const s of src.st) if (s.ls) ls = Math.max(ls, s.ls); if (ls) this.heal(src, src, dealt * ls, true); }
    if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; tgt.st.length = 0; src.stats.kills++; this.ev.push({ t: 'die', u: tgt }); }
    return dealt;
  }
  heal(src, tgt, amt, quiet) {
    if (!tgt.alive) return 0;
    if (this.has(tgt, 'wound')) amt *= 0.5;
    const real = Math.min(amt, tgt.maxHp - tgt.hp);
    if (real <= 0) return 0;
    tgt.hp += real; src.stats.heal += real;
    if (!quiet || real > 8) this.ev.push({ t: 'num', u: tgt, s: '+' + Math.round(real), kind: 'heal' });
    return real;
  }
  ready(u) { return u.alive && u.d.skill && u.cd <= 0; }
  cast(u) { if (u && u.alive && u.d.skill) u.want = true; }
  aiReady(u, foes) {
    const sk = u.d.skill;
    if (this.t < 1.5) return false;
    if (sk.ai === 'heal') return this.allies(u).some(a => a.hp < a.maxHp * 0.8);
    return Math.abs(this.nearest(u, foes).x - u.x) <= (sk.reach || Math.max(u.range + 40, 420));
  }
  basic(u, tg) {
    u.anim.atk = 1;
    if (u.range > 110) this.ev.push({ t: 'proj', a: u, b: tg, c: u.d.look.orb || '#fff' });
    const x = tg.x;
    this.hit(u, tg, 1);
    if (u.d.splash) for (const f of this.foes(u)) if (f !== tg && Math.abs(f.x - x) < u.d.splash) this.hit(u, f, 0.5);
  }
  step() {
    if (this.over) return;
    const dt = DT; this.t += dt;
    for (let i = this.q.length - 1; i >= 0; i--) if (this.q[i].t <= this.t) { const f = this.q[i].fn; this.q.splice(i, 1); f(); }
    for (const u of this.units) {
      const an = u.anim;
      if (an.atk > 0) an.atk = Math.max(0, an.atk - dt * 5); if (an.hit > 0) an.hit = Math.max(0, an.hit - dt * 6); if (an.cast > 0) an.cast = Math.max(0, an.cast - dt * 1.6);
      if (!u.alive) { if (an.dead < 1) an.dead = Math.min(1, an.dead + dt * 2); continue; }
      for (let i = u.st.length - 1; i >= 0 && u.alive; i--) {
        const s = u.st[i]; s.t -= dt;
        if (s.k === 'dot' && (s.tick -= dt) <= 0) { s.tick += 0.5; this.damage(s.src, u, s.v, s.kind); }
        if (u.alive && (s.t <= 0 || (s.k === 'shield' && s.v <= 0))) u.st.splice(i, 1);
      }
      if (!u.alive) continue;
      if (u.cd > 0) u.cd -= dt;
      u.moving = false;
      if (this.has(u, 'stun')) continue;
      if (u.lock > 0) { u.lock -= dt; continue; }
      const foes = this.foes(u);
      if (!foes.length) continue;
      if (u.d.skill && u.cd <= 0 && (this.manual[u.team] ? u.want : this.aiReady(u, foes))) {
        u.want = false; u.cd = u.d.skill.cd; u.lock = 0.45; an.cast = 1; u.stats.casts++;
        this.ev.push({ t: 'cast', u, name: u.d.skill.name });
        u.d.skill.fn(this, u);
        continue;
      }
      const ta = u.st.find(s => s.k === 'taunt' && s.src.alive);
      const tg = ta ? ta.src : this.nearest(u, foes), dx = tg.x - u.x, dist = Math.abs(dx);
      if (dist > 1) u.face = dx > 0 ? 1 : -1;
      if (dist > u.range) { u.x += Math.sign(dx) * Math.min(dist - u.range + 1, u.spd * this.mod(u, 'spd') * dt); u.moving = true; }
      else if ((u.atkT -= dt * this.mod(u, 'as')) <= 0) { u.atkT = u.as; this.basic(u, tg); }
    }
    const a = this.team(0).length, b = this.team(1).length;
    if (!a || !b) { this.over = true; this.winner = a ? 0 : b ? 1 : -1; }
    else if (this.t >= this.limit) {
      this.over = true; this.timeout = true;
      const f = t => this.units.filter(u => u.team === t).reduce((s, u) => s + u.hp / u.maxHp, 0);
      this.winner = f(0) > f(1) ? 0 : 1;
    }
  }
  run() { let n = 0; while (!this.over && n++ < 60 * 200) { this.step(); this.ev.length = 0; } return this; }
}
