/* 블랙쉽 모드의 기체 트리(데이터만). ships.js 가 불러 SHIPS 에 등록한다(이 파일은 아무것도 import 하지 않는다).
 * 주색(main)·보조색(trim)은 하양·검정·갈색(황갈) 안에서 기체마다 다르고, Lv3 부터 포인트 색(acc 색상)이 불빛 몇 점으로 들어간다.
 * 모양은 기체마다 전부 다르다: 그림은 ops-ship-art.js 에 id 별로 따로 설계되어 있다
 * 튜플: [id, 단계, 이름, 설명, 색상(불꽃·글로우·꼬리: 검정·하양은 차가운 흰 푸른빛, 갈색은 따뜻한 호박빛으로 아주 옅게), 외형 look, 능력 증가량, 다음 기체들, 돌진 세기]
 * 능력치 이름은 일반 항해와 같다. 모든 Lv2 기체는 비상 추진기를 하나 갖고, Lv3 부터 수송 능력(포로를 구출해 데려간다)을 가진다 */
export const OPS_SHIPS = [
  ['ob', 1, '스카우트', '평범한 정찰선', 200, { arrow: 1 }, {}, ['os', 'oh']],

  /* Lv2 */
  ['os', 2, '침투정', '빠르고 날카로운 잠입선', 205, { ops: 1, hull: 'needle', main: 'black', trim: 'white', engines: 2, fins: 1 }, { spd: 10, ram: 15, shield: 1 }, ['os1', 'os2']],
  ['oh', 2, '호송정', '느긋하고 튼튼한 짐배', 32, { ops: 1, hull: 'box', main: 'brown', trim: 'tan', engines: 2, crates: 1 }, { o2: 30, decay: 25, shield: 1 }, ['oh1', 'oh2']],

  /* Lv3 — 수송 능력 */
  ['os1', 3, '그림자', '기척 없이 지나가는 스텔스선', 205, { ops: 1, main: 'black', trim: 'brown', acc: 172 }, { spd: 14, grav: 15, ram: 10 }, ['os1a', 'os1b'], .6],
  ['os2', 3, '해방선', '갇힌 이들을 낚아채는 돌격선', 205, { ops: 1, main: 'white', trim: 'black', acc: 46 }, { ram: 35, decay: 10, shield: 1 }, ['os2a', 'os2b'], .5],
  ['oh1', 3, '구호선', '많이 싣고 오래 버티는 구조선', 200, { ops: 1, main: 'white', trim: 'tan', acc: 6 }, { o2: 50, mult: 15, shield: 1 }, ['oh1a', 'oh1b']],
  ['oh2', 3, '중수송함', '두꺼운 장갑의 화물선', 32, { ops: 1, main: 'brown', trim: 'black', acc: 34 }, { decay: 40, o2: 30, ram: 20 }, ['oh2a', 'oh2b']],

  /* Lv4 */
  ['os1a', 4, '유령선', '보이지 않는 가장 빠른 배', 200, { ops: 1, main: 'white', trim: 'black', acc: 190 }, { spd: 14, grav: 20, mult: 20 }, [], 1],
  ['os1b', 4, '암살선', '한 번에 꿰뚫는 칼날', 205, { ops: 1, main: 'black', trim: 'brown', acc: 8 }, { ram: 50, spd: 8 }, [], .9],
  ['os2a', 4, '해방자', '쇠사슬을 끊는 금빛 돌격선', 200, { ops: 1, main: 'white', trim: 'tan', acc: 48 }, { ram: 30, shield: 1, grav: 25 }, [], .7],
  ['os2b', 4, '습격선', '무장한 쾌속 돌격선', 32, { ops: 1, main: 'brown', trim: 'black', acc: 18 }, { spd: 12, ram: 40 }, [], .9],
  ['oh1a', 4, '피난선', '모두를 태우는 하얀 방주', 200, { ops: 1, main: 'white', trim: 'tan', acc: 140 }, { o2: 60, shield: 1 }],
  ['oh1b', 4, '보급함', '산더미 같은 짐을 실은 배', 32, { ops: 1, main: 'tan', trim: 'white', acc: 44 }, { mult: 40, o2: 30, grav: 20 }],
  ['oh2a', 4, '철갑 수송함', '포탑까지 단 장갑 수송선', 205, { ops: 1, main: 'black', trim: 'brown', acc: 24 }, { decay: 40, ram: 30, shield: 1 }, [], 0, { n: 4, dmg: 9 }],
  ['oh2b', 4, '이동 요새', '움직이는 항구', 32, { ops: 1, main: 'brown', trim: 'tan', acc: 200 }, { shield: 2, o2: 40, decay: 15 }, [], 0, { n: 6, dmg: 10 }]
];
