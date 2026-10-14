/* 블랙쉽 적의 공통 공격 수단: 넉백. 맞으면 피해나 산소 손실 없이, 날아가던 기체가 공격 방향으로 크게 튕겨 나간다(궤도를 돌고 있을 땐 맞지 않는다).
 * 포탄·충격파·광선·돌진이 모두 이 한 함수를 쓴다 */
import { G } from './state.js';
import { spd } from './stats.js';
import { burst, ringFx, hitstop, shakeAdd, flashScreen, popText } from './fx.js';
import { thump, vibe, noise } from './audio.js';

/** 비행 중이고 무적이 아닐 때만 튕긴다. (nx, ny) 는 밀려나는 방향, mul 은 세기(1 = 기체 비행 속도) */
export function canKnock() { const s = G.ship; return s.mode === 'free' && G.st === 'play' && s.inv <= 0; }
export function knock(nx, ny, mul, col) {
  if (!canKnock()) return false;
  const s = G.ship, m = Math.hypot(nx, ny) || 1, v = spd() * mul;
  s.vx = nx / m * v + s.vx * .15; s.vy = ny / m * v + s.vy * .15; s.inv = .6; s.gd = 0; s.bumped = true; s.last = null;
  col = col || '#ff8a6a';
  burst(s.x, s.y, col, 12, 220); ringFx(s.x, s.y, '#fff', 4, 40, .3, 3); shakeAdd(6); hitstop(.05); flashScreen(.1, col); vibe(25); thump(150, 40, .22, .3); noise(.15, .2, 2500, 300);
  popText(s.x, s.y - 20, '밀려났다', col, 14);
  return true;
}
