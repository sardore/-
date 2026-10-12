/* 보스전의 열기: 벽에 튕길 때마다 기체에 기체색 불꽃이 쌓이고 점점 빨라진다.
 * 행성에 착지하거나 보스의 공격을 맞으면 식는다. */
import { G } from './state.js';
import { PI, rnd } from './util.js';
import { curDef } from './stats.js';
import { beep, noise } from './audio.js';
import { sparks, ringFx, shakeAdd } from './fx.js';

export const HEAT_MAX = 5;          // 쌓이는 최대 단계
const HEAT_SPEED = .14;             // 한 단계마다 늘어나는 속도 비율
const HEAT_RAM = .12;               // 한 단계마다 늘어나는 박치기 피해 비율

export const heatMul = () => 1 + HEAT_SPEED * G.ship.heat;
export const heatRam = () => 1 + HEAT_RAM * G.ship.heat;
/** 기체 색의 불꽃색. light 는 밝기(%) */
export const flameColor = (light = 62) => 'hsl(' + curDef().L.h + ',100%,' + light + '%)';

/** 벽에 튕겼다: 한 단계 뜨거워지고, 그만큼 즉시 빨라진다. (x, y)는 부딪힌 지점, dir 은 튕겨 나가는 각도 */
export function heatUp(x, y, dir) {
  const s = G.ship, before = heatMul();
  s.heat = Math.min(HEAT_MAX, s.heat + 1);
  const k = heatMul() / before; s.vx *= k; s.vy *= k;
  const h = s.heat;
  sparks(x, y, flameColor(66), 8 + h * 3, 260 + h * 40, dir, .9); sparks(x, y, '#fff', 4, 300, dir, .6);
  ringFx(x, y, flameColor(70), 4, 22 + h * 6, .3, 2 + h * .4);
  beep(220 + h * 90, .07, 'sawtooth', .07); noise(.12 + h * .02, .08 + h * .02, 2500 + h * 700, 400); shakeAdd(2.5 + h * .6);
}

/** 식는다 (착지·피격). 열이 있었으면 연기를 내뿜는다 */
export function heatReset() {
  const s = G.ship; if (!s.heat) return;
  s.heat = 0;
  sparks(s.x, s.y, 'rgba(180,180,200,.7)', 8, 90, rnd(0, 2 * PI), PI);
}

/** 비행 중 열기에 비례해 기체 뒤로 불꽃 입자를 뿜는다 */
export function emitFlames(dt) {
  const s = G.ship, h = s.heat; if (!h) return;
  const m = Math.hypot(s.vx, s.vy) || 1, bx = -s.vx / m, by = -s.vy / m;
  const n = dt * 60 * (.8 + h * .9);
  for (let i = Math.random() < n % 1 ? Math.ceil(n) : Math.floor(n); i > 0; i--) {
    const sp = rnd(20, 70) + h * 14, sd = rnd(-.5, .5), cs = Math.cos(sd), sn = Math.sin(sd);
    const dx = (bx * cs - by * sn) * sp, dy = (bx * sn + by * cs) * sp, core = Math.random() < .3;
    G.parts.push({ x: s.x + bx * 6 + rnd(-3, 3), y: s.y + by * 6 + rnd(-3, 3), vx: dx, vy: dy, t: 0, l: rnd(.25, .45) + h * .03, c: core ? '#fff' : flameColor(rnd(55, 78)), s: rnd(3, 5 + h) });
  }
}
