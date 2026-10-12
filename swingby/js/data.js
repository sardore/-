/* 정적 데이터: 능력치 정의, 업그레이드 카드, 보스, 공격 패턴, 스테이지, 바이옴 */

/* ---------- 능력치 ----------
 * 모든 능력치는 퍼센트이며 100% = Lv1 기본 기체. 추진기(shield)만 개수. */
export const STATS = [ // 레이더 차트 축 순서
  { k: 'spd',   n: '속도',   c: '#8affc8' },
  { k: 'ram',   n: '박치기', c: '#ff6a6a' },
  { k: 'grav',  n: '포획',   c: '#7dd3ff' },
  { k: 'decay', n: '궤도',   c: '#9dffb0' },
  { k: 'o2',    n: '산소',   c: '#b8a8ff' },
  { k: 'mag',   n: '자석',   c: '#ffe27a' },
  { k: 'mult',  n: '점수',   c: '#ff8fd0' }
];
export const SHIELD = { k: 'shield', n: '추진기', c: '#ff9d7a' };
export const STAT_INFO = Object.fromEntries(STATS.concat([SHIELD]).map(s => [s.k, s]));
export const baseStats = () => ({ spd: 100, ram: 100, grav: 100, decay: 100, o2: 100, mag: 100, mult: 100, shield: 0 });

/** 업그레이드 카드(4단 진화 이후). step 은 퍼센트포인트, cap 은 상한 */
export const CARDS = [
  { k: 'spd',   n: '추력 증강',   d: '비행·궤도 속도',     step: 5,  cap: 160 },
  { k: 'ram',   n: '박치기 강화', d: '보스 충돌 피해',     step: 12, cap: 400 },
  { k: 'grav',  n: '중력 증폭',   d: '행성 포획 범위',     step: 10, cap: 300 },
  { k: 'decay', n: '안정 궤도',   d: '궤도가 천천히 줄어듦', step: 12, cap: 320 },
  { k: 'o2',    n: '산소 탱크',   d: '비행 시간·보스전 산소', step: 12, cap: 300 },
  { k: 'mag',   n: '별 자석',     d: '별 수집 범위',       step: 15, cap: 400 },
  { k: 'mult',  n: '항해 일지',   d: '모든 점수',          step: 10, cap: 400 },
  { k: 'shield', n: '비상 추진기', d: '사망 1회 방지',      step: 1,  cap: 9 }
];

/* ---------- 보스 ----------
 * kind: 그리는 방식, pat: 쓰는 패턴, q: 동시에 예고해 두는 공격 수, atk: 한 번 맞을 때 깎이는 산소(초) */
export const BOSSES = [
  { n: '프록시마 센타우리', e: 'PROXIMA CENTAURI', R: 44, hp: 120,  atk: 6,    hue: 10,  kind: 'dwarf', col: ['#ffd9a8', '#ff7a3a', '#8a2208'], pat: ['flare', 'meteor'], q: 1, line: '가장 가까운 이웃 별' },
  { n: '시리우스',         e: 'SIRIUS',           R: 44, hp: 170,  atk: 6.5,  hue: 205, kind: 'spike', col: ['#ffffff', '#9fd8ff', '#2a62b8'], pat: ['beam', 'comet', 'flare'], q: 2, line: '밤하늘에서 가장 밝은 별' },
  { n: '베가',             e: 'VEGA',             R: 47, hp: 220,  atk: 6,    hue: 218, kind: 'ring',  col: ['#ffffff', '#b4c8ff', '#4660c8'], pat: ['comet', 'wind', 'collapse', 'beam'], q: 2, line: '빠르게 자전하는 푸른 별' },
  { n: '알데바란',         e: 'ALDEBARAN',        R: 55, hp: 320,  atk: 7.5,  hue: 28,  kind: 'giant', col: ['#ffe0a0', '#ff9a3a', '#a04a10'], pat: ['meteor', 'hole', 'collapse', 'flare'], q: 2, line: '황소의 눈, 늙은 거성' },
  { n: '안타레스',         e: 'ANTARES',          R: 59, hp: 520,  atk: 8.5,  hue: 2,   kind: 'pulse', col: ['#ffc0a0', '#e83a2a', '#6a0a10'], pat: ['beam', 'collapse', 'flare', 'hole', 'meteor'], q: 3, line: '전갈의 심장, 맥동하는 적색 초거성' },
  { n: '베텔게우스',       e: 'BETELGEUSE',       R: 63, hp: 680,  atk: 9,    hue: 16,  kind: 'super', col: ['#ffd0a0', '#ff6a2a', '#7a1608'], pat: ['meteor', 'comet', 'hole', 'collapse', 'beam', 'wind', 'flare'], q: 3, line: '곧 폭발할 초거성' },
  { n: 'TON 618',          e: 'TON 618',          R: 53, hp: 1100, atk: 10.5, hue: 275, kind: 'quasar', col: ['#000', '#05030a', '#000'], pat: ['hole', 'beam', 'jet', 'collapse', 'meteor', 'comet', 'flare', 'wind'], q: 3, line: '태양 660억 개의 질량, 우주의 끝' }
];
/** 스테이지마다 만날 수 있는 보스(BOSSES 인덱스). 2개면 갈림길에서 고른다 */
export const STAGES = [[0], [1, 2], [3, 4], [5], [6]];
export const LAST_STAGE = STAGES.length - 1;

/* 공격 패턴: n 짧은 이름, c 색, cast 시전 문구, pow 피해 배율(보스 atk 에 곱한다) */
export const ATK = {
  meteor:   { n: '운석',     c: '#ffb06a', cast: '운석 낙하',      pow: 1 },
  comet:    { n: '혜성군',   c: '#9fe8ff', cast: '혜성군 폭격',    pow: .8 },
  beam:     { n: '부채꼴',   c: '#ff6a8a', cast: '부채꼴 광선',    pow: 1.2 },
  jet:      { n: '쌍제트',   c: '#c89aff', cast: '상대론적 제트',  pow: 1.25 },
  flare:    { n: '플레어',   c: '#ffe27a', cast: '플레어 폭발',    pow: 1.3 },
  hole:     { n: '블랙홀',   c: '#c88aff', cast: '흡수 블랙홀',    pow: .9 },
  collapse: { n: '행성 붕괴', c: '#ff7a6a', cast: '행성 붕괴',      pow: 1.1 },
  wind:     { n: '항성풍',   c: '#8affc8', cast: '항성풍',         pow: 0 }
};

/* ---------- 행성 종류 ----------
 * dec: 궤도 붕괴 속도 배율 (n 일반 · r 적색왜성 · g 가스행성 · a 소행성 · m 거대 암석행성) */
export const PLANET_DEC = { n: 1, r: 2.2, g: .5, a: 1.7, m: .08 };

/* ---------- 바이옴: 갈림길 이후 다음 보스까지의 행성 스타일 ---------- */
export const BIOMES = {
  normal:  { n: '일반',      c: '#9fb4ff', hue: 230, sc: 1 },
  belt:    { n: '소행성대',  c: '#e0a878', hue: 28,  sc: 1.25 },
  nebula:  { n: '가스 성운', c: '#b68aff', hue: 268, sc: .8 },
  redzone: { n: '적색 지대', c: '#ff7a6a', hue: 4,   sc: 1.4 },
  void:    { n: '공허대',    c: '#8a8aff', hue: 248, sc: 1.5 }
};
