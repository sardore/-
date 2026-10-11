// 게임 규칙. 렌더링/입력과 분리되어 있어 노드에서 그대로 시뮬레이션할 수 있다.
import { World, COLS, CH, DX, DY, IT } from './gen.js';
import { SKILLS, MAXLV, BRAKE_CD, PHASE_CD, RAM_LEN, FIREWALL, CHAIN_GAP } from './data.js';

const SPEED = 24, MID = (COLS - 1) / 2;

export class Game {
  constructor(seed, hooks) {
    this.h = hooks || {};
    this.rand = (() => { let s = (seed ^ 0x9e3779b9) >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; })();
    this.w = new World(seed); this.w.ensure(CH * 3);
    this.w.items.delete(this.w.key(MID, 0));
    this.p = { c: MID, r: 0, x: MID, y: 0, dir: -1, face: 0, moving: false, len: 0, queued: -1, inv: 0, brake: false };
    this.hp = 3; this.maxHp = 3; this.bits = 0; this.score = 0; this.chain = 0; this.bestChain = 0; this.gap = 0; this.maxRow = 0; this.kills = 0;
    this.sk = {}; this.cd = { brake: 0, phase: 0 };
    this.ghosts = []; this.ev = []; this.fright = 0; this.gold = 0; this.glitch = -7; this.started = false; this.t = 0;
    this.dead = false; this.why = ''; this.menu = null; this.clean = 0;
    this.takeSpawns();
  }
  sfx(n, v) { if (this.h.sfx) this.h.sfx(n, v); }
  text(s, c, col) { this.ev.push({ type: 'text', x: this.p.x, y: this.p.y, s, c: col || '#fff' }); }
  burst(x, y, c, n) { this.ev.push({ type: 'burst', x, y, c, n: n || 10 }); }
  get zone() { return this.w.zoneOf(this.p.r); }
  takeSpawns() {
    for (const s of this.w.spawns) this.ghosts.push({ kind: s.kind, x: s.c, y: s.r, tx: s.c, ty: s.r, dir: -1, state: 'idle', t: 0 });
    this.w.spawns.length = 0;
  }

  /* ---- 입력 ---- */
  swipe(d) {
    if (this.dead || this.menu) return;
    const p = this.p;
    if (p.moving) { p.queued = d; return; }
    this.tryStart(d, true);
  }
  tap() {
    if (this.dead || this.menu) return;
    if (this.p.moving && this.sk.brake && this.cd.brake <= 0) this.p.brake = true;
  }
  tryStart(d, allowPhase) {
    const p = this.p, w = this.w, nc = p.c + DX[d], nr = p.r + DY[d];
    p.face = d;
    if (!w.wall(nc, nr)) { p.dir = d; p.moving = true; p.len = 0; this.started = true; this.sfx('go'); return true; }
    if (allowPhase && this.sk.phase && this.cd.phase <= 0 && nc >= 1 && nc <= COLS - 2 && nr >= 0 && !w.wall(nc + DX[d], nr + DY[d])) {
      this.cd.phase = PHASE_CD[this.sk.phase - 1]; p.dir = d; p.moving = true; p.len = 0; this.started = true;
      this.sfx('phase'); this.burst(nc, nr, '#c4a8ff', 12); return true;
    }
    this.sfx('bump'); return false;
  }

  /* ---- 스킬/장소 ---- */
  offer(n) {
    const pool = SKILLS.filter(s => (this.sk[s.id] || 0) < MAXLV), out = [];
    while (out.length < n && pool.length) out.push(pool.splice((this.rand() * pool.length) | 0, 1)[0]);
    return out;
  }
  gain(id) {
    this.sk[id] = (this.sk[id] || 0) + 1;
    if (id === 'heart') { this.maxHp++; this.hp = Math.min(this.maxHp, this.hp + 1); }
    this.sfx('pick');
  }
  choose(i) { const m = this.menu; if (!m || m.type !== 'pick' || !m.cards[i]) return; this.gain(m.cards[i].id); this.menu = null; }
  buy(i) {
    const m = this.menu; if (!m || m.type !== 'shop') return false;
    const o = m.offers[i]; if (!o || o.sold || this.bits < o.price) return false;
    this.bits -= o.price; o.sold = true;
    if (o.heal) { this.hp = Math.min(this.maxHp, this.hp + 1); this.sfx('pick'); } else this.gain(o.skill.id);
    return true;
  }
  leave() { this.menu = null; }
  openPlace(type) {
    this.sfx('place');
    if (type === IT.ALTAR) {
      const cards = this.offer(3);
      if (cards.length) this.menu = { type: 'pick', cards }; else { this.bits += 20; this.text('+20 비트', 0, '#ffd23f'); }
    } else if (type === IT.SHOP) {
      const offers = this.offer(2).map(s => ({ skill: s, price: 20 + 15 * (this.sk[s.id] || 0) + 4 * this.zone }));
      offers.push({ heal: true, price: 15 + 3 * this.zone });
      this.menu = { type: 'shop', offers };
    } else if (type === IT.REST) {
      this.glitch -= 8; this.hp = Math.min(this.maxHp, this.hp + 1); this.text('쉼터 · 글리치 후퇴', 0, '#ff8fa8'); this.burst(this.p.x, this.p.y, '#ff8fa8', 18);
    } else if (type === IT.VAULT) {
      this.bits += 30; this.score += 300; this.gold = 8; this.text('금고 · +30 · 골드 러시', 0, '#ffd23f'); this.burst(this.p.x, this.p.y, '#ffd23f', 24);
    }
    if (this.menu && this.h.menu) this.h.menu(this.menu);
  }
  collect(it, k, chained) {
    const mul = this.gold > 0 ? 2 : 1, val = (it === IT.GOLD ? 3 : 1) * mul;
    this.w.items.delete(k); this.bits += val;
    if (chained) {
      this.chain++; this.gap = 0; if (this.chain > this.bestChain) this.bestChain = this.chain;
      if (this.chain % 16 === 0) { this.bits += 5; this.score += this.chain * 10; this.text('연쇄 ' + this.chain + ' · +5', 0, '#ff8fd0'); this.sfx('chain'); }
    }
    this.score += 10 * val + Math.min(this.chain, 60);
    this.sfx('dot', this.chain);
  }
  onEnter(c, r) {
    const w = this.w, k = w.key(c, r), it = w.items.get(k);
    if (r > this.maxRow) { this.score += (r - this.maxRow) * 10; this.maxRow = r; }
    w.ensure(r + CH * 3); this.takeSpawns();
    if (it === IT.DOT || it === IT.GOLD) this.collect(it, k, true);
    else if (it === IT.POWER) { w.items.delete(k); this.power(); }
    else if (it >= IT.ALTAR) { w.items.delete(k); this.openPlace(it); }
    else if (++this.gap > CHAIN_GAP[this.sk.chain || 0]) this.chain = 0;
    const mg = this.sk.magnet;
    if (mg) {
      const horiz = this.p.dir === 1 || this.p.dir === 3, rad = mg >= 3 ? 2 : 1;
      for (const s of [-1, 1]) for (let i = 1; i <= rad; i++) {
        const cc = horiz ? c : c + s * i, rr = horiz ? r + s * i : r;
        if (w.wall(cc, rr)) break;
        const kk = w.key(cc, rr), v = w.items.get(kk);
        if (v === IT.DOT || v === IT.GOLD) this.collect(v, kk, false);
        else if (v === IT.POWER && mg >= 2) { w.items.delete(kk); this.power(); }
      }
    }
  }
  power() { this.fright = 6; this.score += 50; this.sfx('power'); this.text('파워 코어', 0, '#7dd3ff'); }
  ramOn() { const l = this.sk.ram; return !!l && this.p.moving && this.p.len >= RAM_LEN[l - 1]; }
  hurt(why) {
    if (this.p.inv > 0) return;
    this.hp--; this.p.inv = 1.6; this.chain = 0; this.sfx('hurt'); this.ev.push({ type: 'shake', v: 10 }); this.burst(this.p.x, this.p.y, '#ff5a5a', 16);
    if (this.hp <= 0) this.die(why);
  }
  die(why) {
    if (this.dead) return;
    this.dead = true; this.why = why; this.p.moving = false; this.sfx('die'); this.ev.push({ type: 'shake', v: 18 }); this.burst(this.p.x, this.p.y, '#ffe14a', 40);
    if (this.h.dead) this.h.dead();
  }

  /* ---- 진행 ---- */
  update(dt) {
    if (this.dead || this.menu) return;
    this.t += dt;
    const p = this.p;
    for (const k of ['brake', 'phase']) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.fright > 0) this.fright -= dt;
    if (this.gold > 0) this.gold -= dt;
    if (p.inv > 0) p.inv -= dt;
    this.movePlayer(dt);
    if (this.dead || this.menu) return;
    this.moveGhosts(dt);
    if (this.dead) return;
    if (this.started) {
      const ci = Math.max(0, Math.floor(p.r / CH));
      const sp = Math.min(0.55 + ci * 0.06, 1.6) * (1 - FIREWALL[this.sk.firewall || 0]);
      this.glitch = Math.max(this.glitch + sp * dt, p.y - 18);
      if (p.y < this.glitch + 0.15) { this.die('글리치에 삼켜짐'); return; }
    }
    if ((this.clean += dt) > 2) {
      this.clean = 0;
      const lim = (Math.floor(this.glitch) - 4) * 16;
      for (const k of this.w.items.keys()) if (k < lim) this.w.items.delete(k);
      this.ghosts = this.ghosts.filter(g => g.y > this.glitch - 1);
    }
  }
  movePlayer(dt) {
    const p = this.p, w = this.w;
    let dist = SPEED * dt, guard = 0;
    while (p.moving && dist > 0 && guard++ < 64) {
      const tx = p.c + DX[p.dir], ty = p.r + DY[p.dir], rem = Math.abs(tx - p.x) + Math.abs(ty - p.y);
      if (dist < rem) { p.x += DX[p.dir] * dist; p.y += DY[p.dir] * dist; break; }
      dist -= rem; p.x = p.c = tx; p.y = p.r = ty; p.len++;
      if (w.wall(tx, ty)) continue;                 // 관통 중인 벽 칸: 그대로 통과
      this.onEnter(tx, ty);
      if (this.dead) return;
      let stop = w.wall(tx + DX[p.dir], ty + DY[p.dir]);
      if (p.brake) { p.brake = false; this.cd.brake = BRAKE_CD[this.sk.brake - 1]; stop = true; this.sfx('brake'); }
      if (stop) {
        p.moving = false; this.sfx('stop'); this.ev.push({ type: 'shake', v: 2 });
        if (p.queued >= 0 && !this.menu) { const d = p.queued; p.queued = -1; this.tryStart(d, false); }
      }
      if (this.menu) return;
    }
    if (!p.moving) p.brake = false;
  }
  los(g) {
    const p = this.p, gc = Math.round(g.x), gr = Math.round(g.y);
    if (gc !== p.c && gr !== p.r) return -1;
    const d = gc === p.c ? (p.r > gr ? 0 : 2) : (p.c > gc ? 1 : 3), n = Math.abs(p.c - gc) + Math.abs(p.r - gr);
    if (n === 0 || n > 9) return -1;
    for (let i = 1; i < n; i++) if (this.w.wall(gc + DX[d] * i, gr + DY[d] * i)) return -1;
    return d;
  }
  moveGhosts(dt) {
    const p = this.p, w = this.w, fr = this.fright > 0, z = this.zone;
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      if (Math.abs(g.y - p.y) < 22) {
        if (g.kind === 'chase') {
          let d = Math.min(2.6 + z * 0.25, 4.4) * (fr ? 0.55 : 1) * dt, guard = 0;
          while (d > 0 && guard++ < 8) {
            const rem = Math.abs(g.tx - g.x) + Math.abs(g.ty - g.y);
            if (rem > d) { g.x += Math.sign(g.tx - g.x) * d; g.y += Math.sign(g.ty - g.y) * d; break; }
            d -= rem; g.x = g.tx; g.y = g.ty;
            let opts = [0, 1, 2, 3].filter(k => !w.wall(g.tx + DX[k], g.ty + DY[k]) && g.ty + DY[k] > this.glitch);
            if (opts.length > 1 && g.dir >= 0) opts = opts.filter(k => k !== (g.dir + 2) % 4);
            if (!opts.length) break;
            let best = opts[0], bv = Infinity;
            if (this.rand() < 0.15) best = opts[(this.rand() * opts.length) | 0];
            else for (const k of opts) { const v = ((g.tx + DX[k] - p.c) ** 2 + (g.ty + DY[k] - p.r) ** 2) * (fr ? -1 : 1); if (v < bv) { bv = v; best = k; } }
            g.dir = best; g.tx += DX[best]; g.ty += DY[best];
          }
        } else {
          if (g.state === 'idle') {
            const d = fr ? -1 : this.los(g);
            if (d >= 0) { g.state = 'aim'; g.t = Math.max(0.38, 0.62 - z * 0.04); g.dir = d; this.sfx('aim'); }
          } else if (g.state === 'aim') { if ((g.t -= dt) <= 0) g.state = 'dash'; }
          else if (g.state === 'cool') { if ((g.t -= dt) <= 0) g.state = 'idle'; }
          else {
            let d = 13 * dt, guard = 0;
            while (d > 0 && guard++ < 8) {
              const rem = Math.abs(g.tx - g.x) + Math.abs(g.ty - g.y);
              if (rem > d) { g.x += Math.sign(g.tx - g.x) * d; g.y += Math.sign(g.ty - g.y) * d; break; }
              d -= rem; g.x = g.tx; g.y = g.ty;
              if (w.wall(g.tx + DX[g.dir], g.ty + DY[g.dir])) { g.state = 'cool'; g.t = 0.9; break; }
              g.tx += DX[g.dir]; g.ty += DY[g.dir];
            }
          }
        }
      }
      if (Math.abs(g.x - p.x) + Math.abs(g.y - p.y) < 0.62) {
        if (fr || this.ramOn()) {
          this.ghosts.splice(i, 1); this.kills++; this.score += 200; this.bits += 3; this.sfx('kill');
          this.burst(g.x, g.y, '#7dd3ff', 20); this.text('+200', 0, '#7dd3ff');
        } else { this.hurt('유령에게 잡힘'); if (this.dead) return; }
      }
    }
  }
}
