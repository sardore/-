/* 블랙쉽 적 함선 보스의 전용 스킬 7종. 공용 범위기(존)가 아니라 보스마다 다른 '장치'로, 각자 자기 판정·그림·턴 규칙을 가진다.
 *   scan 탐조 추적(아르거스) — 탐조등이 부채꼴로 훑고 지나간다
 *   turret 포대 전개(센트리) — 행성 위에 포대가 올라가 두 턴 동안 기체를 겨눠 쏜다(그 행성에 서 있으면 쏘지 않는다)
 *   crate 시한 컨테이너(홀러) — 컨테이너가 놓였다가 두 턴 뒤 십자로 터진다
 *   arc 연쇄 방전(스태틱) — 보스에서 행성들을 차례로 잇는 번개가 내리친다(사슬에 든 행성이 위험)
 *   homing 추격탄(하운드) — 기체를 따라오는 탄. 행성에 부딪히게 유도해 피한다
 *   ricochet 반사 레일(랜서) — 광선이 벽에 튕겨 꺾여 나간다
 *   cage 수감 봉쇄(파놉티콘) — 틈 두 곳이 난 감옥 고리가 행성을 향해 조여든다
 * 흐름: boss-attacks.js 의 mkTele/execAttack/updateHaz/bossTurn 이 여기 skillTele/skillExec/skillUpdate/skillTurn 을 부르고,
 * draw-boss.js 가 skillDrawTele/skillDraw 로 그린다. 위험 요소는 G.haz 에 k 가 'o_' 로 시작하는 항목으로 들어간다. */
import { G, g } from './state.js';
import { PI, TAU, rnd, clamp, pickOf, hexA } from './util.js';
import { fs, arenaK, shipR } from './stats.js';
import { arenaH } from './camera.js';
import { hurt } from './boss-attacks.js';
import { burst, sparks, ringFx, shakeAdd, flashScreen } from './fx.js';
import { beep, thump, noise, sweep } from './audio.js';
import { txt } from './gfx.js';

/** 탐조: 아레나 전체를 훑는 대신 피해가 매우 낮다(위로 올라가 튕겨 나오면 그만이라는 설계 — pow 는 ops-data.js) */
const SCAN = { from: 1.0, fuse: 1.0, blast: 3.4 };
export function scanAng(dir) { return { a0: PI / 2 - dir * SCAN.from, a1: PI / 2 + dir * SCAN.from }; }
export const SKILLS = new Set(['scan', 'turret', 'crate', 'arc', 'homing', 'ricochet', 'cage']);
export const isSkill = k => SKILLS.has(k);

const spread = (list, n) => list.slice().sort(() => Math.random() - .5).slice(0, n);
const angDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
const segD = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); };
const zoneBase = o => Object.assign({ k: 'zone', t: 0, delay: 0, fuse: .9, blast: .3, fade: .8, fired: false }, o);
const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const ring = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const dashed = (on, off, o) => { g.setLineDash([on, off]); if (o != null) g.lineDashOffset = o; };
const solid = () => g.setLineDash([]);

/** 반사 레일의 꺾인 점들: 보스 → (정해 둔 높이의) 벽 → 반대편 벽 → … (nb 번 튕긴다) */
export function ricoPts(b, wall, ty, nb) {
  const K = arenaK(), x0 = b.x, y0 = b.y + b.hr * .4, wx = wall > 0 ? G.w : 0;
  const dxs = wx - x0, adx = Math.max(Math.abs(dxs), 40), dy = Math.max(ty - y0, adx * .32, 60 * K), slope = dy / adx;
  const pts = [[x0, y0], [wx, y0 + dy]]; let side = wall > 0 ? 0 : G.w;   // 다음에 닿을 벽
  for (let i = 0; i < nb; i++) { const last = pts[pts.length - 1]; pts.push([side, last[1] + slope * G.w]); side = side === 0 ? G.w : 0; }
  return pts;
}

/* ---------- 예고(텔레그래프) 구성 ---------- */
export function skillTele(k, b, al, fk, K, ymin, ymax) {
  const s = G.ship, ph = b.phase > 0 ? 1 : 0, pl = al.length ? al : G.planets;
  switch (k) {
    case 'scan': return { dir: Math.random() < .5 ? -1 : 1 };
    case 'turret': { const pool = pl.filter(p => !(s.mode === 'orb' && s.p === p)); return { ps: spread(pool.length >= 2 ? pool : pl, 2 + ph) }; }
    case 'crate': {   // 십자가 닿지 않는 행성이 늘 둘 이상 남도록 놓는다(그 행성에서 안전하게 기다릴 수 있다)
      const live = pl.filter(p => !p.ghost), clear = (cs, p) => cs.every(c => Math.abs(p.y - c.y) > p.R + 58 * fk && Math.abs(p.x - c.x) > p.R + 58 * fk);
      let best = [];
      for (let n = 2 + ph; n >= 1 && best.length < n; n--) {
        for (let att = 0; att < 40 && best.length < n; att++) {
          const cs = [];
          for (let tr = 0; cs.length < n && tr < 120; tr++) {
            const x = rnd(60 * fk, G.w - 60 * fk), y = rnd(ymin, ymax);
            if (pl.every(p => Math.hypot(p.x - x, p.y - y) > p.R + 48 * fk) && cs.every(c => Math.hypot(c.x - x, c.y - y) > 120 * fk && Math.abs(c.y - y) > 50 * K)) cs.push({ x, y });
          }
          if (cs.length === n && live.filter(p => clear(cs, p)).length >= Math.min(2, live.length)) best = cs;
        }
      }
      if (!best.length) best = [{ x: G.w / 2, y: (ymin + ymax) / 2 }];
      return { cs: best };
    }
    case 'arc': return { ps: spread(pl, Math.min(pl.length, 3 + ph)).sort((u, v) => u.y - v.y) };
    case 'homing': return { n: 2 + ph };
    case 'ricochet': return { wall: Math.random() < .5 ? -1 : 1, ty: pickOf(pl).y, nb: 1 + ph };
    case 'cage': { const p = s.mode === 'orb' && s.p && Math.random() < .7 ? s.p : pickOf(pl), g0 = rnd(0, TAU); return { p, g: [g0, g0 + PI + rnd(-.5, .5)], gh: .5 }; }
  }
  return {};
}

/* ---------- 발동 ---------- */
export function skillExec(a, b, c, pow) {
  const fk = fs(), K = arenaK();
  switch (a.k) {
    case 'scan': { const r = scanAng(a.dir); G.haz.push({ k: 'o_scan', anchor: true, delay: 0, fuse: SCAN.fuse, blast: SCAN.blast, a: r.a0, a0: r.a0, a1: r.a1, half: .1, len: 950 * K, col: c, pow, t: 0 }); break; }
    case 'turret': a.ps.forEach((p, i) => { if (!p.dead) G.haz.push({ k: 'o_turret', p, x: p.x, y: p.y, turns: 3, fire: 1.1 + i * .6, aim: 0, ang: PI / 2, col: c, pow, t: 0, born: 0 }); }); break;
    case 'crate': a.cs.forEach(q => G.haz.push({ k: 'o_crate', x: q.x, y: q.y, turns: 3, col: c, pow, t: 0, born: 0 })); break;
    case 'arc': G.haz.push({ k: 'o_arc', pts: [[b.x, b.y + b.hr * .6], ...a.ps.map(p => [p.x, p.y])], fuse: .9, step: .3, w: 15 * fk, col: c, pow, t: 0 }); break;
    case 'homing': for (let i = 0; i < a.n; i++) { const an = PI / 2 + (i - (a.n - 1) / 2) * .95 + rnd(-.1, .1); G.haz.push({ k: 'o_missile', x: b.x, y: b.y + b.hr * .5, vx: Math.cos(an) * 120 * fk, vy: Math.sin(an) * 120 * fk, ang: an, life: 5.0, col: c, pow, t: 0 }); } break;
    case 'ricochet': G.haz.push({ k: 'o_rico', anchor: true, delay: 0, fuse: 1.15, blast: .55, wall: a.wall, ty: a.ty, nb: a.nb, w: 20 * fk, col: c, pow, t: 0 }); break;
    case 'cage': { const p = a.p; if (!p || p.dead) break; G.haz.push({ k: 'o_cage', x: p.x, y: p.y, r0: p.R + 150 * fk, r1: p.R + 16 * fk, g: a.g, gh: a.gh, fuse: 1.0, shrink: 1.5, hold: .35, w: 13 * fk, col: c, pow, t: 0 }); break; }
  }
}

/* ---------- 매 프레임 갱신·판정 ---------- */
function hurtWedge(b, h, s) {   // 부채꼴에 맞았다: 광선 옆으로 튕겨 난다(boss-attacks.js hurtZone 과 같은 방식)
  const dx = s.x - b.x, dy = s.y - b.y, sg = (-dx * Math.sin(h.a) + dy * Math.cos(h.a)) >= 0 ? 1 : -1;
  hurt(s.x + Math.sin(h.a) * sg * 30, s.y - Math.cos(h.a) * sg * 30, h.pow);
}
const hitSegs = (pts, w, s) => { const pad = shipR() * .6; for (let i = 0; i < pts.length - 1; i++) if (segD(s.x, s.y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < w + pad) return i; return -1; };

export function skillUpdate(h, dt, b, s) {
  const fk = fs();
  switch (h.k) {
    case 'o_scan': {
      const f = clamp((h.t - h.fuse) / h.blast, 0, 1), live = h.t > h.fuse && f < 1; h.a = h.a0 + (h.a1 - h.a0) * f;
      if (live) {
        const dx = s.x - b.x, dy = s.y - b.y, d = Math.hypot(dx, dy);
        if (d < h.len && Math.abs(angDiff(Math.atan2(dy, dx), h.a)) < h.half + Math.atan2(shipR() * .6, Math.max(d, 30))) hurtWedge(b, h, s);
        if (Math.random() < dt * 60) { const r = rnd(60, 500); G.parts.push({ x: b.x + Math.cos(h.a) * r, y: b.y + Math.sin(h.a) * r, vx: rnd(-20, 20), vy: rnd(-20, 20), t: 0, l: .4, c: h.col, s: 2.5 }); }
      }
      if (h.t > h.fuse + h.blast + .35) h.dead = true; break;
    }
    case 'o_turret': {
      const p = h.p; if (p.dead || !G.planets.includes(p)) { h.dead = true; break; }
      h.x = p.x; h.y = p.y; h.born = Math.min(1, h.born + dt * 3);
      const here = s.mode === 'orb' && s.p === p;
      if (h.aim > 0) {
        h.aim -= dt; if (h.aim > .25) h.ang = Math.atan2(s.y - h.y, s.x - h.x);   // 마지막 .25초는 겨눈 방향을 잠근다
        if (h.aim <= 0) {
          const sp = 235 * fk, mx = h.x + Math.cos(h.ang) * (p.R + 8), my = h.y + Math.sin(h.ang) * (p.R + 8);
          G.haz.push({ k: 'o_bolt', x: mx, y: my, vx: Math.cos(h.ang) * sp, vy: Math.sin(h.ang) * sp, col: h.col, pow: h.pow, t: 0 });
          sparks(mx, my, h.col, 8, 220, h.ang, .5); beep(300, .06, 'square', .06); noise(.1, .1, 3000, 500); h.fire = 2.0;
        }
      } else if (!here && G.st === 'play') { h.fire -= dt; if (h.fire <= 0) { h.aim = .85; beep(420, .05, 'square', .04); } }
      break;
    }
    case 'o_bolt': {
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (Math.hypot(s.x - h.x, s.y - h.y) < shipR() + 5 * fk && s.inv <= 0) { hurt(h.x - h.vx * .05, h.y - h.vy * .05, h.pow); h.dead = true; burst(h.x, h.y, h.col, 10, 200); }
      if (h.t > 3.4 || h.y > G.arenaBot + 80 || h.y < G.arenaTop - 120 || h.x < -40 || h.x > G.w + 40) h.dead = true;
      break;
    }
    case 'o_crate': h.born = Math.min(1, h.born + dt * 3); break;
    case 'o_arc': {
      const n = h.pts.length - 1, T = h.t;
      for (let i = 0; i < n; i++) {
        const t0 = h.fuse + i * h.step;
        if (T > t0 && T < t0 + .34) {
          if (!h['f' + i]) { h['f' + i] = 1; const q = h.pts[i + 1]; burst(q[0], q[1], h.col, 14, 240); ringFx(q[0], q[1], '#fff', 5, 46, .3, 3); shakeAdd(4); thump(110, 40, .25, .3); noise(.25, .2, 4500, 400); }
          const pts = [h.pts[i], h.pts[i + 1]]; if (hitSegs(pts, h.w * .5, s) >= 0) hurt((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2 - 20, h.pow);
        }
      }
      if (T > h.fuse + n * h.step + .6) h.dead = true; break;
    }
    case 'o_missile': {
      const sp = (138 + 10 * (b.phase || 0)) * fk, turn = 1.7;
      if (h.t > .55) { const want = Math.atan2(s.y - h.y, s.x - h.x); h.ang += clamp(angDiff(want, h.ang), -turn * dt, turn * dt); }
      const cur = Math.hypot(h.vx, h.vy) || sp, v = cur + (sp - cur) * Math.min(1, dt * 3);
      h.vx = Math.cos(h.ang) * v; h.vy = Math.sin(h.ang) * v; h.x += h.vx * dt; h.y += h.vy * dt;
      if (Math.random() < dt * 50) G.parts.push({ x: h.x - Math.cos(h.ang) * 8, y: h.y - Math.sin(h.ang) * 8, vx: -h.vx * .15 + rnd(-20, 20), vy: -h.vy * .15 + rnd(-20, 20), t: 0, l: .45, c: Math.random() < .5 ? '#ffb070' : h.col, s: 3 });
      if (Math.hypot(s.x - h.x, s.y - h.y) < shipR() + 7 * fk && s.inv <= 0) { hurt(h.x, h.y, h.pow); h.dead = true; burst(h.x, h.y, h.col, 16, 260); ringFx(h.x, h.y, '#fff', 4, 50, .3, 3); break; }
      for (const p of G.planets) if (!p.dead && Math.hypot(p.x - h.x, p.y - h.y) < p.R * .92) { h.dead = true; burst(h.x, h.y, '#ffb070', 14, 220); ringFx(h.x, h.y, '#fff', 4, 40, .3, 3); thump(120, 40, .2, .3); break; }
      if (h.t > h.life || h.y > G.arenaBot + 100) h.dead = true; break;
    }
    case 'o_rico': {
      const live = h.t > h.fuse && h.t < h.fuse + h.blast; h.pts = ricoPts(b, h.wall, h.ty, h.nb);
      if (live) {
        if (!h.fired) { h.fired = true; thump(80, 35, .8, .4, 'sawtooth'); noise(.9, .26, 4500, 300); shakeAdd(9); flashScreen(.14, h.col); for (const q of h.pts.slice(1)) { burst(q[0], q[1], h.col, 16, 260); ringFx(q[0], q[1], '#fff', 6, 60, .4, 4); } }
        if (hitSegs(h.pts, h.w, s) >= 0) { const q = h.pts[0]; hurt(q[0] + (s.x - q[0]) * .2, s.y + 30, h.pow); }
      }
      if (h.t > h.fuse + h.blast + .3) h.dead = true; break;
    }
    case 'o_cage': {
      h.r = h.r0; const e = h.t - h.fuse;
      if (e > 0) h.r = h.r0 + (h.r1 - h.r0) * clamp(e / h.shrink, 0, 1) * clamp(e / h.shrink, 0, 1) * .4 + (h.r1 - h.r0) * .6 * clamp(e / h.shrink, 0, 1);
      if (e > 0 && e < h.shrink + h.hold) {
        if (!h.fired) { h.fired = true; thump(90, 35, .6, .36, 'sawtooth'); sweep(500, 120, .8, .1); shakeAdd(6); }
        const dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy), pad = shipR() * .6;
        if (Math.abs(d - h.r) < h.w * .5 + pad && h.g.every(a0 => Math.abs(angDiff(Math.atan2(dy, dx), a0)) > h.gh)) hurt(h.x, h.y, h.pow);
      }
      if (h.t > h.fuse + h.shrink + h.hold + .25) h.dead = true; break;
    }
  }
}

/** 플레이어가 행성에 착지해 턴이 지났다(turns 를 줄인 직후 부른다): 컨테이너는 때가 되면 십자로 터진다 */
export function skillTurn(h) {
  if (h.k !== 'o_crate' || h.turns > 0) return;
  const fk = fs(), K = arenaK(), c = h.col;
  G.haz.push(zoneBase({ kind: 'crate', shape: 'b', x: G.w / 2, y: h.y, w: G.w / 2, hh: 17 * fk, fuse: .7, blast: .35, fade: .5, col: c, pow: h.pow }));
  G.haz.push(zoneBase({ kind: 'crate', shape: 'b', x: h.x, y: (G.arenaTop + G.arenaBot) / 2, w: 17 * fk, hh: arenaH() * .7, fuse: .7, blast: .35, fade: .5, col: c, pow: h.pow, anchor: false }));
  burst(h.x, h.y, c, 18, 260); ringFx(h.x, h.y, '#fff', 6, 70, .4, 4); beep(200, .2, 'sawtooth', .1); void K;
}

/** 직전 턴에 한 번 더 강하게 알리는 링(telePing) */
export function skillPing(a, b) {
  const ps = a.ps || (a.p ? [a.p] : null);
  if (ps) for (const p of ps) ringFx(p.x, p.y, '#fff', p.R, p.R + 70, .5, 3);
  else if (a.cs) for (const q of a.cs) ringFx(q.x, q.y, '#fff', 8, 60, .5, 3);
  else ringFx(b.x, b.y, '#fff', b.hr, b.hr + 80 * fs(), .5, 3);
}

/* ---------- 그리기: 발동 후 ---------- */
const jag = (x1, y1, x2, y2, amp, seed) => {   // 번개처럼 꺾인 선분 점들
  const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(L / 20)), nx = -(y2 - y1) / (L || 1), ny = (x2 - x1) / (L || 1), f = Math.floor(G.T * 22), pts = [[x1, y1]];
  for (let i = 1; i < n; i++) { const r = Math.sin((i * 127.1 + f * 311.7 + seed * 74.7)) * 43758.5453, o = ((r - Math.floor(r)) - .5) * 2 * amp; pts.push([x1 + (x2 - x1) * i / n + nx * o, y1 + (y2 - y1) * i / n + ny * o]); }
  pts.push([x2, y2]); return pts;
};
const poly = pts => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); };

export function skillDraw(h) {
  const b = G.boss, fk = fs(), T = G.T, pul = .5 + .5 * Math.sin(T * 9);
  switch (h.k) {
    case 'o_scan': { // 탐조등: 예고 동안은 시작 각도에서 가는 점선, 훑기 시작하면 밝은 부채꼴
      if (!b) break;
      const live = h.t > h.fuse, a = h.a, hf = h.half * (live ? 1 : .5 + .5 * clamp(h.t / h.fuse, 0, 1)), ap = live ? clamp(Math.min((h.t - h.fuse) / .12, (h.fuse + h.blast + .3 - h.t) / .3), 0, 1) : .55 + .3 * pul;
      g.save(); g.globalAlpha = ap;
      g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, h.len, a - hf, a + hf); g.closePath(); g.clip();
      const gg = g.createLinearGradient(b.x, b.y, b.x + Math.cos(a) * h.len, b.y + Math.sin(a) * h.len);
      gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(.25, hexA(h.col, live ? .7 : .22)); gg.addColorStop(1, hexA(h.col, live ? .22 : .05));
      g.fillStyle = gg; g.fillRect(b.x - h.len, b.y - h.len, h.len * 2, h.len * 2); g.restore();
      g.save(); g.globalAlpha = live ? ap : .7; g.strokeStyle = hexA('#fff', .8); g.lineWidth = live ? 2.2 : 1.4; if (!live) dashed(9, 8, -T * 30);
      for (const e of [-1, 1]) line(b.x, b.y, b.x + Math.cos(a + e * hf) * h.len, b.y + Math.sin(a + e * hf) * h.len); solid(); g.restore(); break;
    }
    case 'o_turret': { // 행성 위의 포대
      const p = h.p, R = p.R, a = h.ang, ap = h.born;
      g.save(); g.globalAlpha = ap; g.strokeStyle = hexA(h.col, .55); g.lineWidth = 2; dashed(5, 6, -T * 20); ring(p.x, p.y, R + 9 * fk); solid();
      g.translate(p.x + Math.cos(a) * R * .85, p.y + Math.sin(a) * R * .85); g.rotate(a);
      g.fillStyle = '#2a2d34'; g.strokeStyle = '#9aa2ac'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 8 * fk, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#4a4f58'; g.fillRect(0, -3 * fk, 17 * fk, 6 * fk); g.strokeRect(0, -3 * fk, 17 * fk, 6 * fk);
      g.fillStyle = h.aim > 0 ? '#fff' : h.col; disc(0, 0, 3 * fk); if (h.aim > 0) { g.globalAlpha = ap * (.4 + .6 * pul); disc(18 * fk, 0, 5 * fk); }
      g.restore();
      if (h.aim > 0) {   // 조준선: 마지막 .25초는 굵은 실선(잠김)
        const lock = h.aim <= .25, ox = p.x + Math.cos(a) * (R + 8), oy = p.y + Math.sin(a) * (R + 8);
        g.save(); g.strokeStyle = hexA(h.col, lock ? .95 : .35 + .3 * pul); g.lineWidth = lock ? 3 : 1.4; if (!lock) dashed(8, 8, -T * 40); line(ox, oy, ox + Math.cos(a) * 900, oy + Math.sin(a) * 900); solid(); g.restore();
      }
      txt(String(h.turns), p.x, p.y - R - 14 * fk, 13, '#ffd0b0', 'center', 800); break;
    }
    case 'o_bolt': {
      const a = Math.atan2(h.vy, h.vx);
      g.save(); g.translate(h.x, h.y); g.rotate(a); g.shadowColor = h.col; g.shadowBlur = 12;
      g.fillStyle = hexA(h.col, .5); g.fillRect(-16, -2, 14, 4); g.fillStyle = '#fff'; disc(0, 0, 5 * fk); g.fillStyle = h.col; disc(0, 0, 3 * fk); g.restore(); break;
    }
    case 'o_crate': { // 컨테이너: 줄무늬 상자. 아직 터지지 않았지만 십자 범위가 옅게 보이고, 마지막 턴에는 깜빡인다
      const last = h.turns <= 1, bl = last ? .5 + .5 * Math.sin(T * 16) : 0, s = 13 * fk * h.born;
      g.save(); g.strokeStyle = hexA(h.col, last ? .35 + .3 * bl : .13); g.lineWidth = 2; dashed(10, 10, -T * 25); line(0, h.y, G.w, h.y); line(h.x, G.arenaTop, h.x, G.arenaBot); solid();
      g.translate(h.x, h.y); g.fillStyle = last ? '#7a4a2a' : '#5a4630'; g.strokeStyle = last ? '#fff' : h.col; g.lineWidth = 2; g.fillRect(-s, -s, s * 2, s * 2); g.strokeRect(-s, -s, s * 2, s * 2);
      g.strokeStyle = hexA(h.col, .8); g.lineWidth = 2; for (let i = -1; i <= 1; i++) line(-s, i * s * .6 + s * .3, s, i * s * .6 - s * .3);
      if (last) { g.fillStyle = hexA('#ff6a4a', .25 + .35 * bl); g.fillRect(-s, -s, s * 2, s * 2); } g.restore();
      txt(String(h.turns), h.x, h.y - s - 10 * fk, 13, last ? '#ff9a8a' : '#ffe0c0', 'center', 800); break;
    }
    case 'o_arc': { // 연쇄 방전
      const n = h.pts.length - 1, T0 = h.t; g.save();
      if (T0 < h.fuse + n * h.step) { // 예고: 사슬 전체가 옅게 깜빡이고 마디마다 고리
        g.strokeStyle = hexA(h.col, .25 + .3 * pul); g.lineWidth = 2; dashed(8, 7, -T * 40); poly(h.pts); solid();
        h.pts.slice(1).forEach(q => { g.strokeStyle = hexA(h.col, .5 + .4 * pul); g.lineWidth = 2; ring(q[0], q[1], 18 * fk + 4 * pul); });
      }
      for (let i = 0; i < n; i++) {
        const t0 = h.fuse + i * h.step, e = T0 - t0; if (e < 0 || e > .36) continue;
        const a = 1 - e / .36, pts = jag(h.pts[i][0], h.pts[i][1], h.pts[i + 1][0], h.pts[i + 1][1], 14 * fk, i);
        g.shadowColor = h.col; g.shadowBlur = 16; g.globalAlpha = a; g.strokeStyle = hexA(h.col, .9); g.lineWidth = h.w * .5; poly(pts); g.strokeStyle = '#fff'; g.lineWidth = 3; poly(pts);
      }
      g.restore(); break;
    }
    case 'o_missile': {
      g.save(); g.translate(h.x, h.y); g.rotate(h.ang); g.shadowColor = h.col; g.shadowBlur = 10;
      g.fillStyle = '#d8dce2'; g.strokeStyle = '#555c66'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(11 * fk, 0); g.lineTo(-4 * fk, -5 * fk); g.lineTo(-8 * fk, -3 * fk); g.lineTo(-8 * fk, 3 * fk); g.lineTo(-4 * fk, 5 * fk); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = h.col; disc(4 * fk, 0, 2.2 * fk); g.globalAlpha = .6 + .4 * pul; g.fillStyle = '#ffb070'; g.beginPath(); g.moveTo(-8 * fk, -2.5 * fk); g.lineTo(-17 * fk - 5 * pul, 0); g.lineTo(-8 * fk, 2.5 * fk); g.closePath(); g.fill(); g.restore(); break;
    }
    case 'o_rico': { // 반사 레일
      const live = h.t > h.fuse, ap = live ? clamp(Math.min((h.t - h.fuse) / .08, (h.fuse + h.blast + .3 - h.t) / .3), 0, 1) : 1; g.save();
      if (!live) { const f = h.t / h.fuse; g.strokeStyle = hexA(h.col, .18 + .35 * f * (.6 + .4 * pul)); g.lineWidth = h.w * 2; g.lineJoin = 'round'; poly(h.pts); g.strokeStyle = hexA('#fff', .4 + .5 * pul); g.lineWidth = 2; dashed(10, 8, -T * 40); poly(h.pts); solid(); }
      else {
        g.globalAlpha = ap; g.lineJoin = 'round'; g.shadowColor = h.col; g.shadowBlur = 20; g.strokeStyle = hexA(h.col, .75); g.lineWidth = h.w * 2; poly(h.pts); g.strokeStyle = '#fff'; g.lineWidth = h.w * .8; poly(h.pts);
      }
      g.restore();
      h.pts.slice(1, -1).forEach(q => { g.fillStyle = hexA('#fff', .6 + .4 * pul); disc(q[0], q[1], 7 * fk); }); break;
    }
    case 'o_cage': { // 수감 고리: 틈 두 곳(초록 표시)만 비어 있다
      const live = h.t > h.fuse, r = h.r || h.r0; g.save();
      const arcs = []; const gs = h.g.map(a => a % TAU).sort((u, v) => u - v);   // 틈을 뺀 호들
      let prev = gs[0] + h.gh; for (let i = 1; i <= gs.length; i++) { const st = prev, en = (i < gs.length ? gs[i] : gs[0] + TAU) - h.gh; arcs.push([st, en]); prev = (i < gs.length ? gs[i] : gs[0] + TAU) + h.gh; }
      if (!live) { g.strokeStyle = hexA(h.col, .35 + .3 * pul); g.lineWidth = 2; dashed(9, 8, -T * 30); for (const [st, en] of arcs) { g.beginPath(); g.arc(h.x, h.y, r, st, en); g.stroke(); } solid(); }
      else { g.shadowColor = h.col; g.shadowBlur = 16; g.strokeStyle = hexA(h.col, .8); g.lineWidth = h.w; for (const [st, en] of arcs) { g.beginPath(); g.arc(h.x, h.y, r, st, en); g.stroke(); } g.strokeStyle = '#fff'; g.lineWidth = 3; for (const [st, en] of arcs) { g.beginPath(); g.arc(h.x, h.y, r, st, en); g.stroke(); } }
      g.shadowBlur = 0; g.strokeStyle = hexA('#8aff9a', .7 + .3 * pul); g.lineWidth = 3;
      for (const a0 of h.g) { g.beginPath(); g.arc(h.x, h.y, r, a0 - h.gh, a0 + h.gh); g.stroke(); }   // 안전한 틈
      g.restore(); break;
    }
  }
}

/* ---------- 그리기: 예고(drawTele 안에서 부른다) ---------- */
/** ui: drawTele 의 도우미 { c, urgent, pul, gr, shape(path), cnt(x,y,sz), warn(x,y,sz) } */
export function skillDrawTele(a, b, ui) {
  const { c, shape, cnt, warn, gr, pul } = ui, fk = fs();
  switch (a.k) {
    case 'scan': {
      const r0 = scanAng(a.dir), L = 950 * arenaK() * gr;
      for (const an of [r0.a0, r0.a1]) shape(() => { g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, L, an - .1, an + .1); g.closePath(); });
      const r = 130 * fk;   // 훑는 방향 화살표(시작 → 끝)
      g.strokeStyle = hexA(c, .75); g.lineWidth = 2.5; g.beginPath(); g.arc(b.x, b.y, r, r0.a0, r0.a1, a.dir < 0); g.stroke();
      g.fillStyle = hexA(c, .9); disc(b.x + Math.cos(r0.a1) * r, b.y + Math.sin(r0.a1) * r, 5);
      cnt(clamp(b.x, 24, G.w - 24), b.y + b.hr + 60 * fk); break;
    }
    case 'turret': for (const p of a.ps) { shape(() => { g.beginPath(); g.arc(p.x, p.y, (p.R + 12 * fk) * gr, 0, TAU); }); warn(p.x, p.y - p.R - 18 * fk, 20); } cnt(a.ps[0].x, a.ps[0].y + a.ps[0].R + 16 * fk); break;
    case 'crate': for (const q of a.cs) {
      shape(() => { g.beginPath(); g.arc(q.x, q.y, 26 * fk * gr, 0, TAU); });
      g.strokeStyle = hexA(c, .3); g.lineWidth = 1.5; dashed(6, 8, -G.T * 20); line(0, q.y, G.w, q.y); line(q.x, G.arenaTop, q.x, G.arenaBot); solid();
    } warn(a.cs[0].x, a.cs[0].y - 2, 22); cnt(a.cs[0].x, a.cs[0].y + 38 * fk); break;
    case 'arc': {
      const pts = [[b.x, b.y + b.hr * .6], ...a.ps.map(p => [p.x, p.y])];
      g.save(); g.strokeStyle = hexA(c, .4 + .3 * pul); g.lineWidth = 2; dashed(8, 7, -G.T * 30); poly(pts); solid(); g.restore();
      a.ps.forEach((p, i) => { shape(() => { g.beginPath(); g.arc(p.x, p.y, (p.R + 14 * fk) * gr, 0, TAU); }); txt(String(i + 1), p.x, p.y - p.R - 20 * fk, 15, c, 'center', 800); });
      cnt(G.w - 24 * fk, a.ps[0].y); break;
    }
    case 'homing': { const n = a.n; for (let i = 0; i < n; i++) { const an = PI / 2 + (i - (n - 1) / 2) * .95; g.strokeStyle = hexA(c, .6); g.lineWidth = 2.5; dashed(7, 7, -G.T * 40); line(b.x, b.y + b.hr * .5, b.x + Math.cos(an) * 110 * fk, b.y + Math.sin(an) * 110 * fk); solid(); g.fillStyle = hexA(c, .8); disc(b.x + Math.cos(an) * 110 * fk, b.y + Math.sin(an) * 110 * fk, 5 * fk); }
      cnt(clamp(b.x, 24, G.w - 24), b.y + b.hr + 60 * fk); break; }
    case 'ricochet': {
      const pts = ricoPts(b, a.wall, a.ty, a.nb);
      g.save(); g.lineJoin = 'round'; g.strokeStyle = hexA(c, .1 + .12 * pul); g.lineWidth = 40 * fk; poly(pts); g.strokeStyle = hexA(c, .6); g.lineWidth = 2; dashed(9, 8, -G.T * 35); poly(pts); solid(); g.restore();
      pts.slice(1, -1).forEach(q => { g.fillStyle = hexA(c, .8); disc(q[0], q[1], 6 * fk); });
      cnt(clamp(pts[1][0] + (a.wall > 0 ? -24 : 24), 22, G.w - 22), pts[1][1]); break;
    }
    case 'cage': {
      const p = a.p, r0 = p.R + 150 * fk; if (!p) break;
      const gs = a.g.map(x => x % TAU).sort((u, v) => u - v), arcs = []; let prev = gs[0] + a.gh;
      for (let i = 1; i <= gs.length; i++) { const st = prev, en = (i < gs.length ? gs[i] : gs[0] + TAU) - a.gh; arcs.push([st, en]); prev = (i < gs.length ? gs[i] : gs[0] + TAU) + a.gh; }
      g.save(); g.strokeStyle = hexA(c, .5 + .3 * pul); g.lineWidth = 2.5; dashed(9, 8, -G.T * 30); for (const [st, en] of arcs) { g.beginPath(); g.arc(p.x, p.y, r0 * gr, st, en); g.stroke(); } solid();
      g.strokeStyle = hexA('#8aff9a', .8); g.lineWidth = 3; for (const a0 of a.g) { g.beginPath(); g.arc(p.x, p.y, r0 * gr, a0 - a.gh, a0 + a.gh); g.stroke(); }
      g.strokeStyle = hexA(c, .6); g.lineWidth = 2; ring(p.x, p.y, p.R + 12 * fk); g.restore();
      cnt(p.x, p.y - p.R - 20 * fk); break;
    }
  }
}
