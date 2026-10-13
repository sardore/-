/* 별 조각 상점의 상품 목록. 값(가격·효과)은 전부 여기서 정한다.
 * 상품 {id, tab, slot, n, d, price, v}: tab 은 화면 탭(fx 이펙트 · ship 기체 · spec 초기 스펙), slot 은 같은 칸에는 하나만 장착, v 는 효과 값.
 * 색 값 v = {h 색상, s 채도(%)} 또는 {rb:1}(무지갯빛). 가격은 후반 유저용으로 비싸게, 저질 장식(색 한 가지)만 싸게 잡았다. */
import { SHIPS } from './ships.js';

export const TABS = [{ k: 'fx', n: '이펙트' }, { k: 'ship', n: '기체 색' }, { k: 'spec', n: '초기 스펙' }];

/** 칸(slot) 정의와 화면에 보이는 순서. note 는 칸 머리글 설명 */
export const SLOTS = [
  { k: 'glow',    tab: 'fx',   n: '기체 글로우',   note: '기체가 내는 빛의 세기' },
  { k: 'glowcol', tab: 'fx',   n: '글로우 색',     note: '글로우의 색. 기본은 기체 색' },
  { k: 'flame',   tab: 'fx',   n: '엔진 불꽃',     note: '엔진이 뿜는 불꽃의 색' },
  { k: 'trail',   tab: 'fx',   n: '꼬리 잔상',     note: '기체가 지나간 자리' },
  { k: 'land',    tab: 'fx',   n: '착지 링',       note: '행성에 붙을 때 번지는 링' },
  { k: 'charge',  tab: 'fx',   n: '충전 링 디자인', note: '돌진을 충전할 때 기체 둘레에 그려지는 링의 모양' },
  { k: 'chargecol', tab: 'fx', n: '충전 링 색',    note: '충전 링의 색. 기본은 기체 색' },
  { k: 'heat',    tab: 'fx',   n: '열기 불꽃',     note: '보스전에서 벽에 튕겨 쌓이는 불꽃' },
  { k: 'starfx',  tab: 'fx',   n: '별 파티클',     note: '별을 먹을 때 터지는 빛' },
  { k: 'paint',   tab: 'ship', n: '도색 (모든 기체)', note: '기체·꼬리·글로우의 기본 색을 바꾼다' }
];

const PAL = [ // 팔레트: [id, 이름, 색]
  ['white', '순백', { h: 0, s: 0 }], ['gold', '황금', { h: 46, s: 100 }], ['rose', '장미', { h: 340, s: 95 }], ['cyan', '청록', { h: 185, s: 100 }],
  ['lime', '라임', { h: 100, s: 95 }], ['violet', '보라', { h: 275, s: 95 }], ['ember', '불씨', { h: 16, s: 100 }], ['prism', '프리즘', { rb: 1 }]
];
/** 칸별 가격표 (팔레트 순서) */
const PRICES = {
  glowcol: [40, 50, 60, 60, 60, 60, 60, 1200],
  land:    [40, 50, 60, 60, 60, 60, 60, 900],
  chargecol: [40, 50, 60, 60, 60, 60, 60, 900],
  starfx:  [50, 70, 70, 70, 70, 70, 70, 1000],
  flame:   [350, 400, 250, 250, 250, 300, 200, 1000],
  trail:   [300, 400, 250, 250, 250, 300, 250, 1200],
  heat:    [400, 500, 350, 350, 350, 400, 300, 1500]
};

export const ITEMS = {};
export const LIST = [];   // 화면 순서
function add(it) { ITEMS[it.id] = it; LIST.push(it); }

/* 글로우 강도: lv 1 = 예전 기본 글로우(비행 20 · 평소 12). 기본(0)은 훨씬 약하다 */
export const GLOW_BLUR = [[4, 6], [12, 20], [19, 32], [29, 48]];   // [평소, 비행]
[['약', 400, '은은한 빛'], ['중', 900, '한층 더 환한 빛'], ['강', 1500, '맥동하는 후광까지']].forEach(([n, price, d], i) =>
  add({ id: 'glow' + (i + 1), tab: 'fx', slot: 'glow', n: '글로우 ' + n, d, price, v: { lv: i + 1 } }));

for (const slot of ['glowcol', 'flame', 'trail', 'land', 'chargecol', 'heat', 'starfx']) {
  const names = { glowcol: '글로우', flame: '불꽃', trail: '꼬리', land: '착지 링', chargecol: '충전 링', heat: '열기', starfx: '별빛' }[slot];
  PAL.forEach(([id, n, v], i) => add({ id: slot + '_' + id, tab: 'fx', slot, n: n + ' ' + names, d: v.rb ? '시간에 따라 색이 변한다' : '', price: PRICES[slot][i], v }));
}
add({ id: 'trail_dust', tab: 'fx', slot: 'trail', n: '별가루 꼬리', d: '반짝이는 별가루가 흩날린다', price: 1000, v: { style: 'dust' } });
add({ id: 'trail_ghost', tab: 'fx', slot: 'trail', n: '잔상 분신', d: '비행 중 기체의 잔상이 겹겹이 남는다', price: 1500, v: { style: 'ghost' } });

/* 충전 링 디자인: 그림은 charge-fx.js */
[['hex', '육각 응축', '돌며 오므라드는 육각형', 600], ['clock', '시계 눈금', '눈금이 차례로 켜진다', 700], ['sonar', '소나 파문', '바깥에서 안으로 파문이 모인다', 800],
  ['star', '별 문장', '돌며 모이는 오각별', 900], ['orbit', '위성 궤도', '점 여섯 개가 안쪽으로 감겨 든다', 900], ['rune', '룬 링', '반대로 도는 점선 이중 링', 1200], ['petals', '연꽃', '꽃잎이 오므라든다', 1200]]
  .forEach(([id, n, d, price]) => add({ id: 'charge_' + id, tab: 'fx', slot: 'charge', n: '충전 링: ' + n, d, price, v: { style: id } }));

/* 도색: 기체 색 한 가지 변경 (모든 기체 공용) */
[['crimson', '진홍', 6, 40], ['amber', '호박', 30, 50], ['emerald', '에메랄드', 140, 60], ['amethyst', '자수정', 275, 60], ['pink', '분홍', 330, 50], ['gold', '황금빛', 46, 500]]
  .forEach(([id, n, h, price]) => add({ id: 'paint_' + id, tab: 'ship', slot: 'paint', n: n + ' 도색', d: '', price, v: { h } }));

/* 기체별 전용 장식: 그 기체로 날 때만 보인다 (4단 기체). 그림·입자는 decor.js */
export const DECOR_LIST = [
  ['gol', '황금 동전 추진체', '엔진에서 황금 동전이 쏟아진다', 2500],
  ['dre', '용암 포신', '포구가 달아오르고 불씨가 흩날린다', 2000],
  ['jug', '용암 균열 장갑', '갈라진 장갑 틈으로 용암이 비친다', 1800],
  ['ph',  '유령 분신', '푸른 유령 분신이 따라붙는다', 2200],
  ['tem', '전기 폭풍', '선체를 따라 번개가 튄다', 2000],
  ['cit', '육각 방벽', '육각형 방벽이 천천히 돈다', 1800],
  ['aeg', '이지스 문장', '황금 문장과 이중 방패 고리', 2000],
  ['ark', '생체 발광', '초록 포자가 빛나며 떠다닌다', 1800],
  ['lei', '해류', '물결 고리와 물방울이 따라온다', 1800],
  ['ast', '별자리', '별자리가 기체 둘레를 돈다', 2200],
  ['wor', '웜홀 소용돌이', '보랏빛 소용돌이가 기체를 감싼다', 2400],
  ['gha', '은하 나선', '은하수가 소용돌이치며 흩어진다', 2400]
];
for (const [ship, n, d, price] of DECOR_LIST) add({ id: 'dc_' + ship, tab: 'ship', slot: 'decor_' + ship, n, d, price, ship, v: {} });
/** 장식 칸: 기체마다 하나씩 */
for (const [ship] of DECOR_LIST) SLOTS.push({ k: 'decor_' + ship, tab: 'ship', n: SHIPS[ship].n + ' 전용 장식', note: 'Lv4 ' + SHIPS[ship].n + '으로 날 때만 보인다' });

/* ---------- 초기 스펙 ----------
 * 영구 유지. 능력치마다 5단계, 단계당 +2%p(최대 +10%p). 점수 배율 항목은 없다 */
export const SPEC_STATS = [
  { k: 'spd', n: '속도', c: '#8affc8' }, { k: 'grav', n: '인력', c: '#7dd3ff' }, { k: 'o2', n: '산소', c: '#b8a8ff' }, { k: 'decay', n: '궤도', c: '#9dffb0' }
];
export const SPEC_STEP = 2;
export const SPEC_PRICE = [300, 600, 1200, 2400, 4800];
export const SHIELD_PRICE = 5000;
SPEC_STATS.forEach(s => add({ id: 'sp_' + s.k, tab: 'spec', slot: 'spec', n: s.n + ' 강화', d: '시작 능력치 +' + SPEC_STEP + '%p / 단계', spec: s.k, c: s.c }));
add({ id: 'sp_shield', tab: 'spec', slot: 'spec', n: '비상 추진기 +1', d: '시작할 때 추진기 1개 (최대 1개)', spec: 'shield', c: '#ff9d7a' });

/** 별 점수 중 별 조각으로 바뀌는 비율 */
export const SHARD_RATE = .2;
