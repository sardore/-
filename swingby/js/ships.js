/* 기체 테크트리. 능력치는 부모 기체에 더해지는 증가량(delta, 퍼센트포인트)으로 정의한다.
 * look: 외형 파라미터(ship-art.js), dash: 차지 돌격 세기(없으면 일반 기체) */
export const SHIPS = {};

function defShip(id, tier, name, desc, hue, look, delta, kids, dash) {
  SHIPS[id] = { id, t: tier, n: name, d: desc, L: Object.assign({ h: hue }, look), delta: delta || {}, kids: kids || [], dash: dash || 0 };
}

defShip('base', 1, '스카우트', '평범한 정찰선', 200, { arrow: 1 }, {}, ['str', 'cru', 'sur']);

/* Lv2 — 모든 루트가 비상 추진기를 하나씩 갖는다 */
defShip('str', 2, '요격기',   '속도·충돌 돌격형', 8,   { kind: 'dart', fins: 1, engines: 2 }, { spd: 8, ram: 25, shield: 1 }, ['brk', 'gal']);
defShip('cru', 2, '순양함',   '느긋한 장거리 튼튼형', 150, { kind: 'hull', engines: 2, plates: 1 }, { decay: 30, o2: 30, shield: 1 }, ['bul', 'tnk']);
defShip('sur', 2, '탐사선',   '넓은 포획 장거리 탐사', 55,  { kind: 'scout', panels: 1, dish: 1, engines: 1 }, { grav: 25, o2: 20, shield: 1 }, ['nav', 'har']);

/* Lv3 */
defShip('brk', 3, '파쇄함',   '충돌 극대화 중장갑', 8,   { kind: 'dart', fins: 2, engines: 2, cannons: 1, plates: 1 }, { ram: 45, decay: 15 }, ['dre', 'jug'], .5);
defShip('gal', 3, '질풍함',   '빠르고 넓은 쾌속함',   170, { kind: 'dart', fins: 2, engines: 3 }, { spd: 14, grav: 20 }, ['ph', 'tem'], .6);
defShip('bul', 3, '방벽함',   '추진기·안정 궤도 수비형', 150, { kind: 'hull', engines: 2, plates: 2, pods: 1 }, { shield: 1, decay: 40 }, ['cit', 'aeg']);
defShip('tnk', 3, '보급함',   '산소 가득 장거리선',   120, { kind: 'hull', engines: 3, pods: 1, plates: 1 }, { o2: 60, decay: 25 }, ['ark', 'lei']);
defShip('nav', 3, '항해선',   '추진기를 하나 더 쥔 넓은 포획',     55,  { kind: 'scout', panels: 1, dish: 1, engines: 2, fins: 1 }, { grav: 20, mult: 15, shield: 1 }, ['ast', 'wor']);
defShip('har', 3, '수확선',   '별을 쓸어 담는 수집형', 42,  { kind: 'scout', panels: 1, pods: 1, engines: 2 }, { grav: 45, mult: 40 }, ['gha', 'gol']);

/* Lv4 */
defShip('dre', 4, '드레드노트', '모든 것을 들이받는 전함', 2,   { kind: 'dart', fins: 2, engines: 3, cannons: 2, plates: 2, spike: 1, pods: 1 }, { ram: 50, shield: 1 }, [], .9);
defShip('jug', 4, '저거너트',   '충돌에 튼튼한 거함',   22,  { kind: 'hull', fins: 1, engines: 3, plates: 3, spike: 1, pods: 1 }, { ram: 30, decay: 40, o2: 25 }, [], .7);
defShip('ph',  4, '팬텀',       '가장 빠른 유령선',       268, { kind: 'dart', fins: 3, engines: 3, halo: 1 }, { spd: 12, ram: 20, grav: 20 }, [], 1.1);
defShip('tem', 4, '템페스트',   '속도로 때리는 폭풍',     195, { kind: 'dart', fins: 3, engines: 4, cannons: 2, plates: 1 }, { spd: 10, ram: 50 }, [], 1);
defShip('cit', 4, '요새함',     '추진기 겹겹이 요새',     150, { kind: 'hull', engines: 3, plates: 3, pods: 2, cannons: 2 }, { shield: 2, decay: 15 });
defShip('aeg', 4, '이지스',     '방패와 넓은 포획',       178, { kind: 'hull', engines: 3, plates: 2, pods: 1, ring: 1 }, { shield: 1, grav: 50 });
defShip('ark', 4, '방주',       '산소 가득 거대 생존선',  112, { kind: 'hull', engines: 4, pods: 2, plates: 2, ring: 1 }, { o2: 60, shield: 1 });
defShip('lei', 4, '대양선',     '산소·속도·점수 두루',    202, { kind: 'hull', fins: 1, engines: 3, pods: 2, panels: 1 }, { o2: 50, spd: 10, mult: 40 });
defShip('ast', 4, '성도선',     '압도적 포획 범위',       45,  { kind: 'scout', panels: 1, dish: 1, engines: 2, ring: 1, drones: 2 }, { grav: 60, o2: 20 });
defShip('wor', 4, '웜홀선',     '포획·속도·점수',         285, { kind: 'scout', panels: 1, dish: 1, engines: 3, fins: 2, halo: 1 }, { grav: 30, spd: 12, mult: 30 }, [], .6);
defShip('gha', 4, '은하 수확선', '별을 끌어모으는 수집선',   35,  { kind: 'scout', panels: 1, pods: 2, engines: 3, drones: 3 }, { grav: 40, mult: 25, o2: 25 });
defShip('gol', 4, '황금 상선',  '점수 배율 극대화',       46,  { kind: 'hull', panels: 1, pods: 2, engines: 3, plates: 2, ring: 1 }, { mult: 75, shield: 1 });

/* 디버그판(?debug) 전용: 진화 트리에 속하지 않는다. 능력치를 상한 근처까지 올린 기체 */
defShip('dbg', 4, '디버그함', '테스트 전용 초고스펙', 48, { kind: 'dart', fins: 3, engines: 4, cannons: 2, plates: 2, spike: 1, halo: 1, ring: 1, drones: 3 }, { spd: 30, ram: 300, grav: 200, decay: 220, o2: 200, mult: 300, shield: 9 }, [], 1);

/** 현재 능력치에 이 기체의 증가량을 더한 결과(새 객체) */
export function statsAfter(stats, def) {
  const out = Object.assign({}, stats);
  for (const k in def.delta) out[k] = (out[k] || 0) + def.delta[k];
  return out;
}
