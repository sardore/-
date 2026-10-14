/* 블랙쉽 모드(첩보 작전)의 정적 데이터: 규칙 상수, 지역(바이옴), 적 함선 보스, 전용 공격 패턴, 행성 종류.
 * 규칙은 ops.js, 기체 트리는 ops-ships.js, 그림은 ops-*-art.js. 이 파일은 아무것도 import 하지 않는다(data.js 가 합쳐 쓴다). */

export const OPS = {
  ticketOn: false, ticket: 150,   // 티켓 판매: 내부 기능만 있고 지금은 꺼 둔다(켜면 모드에 들어갈 때 별 조각 ticket 개를 받는다)
  first: 14, gap: 22,             // 첫 보스까지 · 보스 사이의 행성 수 (일반 항해의 14보다 길다)
    bayTier: 3,                     // 이 단계부터 수송 능력(포로 구출)을 가진다
  maxFollowers: 3,                // 한 번에 따라다닐 수 있는 함선 수. 보스 하나당 한 척뿐이라(두 번째 보스부터) 가득 차면 가진 함선을 한 단계 올려 준다
  rescueMul: { 1: .08, 2: .12, 3: .18 },   // 함께 있는 함선 한 척당 점수 배율 증가(그 함선의 단계별). 셋이 다 Lv3 여도 ×1.54
  clearBonus: 100, clearPer: 20,  // 클리어 보상 별 조각: 기본 + 구출한 함선당
  hangarPeriod: 8.5, hangarWarn: 1.9, hangarMax: 3   // 출격 갑판: 내보내는 주기(초) · 예고 시간 · 동시에 떠 있을 수 있는 소형함 수
};

/** 시작 기체(스카우트)의 id — 기체 트리의 뿌리 */
export const OPS_ROOT = 'ob';
/** 동행 함선들이 주는 점수 배율 증가분의 합(함선 entry 는 단계 t 를 가진다) */
export const fleetBonus = fol => fol.reduce((a, f) => a + (OPS.rescueMul[f.t] || 0), 0);

/** 격파 수 → 이 단계까지 올라가 있어야 한다. 처음 기체는 스카우트(Lv1)이고 진화는 보스를 쓰러뜨렸을 때만 준다(보급 부두 포함, 단계가 모자랄 때) */
export const opsTarget = kills => Math.min(4, kills + 1);   // 보스를 쓰러뜨릴 때마다 한 단계씩(Lv4 가 되면 그 뒤로는 강화 카드)

/* ---------- 지역: 보스 사이 구간마다 분위기가 다르다 ----------
 * ops: 갈림길(fork.js)이 무작위로 뽑지 않게 하는 표시 · mix: 행성 종류 비율 · mook: 소형 적함이 길목에 나올 확률 · kinds: 나오는 종류의 가중치 · chaser: 맵 뒤를 따라붙는 추적정이 나오는 지역
 * wall: 행성 사이에 놓이는 부서지는 벽(ops-walls.js)의 확률과 모양. null 이면 이 지역엔 벽이 없다 */
const L = (sky0, sky1, haze, cl, dust, vig) => ({ sky: [sky0, sky1], haze, cl, dust, vig });
export const OPS_BIOMES = {
  o1: { n: '야간 정찰로', c: '#d8c48a', hue: 40, sc: 1, ph: [190, 230], wall: null, ops: true, mook: 0, mix: { n: .62, s: .2, h: .18 },
        look: L('#03060e', '#0a1320', [205, 40, 28], .06, ['#ffd9a0', 1.1, .5], ['#000000', .45]) },
  o2: { n: '안개 해협', c: '#8fc0b8', hue: 175, sc: 1, ph: [165, 200], wall: { p: .35, kind: 'plate' }, ops: true, mook: .25, kinds: { drone: .6, gunboat: .4 }, mix: { n: .45, s: .15, l: .2, g: .2 },
        look: L('#091216', '#16262a', [175, 35, 36], .3, ['#cfe3e0', 1.2, 1], ['#05161a', .4]) },
  o3: { n: '폐함 묘지', c: '#b98a5a', hue: 28, sc: 1.05, ph: [20, 45], wall: { p: .6, kind: 'wreck' }, ops: true, mook: .3, kinds: { drone: .4, gunboat: .35, repeller: .25 }, mix: { n: .35, a: .22, d: .15, s: .28 },
        look: L('#120b06', '#2a1b10', [28, 45, 28], .14, ['#c9a27a', 1.8, -1], ['#2a1400', .45]) },
  o4: { n: '전파 폭풍', c: '#a98ad0', hue: 275, sc: 1.1, ph: [250, 290], wall: null, ops: true, mook: .3, kinds: { drone: .22, gunboat: .28, repeller: .28, barrage: .22 }, chaser: true, mix: { n: .35, s: .3, h: .35 },
        look: L('#0a0614', '#1a0d2a', [285, 40, 32], .2, ['#b8ffd8', 1.2, 0], ['#3a1a5a', .38]) },
  o5: { n: '열화상 구역', c: '#d97a6a', hue: 5, sc: 1.15, ph: [350, 380], wall: { p: .45, kind: 'slab' }, ops: true, mook: .32, kinds: { gunboat: .22, repeller: .2, barrage: .2, charger: .38 }, chaser: true, mix: { n: .3, r: .25, d: .2, l: .25 },
        look: L('#130408', '#2a0a0e', [350, 50, 30], .18, ['#ff9a70', 1.2, 2.5], ['#5a0a0a', .4]) },
  o6: { n: '수용 구역', c: '#9ab8d8', hue: 210, sc: 1.2, ph: [200, 225], wall: { p: .65, kind: 'bars' }, ops: true, mook: .32, kinds: { gunboat: .18, repeller: .22, barrage: .25, charger: .35 }, chaser: true, mix: { n: .3, d: .3, l: .2, s: .2 },
        look: L('#060c14', '#101c2a', [210, 35, 36], .1, ['#d8e8ff', .9, 0], ['#000a1a', .55]) },
  o7: { n: '요새 접근로', c: '#c8c8f0', hue: 240, sc: 1.3, ph: [225, 260], wall: { p: .55, kind: 'barricade' }, ops: true, mook: .34, kinds: { gunboat: .15, repeller: .25, barrage: .25, charger: .35 }, chaser: true, mix: { n: .28, l: .3, s: .2, h: .22 },
        look: L('#02030a', '#0a0a24', [235, 45, 24], .12, ['#ffffff', .9, .5], ['#000000', .6]) },
  o8: { n: '사령 성역', c: '#e0b860', hue: 42, sc: 1.4, ph: [35, 55], wall: null, ops: true, mook: .34, kinds: { repeller: .25, barrage: .3, charger: .45 }, chaser: true, mix: { n: .28, d: .3, s: .2, l: .22 },
        look: L('#0a0703', '#1c1304', [42, 70, 32], .2, ['#ffd870', 1.4, 1.2], ['#3a2400', .5]) }
};
/** 보스 순서대로의 지역(보스 앞 구간의 지역) */
export const OPS_ZONES = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8'];

/** 행성 종류별 궤도 붕괴 배율: s 중계기지 · d 보관고 · h 홀로그램 위성 · l 탐조등 위성 · k 출격 갑판(거대) · v 보급 부두(거대) */
export const OPS_DEC = { s: .8, d: 1, h: 1.1, l: .9, k: .35, v: .35 };
export const OPS_PLANET_TYPES = 'sdhlkv';

/* ---------- 적 함선 보스 ----------
 * 몸체는 검정·회색의 거대한 철갑이고, 주포 둘레만 위협적인 붉은색·보라색으로 빛난다(hue 는 그 빛의 색상)
 * ship: 그리는 함선(ops-boss-art.js) · cap: 갇힌 아군 함선 수(수송 능력이 있어야 구출한다. 두 번째 보스부터 한 척씩). 별이 아니라 함선이라 항성 패턴 대신 전용 패턴을 쓴다 */
export const OPS_BOSSES = [
  { n: '감시정 아르거스',   e: 'ARGUS',       ship: 'argus',      R: 58, hp: 90,  atk: 4,  hue: 355, kind: 'ship', pat: ['sniper', 'scan'], q: 1, cap: 0, line: '국경 너머를 훑는 감시정' },
  { n: '순찰함 센트리',     e: 'SENTRY',      ship: 'sentry',     R: 66, hp: 170, atk: 6,  hue: 8,  kind: 'ship', pat: ['curtain', 'turret', 'lockon'], q: 2, cap: 1, line: '포탑이 달린 방벽형 순찰함' },
  { n: '호송함 홀러',       e: 'HAULER',      ship: 'hauler',     R: 76, hp: 260, atk: 6,  hue: 350,  kind: 'ship', pat: ['mines', 'crate', 'curtain'], q: 2, cap: 1, line: '포로를 컨테이너에 싣고 가는 호송함' },
  { n: '교란함 스태틱',     e: 'STATIC',      ship: 'static',     R: 84, hp: 340, atk: 7,  hue: 280, kind: 'ship', pat: ['shockwave', 'arc', 'mines'], q: 2, cap: 1, line: '신호를 찢어 놓는 전자전함' },
  { n: '추격함 하운드',     e: 'HOUND',       ship: 'hound',      R: 84, hp: 430, atk: 8,  hue: 0,   kind: 'ship', pat: ['vform', 'homing', 'lockon', 'curtain'], q: 3, cap: 1, line: '한 번 문 표적은 놓치지 않는다' },
  { n: '수용선 오블리엣',   e: 'OUBLIETTE',   ship: 'oubliette',  R: 96, hp: 560, atk: 8,  hue: 295,  kind: 'ship', pat: ['mines', 'shockwave', 'dump', 'sniper'], q: 3, cap: 1, line: '잊혀진 이들을 가두는 감옥선' },
  { n: '레일 순양함 랜서',  e: 'LANCER',      ship: 'lancer',     R: 100, hp: 700, atk: 9,  hue: 322, kind: 'ship', pat: ['railgun', 'ricochet', 'vform'], q: 3, cap: 1, line: '함체를 가로지르는 거대한 레일건' },
  { n: '기함 파놉티콘',     e: 'PANOPTICON',  ship: 'panopticon', R: 114, hp: 960, atk: 10, hue: 272,  kind: 'ship', pat: ['sniper', 'lockon', 'railgun', 'shockwave', 'cage', 'vform'], q: 3, cap: 1, line: '모든 항로를 내려다보는 사령 기함' }
];

/** 마지막 보스(기함)가 터진 뒤 남는 '핵 응축선': 작은 핵에서 두 갈래 가지가 뻗고, 가지 끝에서 느리게 도는 광선이 계속 이어진다. 이것까지 부숴야 클리어 */
export const OPS_CORE = { n: '핵 응축선', e: 'CORE', ship: 'core', R: 52, hp: 320, atk: 10, hue: 38, kind: 'ship', pat: [], q: -9, line: '꺼지지 않는 핵', spd: .3, half: .05 };

/* ---------- 함선 전용 공격 패턴 (ATK 에 합쳐진다. 존 구성은 ops-zones.js) ---------- */
export const OPS_ATK = {
  sniper:   { n: '저격',     c: '#ff8a6a', cast: '저격 조준',      pow: 1.3 },
  lockon:   { n: '일제 사격', c: '#ffb04a', cast: '표적 일제 사격', pow: 1 },
  railgun:  { n: '레일건',   c: '#9fe8ff', cast: '레일건 사격',    pow: 1.4 },
  shockwave: { n: '충격파',   c: '#ffe9a0', cast: '충격파 방출',    pow: 1.1 },
  mines:    { n: '기뢰',     c: '#8aff9a', cast: '기뢰 살포',      pow: .9 },
  curtain:  { n: '차단막',   c: '#ff7ac8', cast: '탄막 차단',      pow: 1 },
  vform:    { n: '편대 급습', c: '#a8b8ff', cast: '편대 급습',      pow: 1.1 },
  scan:     { n: '탐조', c: '#ffe9a0', cast: '탐조 추적', pow: .3 },   // 아레나 전체를 훑지만 위로 올라가 튕겨 나오면 되니 피해는 아주 낮다
  turret:   { n: '포대', c: '#ff9a5a', cast: '포대 전개', pow: 1 },
  crate:    { n: '컨테이너', c: '#e0b080', cast: '컨테이너 투하', pow: 1.1 },
  arc:      { n: '방전', c: '#b8a0ff', cast: '연쇄 방전', pow: 1.1 },
  homing:   { n: '추격탄', c: '#ff7a6a', cast: '추격탄 발사', pow: 1 },
  ricochet: { n: '반사', c: '#9fe8ff', cast: '반사 레일 사격', pow: 1.3 },
  cage:     { n: '봉쇄', c: '#ff7ac8', cast: '수감 봉쇄', pow: 1.2 },
  dump:     { n: '무단 투하', c: '#ffc27a', cast: '무단 투하',      pow: 1.2 }   // 존이 아니라 쓰레기 더미가 쏟아진다(ops-walls.js 의 spawnJunk). 보스전에 쓰레기가 나오는 유일한 경우
};
