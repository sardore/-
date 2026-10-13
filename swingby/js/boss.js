/* 항성 보스전의 진행: 프레임 갱신·이동, 기체의 충돌(피해), 격파와 다음 구간으로의 전환. 아레나는 boss-arena.js, 공격은 boss-attacks.js */
import { G } from './state.js';
import { TAU, rnd, clamp, pickOf, save } from './util.js';
import { BOSSES, STAGES, BIOMES, MONSTER_ZONE } from './data.js';
import { capOf, fs } from './stats.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, slowmo, addScore, toast } from './fx.js';
import { scheduleFork } from './fork.js';
import { afterBoss } from './progress.js';
import { heatRam, heatMul, flameColor } from './heat.js';
import { isDashing, impactDamage, bounceShip, bounceSpeed, standoff } from './impact.js';
import { SWAY_FROM, SWAY_Y, regrowAll, scrollArena, solidifyAll } from './boss-arena.js';
import { queueAttack, beamAngle, updateHaz } from './boss-attacks.js';
import { endlessNext, ENDLESS } from './endless.js';

/* ---------- 프레임 갱신 ---------- */
export function updateBoss(dt) {
  const b = G.boss;
  b.st += dt; for (const a of b.q) a.age += dt;
  if (b.flash > 0) b.flash -= dt; if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 5); if (b.hitT > 0) b.hitT -= dt;
  if (b.state === 'intro') { if (b.st > 2.6) { b.state = 'fight'; b.st = 0; queueAttack().t = 3; toast('맵이 뒤로 밀려난다 — 아래로 떨어지면 끝! 계속 위로', '#ff9d7a'); } return; }
  if (b.state === 'dying') {
    if (Math.random() < dt * 14) {
      const an = rnd(0, TAU), r = rnd(0, b.R);
      burst(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r, pickOf(['#fff', '#ffd070', b.d.col[1]]), 10, 260);
      ringFx(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r, '#fff', 2, 40, .3, 2); shakeAdd(8); if (Math.random() < .25) noise(.2, .2, 3000, 200);
    }
    if (b.st > 2.6) finishBoss();
    return;
  }
  scrollArena(b, dt);
  moveBoss(dt, b);
  if (b.cast > 0) {
    b.cast = Math.max(0, b.cast - dt);
    if (Math.random() < dt * 70) { const an = rnd(0, TAU), r = b.R * rnd(2, 3); G.parts.push({ x: b.x + Math.cos(an) * r, y: b.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 2.6, vy: -Math.sin(an) * r * 2.6, t: 0, l: .4, c: G.castO ? G.castO.c : '#fff', s: 3 }); }
  }
  updateHaz(dt, b);
}
/** 2스테이지부터 보스가 아레나 안을 천천히 떠다닌다. 보스 위치에서 뻗는 공격(빔·제트·플레어)이 나가는 동안은 멈춰 선다 */
function moveBoss(dt, b) {
  if (b.stage < SWAY_FROM) { b.y = b.hy; return; }       // 스크롤 때문에 제자리여도 y 는 계속 올라간다
  const planted = G.haz.some(h => h.anchor && !h.dead && h.t < h.delay + h.fuse + h.blast);
  b.mv += ((planted ? 0 : 1) - b.mv) * Math.min(1, dt * 5);
  b.mt += dt * b.mv;
  const k = b.stage - SWAY_FROM, ease = clamp(b.mt / 2, 0, 1);
  const fk = fs(), ax = Math.min(G.w / 2 - b.hr - 26 * fk, (55 + 22 * k) * fk) * ease, ay = Math.min(SWAY_Y, 14 + 4 * k) * fk * ease;
  b.x = b.hx + ax * Math.sin(b.mt * (.45 + .05 * k) + b.ph);
  b.y = b.hy + ay * (.5 + .5 * Math.sin(b.mt * (.8 + .07 * k)));    // 위로는 HUD, 아래로는 행성이 있어 아래쪽으로만 흔들린다
  for (const a of b.q) if (a.k === 'beam') a.a = beamAngle(a, b);
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
  const b = G.boss; b.state = 'dying'; b.st = 0; b.sv = 0; G.haz = []; b.q = []; G.kills++;
  hitstop(.3); slowmo(.28, 1.5); G.shake = 24; flashScreen(.9, '#fff'); punch(.12); vibe([80, 40, 160]); thump(80, 20, 1.4, .5); noise(1.6, .35, 5000, 60);
}
function finishBoss() {
  const b = G.boss, s = G.ship, stage = b.stage;
  addScore(400 * (stage + 1) + b.loop * 500, s.x, s.y - 30, '#ffe27a', b.d.n + ' 격파!', 24);
  if (G.kills > G.bestBoss && !G.debug) { G.bestBoss = G.kills; save('swingby_boss', G.bestBoss); }
  regrowAll(); solidifyAll();
  G.boss = null; G.haz = []; G.biome = 'normal';
  const next = G.kills % STAGES.length;
  G.nextBi = endlessNext() ? -1 : STAGES[next][0];   // -1: 다음 보스는 무한 모드의 무작위 카탈로그 보스
  if (endlessNext()) { G.nextBoss = G.hops + ENDLESS.gap; scheduleFork(); }
  else if (next === MONSTER_ZONE.stage) { // 독 행성 지대: 갈림길 없이 지대를 지나 도전 보스를 만난다
    G.biome = 'monster'; G.nextBoss = G.hops + MONSTER_ZONE.len;
    G.banner = { t: 0, dur: 2.8, a: 'ZONE', b: BIOMES.monster.n + ' 지대', c: BIOMES.monster.c, sub: '도전 보스  ' + BOSSES[G.nextBi].n };
  } else { G.nextBoss = G.hops + 14; scheduleFork(); }   // 갈림길에서 고르면 nextBi 를 덮어쓴다
  // 보스전이 끝난 직후엔 궤도가 무너지지 않게 보호한다
  s.grace = 4; s.air = s.mode === 'free' ? -2.5 : 0; s.inv = Math.max(s.inv, 1.5);
  if (s.mode === 'orb') s.r = Math.max(s.r, (s.p.R + capOf(s.p)) / 2);
  G.genY = Math.min(...G.planets.map(p => p.y)) - 30;
  afterBoss(stage);
}
