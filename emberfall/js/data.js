// EMBERFALL — 데이터: 지형, 지역, 몬스터, 유물, 이야기
export const T = { WALL: 0, FLOOR: 1, DOOR: 2, DOOROPEN: 3, LOCKED: 4, WATER: 5, DEEP: 6, LAVA: 7, CHASM: 8, BRIDGE: 9, RUBBLE: 10, WELL: 11, GROUND: 12 };
export const P = { NONE: 0, PILLAR: 1, STATUE: 2, SHELF: 3, BRAZIER: 4, BRAZIERLIT: 5, CAMP: 6, ALTAR: 7, CHEST: 8, GRAVE: 9, ANVIL: 10, FURNACE: 11, CART: 12, BARREL: 13, PEW: 14, TABLE: 15,
  STALAG: 16, ROOT: 17, CRYSTAL: 18, TORCH: 19, VENT: 20, SPIKE: 21, WEB: 22, BELL: 23, CANDLE: 24, FUNGUS: 25, BONES: 26, HOUSE: 27, LAMPPOST: 28, SIGN: 29, REMAINS: 30, CHEST_OPEN: 31, CAMPOUT: 32, MIRROR: 33, ORE: 34, NOTE: 35, TREE: 36, FENCE: 37, BED: 38, WELLPIT: 39 };
// 지나갈 수 없는 소품
export const BLOCK = new Set([P.PILLAR, P.STATUE, P.SHELF, P.BRAZIER, P.BRAZIERLIT, P.CAMP, P.ALTAR, P.CHEST, P.GRAVE, P.ANVIL, P.FURNACE, P.CART, P.BARREL, P.PEW, P.TABLE, P.STALAG, P.ROOT, P.CRYSTAL, P.BELL, P.HOUSE, P.LAMPPOST, P.SIGN, P.CHEST_OPEN, P.CAMPOUT, P.MIRROR, P.ORE, P.TREE, P.FENCE, P.BED, P.WELLPIT, P.TORCH]);
export const DECOR = { NONE: 0, CARPET: 1, RAIL: 2, MOSS: 3, BONES: 4, PUDDLE: 5, CRACK: 6, ASH: 7, PLANK: 8, GRASS: 9, PATH: 10 };

export const ZONES = [
  { id: 0, name: '폐광', en: 'THE OLD MINE', tint: [255, 190, 120], amb: 0.20, wall: ['#3a3430', '#4d443c', '#2a2522'], floor: ['#4a423a', '#3f3832'], accent: '#c8873a', drain: 0.45, boss: 'otol',
    intro: ['옛 광산. 광부들은 불의 노래를 따라 더 깊이 파 내려갔다.', '그리고 돌아오지 않았다.'] },
  { id: 1, name: '수몰 예배당', en: 'THE DROWNED CHAPEL', tint: [140, 190, 255], amb: 0.17, wall: ['#2c3a4a', '#3a4c5e', '#1f2b38'], floor: ['#34424f', '#2c3945'], accent: '#6ab0e8', drain: 0.5, boss: 'marga',
    intro: ['물이 불을 삼킨 곳.', '"끄는 자들"이 이곳에서 기도했다. 불꽃의 고통을 덜어 준다며.'] },
  { id: 2, name: '뿌리 도서관', en: 'THE ROOT ARCHIVE', tint: [170, 235, 150], amb: 0.17, wall: ['#2e3a2a', '#3d4d36', '#222b20'], floor: ['#3a4030', '#323828'], accent: '#8fd070', drain: 0.5, boss: 'isil',
    intro: ['마을을 세운 이들의 기록이 나무뿌리에 감겨 있다.', '읽는 순간 진실은 되돌릴 수 없다.'] },
  { id: 3, name: '사슬의 대장간', en: 'THE CHAIN FORGE', tint: [255, 130, 70], amb: 0.22, wall: ['#3d2a28', '#54382f', '#2a1c1a'], floor: ['#4a3430', '#3e2b28'], accent: '#ff7a3a', drain: 0.55, boss: 'borkai',
    intro: ['사슬을 벼린 곳.', '불을 가둔 것은 괴물이 아니라 사람의 손이었다.'] },
  { id: 4, name: '심장', en: 'THE HOLLOW HEART', tint: [190, 150, 255], amb: 0.09, wall: ['#231f33', '#30294a', '#17142a'], floor: ['#2d2842', '#26213a'], accent: '#a98aff', drain: 0.65, boss: 'hollow',
    intro: ['대화로의 심장.', '불이 꺼진 자리에서, 무언가 숨 쉬고 있다.'] },
];
export const FLOORS_PER_ZONE = 3; // 마지막 층은 보스
export const MAXFLOOR = ZONES.length * FLOORS_PER_ZONE;
export const zoneOf = d => Math.min(ZONES.length - 1, (d / FLOORS_PER_ZONE) | 0);
export const isBossFloor = d => d % FLOORS_PER_ZONE === FLOORS_PER_ZONE - 1;
export const floorName = d => `${ZONES[zoneOf(d)].name} ${(d % FLOORS_PER_ZONE) + 1}층`;

/* ---------- 몬스터 ----------
 ai: chase(추격) erratic(제멋대로) still(제자리) keep(거리 유지) water(물에서만) flee(빛을 피함)
 atk: melee1(즉시) slam(예고 후 내려침) line(직선 사격) burst(범위 폭발) charge(돌진) pull(끌어당김) summon blink none
 lightAverse: 빛 안에는 못 들어온다 */
const M = (id, name, hp, dmg, o = {}) => ({ id, name, hp, dmg, spd: 100, ai: 'chase', atk: 'melee1', range: 1, ash: 1, ember: 0.2, ...o });
export const MONSTERS = {
  rat:    M('rat', '굶주린 쥐', 2, 1, { spd: 200, ai: 'chase', ash: 1, group: [2, 4], sleep: 0.2 }),
  bat:    M('bat', '갱도 박쥐', 2, 1, { spd: 150, ai: 'erratic', fly: 1, ash: 1, ember: 0.1 }),
  grub:   M('grub', '바위벌레', 5, 2, { spd: 50, atk: 'slam', wind: 1, ash: 2 }),
  miner:  M('miner', '꺼진 광부', 6, 3, { atk: 'slam', wind: 1, ash: 3, desc: '불이 꺼진 눈. 곡괭이를 치켜든다.' }),
  bloat:  M('bloat', '가스 주머니', 3, 3, { spd: 60, ai: 'chase', atk: 'burst', wind: 2, rad: 1, fly: 1, ash: 2, desc: '부풀어 오르다 터진다.' }),
  drowned:M('drowned', '익사자', 8, 3, { spd: 70, atk: 'slam', wind: 1, ash: 3 }),
  eel:    M('eel', '먹장어', 5, 3, { ai: 'water', atk: 'slam', wind: 1, ash: 3, desc: '물속에서만 움직인다.' }),
  acolyte:M('acolyte', '끄는 자', 6, 2, { ai: 'keep', atk: 'line', wind: 1, range: 5, ash: 4, desc: '물줄기로 불을 겨눈다.' }),
  candle: M('candle', '촛불 유령', 4, 1, { spd: 100, ai: 'chase', fly: 1, lightAverse: 1, drain: 6, ash: 3, ember: 0.5, desc: '빛을 싫어한다. 닿으면 불꽃을 갉는다.' }),
  worm:   M('worm', '책벌레', 3, 1, { spd: 150, group: [2, 3], ash: 2 }),
  wraith: M('wraith', '쪽지 망령', 5, 2, { ai: 'keep', fly: 1, atk: 'line', wind: 1, range: 6, lightAverse: 1, ash: 4, ember: 0.4 }),
  scribe: M('scribe', '필경사', 7, 2, { ai: 'keep', atk: 'summon', wind: 1, summon: 'worm', ash: 5, desc: '책벌레를 불러낸다.' }),
  armor:  M('armor', '움직이는 갑옷', 12, 4, { spd: 60, atk: 'slam', wind: 1, ash: 6 }),
  imp:    M('imp', '불씨 임프', 5, 3, { spd: 150, fly: 1, atk: 'burst', wind: 1, rad: 1, ash: 4 }),
  golem:  M('golem', '슬래그 골렘', 16, 5, { spd: 50, atk: 'burst', wind: 1, rad: 1, ash: 8 }),
  smith:  M('smith', '꺼진 대장장이', 9, 4, { atk: 'charge', wind: 1, range: 5, ash: 6, desc: '일직선으로 돌진한다.' }),
  chain:  M('chain', '사슬 망령', 7, 2, { ai: 'keep', atk: 'pull', wind: 1, range: 6, ash: 6, lightAverse: 1, desc: '사슬로 당신을 끌어당긴다.' }),
  shade:  M('shade', '그림자', 6, 3, { spd: 120, fly: 1, lightAverse: 1, drain: 8, ash: 5, ember: 0.6 }),
  husk:   M('husk', '껍데기', 10, 4, { atk: 'slam', wind: 1, ash: 6 }),
  maw:    M('maw', '허공의 아가리', 12, 4, { ai: 'still', atk: 'pull', wind: 1, range: 7, ash: 7, lightAverse: 0 }),
  // 보스 — 패턴은 game.js의 bossAct
  otol:   M('otol', '광부 대장 오톨', 34, 4, { boss: 1, big: 1, ash: 40, desc: '불을 쬐지 않는 눈.' }),
  marga:  M('marga', '사제 마르가', 44, 4, { boss: 1, ash: 60 }),
  isil:   M('isil', '기록관 이실', 54, 4, { boss: 1, ash: 80 }),
  borkai: M('borkai', '대장장이 왕 보르카이', 70, 5, { boss: 1, big: 1, ash: 110 }),
  hollow: M('hollow', '첫 등불지기', 96, 5, { boss: 1, big: 1, ash: 200 }),
};
// 지역별 출현표: [id, 가중치, 최소 층(지역 내 0~2)]
export const SPAWN = [
  [['rat', 5, 0], ['bat', 3, 0], ['grub', 3, 0], ['miner', 4, 1], ['bloat', 2, 1]],
  [['drowned', 4, 0], ['eel', 3, 0], ['candle', 3, 0], ['acolyte', 3, 1], ['rat', 1, 0], ['bloat', 1, 1]],
  [['worm', 5, 0], ['wraith', 3, 0], ['scribe', 3, 1], ['armor', 3, 1], ['candle', 2, 0]],
  [['imp', 4, 0], ['smith', 3, 0], ['golem', 3, 1], ['chain', 3, 1], ['bat', 1, 0]],
  [['shade', 5, 0], ['husk', 4, 0], ['maw', 2, 1], ['chain', 2, 1], ['wraith', 2, 1]],
];

/* ---------- 유물 ---------- */
export const RELICS = [
  { id: 'dagger', name: '날 선 단검', desc: '공격력 +1', c: '#cfd8e6', f: { atk: 1 } },
  { id: 'coat', name: '두꺼운 외투', desc: '최대 체력 +4', c: '#8a6a4a', f: { hp: 4 } },
  { id: 'flint', name: '부싯돌', desc: '불꽃이 25% 덜 닳는다', c: '#d0d0d8', f: { drain: -0.25 } },
  { id: 'glass', name: '유리 갓', desc: '등불 빛이 한 칸 더 멀리', c: '#9fe0ff', f: { light: 1 } },
  { id: 'spurs', name: '박차 신발', desc: '한 칸만 달려도 돌진이 된다', c: '#b88a4a', f: { streak: -1 } },
  { id: 'gauntlet', name: '무쇠 장갑', desc: '돌진이 적을 두 칸 밀친다', c: '#8a8f9a', f: { knock: 1 } },
  { id: 'thorn', name: '가시 외투', desc: '근접 공격한 적이 1 피해를 입는다', c: '#7a9a4a', f: { thorns: 1 } },
  { id: 'ribbon', name: '피 묻은 리본', desc: '적을 쓰러뜨리면 25% 확률로 체력 1 회복', c: '#d04a4a', f: { vamp: 0.25 } },
  { id: 'charm', name: '재의 부적', desc: '재(灰)를 50% 더 얻는다', c: '#b0a090', f: { ash: 0.5 } },
  { id: 'moth', name: '나방 날개', desc: '빛을 싫어하는 적에게 받는 피해 절반', c: '#e8e0f0', f: { mothwing: 1 } },
  { id: 'knot', name: '회피 매듭', desc: '15% 확률로 피해를 피한다', c: '#e0c060', f: { dodge: 0.15 } },
  { id: 'pouch', name: '약초 주머니', desc: '약초 회복 +2, 최대 +2개', c: '#6aa050', f: { herb: 2 } },
  { id: 'pike', name: '쌍창 조각', desc: '공격이 뒤의 적까지 꿰뚫는다', c: '#c0c8d8', f: { pierce: 1 } },
  { id: 'ring', name: '불꽃 반지', desc: '화로가 불꽃을 +15 더 준다', c: '#ff9a4a', f: { brazier: 15 } },
  { id: 'mirror', name: '깨진 거울', desc: '직선 공격의 피해가 절반', c: '#a8d8e8', f: { reflect: 1 } },
  { id: 'hammer', name: '대장장이의 망치', desc: '돌진 피해가 3배', c: '#e08a4a', f: { charge: 1 } },
  { id: 'map', name: '낡은 지도', desc: '층에 들어서면 지형 절반이 드러난다', c: '#d8c890', f: { mapper: 1 } },
  { id: 'soul', name: '영혼 등잔', desc: '적을 쓰러뜨릴 때 불꽃 +3', c: '#7ad0ff', f: { soul: 3 } },
  { id: 'shard', name: '방패 파편', desc: '층마다 첫 피해를 막는다', c: '#9ab0c8', f: { ward: 1 } },
  { id: 'skeleton', name: '해골 열쇠', desc: '잠긴 문을 그냥 연다', c: '#e8e0c8', f: { skey: 1 } },
  { id: 'dew', name: '이슬 방울', desc: '물속에서도 불꽃이 닳지 않는다', c: '#7ad0ff', f: { dew: 1 } },
  { id: 'boots', name: '내화 부츠', desc: '용암 위를 걸을 수 있다 (한 걸음에 1 피해)', c: '#ff7a3a', f: { lavawalk: 1 } },
  { id: 'feather', name: '불사조 깃털', desc: '쓰러지면 한 번 되살아난다', c: '#ff5a3a', f: { revive: 1 } },
  { id: 'mark', name: '사냥꾼의 표식', desc: '한 방에 쓰러뜨린 적은 항상 불씨를 떨군다', c: '#c04a4a', f: { mark: 1 } },
  { id: 'wick', name: '굵은 심지', desc: '최대 불꽃 +25', c: '#e8c870', f: { flame: 25 } },
  { id: 'heart', name: '불씨 심장', desc: '최대 체력 +2, 공격력 +1, 불꽃이 더 닳는다', c: '#ff6a4a', f: { hp: 2, atk: 1, drain: 0.2 } },
];
export const RIDX = Object.fromEntries(RELICS.map((r, i) => [r.id, i]));

/* ---------- 후계자 ---------- */
export const NAMES = ['카엘', '리안', '에다', '모라', '토비', '세라', '오렌', '이사', '브란', '닐라', '하프', '유나', '데른', '미라', '로스', '타샤', '펜', '아냐', '휴고', '세일'];
export const TRAITS = [
  { id: 'bold', name: '대담한', desc: '공격력 +1, 체력 -2', f: { atk: 1, hp: -2 } },
  { id: 'sturdy', name: '튼튼한', desc: '최대 체력 +4', f: { hp: 4 } },
  { id: 'keen', name: '눈 밝은', desc: '빛이 한 칸 더 멀리', f: { light: 1 } },
  { id: 'frugal', name: '아끼는', desc: '불꽃이 20% 덜 닳는다', f: { drain: -0.2 } },
  { id: 'lucky', name: '운 좋은', desc: '재를 30% 더 얻는다', f: { ash: 0.3 } },
  { id: 'swift', name: '날쌘', desc: '돌진이 한 칸 빨리 시작된다', f: { streak: -1 } },
  { id: 'gentle', name: '다정한', desc: '약초 회복 +1, 시작 약초 +1', f: { herb: 1 } },
];
// 마을 강화 (재로 구입)
export const UPGRADES = {
  atk: { name: '대장간', who: '대장장이 둔', max: 3, cost: [40, 120, 300], desc: ['공격력 +1', '공격력 +1', '공격력 +1'] },
  hp: { name: '예배소', who: '수녀 아다', max: 5, cost: [30, 60, 110, 180, 280], desc: ['최대 체력 +3', '최대 체력 +3', '최대 체력 +3', '최대 체력 +3', '최대 체력 +3'] },
  flame: { name: '등불 공방', who: '등불장이 렌', max: 4, cost: [35, 90, 200, 350], desc: ['최대 불꽃 +15', '최대 불꽃 +15', '최대 불꽃 +15', '최대 불꽃 +15'] },
  herb: { name: '약초 광주리', who: '약초꾼 베라', max: 3, cost: [25, 70, 160], desc: ['시작 약초 +1', '시작 약초 +1', '시작 약초 +1'] },
};

/* ---------- 이야기 ---------- */
export const PROLOGUE = [
  '재의 마을, 애쉬폴.',
  '아흔 번째 겨울. 마을의 불이 하나씩 꺼지고 있다.',
  '구덩이 아래에는 "대화로"가 있다고 했다. 마을의 모든 불을 지피는 불의 뿌리.',
  '그 불이 식고 있다.',
  '벨렌 가문은 대대로 등불을 들고 구덩이로 내려갔다. 돌아온 이는 거의 없다.',
  '이제 등불을 들 사람이 남았다.',
];
export const LORE = [
  // 지역 0
  { z: 0, t: '광부 일지', x: '아래에서 불이 노래한다. 우리는 그 소리를 따라 판다. 오늘도 한 명이 돌아오지 않았다.' },
  { z: 0, t: '광부 일지', x: '대장 오톨이 불을 쬐지 않는다. 눈이 식은 재 같다. 우리더러 "꺼야 한다"고 속삭인다.' },
  { z: 0, t: '갱도 벽의 낙서', x: '불은 땅의 것이 아니다. 누군가의 것이다. 누군가는 아직 살아 있다.' },
  // 1
  { z: 1, t: '끄는 자들의 기도문', x: '불꽃은 아파한다. 우리는 그 아픔을 덜어 줄 뿐이다. 물이 불을 달랜다.' },
  { z: 1, t: '예배당 장부', x: '매 겨울, 한 집에서 등불지기를 보냈다. 돌아온 이는 없다. 마을은 그 값으로 따뜻했다.' },
  { z: 1, t: '사제의 편지', x: '벨렌의 후손에게. 이 일을 시작한 것은 네 가문이다. 네 손으로 끝내라.' },
  // 2
  { z: 2, t: '건립자의 기록', x: '우리는 불을 발견한 것이 아니다. 잠든 어린 불을 깨워 사슬에 묶었다.' },
  { z: 2, t: '기록관의 주석', x: '등불은 사슬의 조각이다. 등불지기는 불을 달래는 열쇠이자, 불이 받는 먹이다.' },
  { z: 2, t: '벨렌 가계도', x: '첫 등불지기는 건립자의 딸이었다. 그녀는 불과 함께 있기를 택하고 돌아오지 않았다.' },
  // 3
  { z: 3, t: '대장장이 일지', x: '사슬을 벼렸다. 불의 비명이 쇠에 스몄다. 식은 쇠가 지금도 운다.' },
  { z: 3, t: '보르카이의 독백', x: '불을 풀면 마을이 얼어 죽는다. 가두면 불이 죽는다. 어느 쪽이든 누군가 값을 치른다.' },
  { z: 3, t: '무쇠 문서', x: '마지막 사슬은 피로 이어진 자만 끊을 수 있다. 혹은 이을 수 있다.' },
  // 4
  { z: 4, t: '벽의 낙서', x: '어둠은 불의 적이 아니다. 불이 쉬는 곳일 뿐이다.' },
  { z: 4, t: '첫 등불지기의 흔적', x: '나는 여기 남았다. 불이 외롭지 않도록. 하지만 너무 오래 외로웠다.' },
  { z: 4, t: '마지막 기록', x: '선택은 단순하다. 다시 묶거나, 풀어 주거나, 대신 타오르거나.' },
];
export const GHOSTS = [
  // 지역별 떠도는 영혼: 말을 걸면 선택지 제공
  { z: 0, name: '길 잃은 광부', lines: ['…불이 보이는군. 따뜻하다.', '오톨 대장은 원래 좋은 사람이었어. 불이 꺼지기 전엔.', '내 곡괭이 조각이라도 가져가. 쓸모가 있을 거야.'],
    choice: [{ t: '곡괭이 조각을 받는다 (공격력 +1)', e: { atk: 1 } }, { t: '그의 손을 잡아 준다 (체력 전부 회복)', e: { heal: 99 } }] },
  { z: 1, name: '익사한 수녀', lines: ['제가 불을 껐어요. 기도하면서요.', '아프다고 했거든요. 불이 아프다고.', '용서해 주세요. 이 물을 가져가세요.'],
    choice: [{ t: '이슬을 받는다 (불꽃 전부 회복)', e: { flame: 99 } }, { t: '기도에 귀 기울인다 (최대 체력 +2)', e: { hp: 2 } }] },
  { z: 2, name: '책에 갇힌 서기', lines: ['기록이 틀렸을 리 없어요. 틀렸다면 제가 틀린 거고요.', '이것을 읽으세요. 마지막 장은 직접 쓰셔야 합니다.'],
    choice: [{ t: '지도를 받는다 (이 층이 드러난다)', e: { reveal: 1 } }, { t: '글귀를 외운다 (불꽃 +30, 체력 +3)', e: { flame: 30, heal: 3 } }] },
  { z: 3, name: '사슬에 묶인 도제', lines: ['끊어 주세요. 이 쇠를 끊어 주세요.', '아니, 안 돼. 끊으면 불이 날뛸 거야…', '그래도 부탁이에요. 이 망치를 가져가요.'],
    choice: [{ t: '망치를 받는다 (공격력 +1)', e: { atk: 1 } }, { t: '사슬을 만져 준다 (최대 불꽃 +15)', e: { maxflame: 15 } }] },
  { z: 4, name: '벨렌의 그림자', lines: ['너는 나를 닮았구나.', '내 아이들이 하나씩 내려왔다. 모두 이 앞에서 멈췄지.', '돌아가라는 말은 하지 않을게.'],
    choice: [{ t: '손을 맞잡는다 (체력과 불꽃 회복)', e: { heal: 99, flame: 99 } }, { t: '등을 돌린다 (공격력 +1)', e: { atk: 1 } }] },
];
export const BOSSTALK = {
  otol: { pre: ['오톨: …불이다. 불이 온다.', '오톨: 꺼야 한다. 모두 꺼야 한다. 그래야 조용해진다.'], post: ['오톨: …따뜻했어. 처음엔.', '오톨: 내려가라, 벨렌. 아래엔 더 큰 불이 아파하고 있다.'] },
  marga: { pre: ['마르가: 벨렌의 후손이로군. 또 한 명.', '마르가: 우리는 불을 해치지 않았다. 아픔을 덜어 주려 했을 뿐.', '마르가: 그 등불 속의 불은… 비명을 지르고 있는데, 너는 듣지 못하니.'], post: ['마르가: 그래… 네 손의 불이 더 아프지 않다고 하는군.', '마르가: 도서관으로 가라. 진실은 거기 있다.'] },
  isil: { pre: ['이실: 읽었나? 기록을? 그렇다면 알겠지.', '이실: 벨렌은 불의 주인이 아니다. 불의 간수였다.', '이실: 나는 그 사실을 영원히 보관하려 했을 뿐이다. 보관이란 가두는 일이지.'], post: ['이실: 아아… 마지막 장은 비워 두었다.', '이실: 그것은 네가 쓸 몫이다. 대장간으로 가라.'] },
  borkai: { pre: ['보르카이: 사슬을 보러 왔나.', '보르카이: 내 손으로 벼렸다. 이 마을이 따뜻하도록. 후회하냐고? 매일.', '보르카이: 풀 테냐? 그럼 나를 먼저 넘어라.'], post: ['보르카이: …사슬이 가벼워졌군.', '보르카이: 가라. 첫 등불지기가 기다린다. 그녀는 아직 사슬을 쥐고 있다.'] },
  hollow: { pre: ['첫 등불지기: 오래 걸렸구나. 나의 아이.', '첫 등불지기: 나는 불이 외롭지 않게 남았다. 너무 오래.', '첫 등불지기: 이제 선택하렴. 나를 넘어서.'], post: ['첫 등불지기: …고맙다.', '첫 등불지기: 불이 기다린다. 선택은 네 몫이다.'] },
};
export const ENDINGS = {
  chain: { title: '다시 사슬을 잇다', lines: ['당신은 사슬을 이었다. 대화로는 다시 타오르고, 애쉬폴의 집집마다 불이 돌아왔다.', '마을은 따뜻했다. 아무도 이유를 묻지 않았다.', '벨렌의 등불은 다음 세대에게 넘어갔다. 구덩이 아래에서, 불은 아주 조용히 울었다.'], tag: '따뜻한 거짓' },
  dawn: { title: '사슬을 끊다', lines: ['사슬이 부서지자 불은 위로 올라갔다. 오랜 잠에서 깬 아이처럼.', '애쉬폴의 불이 한동안 꺼졌다. 마을은 추웠고, 사람들은 서로의 체온으로 겨울을 났다.', '그리고 아침이 왔다. 구덩이 위로 처음으로, 불이 해가 되어 떠올랐다.'], tag: '새벽' },
  ember: { title: '내가 불이 되다', lines: ['당신은 등불을 내려놓고 불 속으로 걸어 들어갔다.', '불은 더 외롭지 않았다. 사슬은 사라지고, 불은 스스로 마을을 데웠다.', '구덩이 입구에서 사람들은 가끔 등불 든 사람의 그림자를 본다고 한다. 벨렌의 마지막 등불지기를.'], tag: '영원한 등불' },
};
export const DEATHWORDS = {
  default: ['불이 꺼지는 게 이렇게 조용할 줄은 몰랐어.', '…내 등불을 가져가. 나보다 멀리 가 줘.', '아직 할 말이 많았는데.', '따뜻하다. 이상하게도.'],
  fall: ['발밑이 없었어.'], dark: ['어둠이 불보다 먼저 나를 찾았다.'],
};
// 마을 주민 대사: 상태(세대/진행)에 따라 달라진다. 함수로 만든다.
export const FIRSTNOTE = '발걸음이 곧 말이다. 부딪치면 공격하고, 말을 걸고, 문을 연다.';
