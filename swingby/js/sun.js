/* 튜토리얼 보스 '태양'. 튜토리얼을 깰 때마다 별 조각 30개를 주고, 깬 횟수에 비례해 패턴이 늘고 강해진다(화면에는 알리지 않는 숨은 성장).
 * 튜토리얼은 2단 기체까지만 쓰는 구조라, 횟수가 쌓일수록 못 이기게 되어 무한히 파밍할 수는 없다. */
import { load, save } from './util.js';

export const TUTO_SHARDS = 30;
const KEY = 'swingby_tuto';
export const tutoClears = () => Math.max(0, Math.floor(+load(KEY, 0) || 0));
export const addTutoClear = () => { const n = tutoClears() + 1; save(KEY, n); return n; };

/** 깰 때마다 하나씩 늘어나는 패턴 순서 (2번 깰 때마다 한 종류) */
const PATS = ['meteor', 'flare', 'comet', 'cross', 'beam', 'collapse', 'spokes', 'quake'];

/** 지금까지 깬 횟수에 맞춘 태양 */
export function makeSunBoss() {
  const n = tutoClears(), kinds = Math.min(PATS.length, 1 + Math.floor(n / 2));
  return {
    n: '태양', e: 'THE SUN', R: 50, hue: 42, kind: 'sun', col: ['#fffbe0', '#ffc23a', '#c8480a'], line: '우리의 별', tuto: true,
    hp: Math.round((60 + 26 * n) / 10) * 10, atk: Math.round((4 + .6 * n) * 10) / 10,
    pat: PATS.slice(0, kinds), q: n < 3 ? 1 : n < 8 ? 2 : 3
  };
}
