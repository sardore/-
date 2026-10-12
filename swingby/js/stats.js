/* 퍼센트 능력치 → 실제 게임 수치 변환. 규칙을 이 파일 하나에 모아 둔다.
 *   spd 비행·궤도 속도 ×  · ram 박치기 피해 ×  · grav 포획 링 폭 ×  · decay 궤도 붕괴 ÷
 *   o2 비행 시간·보스전 산소 ×  · mag 별 수집 범위 ×  · mult 점수 ×  · shield 개수 */
import { G } from './state.js';
import { W0 } from './util.js';
import { SHIPS } from './ships.js';
import { PLANET_DEC, BIOMES } from './data.js';

const pct = k => G.stats[k] / 100;

export const curDef = () => SHIPS[G.shipId];
/** 지형 배율: 필드가 넓어질수록 행성·기체·속도가 같이 조금씩 커져 체감 속도·난이도는 그대로 둔다 */
export const fs = () => Math.sqrt(G.w / W0);
export const shipR = () => (7 + (G.tier - 1) * 1.6) * fs();                 // 기체 충돌 반경

export const spd = () => (235 + Math.min(G.hops * 3, 165)) * pct('spd') * fs();
export const capOf = p => p.R + (p.cap - p.R) * pct('grav');
export const decRate = p => (5 + Math.min(G.hops * .22, 9)) * PLANET_DEC[p.t] / pct('decay') * fs();
export const o2max = () => 2.6 * pct('o2');
export const magRange = () => 20 * pct('mag') * fs();
export const ramMul = () => pct('ram');
/** 보스전 산소 풀: 스테이지·루프에 따라 늘고 산소 능력치가 절반만큼 반영된다 */
export const bossO2 = (stage, loop) => (24 + 6 * stage + 2 * loop) * (1 + (G.stats.o2 - 100) / 200);
/** 점수 배율: 능력치 × 바이옴(보스전 중에는 바이옴 무시) */
export const scoreMul = () => pct('mult') * (G.boss ? 1 : BIOMES[G.biome].sc);
