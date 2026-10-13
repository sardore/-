/* 항성 보스전: 아레나 구성, 턴제 예고·공격 패턴, 존(zone) 판정, 피격·충돌, 격파와 진행 */
import { G, V } from './state.js';
import { W0, PI, TAU, rnd, clamp, pickOf, save } from './util.js';
import { BOSSES, STAGES, ATK, BIOMES, MONSTER_ZONE } from './data.js';
import { spd, capOf, shipR, bossO2 } from './stats.js';
import { isDashing, impactDamage, bounceShip, bounceSpeed, standoff } from './impact.js';
import { beep, thump, sweep, noise, vibe } from './audio.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, slowmo, popText, addScore } from './fx.js';
import { mkPlanet } from './planets.js';
import { scheduleFork } from './fork.js';
import { die } from './player.js';
import { afterBoss } from './progress.js';
import { heatReset, heatRam, heatMul, flameColor } from './heat.js';

const ARENA_RING = .78;               // 보스전에서 서 있던 행성의 포획 링 폭 비율 (아레나 행성은 처음부터 좁게 만든다)
const SWAY_FROM = 1, SWAY_Y = 26;   // 보스가 움직이기 시작하는 스테이지(0부터)와 위아래 흔들림 폭
export const aliveP = () => G.planets.filter(p => !p.dead);

/* ---------- 시작: 아레나 ---------- */
/** 지금 서 있는 행성을 기준으로 보스 아레나를 만든다 */
export function startBoss() {
  const s = G.ship, P = s.p, bi = G.nextBi, d0 = BOSSES[bi];
  // 아레나는 항상 기본 폭: 필드를 기본 폭으로 되돌리고, 지금 서 있는 행성도 그 안으로 옮긴다
  P.x = clamp(P.x * W0 / G.w, 70, W0 - 70); G.w = W0; G.vz = 1;
  const stage = G.kills % STAGES.length, loop = Math.floor(G.kills / STAGES.length);
  const ks = clamp(V.VH / 860, .78, 1), d = Object.assign({}, d0, { R: d0.R * ks });
  G.arenaCam = P.y - V.VH + 110;
  const by = G.arenaCam + (V.VH < 760 ? 150 : 178) + d.R * .6;
  G.stars = []; G.holes = []; G.mons = [];
  P.cap = P.R + (P.cap - P.R) * ARENA_RING; s.r = Math.min(s.r, Math.max(P.R + 14, capOf(P) - 6));   // 서 있던 행성의 포획 범위도 같이 줄인다
  const list = buildArena(P, by, d.R, stage >= SWAY_FROM ? SWAY_Y : 0);
  P.seen = true; list.sort((a, b) => b.y - a.y); G.planets = list;
  if (G.biome === 'belt') list.forEach(q => { q.brittle = true; }); // 소행성대의 보스: 아레나 행성도 떠나면 부서진다
  const hp = Math.round(d.hp * (1 + .6 * loop));
  G.boss = {
    bi, stage, loop, d, hp, max: hp, R: d.R, hr: d.kind === 'quasar' ? d.R * 1.35 : d.R, x: W0 / 2, y: by, hx: W0 / 2, hy: by, mt: 0, mv: 1,
    idle: 0, cast: 0, st: 0, state: 'intro', flash: 0, sq: 0, q: [], turn: 0, phase: 0, hitT: 0, last: '', ph: rnd(0, TAU)
  };
  G.bo2max = G.bo2 = bossO2(stage, loop); G.bcombo = 0; s.hitF = false; s.charging = false; G.haz = [];
  G.banner = { t: 0, dur: 3, a: 'BOSS ' + (stage + 1) + ' / ' + STAGES.length + (loop ? '  ·  ' + (loop + 1) + '회차' : ''), b: d.n, c: 'hsl(' + d.hue + ',100%,70%)', sub: d.line };
  G.shake = 8; flashScreen(.35, 'hsl(' + d.hue + ',100%,70%)'); thump(70, 28, 1.4, .4); noise(1.6, .25, 900, 60); vibe([40, 30, 80]);
}

/** 보스로 향하는 직선을 가로막지 않는 행성 배치를 찾는다 */
function buildArena(P, by, bossR, sway) {
  const yMin = by + bossR + 50 + sway, yMax = P.y + (V.VH < 760 ? 18 : -60);
  const clear = (p, L) => { // p→보스 선분 근처에 다른 행성이 없어야 한다
    const ax = p.x, ay = p.y, vx = W0 / 2 - ax, vy = by - ay, len2 = vx * vx + vy * vy;
    for (const q of L) {
      if (q === p) continue;
      const t = ((q.x - ax) * vx + (q.y - ay) * vy) / len2; if (t <= 0 || t >= 1) continue;
      if (Math.hypot(q.x - (ax + vx * t), q.y - (ay + vy * t)) < capOf(q) * .55 + 10) return false;
    }
    return true;
  };
  let list = [P];
  for (let att = 0; att < 80; att++) {
    const L = [P];
    for (let tries = 0; tries < 300 && L.length < 5 + (att % 2); tries++) {
      const x = rnd(58, W0 - 58), y = rnd(yMin, Math.max(yMin + 10, yMax));
      if (!L.every(q => Math.hypot(q.x - x, q.y - y) > 118)) continue;
      const gas = L.length === 3, q = mkPlanet(G.genI++, x, y, 'normal', gas ? 'g' : 'n');
      q.R = gas ? rnd(32, 38) : rnd(20, 27); q.cap = q.R + (gas ? 58 : rnd(40, 48)); q.hue = gas ? 36 : rnd(...BIOMES[G.biome].ph); q.seen = true; L.push(q);
    }
    if (L.length >= 4 && L.every(q => clear(q, L))) { list = L; break; }
    if (att === 79) list = L;
  }
  return list;
}

/* ---------- 공격 예고 ---------- */
function mkTele(k) {
  const b = G.boss, o = { k, t: 2, age: 0 }, ymin = b.y + b.hr + 40, ymax = G.arenaCam + V.VH - 125, al = aliveP();
  if (k === 'meteor') {
    const n = 2 + (b.phase > 0 ? 1 : 0) + (Math.random() < .4 ? 1 : 0), r = 58 + (b.phase > 0 ? 6 : 0); o.zs = [];
    for (let tr = 0; o.zs.length < n && tr < 80; tr++) {
      let x, y;
      if (Math.random() < .65 && al.length) { const p = pickOf(al); x = p.x + rnd(-24, 24); y = p.y + rnd(-24, 24); } else { x = rnd(50, W0 - 50); y = rnd(ymin, ymax); }
      x = clamp(x, r * .6, W0 - r * .6); y = clamp(y, ymin, ymax);
      if (o.zs.every(z => Math.hypot(z.x - x, z.y - y) > r * 1.5)) o.zs.push({ x, y, r });
    }
  } else if (k === 'comet') {
    const n = 5 + (b.phase > 0 ? 2 : 0), r = 34; o.zs = [];
    for (let tr = 0; o.zs.length < n && tr < 120; tr++) { const x = rnd(36, W0 - 36), y = rnd(ymin, ymax); if (o.zs.every(z => Math.hypot(z.x - x, z.y - y) > r * 2.1)) o.zs.push({ x, y, r }); }
    o.zs.sort((u, v) => u.x - v.x);
  } else if (k === 'beam') {
    const tg = G.ship.mode === 'orb' && Math.random() < .5 ? G.ship.p : pickOf(al.length ? al : G.planets);
    o.tx = tg.x; o.ty = tg.y; o.jit = rnd(-.08, .08); o.half = .3; o.len = 950; o.a = beamAngle(o, b);
  } else if (k === 'jet') { o.as = [PI / 2 - .82, PI / 2 + .82]; o.half = .24; o.len = 950; }
  else if (k === 'flare') o.r = b.hr + 150 + (b.phase > 0 ? 28 : 0);
  else if (k === 'hole') { for (let n = 0; n < 40; n++) { o.x = rnd(60, W0 - 60); o.y = rnd(ymin + 20, ymax); if (G.planets.every(p => Math.hypot(p.x - o.x, p.y - o.y) > p.R + 60)) break; } }
  else if (k === 'collapse') { o.p = pickOf(al); o.t = 3; o.r = o.p.R + 78; }
  else if (k === 'wind') { o.dir = Math.random() < .5 ? -1 : 1; o.t = 1; }
  return o;
}
/** 빔은 보스가 움직여도 목표를 계속 겨눈다 */
const beamAngle = (o, b) => clamp(Math.atan2(o.ty - b.y, o.tx - b.x) + o.jit, .55, PI - .55);

/** 직전 턴에 한 번 더 강하게 알리는 링 */
function telePing(a) {
  const c = ATK[a.k].c, b = G.boss;
  if (a.zs) for (const z of a.zs) ringFx(z.x, z.y, c, z.r * .3, z.r * 1.1, .5, 3);
  else if (a.k === 'beam' || a.k === 'jet') ringFx(b.x, b.y, c, b.hr, b.hr + 75, .5, 3);
  else if (a.k === 'flare') ringFx(b.x, b.y, c, b.hr, a.r, .6, 3);
  else if (a.k === 'hole') ringFx(a.x, a.y, c, 10, 80, .5, 3);
  else if (a.k === 'collapse') ringFx(a.p.x, a.p.y, c, a.p.R, a.r, .5, 3);
}
export function queueAttack(kind) {
  const b = G.boss;
  let pool = b.d.pat.filter(k => k !== b.last && !(k === 'collapse' && aliveP().length < 4) && !(k === 'hole' && G.haz.filter(h => h.k === 'hole').length >= 2) && !b.q.some(a => a.k === k));
  if (!pool.length) pool = b.d.pat.filter(k => !(k === 'collapse' && aliveP().length < 4));
  const k = kind || pickOf(pool); b.last = k;
  const a = mkTele(k); b.q.push(a); return a;
}
/** 디버그/테스트용: 지정한 공격을 t 턴 뒤 발동으로 예고 */
export function forceTele(k, t) { const a = mkTele(k); a.t = t; G.boss.q.push(a); telePing(a); }

/* ---------- 턴 진행 ---------- */
/** 플레이어가 행성에 착지할 때마다 1턴 */
export function bossTurn() {
  const b = G.boss; if (!b || b.state !== 'fight') return;
  b.turn++;
  for (const a of b.q) a.t--;
  const due = b.q.filter(a => a.t <= 0); b.q = b.q.filter(a => a.t > 0);
  for (const a of due) execAttack(a);
  for (const h of G.haz) if (h.turns != null) h.turns--;
  G.haz = G.haz.filter(h => h.turns == null || h.turns > 0);
  for (const p of G.planets) if (p.dead && --p.re <= 0) regrow(p);
  // 매 턴 쓰지 않는다: 가끔 새 공격을 예고하고, 오래 쉬면 확정 예고
  b.idle = (b.q.length || due.length) ? 0 : b.idle + 1;
  if (b.q.length < b.d.q + b.phase && (Math.random() < .27 + .1 * b.phase || b.idle >= 4)) { queueAttack(); b.idle = 0; }
  for (const a of b.q) if (a.t === 1) { telePing(a); beep(560, .08, 'square', .06); }
}
function regrow(p) {
  p.dead = false; p.born = 0; p.pulse = 1;
  ringFx(p.x, p.y, 'rgba(160,255,200,.9)', 4, capOf(p), .6, 3); burst(p.x, p.y, '#9dffb0', 14, 120); beep(520, .1, 'sine');
}
export function regrowAll() { for (const p of G.planets) if (p.dead) regrow(p); }

/* ---------- 공격 발동 ---------- */
function zone(o) { G.haz.push(Object.assign({ k: 'zone', t: 0, delay: 0, fuse: .9, blast: .3, fade: .8, fired: false }, o)); }
function execAttack(a) {
  const b = G.boss, at = ATK[a.k], c = at.c, pow = at.pow;
  G.castO = { t: 0, dur: 1.1, name: at.cast, c }; b.cast = .9;
  sweep(110, 460, .9, .11); beep(240, .08, 'square', .05); shakeAdd(3);
  switch (a.k) {
    case 'meteor': a.zs.forEach((z, i) => zone({ kind: 'meteor', shape: 'c', x: z.x, y: z.y, r: z.r, delay: i * .2, fuse: .95, blast: .3, col: c, pow })); break;
    case 'comet': a.zs.forEach((z, i) => zone({ kind: 'comet', shape: 'c', x: z.x, y: z.y, r: z.r, delay: i * .15, fuse: .62, blast: .22, fade: .6, col: c, pow })); break;
    case 'beam': zone({ kind: 'beam', shape: 'w', anchor: true, x: b.x, y: b.y, a: a.a, half: a.half, len: a.len, fuse: 1.05, blast: .9, col: c, pow }); break;
    case 'jet': for (const an of a.as) zone({ kind: 'jet', shape: 'w', anchor: true, x: b.x, y: b.y, a: an, half: a.half, len: a.len, fuse: 1.15, blast: 1, col: c, pow }); break;
    case 'flare': zone({ kind: 'flare', shape: 'c', anchor: true, x: b.x, y: b.y, r: a.r, fuse: 1.05, blast: .4, fade: 1, col: c, pow }); break;
    case 'hole': G.haz.push({ k: 'hole', x: a.x, y: a.y, turns: 3, r: 16, t: 0, born: 0, pow }); beep(150, .4, 'sawtooth', .12); break;
    case 'wind': G.haz.push({ k: 'wind', dir: a.dir, turns: 2 }); noise(1.2, .12, 1800, 300); break;
    case 'collapse': if (!a.p.dead) zone({ kind: 'collapse', shape: 'c', x: a.p.x, y: a.p.y, r: a.r, p: a.p, fuse: 1.1, blast: .4, fade: .9, col: c, pow }); break;
  }
}

/* ---------- 존 판정 ---------- */
function inZone(h, s) {
  const pad = shipR() * .6;
  if (h.shape === 'c') return Math.hypot(s.x - h.x, s.y - h.y) < h.r + pad;
  const dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy); if (d > h.len) return false;
  let df = Math.atan2(dy, dx) - h.a; df = Math.atan2(Math.sin(df), Math.cos(df));
  return Math.abs(df) < h.half + Math.atan2(pad, Math.max(d, 30));
}
function zoneBlast(h) {
  const col = h.col, big = h.shape === 'c' && h.r > 100;
  if (h.shape === 'c') {
    burst(h.x, h.y, col, Math.round(10 + h.r * .3), 180 + h.r); burst(h.x, h.y, '#fff', 8, 150);
    ringFx(h.x, h.y, '#fff', 6, h.r * 1.05, .4, 5); ringFx(h.x, h.y, col, 4, h.r * 1.35, .65, 3);
    thump(big ? 90 : 130, 38, .4, big ? .42 : .3); noise(.55, big ? .34 : .22, 3500, 200);
    shakeAdd(h.kind === 'comet' ? 3.5 : big ? 13 : 8); if (big) { flashScreen(.22, col); punch(.04); }
    if (h.kind === 'collapse') {
      const p = h.p;
      if (!p.dead) { p.dead = true; p.re = 4; burst(p.x, p.y, 'hsl(' + p.hue + ',90%,70%)', 32, 320); hitstop(.06); }
      const sh = G.ship;
      if (sh.mode === 'orb' && sh.p === p) { const an = Math.atan2(sh.y - p.y, sh.x - p.x); sh.mode = 'free'; sh.last = null; sh.vx = Math.cos(an) * spd() * .7; sh.vy = Math.sin(an) * spd() * .7; sh.air = 0; sh.hitF = false; sh.charging = false; }
    }
  } else {
    thump(80, 35, .8, .4, 'sawtooth'); noise(1, .27, 3500, 250); shakeAdd(9); flashScreen(.16, col); punch(.03);
    for (let i = 0; i < 26; i++) { const an = h.a + rnd(-h.half, h.half), r = rnd(80, h.len * .85); sparks(h.x + Math.cos(an) * r, h.y + Math.sin(an) * r, i % 3 ? col : '#fff', 1, 220, an, .7); }
  }
}
function hurtZone(h, s) {
  if (h.shape === 'c') { hurt(h.x, h.y, h.pow); return; }
  const dx = s.x - h.x, dy = s.y - h.y, sg = (-dx * Math.sin(h.a) + dy * Math.cos(h.a)) >= 0 ? 1 : -1;
  hurt(s.x + Math.sin(h.a) * sg * 30, s.y - Math.cos(h.a) * sg * 30, h.pow);
}

/* ---------- 피격 / 충돌 ---------- */
/** 보스 공격에 맞았다: 보스마다 다른 atk(초) × 패턴 배율만큼 산소를 잃는다 */
export function hurt(x, y, pow = 1) {
  const s = G.ship, b = G.boss; if (s.inv > 0 || G.st !== 'play' || !b) return;
  const dm = b.d.atk * pow * (1 + .15 * b.loop);
  s.inv = 1.3; G.bo2 -= dm; G.bcombo = 0; G.combo = 0; s.charging = false; heatReset();
  G.shake = 15; hitstop(.1); flashScreen(.5, '#ff4040'); punch(.06); vibe(70);
  burst(s.x, s.y, '#ff6a6a', 22, 260); sparks(s.x, s.y, '#fff', 12, 320, Math.atan2(s.y - y, s.x - x), .8); ringFx(s.x, s.y, '#ff6a6a', 6, 60, .35, 3);
  thump(140, 35, .3, .4, 'sawtooth'); noise(.3, .3, 5000, 300);
  popText(s.x, s.y - 24, '-' + dm.toFixed(1) + '초', '#ff8f8f', 17);
  const an = Math.atan2(s.y - y, s.x - x);
  if (s.mode === 'orb') { s.mode = 'free'; s.last = s.p; s.vx = Math.cos(an) * spd() * .85; s.vy = Math.sin(an) * spd() * .85; s.air = 0; s.hitF = false; s.boost = 1; }
  else { s.vx += Math.cos(an) * 150; s.vy += Math.sin(an) * 150; }
  if (G.bo2 <= 0) { G.bo2 = 0; die('산소 고갈 — 보스의 공격'); }
}

/** 기체가 보스에 부딪혔다: 반사 + 피해. 돌격 중이면 더 아프다 */
export function ram() {
  const b = G.boss, s = G.ship;
  const nx0 = s.x - b.x, ny0 = s.y - b.y, L = Math.hypot(nx0, ny0) || 1, nx = nx0 / L, ny = ny0 / L;
  const dashing = isDashing(), dmg = impactDamage((1 + .12 * Math.min(G.bcombo, 6)) * heatRam());
  b.hp -= dmg; b.flash = .18; b.sq = 1; b.hitT = .5; s.ramT = .35; s.hitF = true;
  bounceShip(b.x, b.y, nx, ny, standoff(b.hr, 5), bounceSpeed(heatMul()));
  const col = 'hsl(' + b.d.hue + ',100%,70%)', ang = Math.atan2(ny, nx);
  hitstop(.09 + Math.min(dmg, 40) / 700 + (dashing ? .04 : 0)); shakeAdd(11 + dmg * .12 + (dashing ? 5 : 0)); punch(.05 + (dashing ? .03 : 0)); flashScreen(.28, '#fff'); vibe(35);
  if (s.heat) sparks(s.x, s.y, flameColor(66), 8 + s.heat * 4, 420, ang, 1.3);
  sparks(s.x, s.y, '#fff', 16, 480, ang, .9); sparks(s.x, s.y, col, 14, 380, ang, 1.2); burst(b.x + nx * b.hr, b.y + ny * b.hr, col, 18, 240);
  ringFx(b.x + nx * b.hr, b.y + ny * b.hr, '#fff', 4, 70, .35, 4); ringFx(b.x, b.y, col, b.hr, b.hr + 60, .5, 3);
  thump(190, 38, .3, .42); noise(.22, .3, 6000, 300); beep(820 + Math.min(G.bcombo, 6) * 60, .05, 'square', .07);
  G.texts.push({ x: b.x + nx * (b.hr + 22), y: b.y + ny * (b.hr + 22), t: 0, s: '-' + dmg, c: '#ffe27a', sz: clamp(18 + dmg * .45, 20, 40) });
  addScore(dmg * 3, s.x, s.y - 14, '#ffe27a', dashing ? '돌격!' : '충돌', 16);
  const phases = b.d.kind === 'quasar' ? [.66, .33] : [.5];
  if (b.phase < phases.length && b.hp <= b.max * phases[b.phase] && b.hp > 0) {
    b.phase++;
    G.banner = { t: 0, dur: 2, a: b.d.kind === 'quasar' && b.phase === 2 ? '최종 형태' : '분노!', b: b.d.n, c: '#ff6a6a' };
    G.shake = 18; flashScreen(.5, '#ff6a6a'); thump(60, 25, 1, .4); noise(1, .3, 1500, 80);
    if (b.q.length < b.d.q + b.phase) queueAttack();
  }
  if (b.hp <= 0) { b.hp = 0; bossDefeat(); }
}

/* ---------- 격파 ---------- */
function bossDefeat() {
  const b = G.boss; b.state = 'dying'; b.st = 0; G.haz = []; b.q = []; G.kills++;
  hitstop(.3); slowmo(.28, 1.5); G.shake = 24; flashScreen(.9, '#fff'); punch(.12); vibe([80, 40, 160]); thump(80, 20, 1.4, .5); noise(1.6, .35, 5000, 60);
}
function finishBoss() {
  const b = G.boss, s = G.ship, stage = b.stage;
  addScore(400 * (stage + 1) + b.loop * 500, s.x, s.y - 30, '#ffe27a', b.d.n + ' 격파!', 24);
  if (G.kills > G.bestBoss && !G.debug) { G.bestBoss = G.kills; save('swingby_boss', G.bestBoss); }
  regrowAll();
  G.boss = null; G.haz = []; G.biome = 'normal';
  const next = G.kills % STAGES.length; G.nextBi = STAGES[next][0];
  if (next === MONSTER_ZONE.stage) { // 괴물 행성 지대: 갈림길 없이 지대를 지나 도전 보스를 만난다
    G.biome = 'monster'; G.nextBoss = G.hops + MONSTER_ZONE.len;
    G.banner = { t: 0, dur: 2.8, a: 'ZONE', b: BIOMES.monster.n + ' 지대', c: BIOMES.monster.c, sub: '도전 보스  ' + BOSSES[G.nextBi].n };
  } else { G.nextBoss = G.hops + 14; scheduleFork(); }   // 갈림길에서 고르면 nextBi 를 덮어쓴다
  // 보스전이 끝난 직후엔 궤도가 무너지지 않게 보호한다
  s.grace = 4; s.air = s.mode === 'free' ? -2.5 : 0; s.inv = Math.max(s.inv, 1.5);
  if (s.mode === 'orb') s.r = Math.max(s.r, (s.p.R + capOf(s.p)) / 2);
  G.genY = Math.min(...G.planets.map(p => p.y)) - 30;
  afterBoss(stage);
}

/* ---------- 프레임 갱신 ---------- */
export function updateBoss(dt) {
  const b = G.boss, s = G.ship;
  b.st += dt; for (const a of b.q) a.age += dt;
  if (b.flash > 0) b.flash -= dt; if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 5); if (b.hitT > 0) b.hitT -= dt;
  if (b.state === 'intro') { if (b.st > 2.6) { b.state = 'fight'; b.st = 0; queueAttack().t = 3; } return; }
  if (b.state === 'dying') {
    if (Math.random() < dt * 14) {
      const an = rnd(0, TAU), r = rnd(0, b.R);
      burst(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r, pickOf(['#fff', '#ffd070', b.d.col[1]]), 10, 260);
      ringFx(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r, '#fff', 2, 40, .3, 2); shakeAdd(8); if (Math.random() < .25) noise(.2, .2, 3000, 200);
    }
    if (b.st > 2.6) finishBoss();
    return;
  }
  moveBoss(dt, b);
  if (b.cast > 0) {
    b.cast = Math.max(0, b.cast - dt);
    if (Math.random() < dt * 70) { const an = rnd(0, TAU), r = b.R * rnd(2, 3); G.parts.push({ x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 2.6, vy: -Math.sin(an) * r * 2.6, t: 0, l: .4, c: G.castO ? G.castO.c : '#fff', s: 3 }); }
  }
  for (const h of G.haz) {
    h.t = (h.t || 0) + dt;
    if (h.k === 'zone') updateZone(h, dt, b, s);
    else if (h.k === 'hole') updateHole(h, dt, s);
    else if (h.k === 'wind') {
      if (s.mode === 'free') s.vx += h.dir * 230 * dt;
      if (Math.random() < dt * 40) G.parts.push({ x: h.dir > 0 ? -5 : W0 + 5, y: G.camY + rnd(0, V.VH), vx: h.dir * rnd(300, 500), vy: rnd(-10, 10), t: 0, l: .9, c: 'rgba(150,255,210,.6)', s: 2, line: true });
    }
  }
  G.haz = G.haz.filter(h => !h.dead);
}
/** 2스테이지부터 보스가 아레나 안을 천천히 떠다닌다. 보스 위치에서 뻗는 공격(빔·제트·플레어)이 나가는 동안은 멈춰 선다 */
function moveBoss(dt, b) {
  if (b.stage < SWAY_FROM) return;
  const planted = G.haz.some(h => h.anchor && !h.dead && h.t < h.delay + h.fuse + h.blast);
  b.mv += ((planted ? 0 : 1) - b.mv) * Math.min(1, dt * 5);
  b.mt += dt * b.mv;
  const k = b.stage - SWAY_FROM, ease = clamp(b.mt / 2, 0, 1);
  const ax = Math.min(W0 / 2 - b.hr - 26, 55 + 22 * k) * ease, ay = Math.min(SWAY_Y, 14 + 4 * k) * ease;
  b.x = b.hx + ax * Math.sin(b.mt * (.45 + .05 * k) + b.ph);
  b.y = b.hy + ay * (.5 + .5 * Math.sin(b.mt * (.8 + .07 * k)));    // 위로는 HUD, 아래로는 행성이 있어 아래쪽으로만 흔들린다
  for (const a of b.q) if (a.k === 'beam') a.a = beamAngle(a, b);
}
function updateZone(h, dt, b, s) {
  const t0 = h.delay, t1 = t0 + h.fuse, t2 = t1 + h.blast;
  if (h.t < t0) return;
  if (h.t < t1) {
    const f = (h.t - t0) / h.fuse;
    if (h.shape === 'c') {
      if (Math.random() < dt * 60 * clamp(h.r / 70, .5, 2.2)) { const an = rnd(0, TAU), r = h.r * 1.15; G.parts.push({ x: h.x + Math.cos(an) * r, y: h.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 1.7, vy: -Math.sin(an) * r * 1.7, t: 0, l: .5, c: h.col, s: 2.5 }); }
    } else if (f > .35 && Math.random() < dt * 90) {
      const an = h.a + rnd(-h.half, h.half), sp = rnd(300, 700);
      G.parts.push({ x: h.x + Math.cos(an) * b.hr, y: h.y + Math.sin(an) * b.hr, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, t: 0, l: .5, c: h.col, s: 3, line: true });
    }
    if (h.kind === 'meteor' && !h.whoosh && f > .4) { h.whoosh = true; noise(.55, .1, 1800, 300); }
  } else if (h.t < t2) {
    if (!h.fired) { h.fired = true; zoneBlast(h); }
    if (inZone(h, s)) hurtZone(h, s);
  } else if (h.t > t2 + h.fade) h.dead = true;
}
function updateHole(h, dt, s) {
  h.born = Math.min(1, h.born + dt * 2);
  if (s.mode === 'free') {
    const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
    if (d < 150) { const a = 16000 / (d + 40); s.vx += dx / d * a * dt; s.vy += dy / d * a * dt; }
    if (d < h.r + shipR() - 1) hurt(h.x, h.y, h.pow);
  }
  if (Math.random() < dt * 50) { const an = rnd(0, TAU); G.parts.push({ x: h.x + Math.cos(an) * 80, y: h.y + Math.sin(an) * 80, vx: -Math.cos(an) * 100, vy: -Math.sin(an) * 100, t: 0, l: .7, c: '#c88aff', s: 2 }); }
}

