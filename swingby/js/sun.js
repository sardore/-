/* 튜토리얼 보스 '태양'. 튜토리얼을 깰 때마다 별 조각 20개를 주고, 깬 횟수에 비례해 패턴이 늘고 강해진다(화면에는 알리지 않는 숨은 성장).
 * 튜토리얼은 2단 기체까지만 쓰는 구조라, 횟수가 쌓일수록 못 이기게 되어 무한히 파밍할 수는 없다. */
import { load, save } from './util.js';

export const TUTO_SHARDS = 20;
const KEY = 'swingby_tuto';
const tutoClears = () => Math.max(0, Math.floor(+load(KEY, 0) || 0));
export const addTutoClear = () => { const n = tutoClears() + 1; save(KEY, n); return n; };

/** 깰 때마다 늘어나는 패턴 순서 (2번 깰 때마다 한 종류). 뒤쪽은 무한 모드 랜덤 보스의 전용 패턴이다 */
const PATS = ['meteor', 'flare', 'comet', 'rain', 'cross', 'beam', 'ripple', 'collapse', 'spokes', 'grid', 'quake', 'sweep', 'snare'];
const FAVOR = ['rain', 'ripple', 'grid', 'sweep', 'snare'];   // 랜덤 보스 전용 패턴: 일찍 풀리고 뽑힐 확률도 두 배

/** 지금까지 깬 횟수에 맞춘 태양. 체력은 로그로 늘어 갈수록 오름폭이 줄고, 대신 공격력이 깰 때마다 1씩 오른다 */
export function makeSunBoss() {
  const n = tutoClears(), kinds = Math.min(PATS.length, 1 + Math.floor(n / 2));
  return {
    n: '태양', e: 'THE SUN', R: 50, hue: 42, kind: 'sun', col: ['#fffbe0', '#ffc23a', '#c8480a'], line: '우리의 별', tuto: true,
    hp: Math.round((60 + 125 * Math.log(1 + n / 3)) / 10) * 10, atk: 4 + n,
    pat: PATS.slice(0, kinds), favor: FAVOR, fill: Math.min(.95, .55 + .03 * n), q: Math.min(6, 1 + Math.floor(n / 2))   // 동시 예고: 2번 깰 때마다 +1 (체력바 위 칩이 6개까지 들어가므로 6에서 멈춘다)
  };
}
