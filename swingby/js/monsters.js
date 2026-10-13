/* 독 행성(내부 이름은 monster): 지형이 아니라 "적". 포획되지 않고, 비행 중 부딪히면 보스처럼 튕겨 나가며
 * 부딪힐수록 작아지다가 터진다. 독 행성 지대(BIOMES.monster)에서만 나온다. 겉모습은 draw-monster.js */
import { G } from './state.js';
import { rnd, clamp, TAU } from './util.js';
import { fs, shipR } from './stats.js';
import { impactDamage, bounceShip, bounceSpeed, standoff } from './impact.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, popText, addScore } from './fx.js';
import { beep, thump, noise, vibe } from './audio.js';

/** 종류별 반지름(기본 폭 기준)·좌우 흔들림 폭·흔들림 속도·등장 비중 */
const KINDS = {
  volcano: { r: [24, 36], amp: [18, 34], sp: [.5, .8], w: 28 },    // 독 화산: 독 용암과 가스를 뿜는다
  crater:  { r: [22, 34], amp: [24, 44], sp: [.6, 1],  w: 30 },    // 분화구: 부글거리는 독 웅덩이
  river:   { r: [24, 36], amp: [28, 50], sp: [.5, .9], w: 24 },    // 독 강: 독이 흐르는 강줄기
  crystal: { r: [28, 42], amp: [0, 0],   sp: [0, 0],   w: 18 }     // 독 수정: 뾰족한 수정 군락 (제자리에서 천천히 돈다)
};
const HIT_COOLDOWN = .35;      // 한 번 부딪힌 뒤 다시 맞기까지(초)
const MIN_SIZE = .4;           // 체력이 바닥일 때 남는 크기 비율
const hpOf = r => Math.round(r * 2 + 10);   // 크기(기본 폭 기준 반지름)에 비례한 체력. 기본 충돌 1회가 26

const pickKind = () => {
  let r = Math.random() * Object.values(KINDS).reduce((a, k) => a + k.w, 0);
  for (const k in KINDS) { if ((r -= KINDS[k].w) <= 0) return k; }
  return 'crater';
};
/** 주로 독성 녹색, 가끔 청록·연두·보라 */
const pickHue = () => { const r = Math.random(); return r < .6 ? rnd(100, 140) : r < .74 ? rnd(160, 185) : r < .87 ? rnd(62, 85) : rnd(275, 305); };

function mkMonster(x, y) {
  const kind = pickKind(), K = KINDS[kind], k = fs(), r0 = rnd(...K.r);
  const R0 = r0 * k, amp = rnd(...K.amp) * k;
  return { kind, hue: pickHue(), x, y, x0: x, y0: y, amp, sp: rnd(...K.sp), t: rnd(0, TAU), R0, R: R0 * .2, hp: hpOf(r0), max: hpOf(r0), sq: 0, flash: 0, rot: rnd(0, TAU), ph: rnd(0, TAU), born: 0 };
}
/** 몸 반지름(충돌 판정). 독 수정은 뾰족한 끝까지 */
export const reachOf = m => m.R * (m.kind === 'crystal' ? 1.1 : 1);

/** 새 행성 p 가 prev 위에 생길 때 그 사이 빈 곳에 독 행성을 놓는다. 흔들려도 행성 몸체와 겹치지 않는 자리만 쓴다 */
export function maybeMonster(prev, p, dy) {
  if (G.genI < 4 || p.drift || prev.drift || dy < 120 * fs()) return;
  if (Math.random() > Math.min(.55 + G.genI * .004, .8)) return;
  const k = fs();
  for (let tries = 0; tries < 24; tries++) {
    const m = mkMonster((prev.x + p.x) / 2 + rnd(-120, 120) * k, p.y + dy * rnd(.35, .65));
    m.x0 = m.x = clamp(m.x0, m.amp + m.R0 + 20, G.w - m.amp - m.R0 - 20);
    const room = q => Math.hypot(m.x0 - q.x, m.y - q.y) > q.R + m.R0 + m.amp + 14 * k;   // 행성 몸체와만 겹치지 않으면 된다(포획 범위는 겹쳐도 괜찮다)
    if (room(prev) && room(p)) { G.mons.push(m); return; }
  }
}

export function updateMonsters(dt) {
  for (const m of G.mons) {
    m.t += dt * m.sp; m.born = Math.min(1, m.born + dt * 1.6); m.rot += dt * (m.kind === 'crystal' ? .35 : 0);
    m.x = m.x0 + Math.sin(m.t) * m.amp;
    m.y = m.y0 + (m.kind === 'volcano' ? Math.sin(m.t * 1.7) * 5 * fs() : 0);
    if (m.sq > 0) m.sq = Math.max(0, m.sq - dt * 4); if (m.flash > 0) m.flash -= dt;
    const want = m.R0 * (MIN_SIZE + (1 - MIN_SIZE) * m.hp / m.max) * (.2 + .8 * m.born);
    m.R += (want - m.R) * Math.min(1, dt * 12);
  }
}

/** 비행 중인 기체가 독 행성에 닿았는지 보고, 닿았으면 튕겨 낸다 */
export function hitMonsters() {
  const s = G.ship; if (s.ramT > 0) return;
  for (const m of G.mons) {
    const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d < reachOf(m) + shipR()) { bump(m, dx / d, dy / d); return; }
  }
}

function bump(m, nx, ny) {
  const s = G.ship, dmg = impactDamage();
  m.hp -= dmg; m.flash = .16; m.sq = 1; s.ramT = HIT_COOLDOWN;
  bounceShip(m.x, m.y, nx, ny, standoff(reachOf(m), 4), bounceSpeed());
  const col = 'hsl(' + m.hue + ',90%,62%)', ang = Math.atan2(ny, nx), bx = m.x + nx * m.R, by = m.y + ny * m.R;
  sparks(s.x, s.y, '#fff', 10, 380, ang, .9); sparks(bx, by, col, 12, 300, ang, 1.2);
  ringFx(bx, by, '#fff', 4, 46, .3, 3); hitstop(.06 + Math.min(dmg, 40) / 900); shakeAdd(6 + dmg * .08); punch(.03); vibe(25);
  thump(170, 40, .22, .35); noise(.18, .22, 4500, 300); beep(520 + (1 - m.hp / m.max) * 300, .05, 'square', .06);
  popText(bx + nx * 18, by + ny * 18, '-' + dmg, '#d6ff9a', clamp(15 + dmg * .3, 16, 30));
  if (m.hp <= 0) kill(m);
}

function kill(m) {
  m.dead = true; G.mons = G.mons.filter(q => !q.dead);
  const col = 'hsl(' + m.hue + ',90%,60%)', n = 2 + Math.floor(m.R0 / fs() / 16);
  burst(m.x, m.y, col, 26, 260); burst(m.x, m.y, '#e6ffb0', 14, 180); ringFx(m.x, m.y, col, m.R * .6, m.R0 * 2.2, .5, 4); ringFx(m.x, m.y, '#fff', 4, m.R0 * 1.4, .3, 3);
  hitstop(.1); shakeAdd(10); punch(.05); flashScreen(.2, col); thump(110, 30, .4, .4); noise(.5, .3, 3500, 150); beep(760, .1, 'triangle', .1);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + m.ph; G.stars.push({ x: clamp(m.x + Math.cos(a) * m.R0 * .8, 14, G.w - 14), y: m.y + Math.sin(a) * m.R0 * .8, got: false, ph: rnd(0, TAU), br: 'mon' }); }
  addScore(40 + m.max, m.x, m.y - m.R0 - 14, '#d6ff9a', '독 행성 파괴', 18);
}
