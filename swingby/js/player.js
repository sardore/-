/* 플레이어 기체: 입력 동작(발사·차지), 포획, 사망, 매 프레임의 이동·충돌 */
import { G, V } from './state.js';
import { PI, TAU, rnd, save } from './util.js';
import { BIOMES, BOSSES } from './data.js';
import { spd, orbSpd, capOf, decRate, o2max, magRange, shipR, curDef, minOrbit, maxOrbit } from './stats.js';
import { viewBot } from './camera.js';
import { beep, thump, sweep, noise, vibe } from './audio.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, slowmo, toast, popText, addScore } from './fx.js';
import { shatter, enterFork, commitRoute } from './world.js';
import { bossTurn, ram } from './boss.js';
import { hitMonsters } from './monsters.js';
import { heatUp, heatReset, heatMul, emitFlames } from './heat.js';

export const CHARGE_T = .8;      // 차지가 가득 차는 시간(초)
const DASH_TAU = .55;            // 돌격 속도가 원래 속도로 돌아오는 시간 상수

/* ---------- 입력 동작 ---------- */
const canAct = () => G.st === 'play' && G.ship.mode === 'orb' && !(G.boss && G.boss.state !== 'fight');

/** 누름: 일반 기체는 바로 발사, 돌격 기체는 차지를 시작한다 */
export function pressStart() {
  if (!canAct()) return;
  if (curDef().dash) {
    const s = G.ship; s.charging = true; s.charge = 0; s.chFull = false;
    sweep(180, 900, CHARGE_T, .07);
  } else release(0);
}
/** 뗌: 차지 중이었다면 그 세기로 발사 */
export function pressEnd() {
  const s = G.ship; if (!s || !s.charging) return;
  const c = s.charge; s.charging = false; s.charge = 0;
  if (canAct()) release(c);
}

/** 궤도를 벗어나 접선 방향으로 날아간다. charge(0~1)가 크면 돌격 속도 */
export function release(charge) {
  const s = G.ship; if (s.mode !== 'orb') return;
  if (G.boss && G.boss.state !== 'fight') return;
  const boost = 1 + curDef().dash * Math.max(0, (charge - .1) / .9), v = spd() * boost, from = s.p;
  s.grace = 0; s.mode = 'free'; s.vx = -Math.sin(s.a) * s.dir * v; s.vy = Math.cos(s.a) * s.dir * v;
  s.last = from; s.air = 0; s.hitF = false; s.boost = boost; s.charging = false; G.starChain = 0;
  const back = Math.atan2(-s.vy, -s.vx);
  beep(620, .04); noise(.22, .16, 5000, 400);
  sparks(s.x, s.y, '#bfeaff', 9, 260, back, .5); ringFx(s.x, s.y, 'rgba(190,235,255,.8)', 4, 26, .3, 2); shakeAdd(2.2);
  if (boost > 1.15) { // 돌격!
    const f = boost - 1;
    thump(260, 50, .25, .3); sweep(300, 1400, .3, .1, 'square'); noise(.3, .22, 7000, 500);
    sparks(s.x, s.y, '#fff', 16, 520, back, .35); sparks(s.x, s.y, 'hsl(' + curDef().L.h + ',100%,70%)', 14, 420, back, .5);
    ringFx(s.x, s.y, '#fff', 6, 60 + f * 40, .35, 4); shakeAdd(4 + f * 5); punch(.02 + f * .02); flashScreen(.1 + f * .08, '#fff'); vibe(25);
  }
  if (from.brittle) { // 소행성은 떠나는 순간 부서진다
    shatter(from);
    burst(from.x, from.y, 'hsl(' + from.hue + ',50%,60%)', 22, 220); sparks(from.x, from.y, '#e8d0b0', 12, 260, rnd(0, TAU), PI);
    ringFx(from.x, from.y, 'rgba(230,200,160,.8)', from.R, from.R + 36, .4, 3); noise(.35, .2, 3000, 300);
  }
}

/* ---------- 포획 ---------- */
export function latch(p, dx, dy, d) {
  const s = G.ship;
  s.mode = 'orb'; s.p = p; s.r = Math.max(d, minOrbit(p)); s.a = Math.atan2(dy, dx); s.dir = (dx * s.vy - dy * s.vx) >= 0 ? 1 : -1;
  const quick = s.swept < TAU * 1.05;
  s.swept = 0; s.air = 0; s.last = null; s.boost = 1; s.charging = false; s.charge = 0; heatReset();
  p.pulse = 1; p.sq = .55;
  ringFx(p.x, p.y, 'hsla(' + p.hue + ',90%,75%,.9)', p.R, capOf(p) * .9, .5, 3);
  thump(170, 60, .16, .2);
  if (G.boss) {
    if (G.boss.state === 'fight') { G.bcombo = s.hitF ? G.bcombo + 1 : 0; s.hitF = false; beep(330, .07); bossTurn(); }
    return;
  }
  if (!p.seen) {
    p.seen = true; G.hops++; G.combo = quick ? G.combo + 1 : 1; G.maxCombo = Math.max(G.maxCombo, G.combo);
    const close = d < p.R + 24, combo = G.combo;
    addScore((p.t === 'r' ? 20 : 10) * combo + (close ? 10 : 0), p.x, p.y - p.R - 16, combo > 1 ? '#7dd3ff' : '#fff', close ? '근접 스윙!' : combo > 1 ? 'x' + combo + ' 콤보' : null, close ? 19 : 15);
    beep(420 + Math.min(combo, 12) * 55, .1); burst(s.x, s.y, 'hsl(' + p.hue + ',90%,72%)', 12 + Math.min(combo, 10));
    if (close) { hitstop(.045); punch(.025); shakeAdd(3.5); sparks(s.x, s.y, '#fff', 10, 300, TAU * Math.random(), PI); }
    if (combo >= 5 && combo % 5 === 0) { flashScreen(.18, '#7dd3ff'); punch(.03); toast('x' + combo + ' 콤보!', '#7dd3ff'); }
  } else beep(300, .06);
  forkArrive(p);
}

/** 갈림길 도착 처리: 허브면 시야가 넓어지고, 항로의 첫 행성이면 길이 정해진다.
 * 포획과 비상 추진기 복귀처럼 "그 행성에 자리 잡는" 모든 경로에서 부른다 */
function forkArrive(p) {
  const F = G.fork;
  if (F && p === F.hub) enterFork();
  else if (F && F.state === 'hub' && p.branch) {
    const br = commitRoute(p), bm = BIOMES[br.biome];
    G.banner = { t: 0, dur: 2.6, a: '항로 결정', b: bm.n, c: bm.c, sub: '다음 보스  ' + BOSSES[br.bi].n };
    flashScreen(.25, bm.c); punch(.03); thump(110, 40, .4, .25);
  }
}

/* ---------- 사망 ---------- */
export function die(why) {
  const s = G.ship, st = G.stats;
  if (st.shield > 0) { // 비상 추진기: 가장 가까운 행성 궤도로 되돌린다
    st.shield--; let bp = null;
    for (const p of G.planets) { if (p.dead) continue; if (p.y < G.camY + V.VH - 70 && p.y > G.camY + 50 && (!bp || Math.hypot(p.x - s.x, p.y - s.y) < Math.hypot(bp.x - s.x, bp.y - s.y))) bp = p; }
    bp = bp || s.p;
    let a = Math.atan2(s.y - bp.y, s.x - bp.x); if (!isFinite(a)) a = 0;
    s.mode = 'orb'; s.p = bp; s.r = maxOrbit(bp) - 4; s.a = a; s.swept = 0; s.air = 0; s.last = null; s.trail.length = 0; s.inv = 1.5; s.boost = 1; s.charging = false; s.heat = 0;
    s.x = bp.x + Math.cos(a) * s.r; s.y = bp.y + Math.sin(a) * s.r;
    if (!G.boss && !bp.seen) { bp.seen = true; G.hops++; }
    if (!G.boss) forkArrive(bp);
    if (G.boss) G.bo2 = Math.max(G.bo2, 6);
    G.combo = 0; popText(s.x, s.y - 20, '비상 추진!', '#ff9d7a', 17); burst(s.x, s.y, '#ff9d7a', 22, 220); ringFx(s.x, s.y, '#ff9d7a', 6, 90, .5, 4);
    beep(220, .25, 'sawtooth'); noise(.4, .2, 3000, 200); G.shake = 10; hitstop(.1); flashScreen(.3, '#ff9d7a');
    return;
  }
  G.st = 'dead'; G.deadT = 0; G.deadWhy = why; G.shake = 18; hitstop(.14); flashScreen(.5, '#fff'); slowmo(.35, .9);
  burst(s.x, s.y, '#fff', 34, 280); burst(s.x, s.y, '#ff6a6a', 24, 200); ringFx(s.x, s.y, '#fff', 6, 140, .6, 4); ringFx(s.x, s.y, '#ff6a6a', 6, 100, .5, 3);
  beep(110, .5, 'sawtooth', .14); thump(120, 30, .6, .4); noise(.7, .3, 4000, 100); vibe([60, 40, 120]);
  if (G.score > G.best && !G.debug) { G.best = G.score; G.newBest = true; save('swingby_best', G.best); }
}

/* ---------- 프레임 이동 ---------- */
/** 기체를 dt 만큼 움직이고 충돌·산소·별을 처리한다. 판이 끝났으면 false */
export function stepShip(dt) {
  const s = G.ship, v = spd(), boss = G.boss, bf = boss && boss.state === 'fight';
  if (s.inv > 0) s.inv -= dt; if (s.ramT > 0) s.ramT -= dt; if (s.grace > 0) s.grace -= dt;
  if (s.evoT > 0) s.evoT = Math.max(0, s.evoT - dt / 1.1);
  for (let i = s.ghosts.length - 1; i >= 0; i--) { s.ghosts[i].t += dt; if (s.ghosts[i].t > .32) s.ghosts.splice(i, 1); }

  if (s.mode === 'orb') {
    const p = s.p;
    if (!boss && !(s.grace > 0)) s.r -= decRate(p) * dt;
    const mo = maxOrbit(p); if (s.r > mo) s.r += (mo - s.r) * Math.min(1, dt * 5);   // 너무 먼 궤도로 붙었으면 부드럽게 끌려 들어온다
    const da = (boss ? orbSpd() * .58 : orbSpd()) / Math.max(s.r, 8) * dt;
    s.a += s.dir * da; s.swept += da;
    s.x = p.x + Math.cos(s.a) * s.r; s.y = p.y + Math.sin(s.a) * s.r;
    if (s.charging) chargeFx(dt);
    if (s.r <= p.R + 3) { die('궤도가 붕괴해 행성에 추락'); if (G.st !== 'play') return false; }
  } else {
    regulateSpeed(dt, v);
    s.x += s.vx * dt; s.y += s.vy * dt; s.air += dt;
    if (Math.random() < dt * 60 * .7) G.parts.push({ x: s.x, y: s.y, vx: rnd(-12, 12), vy: rnd(-12, 12), t: 0, l: .28, c: 'rgba(160,220,255,.9)', s: 2 });
    if (s.boost > 1.2) dashTrail(dt);
    if (bf) emitFlames(dt);
    if (s.x < 6 && s.vx < 0) { s.x = 6; s.vx *= -1; wallHit(6, s.y, 0, bf); }
    if (s.x > G.w - 6 && s.vx > 0) { s.x = G.w - 6; s.vx *= -1; wallHit(G.w - 6, s.y, PI, bf); }
    if (boss && s.y < G.arenaCam + 10 && s.vy < 0) { s.y = G.arenaCam + 10; s.vy *= -1; if (bf) heatUp(s.x, s.y, PI / 2); }
    if (s.last && Math.hypot(s.x - s.last.x, s.y - s.last.y) > capOf(s.last) + 8) s.last = null;
    if (bf && s.ramT <= 0 && Math.hypot(s.x - boss.x, s.y - boss.y) < boss.hr + shipR() + 3) { ram(); if (G.st !== 'play' || !G.boss || G.boss.state !== 'fight') return false; }
    if (!boss) hitMonsters();
    for (const p of G.planets) {
      if (p === s.last || p.dead) continue;
      const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
      if (d >= capOf(p)) continue;
      if (d < p.R * .4) { burst(s.x, s.y, '#ffb070', 16, 200); die('행성에 정면충돌'); break; }
      if (dx * s.vx + dy * s.vy >= 0 || d < p.R + 10) { latch(p, dx, dy, d); break; }
    }
    if (G.st !== 'play') return false;
    if (s.mode === 'free') {
      if (boss) { if (boss.state === 'fight') { G.bo2 -= dt; if (G.bo2 <= 0) { G.bo2 = 0; die('산소 고갈'); } } }
      else if (s.air > o2max()) die('산소 고갈');
      if (G.st !== 'play') return false;
      if (boss && s.y > G.camY + V.VH - 12 && s.vy > 0) { // 보스전 바닥: 튕기고 산소를 조금 잃는다
        s.y = G.camY + V.VH - 12; s.vy *= -1; G.bo2 = Math.max(0, G.bo2 - .8); beep(120, .08, 'triangle', .08);
        sparks(s.x, s.y, '#ff8a7a', 9, 240, -PI / 2, .9); shakeAdd(4); popText(s.x, s.y - 16, '-0.8s', '#ff8a7a', 14);
      } else if (!boss && s.y > viewBot() + 40) die('심우주로 표류');
      if (G.st !== 'play') return false;
    }
  }
  if (!boss) for (const h of G.holes) { if (Math.hypot(s.x - h.x, s.y - h.y) < h.r + 6) { die('블랙홀에 흡수'); if (G.st !== 'play') return false; break; } }
  collectStars();
  s.trail.push(s.x, s.y); if (s.trail.length > 48) s.trail.splice(0, 2);
  return true;
}

/** 옆 벽에 튕김. 보스전에서는 열기가 쌓인다 */
function wallHit(x, y, dir, bf) {
  if (bf) { heatUp(x, y, dir); return; }
  beep(170, .05); sparks(x, y, '#bfeaff', 7, 220, dir, .8); shakeAdd(2.5);
}

/** 비행 속도 보정: 돌격 속도는 서서히 원래대로, 보스전에서는 바람·블랙홀로 과속하지 않게 */
function regulateSpeed(dt, base) {
  const s = G.ship, m = Math.hypot(s.vx, s.vy);
  if (s.boost > 1.003) {
    s.boost = 1 + (s.boost - 1) * Math.exp(-dt / DASH_TAU);
    if (m > 0) { const k = base * s.boost * heatMul() / m; s.vx *= k; s.vy *= k; }
  } else if (G.boss) {
    const mx = base * 1.25 * heatMul(); if (m > mx) { s.vx *= mx / m; s.vy *= mx / m; }
  }
}
function dashTrail(dt) {
  const s = G.ship; s.gt = (s.gt || 0) - dt;
  if (s.gt <= 0) { s.gt = .025; s.ghosts.push({ x: s.x, y: s.y, a: Math.atan2(s.vy, s.vx), t: 0 }); }
}
function chargeFx(dt) {
  const s = G.ship;
  s.charge = Math.min(1, s.charge + dt / CHARGE_T);
  const col = 'hsl(' + curDef().L.h + ',100%,75%)';
  if (Math.random() < dt * 70 * (.3 + s.charge)) { // 기체로 빨려드는 입자
    const an = rnd(0, TAU), r = 38 - s.charge * 14;
    G.parts.push({ x: s.x + Math.cos(an) * r, y: s.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 3, vy: -Math.sin(an) * r * 3, t: 0, l: .25, c: col, s: 2 });
  }
  if (s.charge >= 1 && !s.chFull) { // 가득 참
    s.chFull = true; beep(1100, .09, 'square', .09); ringFx(s.x, s.y, '#fff', 8, 44, .3, 3); shakeAdd(2); vibe(15);
  }
}
function collectStars() {
  const s = G.ship, mr = magRange();
  for (const t of G.stars) {
    if (t.got) continue;
    if (Math.hypot(s.x - t.x, s.y - t.y) < mr) {
      t.got = true; G.starChain++;
      addScore(5 + G.starChain - 1, t.x, t.y, '#ffe27a');
      beep(990 * Math.pow(1.07, Math.min(G.starChain - 1, 8)), .06, 'sine'); burst(t.x, t.y, '#ffe27a', 8, 110); ringFx(t.x, t.y, '#ffe27a', 3, 22, .3, 2);
    }
  }
}
