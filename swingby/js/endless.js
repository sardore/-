/* 무한 모드: TON 618 을 쓰러뜨린 뒤의 항해. 별 조각은 계속 모이고, 대신 궤도 붕괴가 진행도에 비례해 점점 빨라진다.
 * 보스는 별 카탈로그 번호(HD 209458 …)를 이름으로 갖는 무작위 보스다: 전용 패턴 5개 중 둘 + 공용 패턴 몇 개를 들고 나오고, 스킬 이름은 알려주지 않는다.
 * 공격력·체력은 보스를 잡을 때마다 지수로 오른다 — 궤도 붕괴(선형)보다 가팔라서 언젠가는 반드시 게임오버가 된다. */
import { G } from './state.js';
import { rint, shuffle, rnd, clamp } from './util.js';
import { STAGES } from './data.js';
import { genLook } from './boss-gen.js';

/** 체력·공격력에 곱하는 무작위 편차 (1 ± var) */
const dev = () => 1 + rnd(-ENDLESS.var, ENDLESS.var);
export const ENDLESS = {
  grav: .012,                // 클리어 뒤 행성 하나를 지날 때마다 행성의 포획 범위(인력)가 처음의 1.2%p 씩 줄어든다 (선형)
  hp0: 800, hpG: 1.22,       // 첫 무한 보스 체력, 보스마다 곱해지는 비율
  var: .3,                   // 체력·공격력의 무작위 편차(±). 체력은 100 단위, 공격력은 정수로 맞춘다
  atk0: 9, atkG: 1.09,       // 첫 무한 보스 공격력(맞을 때 깎이는 산소 초), 보스마다 곱해지는 비율
  gap: 12,                   // 다음 보스까지의 행성 수
  r0: 56, r1: 90, rk: 7, rv: 10, rmax: 100   // 보스 반지름: 중심값이 r0 에서 r1 로 (1-e^(-n/rk)) 만큼 커지고 ±rv 만큼 흔들린다. 최소 46, 최대 rmax
};
export const EXCLUSIVE = ['rain', 'ripple', 'grid', 'sweep', 'snare'];
const COMMON = ['meteor', 'comet', 'beam', 'jet', 'flare', 'hole', 'collapse', 'wind'];
/** 카탈로그 약어와 실제 목록의 번호 범위(가중치) */
const CATALOGS = [['HD', 359083, 3], ['HIP', 118322, 3], ['HR', 9110, 1], ['GJ', 1291, 1], ['SAO', 258997, 1]];

/** 지금 판이 무한 모드(TON 618 격파 이후의 보스)인지 */
export const endlessNext = () => G.kills >= STAGES.length;
/** 클리어 뒤에 지난 행성 수에 비례하는 궤도 붕괴 배율 (클리어 전에는 1) */
export const endlessGrav = () => G.endHop == null ? 1 : Math.max(0, 1 - ENDLESS.grav * Math.max(0, G.hops - G.endHop));

function catalogName() {
  const tot = CATALOGS.reduce((a, c) => a + c[2], 0); let r = Math.random() * tot;
  for (const [ab, max, w] of CATALOGS) if ((r -= w) <= 0) return ab + ' ' + rint(1, max);
  return 'HD ' + rint(1, 359083);
}

/** n(0부터)번째 무한 보스를 만든다. BOSSES 항목과 같은 모양 + endless 표시 */
export function makeEndlessBoss(n) {
  const name = catalogName(), look = genLook();   // 외형은 기존 보스 그림을 쓰지 않고 boss-gen.js 가 부품을 조합해 그린다
  const own = shuffle(EXCLUSIVE.slice()).slice(0, 2), com = shuffle(COMMON.slice()).slice(0, 3);
  return {
    n: name, e: name, endless: n + 1, R: Math.round(clamp(ENDLESS.r0 + (ENDLESS.r1 - ENDLESS.r0) * (1 - Math.exp(-n / ENDLESS.rk)) + rnd(-ENDLESS.rv, ENDLESS.rv), 46, ENDLESS.rmax)), hue: look.pal.h, kind: 'gen', look,
    hp: Math.max(100, Math.round(ENDLESS.hp0 * Math.pow(ENDLESS.hpG, n) * dev() / 100) * 100), atk: Math.max(1, Math.round(ENDLESS.atk0 * Math.pow(ENDLESS.atkG, n) * dev())),
    pat: shuffle(own.concat(com)), q: n >= 4 ? 4 : 3, line: '이름만 남은 카탈로그의 별'
  };
}
