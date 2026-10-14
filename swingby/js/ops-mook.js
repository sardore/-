/* 소형 적함(경비정): 길목에 가끔 나오는 작은 함선. 보스처럼 맞서는 몸이라 부딪히면 튕겨 나가고, 몇 번 박으면 터진다.
 * 공격은 거의 다 넉백(ops-knock.js): 맞아도 산소·체력은 그대로이고 날아가던 방향이 크게 꺾인다.
 *   drone 정찰 드론 — 좌우로 순찰만 한다 · gunboat 포함 — 순찰하면서 기체를 겨눠 가끔 쏜다(맞으면 탄이 가는 방향으로 튕김)
 *   skiff 쾌속정 — 출격 갑판(ops-gimmick.js)이 내보내는, 곧장 날아가는 소형함
 *   barrage 산탄 포함 — 포함보다 크고, 세 갈래 산탄을 쏜다
 *   repeller 척력정 · charger 돌격정 · tracker 추적정 — 행동은 ops-mook-ai.js (후반 지역)
 * 보스전에는 나오지 않는다. 겉모습은 ops-mook-art.js, 화면에 보이는 이름은 '경비정' 계열 */
import { G } from './state.js';
import { rnd, clamp, TAU, angDiff } from './util.js';
import { BIOMES } from './data.js';
import { fs, shipR } from './stats.js';
import { viewBot } from './camera.js';
import { knock } from './ops-knock.js';
import { stepRepeller, stepCharger, stepTracker, trackerState, TRK } from './ops-mook-ai.js';
import { impactDamage, bounceShip, bounceSpeed, standoff } from './impact.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, popText, addScore, toast } from './fx.js';
import { beep, thump, noise, vibe } from './audio.js';

const KINDS = {
  drone:    { r: 13, hp: 36, name: '경비정' },
  gunboat:  { r: 17, hp: 62, name: '포함' },
  skiff:    { r: 10, hp: 24, name: '소형함' },
  barrage:  { r: 19, hp: 90, name: '산탄 포함' },
  repeller: { r: 15, hp: 58, name: '척력정' },
  charger:  { r: 15, hp: 78, name: '돌격정' },
  tracker:  { r: 28, hp: 1, name: '추적정' }
};
const HIT_COOLDOWN = .35, SHOT_SPEED = 185, SHOT_RANGE = 330, FIRE_EVERY = 3.4, AIM_TIME = .8;
const list = () => G.ops.mooks;

export function mkMook(kind, x, y, o) {
  const K = KINDS[kind], k = fs();
  return Object.assign({ kind, x, y, x0: x, y0: y, amp: 0, sp: 1, t: rnd(0, TAU), R: K.r * k, hp: K.hp, max: K.hp, flash: 0, sq: 0, born: 0, a: Math.PI / 2, vx: 0, vy: 0, fire: rnd(1.5, FIRE_EVERY), aim: 0, ph: rnd(0, TAU) }, o || {});
}

/** 새 행성 p 가 prev 위에 생길 때, 이 지역에서 소형함이 나올 확률로 그 사이에 순찰하는 함선을 놓는다 */
export function maybeMook(prev, p, dy) {
  const pr = BIOMES[G.biome].mook;
  if (!pr || G.boss || G.genI < 6 || p.drift || prev.drift || dy < 120 * fs() || Math.random() > pr) return;
  const k = fs(), kind = pickKind(BIOMES[G.biome].kinds);
  for (let tries = 0; tries < 20; tries++) {
    const m = mkMook(kind, (prev.x + p.x) / 2 + rnd(-110, 110) * k, p.y + dy * rnd(.35, .65), { amp: rnd(26, 70) * k, sp: rnd(.5, .9) });
    m.x = m.x0 = clamp(m.x0, m.amp + m.R + 20, G.w - m.amp - m.R - 20);
    if ([prev, p].every(q => Math.hypot(m.x0 - q.x, m.y - q.y) > q.R + m.R + m.amp + 16 * k)) { list().push(m); return; }
  }
}

/** 지역의 적 구성표({종류: 가중치})에서 하나를 뽑는다 */
function pickKind(tab) {
  const ks = Object.keys(tab || { drone: .55, gunboat: .45 }), t = tab || { drone: .55, gunboat: .45 };
  let r = Math.random() * ks.reduce((a, q) => a + t[q], 0);
  for (const q of ks) { r -= t[q]; if (r <= 0) return q; }
  return ks[0];
}

export function clearMooks() { if (G.ops) { G.ops.mooks = []; G.ops.shots = []; } }
export function squeezeMooks(r) { if (G.ops) for (const m of list()) { m.x *= r; m.x0 *= r; } }
export function cullMooks(lim) { if (G.ops) { G.ops.mooks = list().filter(m => m.y < lim); G.ops.shots = G.ops.shots.filter(b => b.y < lim); } }

/** 추적정 등장: 후반 지역(chaser)에서 한 번에 하나, 떠난 뒤 한참 뒤에 다시 */
function maybeTracker() {
  const O = G.ops, z = BIOMES[G.biome];
  if (!z.chaser || G.boss || G.genI < 6 || list().some(m => m.kind === 'tracker')) return;
  if (O.chase == null) O.chase = G.hops + 5;
  if (G.hops < O.chase) return;
  O.chase = G.hops + TRK.stay + Math.floor(rnd(7, 12));
  const s = G.ship; list().push(mkMook('tracker', s.x, viewBot(), Object.assign(trackerState(), { born: 1, x0: s.x })));
  toast('추적정이 뒤를 따라붙는다', '#ff9aa8');
}

export function updateMooks(dt) {
  const s = G.ship, k = fs(), O = G.ops;
  maybeTracker();
  for (const m of list()) {
    m.born = Math.min(1, m.born + dt * 1.6); if (m.sq > 0) m.sq = Math.max(0, m.sq - dt * 4); if (m.flash > 0) m.flash -= dt;
    if (m.kind === 'skiff') { m.x += m.vx * dt; m.y += m.vy * dt; m.a = Math.atan2(m.vy, m.vx); if (m.x < -60 || m.x > G.w + 60 || m.y > viewBot() + 220) m.dead = true; continue; }
    if (m.kind === 'repeller') { stepRepeller(m, dt); continue; }
    if (m.kind === 'charger') { stepCharger(m, dt); continue; }
    if (m.kind === 'tracker') { stepTracker(m, dt); continue; }
    m.t += dt * m.sp; m.x = m.x0 + Math.sin(m.t) * m.amp; m.y = m.y0 + Math.sin(m.t * 1.7) * 4 * k;
    if (m.kind === 'drone') m.a = Math.PI / 2 + Math.sin(m.t * 2) * .12;
    else {   // 포함·산탄 포함: 포탑은 비행 중인 기체를 겨눈다
      const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy), want = Math.atan2(dy, dx), near = s.mode === 'free' && d < SHOT_RANGE * k && d > 70 * k, every = m.kind === 'barrage' ? FIRE_EVERY * 1.25 : FIRE_EVERY;
      m.a += angDiff(want, m.a) * Math.min(1, dt * 5);
      if (m.aim > 0) { m.aim -= dt; if (m.aim <= 0) shoot(m); }
      else if (near) { m.fire -= dt; if (m.fire <= 0) { m.aim = AIM_TIME; m.fire = every; } }
    }
  }
  if (list().some(m => m.dead)) G.ops.mooks = list().filter(m => !m.dead);
  for (const b of O.shots) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (G.ship.mode === 'free' && G.st === 'play' && s.inv <= 0 && Math.hypot(s.x - b.x, s.y - b.y) < shipR() + 4) { b.life = 0; shotHit(b); }
  }
  O.shots = O.shots.filter(b => b.life > 0);
}

/** 포탄: 포함은 한 발, 산탄 포함은 세 갈래(각각 조금 약하게 밀어낸다) */
function shoot(m) {
  const k = fs(), fan = m.kind === 'barrage' ? [-.3, 0, .3] : [0];
  for (const da of fan) {
    const a = m.a + da;
    G.ops.shots.push({ x: m.x + Math.cos(a) * m.R * 1.1, y: m.y + Math.sin(a) * m.R * 1.1, vx: Math.cos(a) * SHOT_SPEED * k, vy: Math.sin(a) * SHOT_SPEED * k, life: 3, pow: fan.length > 1 ? .75 : .9 });
  }
  sparks(m.x + Math.cos(m.a) * m.R, m.y + Math.sin(m.a) * m.R, '#ff8a6a', 8, 200, m.a, .5); beep(260, .06, 'square', .06); noise(.12, .1, 3000, 400);
}
/** 포탄에 맞았다: 탄이 날아온 방향으로 튕겨 나간다(산소는 깎이지 않는다) */
function shotHit(b) { knock(b.vx, b.vy, b.pow || .9, '#ff8a6a'); burst(b.x, b.y, '#ff8a6a', 8, 180); }

/** 비행 중인 기체가 소형함에 닿았는지 보고 튕겨 낸다 */
export function hitMooks() {
  const s = G.ship; if (s.mode !== 'free' || s.ramT > 0 || G.boss) return;
  for (const m of list()) {
    if (m.nohit || m.st === 'dash') continue;   // 추적정은 닿지 않고, 돌진 중인 돌격정은 넉백으로 처리(ops-mook-ai.js)
    const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d < m.R * (.4 + .6 * m.born) + shipR()) { bump(m, dx / d, dy / d); return; }
  }
}
function bump(m, nx, ny) {
  const s = G.ship, dmg = impactDamage();
  m.hp -= dmg; m.flash = .16; m.sq = 1; s.ramT = HIT_COOLDOWN; s.bumped = true;
  bounceShip(m.x, m.y, nx, ny, standoff(m.R, 4), bounceSpeed());
  const ang = Math.atan2(ny, nx), bx = m.x + nx * m.R, by = m.y + ny * m.R;
  sparks(s.x, s.y, '#fff', 10, 380, ang, .9); sparks(bx, by, '#ff9a7a', 10, 300, ang, 1.2); ringFx(bx, by, '#fff', 4, 44, .3, 3);
  hitstop(.06 + Math.min(dmg, 40) / 900); shakeAdd(6 + dmg * .08); punch(.03); vibe(25); thump(170, 40, .22, .35); noise(.18, .22, 4500, 300); beep(520 + (1 - m.hp / m.max) * 300, .05, 'square', .06);
  popText(bx + nx * 18, by + ny * 18, '-' + dmg, '#ffd6a0', clamp(15 + dmg * .3, 16, 30));
  if (m.hp <= 0) kill(m);
}
/** 돌진 포대의 포탄이 맞았다(ops-battery.js) */
export function shootMook(m, dmg) {
  m.hp -= dmg; m.flash = .12; m.sq = Math.max(m.sq || 0, .5);
  popText(m.x, m.y - m.R - 6, '-' + dmg, '#ffd6a0', 14);
  if (m.hp <= 0) kill(m);
}
function kill(m) {
  m.dead = true; G.ops.mooks = list().filter(q => !q.dead);
  burst(m.x, m.y, '#ffb48a', 22, 260); burst(m.x, m.y, '#fff', 10, 180); ringFx(m.x, m.y, '#ffb48a', m.R * .6, m.R * 2.4, .5, 4); ringFx(m.x, m.y, '#fff', 4, m.R * 1.5, .3, 3);
  hitstop(.09); shakeAdd(9); punch(.04); flashScreen(.16, '#ffb48a'); thump(110, 30, .4, .36); noise(.45, .3, 3500, 150); beep(700, .1, 'triangle', .1);
  const n = m.kind === 'skiff' ? 1 : m.kind === 'drone' || m.kind === 'gunboat' ? 2 : 3;
  for (let i = 0; i < n; i++) { const a = i / n * TAU + m.ph; G.stars.push({ x: clamp(m.x + Math.cos(a) * m.R, 14, G.w - 14), y: m.y + Math.sin(a) * m.R, got: false, ph: rnd(0, TAU), br: 'ops' }); }
  addScore(30 + m.max, m.x, m.y - m.R - 14, '#ffd6a0', KINDS[m.kind].name + ' 격파', 17);
}
