/* 정적 데이터: 능력치 정의, 업그레이드 카드, 보스, 공격 패턴, 스테이지, 바이옴 */

/* ---------- 능력치 ----------
 * 모든 능력치는 퍼센트이며 100% = Lv1 기본 기체. 추진기(shield)만 개수. */
export const STATS = [ // 레이더 차트 축 순서
  { k: 'spd',   n: '속도',   c: '#8affc8' },
  { k: 'ram',   n: '충돌', c: '#ff6a6a' },
  { k: 'grav',  n: '인력',   c: '#7dd3ff' },
  { k: 'decay', n: '궤도',   c: '#9dffb0' },
  { k: 'o2',    n: '산소',   c: '#b8a8ff' },
  { k: 'mult',  n: '점수',   c: '#ff8fd0' }
];
export const SHIELD = { k: 'shield', n: '추진기', c: '#ff9d7a' };
export const STAT_INFO = Object.fromEntries(STATS.concat([SHIELD]).map(s => [s.k, s]));
export const baseStats = () => ({ spd: 100, ram: 100, grav: 100, decay: 100, o2: 100, mult: 100, shield: 0 });

/** 업그레이드 카드(4단 진화 이후). step 은 퍼센트포인트, cap 은 상한 */
export const CARDS = [
  { k: 'spd',   n: '추력 증강',   d: '비행 속도',     step: 5,  cap: 160 },
  { k: 'ram',   n: '충돌 강화', d: '보스 충돌 피해',     step: 12, cap: 400 },
  { k: 'grav',  n: '중력 증폭',   d: '행성 포획·별 수집 범위', step: 10, cap: 300 },
  { k: 'decay', n: '안정 궤도',   d: '궤도가 천천히 줄어듦', step: 12, cap: 320 },
  { k: 'o2',    n: '산소 탱크',   d: '비행 시간·보스전 산소', step: 12, cap: 300 },
  { k: 'mult',  n: '항해 일지',   d: '모든 점수',          step: 10, cap: 400 },
  { k: 'shield', n: '비상 추진기', d: '사망 1회 방지',      step: 1,  cap: 9 }
];

/** 보스를 쓰러뜨릴 때마다 점수 배율이 20%씩 복리로 오른다 (화면에는 표시하지 않는다) */
export const BOSS_MUL = 1.2;

/* ---------- 보스 ----------
 * kind: 그리는 방식, pat: 쓰는 패턴, q: 동시에 예고해 두는 공격 수, atk: 한 번 맞을 때 깎이는 산소(초) */
export const BOSSES = [
  { n: '프록시마 센타우리', e: 'PROXIMA CENTAURI', R: 44, hp: 120,  atk: 6,    hue: 10,  kind: 'dwarf', col: ['#ffd9a8', '#ff7a3a', '#8a2208'], pat: ['flare', 'meteor'], q: 1, line: '가장 가까운 이웃 별' },
  { n: '시리우스',         e: 'SIRIUS',           R: 44, hp: 170,  atk: 6.5,  hue: 205, kind: 'spike', col: ['#ffffff', '#9fd8ff', '#2a62b8'], pat: ['beam', 'comet', 'cross'], q: 2, line: '밤하늘에서 가장 밝은 별' },
  { n: '베가',             e: 'VEGA',             R: 47, hp: 220,  atk: 6,    hue: 218, kind: 'ring',  col: ['#ffffff', '#b4c8ff', '#4660c8'], pat: ['comet', 'collapse', 'spokes'], q: 2, line: '빠르게 자전하는 푸른 별' },
  { n: '알데바란',         e: 'ALDEBARAN',        R: 55, hp: 320,  atk: 7.5,  hue: 28,  kind: 'bull', col: ['#ffe0a0', '#ff9a3a', '#a04a10'], pat: ['collapse', 'flare', 'quake'], q: 2, line: '황소의 눈, 늙은 거성' },
  { n: '안타레스',         e: 'ANTARES',          R: 59, hp: 520,  atk: 8.5,  hue: 2,   kind: 'pulse', col: ['#ffc0a0', '#e83a2a', '#6a0a10'], pat: ['beam', 'collapse', 'meteor', 'pulse'], q: 3, line: '전갈의 심장, 맥동하는 적색 초거성' },
  { n: '베텔게우스',       e: 'BETELGEUSE',       R: 63, hp: 680,  atk: 9,    hue: 16,  kind: 'super', col: ['#ffd0a0', '#ff6a2a', '#7a1608'], pat: ['meteor', 'collapse', 'beam', 'flare', 'nova'], q: 3, line: '곧 폭발할 초거성' },
  { n: 'TON 618',          e: 'TON 618',          R: 80, hp: 1100, atk: 11,   hue: 275, kind: 'quasar', col: ['#000', '#05030a', '#000'], pat: ['beam', 'jet', 'collapse', 'meteor', 'flare', 'sing'], q: 3, line: '태양 660억 개의 질량, 우주의 끝' }
,
  { n: '아크투루스',       e: 'ARCTURUS',         R: 50, hp: 270,  atk: 7,    hue: 40,  kind: 'swirl', col: ['#fff2c4', '#ffc23a', '#a86a10'], pat: ['beam', 'collapse', 'spiral'], q: 2, line: '목동자리의 주황빛 거성' },
  { n: '폴라리스',         e: 'POLARIS',          R: 42, hp: 240,  atk: 6.5,  hue: 52,  kind: 'twin',  col: ['#ffffff', '#fff2a0', '#b8a030'], pat: ['beam', 'hole', 'twin'], q: 2, line: '북극성, 동반성을 거느린 길잡이' },
  { n: '리겔',             e: 'RIGEL',            R: 58, hp: 560,  atk: 8.5,  hue: 222, kind: 'hex', col: ['#ffffff', '#a8c8ff', '#3050c8'], pat: ['comet', 'hole', 'jet', 'hex'], q: 3, line: '오리온의 발끝, 푸른 초거성' },
  { n: '에타 카리나',      e: 'ETA CARINAE',      R: 60, hp: 640,  atk: 10,   hue: 14,  kind: 'eta',   col: ['#ffd8b0', '#ff7a30', '#701808'], pat: ['collapse', 'hole', 'wind', 'beam', 'lobes'], q: 3, line: '언제 터질지 모르는 극대거성' },
  { n: '포식성 그롬',      e: 'GROM THE DEVOURER', R: 56, hp: 420,  atk: 8,    hue: 125, kind: 'devour', col: ['#d8ffb0', '#4fd84a', '#124a14'], pat: ['meteor', 'hole', 'collapse', 'pool'], q: 2, line: '독 행성들의 왕, 닥치는 대로 삼킨다' }
];
/** 스테이지마다 만날 수 있는 보스(BOSSES 인덱스). 2개면 갈림길에서 고른다. 한 판에 8스테이지 = 8종을 만난다.
 * 4번째(11)는 독 행성 지대의 도전 보스 — 갈림길 없이 지대를 지나 바로 만난다 */
export const STAGES = [[0], [1, 2], [7, 8], [11], [3, 4], [9], [5, 10], [6]];
/** 독 행성 지대: 이 스테이지(STAGES 인덱스)의 보스 앞에 반드시 나온다. len 은 지대를 지나는 행성 수 */
export const MONSTER_ZONE = { stage: 3, len: 12 };
/** 기체 진화에 필요한 누적 보스 격파 수 (현재 단계 → 격파 수). 후반 진화는 보스가 늘어난 만큼 늦다 */
export const EVOLVE_AT = { 2: 2, 3: 5 };
export const LAST_STAGE = STAGES.length - 1;

/* 공격 패턴: n 짧은 이름, c 색, cast 시전 문구, pow 피해 배율(보스 atk 에 곱한다), keep 발동 뒤 유지되는 턴 수(예고 지연 없이 바로 작동하는 지속형만) */
export const ATK = {
  meteor:   { n: '운석',     c: '#ffb06a', cast: '운석 낙하',      pow: 1 },
  comet:    { n: '혜성군',   c: '#9fe8ff', cast: '혜성군 폭격',    pow: .8 },
  beam:     { n: '부채꼴',   c: '#ff6a8a', cast: '부채꼴 광선',    pow: 1.2 },
  jet:      { n: '쌍제트',   c: '#c89aff', cast: '상대론적 제트',  pow: 1.25 },
  flare:    { n: '플레어',   c: '#ffe27a', cast: '플레어 폭발',    pow: 1.3 },
  hole:     { n: '블랙홀',   c: '#c88aff', cast: '흡수 블랙홀',    pow: .9, keep: 4 },
  collapse: { n: '행성 붕괴', c: '#ff7a6a', cast: '행성 붕괴',      pow: 1.1 },
  wind:     { n: '항성풍',   c: '#8affc8', cast: '항성풍',         pow: 0, keep: 4 },
  // 고유 패턴: 2번째 보스부터 보스마다 하나씩
  cross:    { n: '십자 섬광', c: '#9fe0ff', cast: '십자 섬광',      pow: 1.2 },   // 시리우스
  spokes:   { n: '방사 광선', c: '#8fb0ff', cast: '방사 광선',      pow: 1.1 },   // 베가
  spiral:   { n: '나선 폭발', c: '#ffc23a', cast: '나선 폭발',      pow: .9 },    // 아크투루스
  twin:     { n: '쌍성 폭격', c: '#fff2a0', cast: '쌍성 폭격',      pow: 1.1 },   // 폴라리스
  pool:     { n: '독 웅덩이', c: '#7dff7a', cast: '독 웅덩이',      pow: .8 },    // 포식성 그롬
  quake:    { n: '지축 균열', c: '#ff9a3a', cast: '지축 균열',      pow: 1.1 },   // 알데바란
  pulse:    { n: '맥동파',   c: '#ff5a4a', cast: '심장 맥동파',    pow: 1.2 },   // 안타레스
  hex:      { n: '육각 결정', c: '#7fa8ff', cast: '육각 결정',      pow: 1.1 },   // 리겔
  nova:     { n: '초신성',   c: '#ff7a2a', cast: '초신성 폭발',    pow: 1.5 },   // 베텔게우스
  lobes:    { n: '쌍엽 분출', c: '#ff8a50', cast: '쌍엽 분출',      pow: 1.3 },   // 에타 카리나
  sing:     { n: '특이점',   c: '#d070ff', cast: '특이점 붕괴',    pow: 1.2, keep: 5 },   // TON 618
  // 무한 모드(endless.js)의 카탈로그 보스 전용 패턴: 이 보스들이 둘씩 가지고 나온다
  rain:     { n: '별똥비',   c: '#8affd8', cast: '별똥비',         pow: 1 },
  ripple:   { n: '공명파',   c: '#ffd070', cast: '공명 파동',      pow: 1.1 },
  grid:     { n: '격자망',   c: '#ff8ae0', cast: '격자망',         pow: 1.15 },
  sweep:    { n: '소탕선',   c: '#ff9a5a', cast: '회전 소탕',      pow: 1.2 },
  snare:    { n: '올가미',   c: '#a0a8ff', cast: '중력 올가미',    pow: 1.1 },
  // 패턴 풀에는 없는 특수 공격: TON 618 체력이 1/3 이하가 된 다음 턴에 발동해 보스전이 끝날 때까지 지속
  horizon:  { n: '사건의 지평선', c: '#b070ff', cast: '사건의 지평선', pow: 0 }
};

/* ---------- 행성 종류 ----------
 * dec: 궤도 붕괴 속도 배율 (n 일반 · r 적색왜성 · g 가스행성 · a 소행성 · m 거대 암석행성) */
export const PLANET_DEC = { n: 1, r: 1.8, g: .5, a: 1.15, m: .08 };

/* ---------- 바이옴: 갈림길 이후 다음 보스까지의 행성 스타일과 배경 ----------
 * sc 점수 배율 · ph 일반 행성 색상(hue) 범위
 * look: sky 하늘 위/아래 색 · haze 구름 색(h,s,l) · cl 구름 세기 · dust 먼지(색, 크기, 떠오르는 속도) · vig 가장자리 어둠/색(색, 세기) */
export const BIOMES = {
  normal:  { n: '일반',      c: '#9fb4ff', hue: 230, sc: 1,    ph: [190, 320], look: { sky: ['#070818', '#0c0a1f'], haze: [230, 60, 45], cl: .05, dust: ['#cfd8ff', 1, 0],    vig: ['#000000', 0] } },
  belt:    { n: '소행성대',  c: '#e0a878', hue: 28,  sc: 1.25, ph: [18, 48],   look: { sky: ['#1c1006', '#3a230e'], haze: [30, 75, 46],  cl: .13, dust: ['#f0c690', 1.9, -1], vig: ['#4a2400', .4] } },
  nebula:  { n: '가스 성운', c: '#b68aff', hue: 268, sc: .8,   ph: [265, 325], look: { sky: ['#16063c', '#34105a'], haze: [305, 85, 52], cl: .3,  dust: ['#ecd0ff', 1.1, 1],  vig: ['#7a28b8', .35] } },
  redzone: { n: '적색 지대', c: '#ff7a6a', hue: 4,   sc: 1.4,  ph: [200, 330],  look: { sky: ['#2c0507', '#4c0b10'], haze: [4, 92, 48],   cl: .24, dust: ['#ffb070', 1.5, 3],  vig: ['#ff2a14', .38] } },
  monster: { n: '독 행성',  c: '#8dff7a', hue: 128, sc: 1.3,  ph: [180, 255], look: { sky: ['#031208', '#0a2614'], haze: [135, 70, 36], cl: .22, dust: ['#b8ff9a', 1.4, 1], vig: ['#22ff5a', .34] } },
  void:    { n: '공허대',    c: '#8a8aff', hue: 248, sc: 1.5,  ph: [222, 268], look: { sky: ['#010105', '#05031a'], haze: [255, 70, 32], cl: .14, dust: ['#8a8aff', .8, 0],   vig: ['#000000', .65] } }
};
