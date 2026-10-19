/* 별 조각 상점의 상품 목록. 값(가격·효과)은 전부 여기서 정한다.
 * 상품 {id, tab, slot, n, d, price, v}: tab 은 화면 탭(fx 이펙트 · ship 기체 · spec 초기 스펙), slot 은 같은 칸에는 하나만 장착, v 는 효과 값.
 * 색은 전부 '페인트' 탭의 색 상품(slot 'pt')이다: 한 번 사면 기체·글로우·불꽃·꼬리·충전 링·열기·별빛 어디에든 칠할 수 있다(칠한 곳은 SHOP.eq 의 PAINT_TARGETS 칸).
 * 색 값 v = {h 색상, s 채도(%)} · {rb:1}(무지갯빛) · {duo:[[h,s],[h,s]]}(두 색이 비중을 바꾸며 함께 있는 그라데이션). */
import { SHIPS } from './ships.js';

export const TABS = [{ k: 'fx', n: '이펙트' }, { k: 'paint', n: '페인트' }, { k: 'ship', n: '기체 장식' }, { k: 'spec', n: '초기 스펙' }];

/** 페인트를 칠할 수 있는 부위. k 는 SHOP.eq 의 칸 이름 */
export const PAINT_TARGETS = [{ k: 'hull', n: '기체' }, { k: 'glowcol', n: '글로우' }, { k: 'flame', n: '불꽃' }, { k: 'trailcol', n: '꼬리' }, { k: 'chargecol', n: '충전' }, { k: 'heat', n: '열기' }, { k: 'starfx', n: '별빛' }];
export const TARGET_NAMES = Object.fromEntries(PAINT_TARGETS.map(t => [t.k, t.n]));

/** 칸(slot) 정의와 화면에 보이는 순서. note 는 칸 머리글 설명 */
export const SLOTS = [
  { k: 'glow',    tab: 'fx',   n: '기체 글로우',   note: '기체가 내는 빛의 세기. 색은 페인트 탭에서' },
  { k: 'trail',   tab: 'fx',   n: '꼬리 잔상',     note: '기체가 지나간 자리의 모양. 색은 페인트 탭에서' },
  { k: 'landshape', tab: 'fx', n: '착지 링 모양',  note: '행성에 붙을 때 번지는 링의 모양. 색은 기체 색' },
  { k: 'charge',  tab: 'fx',   n: '충전 링 디자인', note: '돌진을 충전할 때 기체 둘레에 그려지는 링의 모양. 색은 페인트 탭에서' },
];

/* 예전의 부품별 색 상품(글로우·불꽃·꼬리·충전 링·열기·별빛 × 8색)은 없어졌다. 가진 만큼 별 조각으로 돌려준다 (shop.js 가 불러올 때 처리) */
const OLD_PAL = ['white', 'gold', 'rose', 'cyan', 'lime', 'violet', 'ember', 'prism'];
const OLD_PRICES = {
  glowcol: [40, 50, 60, 60, 60, 60, 60, 1200], chargecol: [40, 50, 60, 60, 60, 60, 60, 900], starfx: [50, 70, 70, 70, 70, 70, 70, 1000],
  flame: [350, 400, 250, 250, 250, 300, 200, 1000], trail: [300, 400, 250, 250, 250, 300, 250, 1200], heat: [400, 500, 350, 350, 350, 400, 300, 1500]
};

export const ITEMS = {};
export const LIST = [];   // 화면 순서
function add(it) { ITEMS[it.id] = it; LIST.push(it); }

/* 글로우 강도: lv 1 = 예전 기본 글로우(비행 20 · 평소 12). 기본(0)은 훨씬 약하다 */
export const GLOW_BLUR = [[4, 6], [12, 20], [19, 32], [29, 48]];   // [평소, 비행]
[['약', 400, '은은한 빛'], ['중', 900, '한층 더 환한 빛'], ['강', 1500, '맥동하는 후광까지']].forEach(([n, price, d], i) =>
  add({ id: 'glow' + (i + 1), tab: 'fx', slot: 'glow', n: '글로우 ' + n, d, price, v: { lv: i + 1 } }));

add({ id: 'trail_dust', tab: 'fx', slot: 'trail', n: '별가루 꼬리', d: '반짝이는 별가루가 흩날린다', price: 1000, v: { style: 'dust' } });
add({ id: 'trail_ghost', tab: 'fx', slot: 'trail', n: '잔상 분신', d: '비행 중 기체의 잔상이 겹겹이 남는다', price: 1500, v: { style: 'ghost' } });

/* 충전 링 디자인: 그림은 charge-fx.js */
[['hex', '육각 응축', '돌며 오므라드는 육각형', 600], ['clock', '시계 눈금', '눈금이 차례로 켜진다', 700], ['sonar', '소나 파문', '바깥에서 안으로 파문이 모인다', 800],
  ['star', '별 문장', '돌며 모이는 오각별', 900], ['orbit', '위성 궤도', '점 여섯 개가 안쪽으로 감겨 든다', 900], ['rune', '룬 링', '반대로 도는 점선 이중 링', 1200], ['petals', '연꽃', '꽃잎이 오므라든다', 1200]]
  .forEach(([id, n, d, price]) => add({ id: 'charge_' + id, tab: 'fx', slot: 'charge', n: '충전 링: ' + n, d, price, v: { style: id } }));

/* 착지 링 모양: 그림은 land-fx.js */
[['hex', '육각', '육각형으로 번진다', 600], ['diamond', '마름모', '마름모로 번진다', 600], ['tri', '삼각', '삼각형으로 번진다', 700], ['cross', '십자 섬광', '네 갈래 십자로 번진다', 800],
  ['star', '오각별', '오각별로 번진다', 900], ['gear', '톱니', '톱니바퀴 모양으로 번진다', 1000], ['flower', '꽃잎', '여덟 꽃잎으로 번진다', 1200]]
  .forEach(([id, n, d, price]) => add({ id: 'landshape_' + id, tab: 'fx', slot: 'landshape', n: '착지 링: ' + n, d, price, v: { style: id } }));
/** 없어진 상품 → 돌려줄 별 조각. 예전 '착지 링 색'(land_*)과 부품별 색 상품 전부 */
export const LEGACY_REFUND = {};
OLD_PAL.forEach((id, i) => {
  LEGACY_REFUND['land_' + id] = [40, 50, 60, 60, 60, 60, 60, 900][i];
  for (const slot in OLD_PRICES) LEGACY_REFUND[slot + '_' + id] = OLD_PRICES[slot][i];
});
/** 예전 기체 도색 → 같은 색의 페인트 (돌려주지 않고 그대로 바꿔 준다) */
export const LEGACY_PAINT = { paint_crimson: 'pt_crimson', paint_amber: 'pt_amber', paint_emerald: 'pt_emerald', paint_amethyst: 'pt_violet', paint_pink: 'pt_rose', paint_gold: 'pt_gold' };

/* ---------- 페인트 ----------
 * 색 하나가 상품 하나. 한 번 사면 모든 부위(PAINT_TARGETS)에 칠할 수 있다. 부위마다 다른 색을 칠해도 된다.
 * 다색(duo): 두 색이 한 부위에 함께 있고, 두 색의 비중(cos.js 의 duoW)이 시간에 따라 천천히 오르내린다 — 한 색으로 바뀌어 버리지 않는다 */
const SOLID = [ // [id, 이름, 색상, 채도, 가격]
  ['white', '순백', 0, 0, 150], ['crimson', '진홍', 6, 100, 100], ['amber', '호박', 30, 100, 100], ['gold', '황금', 46, 100, 150], ['lime', '라임', 100, 95, 120],
  ['emerald', '에메랄드', 140, 100, 120], ['cyan', '청록', 185, 100, 120], ['sky', '하늘', 205, 100, 120], ['violet', '보라', 275, 95, 120], ['rose', '장미', 340, 95, 120]
];
const DUO = [ // [id, 이름, 설명, 색 A [색상, 채도], 색 B, 가격]
  ['ocean', '오션', '노랑과 하늘색이 함께 일렁인다', [50, 100], [195, 100], 800],
  ['sunset', '노을', '주황과 보라가 번갈아 짙어진다', [18, 100], [292, 85], 800],
  ['aurora', '오로라', '초록과 보랏빛이 겹쳐 흐른다', [150, 100], [268, 95], 900],
  ['fireice', '빙염', '붉은 불과 푸른 얼음이 맞선다', [8, 100], [195, 100], 900],
  ['neon', '네온', '핑크와 시안이 번쩍인다', [320, 100], [180, 100], 900],
  ['forest', '숲', '라임과 청록이 우거진다', [98, 95], [172, 95], 700],
  ['galaxy', '은하', '남색과 자홍이 소용돌이친다', [238, 95], [305, 95], 800],
  ['champagne', '샴페인', '황금빛과 순백이 어우러진다', [46, 100], [0, 0], 1000]
];
SOLID.forEach(([id, n, h, sat, price]) => add({ id: 'pt_' + id, tab: 'paint', slot: 'pt', grp: '단색', n, d: '', price, v: { h, s: sat } }));
add({ id: 'pt_prism', tab: 'paint', slot: 'pt', grp: '무지개', n: '프리즘', d: '무지갯빛으로 계속 변한다', price: 1500, v: { rb: 1 } });
DUO.forEach(([id, n, d, A, B, price]) => add({ id: 'pt_' + id, tab: 'paint', slot: 'pt', grp: '다색', n, d, price, v: { duo: [A, B] } }));
export const PAINT_GROUPS = [{ k: '단색', n: '단색 페인트', note: '한 번 사면 어느 부위에든 칠할 수 있다' }, { k: '다색', n: '다색 페인트 (그라데이션)', note: '두 색이 함께 있으면서 비중이 천천히 바뀐다' }, { k: '무지개', n: '무지개 페인트', note: '모든 색으로 계속 변한다' }];

/* 기체별 전용 장식: 그 기체로 날 때만 보인다 (4단 기체). 그림·입자는 decor.js */
const DECOR_LIST = [
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
