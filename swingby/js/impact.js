/* 기체가 보스·독 행성 같은 "맞서는 몸"에 부딪혔을 때의 공통 계산: 충돌 피해와 튕겨 나가기 */
import { G } from './state.js';
import { ramMul, shipR, spd, curDef } from './stats.js';

export const DASH_MIN = 1.15;                       // 이 배율을 넘으면 "돌격 중"
export const isDashing = () => G.ship.boost > DASH_MIN;
/** 돌격이 셀수록 충돌이 아프다 */
const dashMul = () => isDashing() ? 1 + curDef().pow * (G.ship.boost - 1) : 1;   // 돌진형 기체는 계수가 더 크다

/** 충돌 한 번의 피해: 기본 26 × 충돌 능력치 × 돌격 보너스 × 호출한 쪽의 추가 배율(콤보·열기 등), ±10% 흔들림 */
export const impactDamage = (extra = 1) => Math.round(26 * ramMul() * dashMul() * extra * (.9 + Math.random() * .2));

/** 법선 (nx, ny) 으로 기체를 반사시키고 몸 바깥(중심 (cx, cy)에서 reach 만큼)으로 옮긴다. 속도는 minSpeed 밑으로 떨어지지 않는다 */
export function bounceShip(cx, cy, nx, ny, reach, minSpeed) {
  const s = G.ship; s.gd = 0;
  const dot = s.vx * nx + s.vy * ny, vx = s.vx - 2 * dot * nx, vy = s.vy - 2 * dot * ny;
  const len = Math.hypot(vx, vy) || 1, v = Math.max(minSpeed, len * .85);
  s.vx = vx / len * v; s.vy = vy / len * v; s.x = cx + nx * reach; s.y = cy + ny * reach;
}
/** 몸 표면에서 기체가 놓일 거리 */
export const standoff = (bodyR, gap) => bodyR + shipR() + gap;
export const bounceSpeed = (mul = 1) => spd() * .75 * mul;
