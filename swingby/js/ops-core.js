/* 마지막 보스 '기함 파놉티콘' 의 두 번째 형태. 체력이 0 이 되면 함선이 폭발하고, 그 잔해 속에서 작은 핵 응축선이 나온다.
 * 핵에서 두 갈래 가지가 반대 방향으로 뻗고, 가지가 가리키는 쪽으로 광선이 느리게 돌며 계속 이어진다(체력이 줄수록 조금씩 빨라진다).
 * 이 핵까지 부숴야 진짜 클리어다. 광선의 판정은 boss-attacks.js(updateHaz), 그림은 draw-boss.js(drawHaz)·ops-boss-art2.js(core) */
import { G } from './state.js';
import { PI, TAU, rnd } from './util.js';
import { OPS_CORE } from './ops-data.js';
import { fs, arenaK } from './stats.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, slowmo } from './fx.js';
import { thump, noise, vibe, sweep } from './audio.js';

/** 기함이 쓰러졌을 때 부른다(boss.js ram). 핵으로 바뀌었으면 true — 그러면 아직 격파가 아니다 */
export function opsFinalForm(b) {
  if (!G.ops || b.core || b.d.ship !== 'panopticon') return false;
  const C = OPS_CORE, ratio = C.R / b.d.R, fk = fs();
  b.core = true; b.coreT = 0; b.coreA = PI / 2 + .5;
  b.d = Object.assign({}, b.d, C);                         // 이름·그림·체력·공격 패턴 없음(q 가 음수라 새 예고가 쌓이지 않는다)
  b.hp = b.max = C.hp; b.R *= ratio; b.hr = Math.max(b.R, 21 * fk);
  b.q = []; b.cast = 0; b.phase = 1; b.flash = .4; b.sq = 0;
  G.haz = [{ k: 'rbeam', ang: b.coreA, spd: C.spd, half: C.half, len: 950 * arenaK(), pow: 1, t: 0, born: 0 }];
  // 함선이 터진다
  hitstop(.25); slowmo(.3, 1.2); G.shake = 26; flashScreen(.9, '#fff'); punch(.1); vibe([80, 40, 160]); thump(70, 20, 1.5, .5); noise(1.5, .35, 5000, 60); sweep(900, 60, 1.2, .14);
  for (let i = 0; i < 14; i++) { const an = rnd(0, TAU), r = rnd(0, 62 * fk); burst(b.x + Math.cos(an) * r, b.y + Math.sin(an) * r, i % 2 ? '#fff' : 'hsl(' + (i % 3 ? 272 : 38) + ',100%,66%)', 14, 320); sparks(b.x, b.y, '#fff', 3, 420, an, .5); }
  ringFx(b.x, b.y, '#fff', 10, 230, .8, 5); ringFx(b.x, b.y, 'hsl(272,100%,70%)', 8, 340, 1.1, 3);
  G.banner = { t: 0, dur: 2.6, a: '최종 형태', b: C.n, c: 'hsl(' + C.hue + ',100%,70%)', sub: C.line };
  return true;
}
