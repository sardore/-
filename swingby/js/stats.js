/* 퍼센트 능력치 → 실제 게임 수치 변환. 규칙을 이 파일 하나에 모아 둔다.
 *   spd 비행·궤도 속도 ×  · ram 충돌 피해 ×  · grav 행성 포획 링 폭·별 수집 범위 ×  · decay 궤도 붕괴 ÷
 *   o2 비행 시간·보스전 산소 ×  · mult 점수 ×  · shield 개수 */
import { G } from './state.js';
import { W0 } from './util.js';
import { SHIPS } from './ships.js';
import { PLANET_DEC, BIOMES, BOSS_MUL } from './data.js';
import { endlessGrav } from './endless.js';

const pct = k => G.stats[k] / 100;

export const curDef = () => SHIPS[G.shipId];
/** 지형 배율: 필드가 넓어질수록 행성·기체·속도가 같이 조금씩 커져 체감 속도·난이도는 그대로 둔다 */
export const fs = () => Math.sqrt(G.w / W0);
/** 행성에 붙을 때의 최소 궤도 반지름. 한가운데로 파고들어도 이만큼은 바깥에서 돌게 한다 */
export const minOrbit = p => p.R + 20 * fs();
/** 아레나 배율(선형): 필드 폭 ÷ 기본 폭. 거리·길이처럼 필드 전체에 걸치는 값에 쓴다. 크기 배율은 fs() */
export const arenaK = () => G.w / W0;
export const shipR = () => (7 + (G.tier - 1) * 1.6) * fs();                 // 기체 충돌 반경

const baseSpd = () => (235 + Math.min(G.hops * 3, 165)) * fs();
export const spd = () => baseSpd() * pct('spd');     // 비행 속도
export const orbSpd = () => baseSpd();                // 궤도 회전 속도: 속도 능력치의 영향을 받지 않는다
/** 포획 범위 배율. 인력이 높을수록 효과가 줄어든다: 너무 넓으면 원하는 행성을 고를 수 없어 오히려 답답해진다 */
const RING_KNEE = 1.5, RING_SLOPE = .4, ORBIT_MAX = 1.45;
const ringMul = () => { const g = pct('grav'); return g <= RING_KNEE ? g : RING_KNEE + (g - RING_KNEE) * RING_SLOPE; };
/** 행성의 포획 범위. TON 618 을 잡은 뒤(무한 모드)에는 진행도에 비례해 인력이 줄지만, 궤도로 돌 최소한의 폭(minOrbit 근처)은 남는다 */
export const capOf = p => {
  const full = (p.cap - p.R) * ringMul(), gv = endlessGrav();
  return p.R + (gv >= 1 ? full : Math.max(full * gv, Math.min(full, 24 * fs())));
};
/** 궤도 반지름의 상한. 포획 범위가 아무리 넓어도 이보다 먼 궤도는 금방 안쪽으로 끌려 들어온다(큰 궤도는 회전이 느려 답답하다) */
export const maxOrbit = p => Math.min(capOf(p), p.R + (p.cap - p.R) * ORBIT_MAX);
export const decRate = p => (5 + Math.min(G.hops * .22, 9)) * PLANET_DEC[p.t] / pct('decay') * fs();
export const o2max = () => 2.6 * pct('o2');
export const magRange = () => 20 * pct('grav') * fs();
export const ramMul = () => pct('ram');
/** 보스전 산소 풀: 스테이지·루프에 따라 늘고 산소 능력치가 절반만큼 반영된다 */
export const bossO2 = (stage, loop) => (24 + 6 * stage + 2 * loop) * (1 + (G.stats.o2 - 100) / 200);
/** 점수 배율: 능력치 × 보스 격파 복리 × 바이옴(보스전 중에는 바이옴 무시) */
export const scoreMul = () => pct('mult') * Math.pow(BOSS_MUL, G.kills) * (G.boss ? 1 : BIOMES[G.biome].sc);   // 보스 격파마다 ×BOSS_MUL 복리
