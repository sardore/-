/* 블랙쉽 후반 소형 적함의 행동(ops-mook.js 가 부른다). 공격은 전부 넉백(ops-knock.js)이다.
 *   repeller 척력정 — 순찰하다가 멈춰 충전한 뒤 사방으로 척력 충격파를 퍼뜨린다(닿으면 바깥으로 튕김)
 *   charger  돌격정 — 가까워진 기체를 겨눠 잠깐 조준선을 보이고 곧장 돌진한다(닿으면 돌진 방향으로 튕김). 박아서 부술 수 있다
 *   tracker  추적정 — 맵 뒤(화면 아래)를 따라붙으며 몇 초마다 세로 광선을 쏜다(닿으면 옆으로 튕김). 부술 수 없고, 행성 몇 개를 지나면 떠난다 */
import { G } from './state.js';
import { clamp, PI, rnd, angDiff } from './util.js';
import { fs, shipR } from './stats.js';
import { viewBot } from './camera.js';
import { knock, canKnock } from './ops-knock.js';
import { ringFx, burst, sparks } from './fx.js';
import { beep, noise, thump } from './audio.js';

const free = () => G.ship.mode === 'free' && G.st === 'play';
/** 척력 충격파가 닿는 반지름 · 돌진 속도·시간 · 광선 주기·예고·지속·폭 */
export const REP = { reach: 150, speed: 300, warn: .9, every: 3.6 };
export const CHG = { range: 290, aim: .85, dash: .5, speed: 580, rest: 1.3, every: 2.6 };
export const TRK = { every: 4.4, warn: 1.25, lock: .35, beam: .55, half: .07, len: 1200, follow: 95, stay: 5 };   // half: 광선 부채꼴 반각(라디안) · len: 길이

export function stepRepeller(m, dt) {
  const k = fs(), s = G.ship;
  m.t += dt * m.sp; m.x = m.x0 + Math.sin(m.t) * m.amp; m.y = m.y0 + Math.sin(m.t * 1.7) * 4 * k; m.a = PI / 2 + Math.sin(m.t * 2) * .1;
  if (m.warn > 0) { m.warn -= dt; if (m.warn <= 0) { m.ring = true; m.rr = 0; m.hit = false; beep(180, .2, 'sawtooth', .08); noise(.25, .15, 1200, 200); ringFx(m.x, m.y, '#c8a0ff', 8, 50, .35, 3); } }
  else if (m.ring) {
    m.rr += REP.speed * k * dt;
    if (!m.hit && canKnock()) { const dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy); if (Math.abs(d - m.rr) < shipR() + 9 * k) { knock(dx, dy, 1, '#c8a0ff'); m.hit = true; } }
    if (m.rr > REP.reach * k) m.ring = false;
  } else { m.fire -= dt; if (m.fire <= 0 && free() && Math.hypot(s.x - m.x, s.y - m.y) < REP.reach * 2.2 * k) { m.warn = REP.warn; m.fire = REP.every; beep(300, .15, 'triangle', .05); } }
}

export function stepCharger(m, dt) {
  const k = fs(), s = G.ship, dx = s.x - m.x, dy = s.y - m.y, d = Math.hypot(dx, dy); m.t += dt * m.sp;
  if (m.st === 'dash') {
    const ux = Math.cos(m.da), uy = Math.sin(m.da); m.x += ux * CHG.speed * k * dt; m.y += uy * CHG.speed * k * dt; m.a = m.da; m.dash -= dt;
    sparks(m.x - ux * m.R, m.y - uy * m.R, '#ffb48a', 1, 120, m.da + PI, .5);
    if (canKnock() && d < m.R + shipR()) { knock(ux, uy, 1.15, '#ff9a6a'); m.dash = Math.min(m.dash, .05); }
    if (m.dash <= 0 || m.x < 0 || m.x > G.w) { m.st = 'rest'; m.rest = CHG.rest; m.x = clamp(m.x, m.R, G.w - m.R); }
    return;
  }
  if (m.st === 'aim') {
    m.aim -= dt; if (m.aim > .3) m.a += angDiff(Math.atan2(dy, dx), m.a) * Math.min(1, dt * 9);   // 마지막 .3초는 방향을 잠근다
    if (m.aim <= 0) { m.st = 'dash'; m.dash = CHG.dash; m.da = m.a; beep(520, .12, 'sawtooth', .08); thump(120, 40, .25, .3); }
    return;
  }
  const tx = m.x0 + Math.sin(m.t) * m.amp, ty = m.y0 + Math.sin(m.t * 1.7) * 4 * k, f = Math.min(1, dt * 2.6);
  m.x += (tx - m.x) * f; m.y += (ty - m.y) * f; m.a += (PI / 2 - m.a) * Math.min(1, dt * 4);
  if (m.st === 'rest') { m.rest -= dt; if (m.rest <= 0) m.st = 'patrol'; return; }
  m.fire -= dt;
  if (m.fire <= 0 && free() && d < CHG.range * k && d > 60 * k) { m.st = 'aim'; m.aim = CHG.aim; m.fire = CHG.every; m.a = Math.atan2(dy, dx); beep(420, .1, 'square', .05); }
}

/** 추적정의 포구(함선 코) 자리: 몸 중심에서 조준 방향으로 코 끝만큼 */
export const trkNose = m => { const k = fs(); return { x: m.x + Math.cos(m.ba) * 42 * k, y: m.y + Math.sin(m.ba) * 42 * k }; };
/** 위쪽(화면 안)을 향하는 조준 각도 */
const upAim = (m, s) => { const o = trkNose(m); return clamp(Math.atan2(s.y - o.y, s.x - o.x), -PI + .3, -.3); };

/** 추적정: 화면 아래 가장자리에 붙어 기체 쪽 x 를 천천히 따라간다. 쏠 때는 보스 광선처럼 멈춰서 기체를 향해 코를 돌리고,
 * 예고(충전)가 끝나기 직전에 각도를 잠근 뒤 코에서 가는 부채꼴 광선(저격과 같은 그림)을 쏜다 */
export function stepTracker(m, dt) {
  const k = fs(), s = G.ship;
  m.y = viewBot() - 4 * k;
  const firing = m.warn > 0 || m.beam > 0;
  if (!firing) { const dx = s.x - m.x, mv = TRK.follow * k * dt; m.x += clamp(dx, -mv, mv); m.ba += angDiff(-PI / 2, m.ba) * Math.min(1, dt * 4); }
  if (m.leave) { m.out += dt * .9; if (m.out >= 1) m.dead = true; return; }
  if (G.hops - m.h0 >= TRK.stay && !firing) { m.leave = true; return; }
  if (m.beam > 0) {
    m.beam -= dt;
    const o = trkNose(m), dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy) || 1;
    if (canKnock() && d < TRK.len * k && Math.abs(angDiff(Math.atan2(dy, dx), m.ba)) < TRK.half + shipR() / d) {
      const px = -Math.sin(m.ba), py = Math.cos(m.ba), side = Math.sign(dx * px + dy * py) || 1;   // 광선 옆으로, 선에서 멀어지는 쪽
      knock(px * side, py * side, 1, '#ff6a8a');
    }
  } else if (m.warn > 0) {
    m.warn -= dt; if (m.warn > TRK.lock) m.ba += angDiff(upAim(m, s), m.ba) * Math.min(1, dt * 7);   // 마지막 .35초는 각도를 잠근다
    if (m.warn <= 0) { m.beam = TRK.beam; const o = trkNose(m); beep(150, .3, 'sawtooth', .1); noise(.35, .25, 2500, 200); thump(90, 30, .3, .3); burst(o.x, o.y, '#ff6a8a', 10, 200); }
  } else { m.fire -= dt; if (m.fire <= 0) { m.warn = TRK.warn; m.fire = TRK.every; beep(240, .12, 'square', .05); } }
}

/** 추적정을 새로 놓는다(ops-mook.js 의 mkMook 이 만든 틀에 상태를 얹는다) */
export function trackerState() { return { warn: 0, beam: 0, ba: -PI / 2, leave: false, out: 0, h0: G.hops, nohit: true, fire: rnd(1.8, 2.8) }; }
