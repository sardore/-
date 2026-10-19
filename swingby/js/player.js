/* 플레이어 기체: 입력 동작(발사·차지), 포획, 사망, 매 프레임의 이동·충돌 */
import { G } from './state.js';
import { PI, TAU, rnd } from './util.js';
import { spd, orbSpd, capOf, decRate, o2max, magRange, shipR, curDef, minOrbit, maxOrbit, fs } from './stats.js';
import { viewBot } from './camera.js';
import { beep, thump, sweep, noise, vibe } from './audio.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, toast, addScore } from './fx.js';
import { shatter } from './planets.js';
import { forkArrive } from './fork.js';
import { die } from './death.js';
import { netAssist, rescueAssist } from './assist.js';
import { bossTurn } from './boss-attacks.js';
import { ram } from './boss.js';
import { hitMonsters } from './monsters.js';
import { hitOps } from './ops.js';
import { batteryStart } from './ops-battery.js';
import { onLand } from './ops-gimmick.js';
import { DASH_MIN } from './impact.js';
import { heatUp, heatReset, heatMul, emitFlames } from './heat.js';
import { cfg, shipHue, emitDecor, starHsl } from './cos.js';
import { spawnLand } from './land-fx.js';

const CHARGE_T = .8;      // 돌진 세기 1.0 인 기체의 차지가 가득 차는 시간(초). 세기에 반비례한다(강한 돌진일수록 빨리 찬다)
const chargeTime = () => CHARGE_T / curDef().dash;
const DASH_TAU = .55;            // 돌격 속도가 원래 속도로 돌아오는 시간 상수

/* ---------- 입력 동작 ---------- */
const canAct = () => G.st === 'play' && G.ship.mode === 'orb' && !(G.boss && G.boss.state !== 'fight');

/** 누름: 차지를 시작한다 (뗄 때 발사) */
export function pressStart() {
  if (!canAct()) return;
  const s = G.ship; s.charging = true; s.charge = 0; s.chFull = false;
  stopChargeSnd(); chSnd = sweep(180, 900, chargeTime(), .07) || null;
}
let chSnd = null;   // 지금 울리는 충전 소리를 끊는 함수
function stopChargeSnd() { if (chSnd) { chSnd(); chSnd = null; } }
/** 뗌: 차지 중이었다면 그 세기로 발사 */
export function pressEnd() {
  const s = G.ship; if (!s || !s.charging) return;
  const c = s.charge; s.charging = false; s.charge = 0; stopChargeSnd();
  if (canAct()) release(c);
}

/** 궤도를 벗어나 접선 방향으로 날아간다. charge(0~1)가 크면 돌격 속도 */
function release(charge) {
  const s = G.ship; if (s.mode !== 'orb') return;
  if (G.boss && G.boss.state !== 'fight') return;
  const boost = 1 + curDef().dash * Math.max(0, (charge - .1) / .9), v = spd() * boost, from = s.p;
  s.grace = 0; s.fallT = .4; s.mode = 'free'; s.vx = -Math.sin(s.a) * s.dir * v; s.vy = Math.cos(s.a) * s.dir * v;
  s.last = from; s.air = 0; s.hitF = false; s.boost = boost; s.charging = false; G.starChain = 0;
  const back = Math.atan2(-s.vy, -s.vx);
  beep(620, .04); noise(.22, .16, 5000, 400);
  sparks(s.x, s.y, '#bfeaff', 9, 260, back, .5); ringFx(s.x, s.y, 'rgba(190,235,255,.8)', 4, 26, .3, 2); shakeAdd(2.2);
  s.gd = 0; s.gSkip = null; s.net = false; s.bumped = false;
  if (boost > DASH_MIN) { // 돌격!
    const f = boost - 1;
    if (G.ops) batteryStart();   // 블랙쉽: 돌진 포대가 있는 기체는 비행 중 포탄을 쏜다
    // 발사 직후 잠깐은 출발 행성과 포획 범위가 겹친 이웃에 다시 붙지 않게 한다(돌진 세기에 비례, 출발 행성의 포획 범위보다는 멀리)
    s.gd = Math.max(capOf(from) * 1.1 + 20 * fs(), f * 300 * fs());
    s.gSkip = G.planets.filter(q => q !== from && Math.hypot(q.x - from.x, q.y - from.y) < capOf(from) + capOf(q));
    thump(260, 50, .25, .3); sweep(300, 1400, .3, .1, 'square'); noise(.3, .22, 7000, 500);
    sparks(s.x, s.y, '#fff', 16, 520, back, .35); sparks(s.x, s.y, 'hsl(' + shipHue() + ',100%,70%)', 14, 420, back, .5);
    ringFx(s.x, s.y, '#fff', 6, 60 + f * 40, .35, 4); shakeAdd(4 + f * 5); punch(.02 + f * .02); flashScreen(.1 + f * .08, '#fff'); vibe(25);
  }
  if (from.brittle) { // 소행성은 떠나는 순간 부서진다
    shatter(from);
    burst(from.x, from.y, 'hsl(' + from.hue + ',50%,60%)', 22, 220); sparks(from.x, from.y, '#e8d0b0', 12, 260, rnd(0, TAU), PI);
    ringFx(from.x, from.y, 'rgba(230,200,160,.8)', from.R, from.R + 36, .4, 3); noise(.35, .2, 3000, 300);
  }
}

/* ---------- 포획 ---------- */
function latch(p, dx, dy, d) {
  const s = G.ship;
  s.mode = 'orb'; s.p = p; s.r = Math.max(d, minOrbit(p)); s.a = Math.atan2(dy, dx); s.dir = (dx * s.vy - dy * s.vx) >= 0 ? 1 : -1;
  const quick = s.swept < TAU * 1.05;
  s.swept = 0; s.air = 0; s.last = null; s.boost = 1; s.charging = false; s.charge = 0; s.gd = 0; s.net = false; s.bumped = false; heatReset();
  p.pulse = 1; p.sq = .55;
  spawnLand(G.fxr, G.parts, p.x, p.y, p.R, capOf(p), shipHue(), cfg().landshape);   // 착지 링: 색은 늘 기체 색, 모양은 상점 상품
  if (cfg().landshape) burst(s.x, s.y, 'hsl(' + shipHue() + ',90%,70%)', 10, 160);
  thump(170, 60, .16, .2);
  if (G.ops && p.gim) onLand(p);   // 거대 행성 기믹(보급 부두의 보상)
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

/* ---------- 프레임 이동 ---------- */
/** 기체를 dt 만큼 움직이고 충돌·산소·별을 처리한다. 판이 끝났으면 false */
export function stepShip(dt) {
  const s = G.ship, v = spd(), boss = G.boss, bf = boss && boss.state === 'fight';
  const forkWait = !boss && !!G.fork && G.fork.state === 'hub';   // 갈림길 선택 대기 중
  if (chSnd && !(s.charging && s.mode === 'orb')) stopChargeSnd();   // 피격·보스 연출 등으로 충전이 풀렸으면 소리도 끈다
  if (s.inv > 0) s.inv -= dt; if (s.ramT > 0) s.ramT -= dt; if (s.grace > 0) s.grace -= dt; if (s.fallT > 0) s.fallT -= dt;
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
    else if (G.held && canAct()) pressStart();   // 누르고 있는데 충전 중이 아니면(비행 중 선입력·보스 연출·피격으로 풀림) 행동 가능해진 순간부터 충전
    if (s.r <= p.R + 3) { die('궤도가 붕괴해 행성에 추락'); if (G.st !== 'play') return false; }
    if (bf && s.y > G.arenaBot + 40) { die('행성과 함께 뒤로 밀려나 표류'); if (G.st !== 'play') return false; }   // 행성이 화면 아래로 사라졌다
  } else {
    regulateSpeed(dt, v);
    if (s.net && bf) netAssist(dt);
    else if (!boss && (s.net || forkWait)) rescueAssist(dt);
    if (!boss && s.bumped) netAssist(dt);   // 독 행성·소형함·넉백에 튕겼으면 보스를 때렸을 때처럼 바닥이 가까워질수록 행성 쪽으로 서서히 끌려간다   // 격파 직후 · 갈림길 대기 중(월드 생성이 멈춰 있어 놓치면 갈 곳이 없다)
    s.x += s.vx * dt; s.y += s.vy * dt; s.air += dt;
    if (s.gd > 0) s.gd -= Math.hypot(s.vx, s.vy) * dt;
    if (Math.random() < dt * 60 * .7) G.parts.push({ x: s.x, y: s.y, vx: rnd(-12, 12), vy: rnd(-12, 12), t: 0, l: .28, c: 'rgba(160,220,255,.9)', s: 2 });
    const cf = cfg();
    if (s.boost > 1.2 || (cf.trail && cf.trail.style === 'ghost')) dashTrail(dt);
    emitDecor(cf, s.x, s.y, s.vx, s.vy, dt, fs(), G.parts);
    if (bf) emitFlames(dt);
    if (s.x < 6 && s.vx < 0) { s.x = 6; s.vx *= -1; wallHit(6, s.y, 0, bf); }
    if (s.x > G.w - 6 && s.vx > 0) { s.x = G.w - 6; s.vx *= -1; wallHit(G.w - 6, s.y, PI, bf); }
    if (boss && s.y < G.arenaTop + 10 && s.vy < 0) { s.y = G.arenaTop + 10; s.vy *= -1; s.gd = 0; if (bf) heatUp(s.x, s.y, PI / 2); }
    if (s.last && Math.hypot(s.x - s.last.x, s.y - s.last.y) > capOf(s.last) + 8) s.last = null;
    if (bf && s.ramT <= 0 && Math.hypot(s.x - boss.x, s.y - boss.y) < boss.hr + shipR() + 3) { ram(); G.ship.net = true; if (G.st !== 'play' || !G.boss || G.boss.state !== 'fight') return false; }
    if (!boss) hitMonsters();
    if (G.ops) hitOps();
    for (const p of G.planets) {
      if (p === s.last || p.dead || p.ghost) continue;
      const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
      if (d >= capOf(p)) continue;
      if (d < p.R * .4) { burst(s.x, s.y, '#ffb070', 16, 200); die('행성에 정면충돌'); break; }
      if (s.gd > 0 && d > p.R + 10 && s.gSkip && s.gSkip.includes(p)) continue;   // 몸체에 닿을 만큼 박으면 그대로 붙잡힌다
      if (dx * s.vx + dy * s.vy >= 0 || d < p.R + 10) { latch(p, dx, dy, d); break; }
    }
    if (G.st !== 'play') return false;
    if (s.mode === 'free') {
      if (boss) { if (boss.state === 'fight') { G.bo2 -= dt; if (G.bo2 <= 0) { G.bo2 = 0; die('산소 고갈'); } } }
      else if (s.air > o2max() && !forkWait) die('산소 고갈');   // 갈림길 대기 중엔 월드 생성이 멈춰 있어, 놓친 비행을 죽이지 않고 assist.js 가 행성으로 되돌린다
      if (G.st !== 'play') return false;
      if (boss && !bf) { if (s.y > G.arenaBot - 12 && s.vy > 0) { s.y = G.arenaBot - 12; s.vy *= -1; } }   // 등장·격파 연출 중에만 바닥이 막아 준다
      else if (bf && s.net && s.y > G.arenaBot + 24 && s.vy > 0) { s.y = G.arenaBot + 24; s.vy = -Math.abs(s.vy) * .8; s.net = false; }   // 안전망의 마지막 수단: 이미 화면 밖이라 눈에 띄지 않는다
      else if (s.y > (boss ? G.arenaBot : viewBot()) + 40 && !forkWait && !(s.fallT > 0)) die(boss ? '뒤처져 심우주로 표류' : '심우주로 표류');   // 보스전도 일반 지형과 같은 낙사
      if (G.st !== 'play') return false;
    }
  }
  // 보스 격파 직후(grace)·피격 직후(inv)에는 블랙홀에 흡수되지 않는다
  if (!boss && !(s.grace > 0) && !(s.inv > 0)) for (const h of G.holes) { if (Math.hypot(s.x - h.x, s.y - h.y) < h.r + 6) { die('블랙홀에 흡수'); if (G.st !== 'play') return false; break; } }
  collectStars();
  s.trail.push(s.x, s.y); if (s.trail.length > 48) s.trail.splice(0, 2);
  return true;
}

/** 옆 벽에 튕김. 보스전에서는 열기가 쌓인다 */
function wallHit(x, y, dir, bf) {
  G.ship.gd = 0;
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
  if (s.gt <= 0) { s.gt = s.boost > 1.2 ? .025 : .05; s.ghosts.push({ x: s.x, y: s.y, a: Math.atan2(s.vy, s.vx), t: 0 }); }
}
function chargeFx(dt) {
  const s = G.ship;
  s.charge = Math.min(1, s.charge + dt / chargeTime());
  const col = 'hsl(' + shipHue() + ',100%,75%)';
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
      G.starScore += addScore(5 + G.starChain - 1, t.x, t.y, '#ffe27a');
      const sc = () => starHsl(70) || '#ffe27a';   // 상점 별 파티클 색 (다색이면 부를 때마다 두 색 중 하나라 한 번 터질 때 두 색이 섞인다)
      beep(990 * Math.pow(1.07, Math.min(G.starChain - 1, 8)), .06, 'sine'); burst(t.x, t.y, sc(), 4, 110); burst(t.x, t.y, sc(), 4, 110); ringFx(t.x, t.y, sc(), 3, 22, .3, 2);
    }
  }
}
