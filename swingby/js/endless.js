/* 무한 모드: TON 618 을 쓰러뜨린 뒤의 항해. 별 조각은 계속 모이고, 대신 궤도 붕괴가 진행도에 비례해 점점 빨라진다.
 * 보스는 별 카탈로그 번호(HD 209458 …)를 이름으로 갖는 무작위 보스다: 전용 패턴 5개 중 둘 + 공용 패턴 몇 개를 들고 나오고, 스킬 이름은 알려주지 않는다.
 * 공격력·체력은 보스를 잡을 때마다 지수로 오른다 — 궤도 붕괴(선형)보다 가팔라서 언젠가는 반드시 게임오버가 된다. */
import { G } from './state.js';
import { rnd, rint, pickOf, shuffle } from './util.js';
import { STAGES } from './data.js';

export const ENDLESS = {
  dec: .03,                  // 클리어 뒤 행성 하나를 지날 때마다 궤도 붕괴 속도가 +3%p (선형)
  hp0: 800, hpG: 1.22,       // 첫 무한 보스 체력, 보스마다 곱해지는 비율
  atk0: 9, atkG: 1.09,       // 첫 무한 보스 공격력(맞을 때 깎이는 산소 초), 보스마다 곱해지는 비율
  gap: 12                    // 다음 보스까지의 행성 수
};
export const EXCLUSIVE = ['rain', 'ripple', 'grid', 'sweep', 'snare'];
const COMMON = ['meteor', 'comet', 'beam', 'jet', 'flare', 'hole', 'collapse', 'wind'];
const KINDS = ['dwarf', 'spike', 'ring', 'bull', 'pulse', 'super', 'swirl', 'twin', 'hex', 'eta', 'devour'];
/** 카탈로그 약어와 실제 목록의 번호 범위(가중치) */
const CATALOGS = [['HD', 359083, 3], ['HIP', 118322, 3], ['HR', 9110, 1], ['GJ', 1291, 1], ['SAO', 258997, 1]];

/** 지금 판이 무한 모드(TON 618 격파 이후의 보스)인지 */
export const endlessNext = () => G.kills >= STAGES.length;
/** 클리어 뒤에 지난 행성 수에 비례하는 궤도 붕괴 배율 (클리어 전에는 1) */
export const endlessDec = () => G.endHop == null ? 1 : 1 + ENDLESS.dec * Math.max(0, G.hops - G.endHop);

function catalogName() {
  const tot = CATALOGS.reduce((a, c) => a + c[2], 0); let r = Math.random() * tot;
  for (const [ab, max, w] of CATALOGS) if ((r -= w) <= 0) return ab + ' ' + rint(1, max);
  return 'HD ' + rint(1, 359083);
}

/** n(0부터)번째 무한 보스를 만든다. BOSSES 항목과 같은 모양 + endless 표시 */
export function makeEndlessBoss(n) {
  const name = catalogName(), hue = rint(0, 359);
  const own = shuffle(EXCLUSIVE.slice()).slice(0, 2), com = shuffle(COMMON.slice()).slice(0, 3);
  return {
    n: name, e: name, endless: n + 1, R: rint(46, 66), hue, kind: pickOf(KINDS),
    hp: Math.round(ENDLESS.hp0 * Math.pow(ENDLESS.hpG, n)), atk: +(ENDLESS.atk0 * Math.pow(ENDLESS.atkG, n)).toFixed(1),
    col: ['hsl(' + hue + ',100%,92%)', 'hsl(' + hue + ',92%,60%)', 'hsl(' + hue + ',85%,22%)'],
    pat: shuffle(own.concat(com)), q: n >= 4 ? 4 : 3, line: '이름만 남은 카탈로그의 별'
  };
}
