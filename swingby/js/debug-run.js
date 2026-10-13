/* 디버그판: 주소에 ?debug 를 붙이면 초고스펙 기체로 바로 보스전을 시작한다. (예: index.html?debug)
 *   ?debug            TON 618 (마지막 보스)
 *   ?debug&boss=3     BOSSES 인덱스로 다른 보스
 *   ?debug&zone=monster  보스 없이 그 지역(BIOMES 키)에서 시작해 지형을 구경한다
 * 이 판의 기록은 저장하지 않는다. 죽으면 같은 조건으로 다시 시작한다. */
import { G } from './state.js';
import { BOSSES, STAGES, BIOMES, baseStats } from './data.js';
import { SHIPS, statsAfter } from './ships.js';

const q = new URLSearchParams(location.search);
export const DEBUG = q.has('debug');
const zone = q.get('zone');
const TON = BOSSES.findIndex(b => b.kind === 'quasar');
const target = q.has('boss') ? Math.min(BOSSES.length - 1, Math.max(0, +q.get('boss') || 0)) : TON;

/** 새 판 직후 호출: 디버그 전용 기체('dbg')로 시작하고 보스 등장 조건을 즉시 만족시킨다 */
export function applyDebugRun() {
  if (!DEBUG) return;
  G.debug = true;
  G.tier = 4; G.shipId = 'dbg';
  G.stats = statsAfter(baseStats(), SHIPS.dbg);
  if (zone && BIOMES[zone] && !q.has('boss')) { G.biome = zone; G.stats.ram = 100; return; }   // 지형 구경: 보스 조건은 건드리지 않는다
  G.nextBi = target; G.kills = Math.max(0, STAGES.findIndex(s => s.includes(target)));
  G.hops = 1; G.nextBoss = 0; G.nextOffer = Infinity;
}
