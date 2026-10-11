// 유닛·스킬·스테이지 정의. 스킬 fn(b,u)은 sim.js의 Battle API만 사용한다.
export const ROLE = { charge: '돌격', defense: '방어', magic: '마법', ranged: '사격', ambush: '침투', support: '지원', heal: '회복', bomb: '폭발', mob: '졸개', boss: '보스' };
export const POS = { front: '전열', mid: '중열', rear: '후열' };

const rearmost = (b, u) => b.foes(u).reduce((a, f) => (u.team ? f.x < a.x : f.x > a.x) ? f : a);
const lowest = list => list.reduce((a, f) => f.hp / f.maxHp < a.hp / a.maxHp ? f : a);

export const UNITS = {
  knight: { name: '로엔', title: '강철 기사', role: 'defense', pos: 'front', hp: 1480, atk: 62, def: 60, as: 1.2, range: 62,
    look: { body: '#5b7bd6', hair: '#c9a15a', hat: 'helm', weapon: 'sword', off: 'shield' },
    skill: { name: '수호의 외침', cd: 12, reach: 260, desc: '모든 적을 3초간 도발하고 최대 체력 25%의 보호막을 얻는다.',
      fn(b, u) { for (const f of b.foes(u)) b.add(f, { k: 'taunt', t: 3, src: u }); b.add(u, { k: 'shield', t: 5, v: u.maxHp * 0.25 }); b.fx({ t: 'aoe', x: u.x, r: 200, c: '#8fb0ff' }); } } },
  lancer: { name: '바르', title: '돌격대장', role: 'charge', pos: 'front', hp: 1250, atk: 88, def: 40, as: 1.0, range: 72,
    look: { body: '#d65b5b', hair: '#3a2a2a', hat: 'band', weapon: 'spear' },
    skill: { name: '관통 돌진', cd: 10, reach: 320, desc: '가장 가까운 적에게 돌진해 주변 적에게 220% 피해를 주고 1.2초 기절시킨다.',
      fn(b, u) { const tg = b.nearest(u, b.foes(u)); u.x = Math.max(30, Math.min(970, tg.x - u.face * 50)); b.fx({ t: 'aoe', x: u.x + u.face * 60, r: 170, c: '#ff9a9a' });
        for (const f of b.foes(u)) if (Math.abs(f.x - u.x) < 170) { b.hit(u, f, 2.2, { skill: 1 }); b.add(f, { k: 'stun', t: 1.2 }); } } } },
  berserk: { name: '그룬', title: '광전사', role: 'charge', pos: 'front', hp: 1350, atk: 92, def: 32, as: 0.95, range: 66,
    look: { body: '#8a4b2d', hair: '#e06a2b', hat: 'horn', weapon: 'axe' },
    skill: { name: '피의 격노', cd: 14, reach: 120, desc: '6초간 공격력 +50%, 공격 속도 +40%, 피해의 30%만큼 회복한다.',
      fn(b, u) { b.add(u, { k: 'buff', t: 6, mods: { atk: 0.5, as: 0.4 }, ls: 0.3 }); b.fx({ t: 'aoe', x: u.x, r: 70, c: '#ff5a3a' }); } } },
  paladin: { name: '아인', title: '성기사', role: 'defense', pos: 'front', hp: 1500, atk: 74, def: 55, as: 1.15, range: 64,
    look: { body: '#e8e2c8', hair: '#f2d16b', hat: 'halo', weapon: 'hammer', off: 'shield' },
    skill: { name: '심판', cd: 11, reach: 110, desc: '가까운 적에게 190% 피해와 1.5초 기절. 자신의 체력을 15% 회복한다.',
      fn(b, u) { const tg = b.nearest(u, b.foes(u)); b.hit(u, tg, 1.9, { skill: 1 }); b.add(tg, { k: 'stun', t: 1.5 }); b.heal(u, u, u.maxHp * 0.15); b.fx({ t: 'aoe', x: tg.x, r: 60, c: '#ffe9a0' }); } } },
  guardian: { name: '테라', title: '수정 골렘', role: 'defense', pos: 'front', hp: 1620, atk: 48, def: 75, as: 1.5, range: 62,
    look: { body: '#58c2b0', hair: '#2f8f84', hat: 'crystal', weapon: 'fist', skin: '#bdeee4' },
    skill: { name: '수정 장벽', cd: 14, reach: 400, desc: '모든 아군에게 자신의 최대 체력 11%의 보호막을 6초간 건다. 자신의 방어력 +30%.',
      fn(b, u) { for (const a of b.allies(u)) b.add(a, { k: 'shield', t: 6, v: u.maxHp * 0.11 }); b.add(u, { k: 'buff', t: 6, mods: { def: 0.3 } }); } } },
  mage: { name: '이그니', title: '화염술사', role: 'magic', pos: 'mid', hp: 860, atk: 110, def: 15, as: 1.6, range: 390,
    look: { body: '#c8472f', hair: '#2a1a1a', hat: 'wizard', weapon: 'staff', orb: '#ffb347' },
    skill: { name: '유성', cd: 11, desc: '적이 가장 뭉친 곳에 260% 범위 피해를 주고 4초간 화상을 입힌다.',
      fn(b, u) { const fs = b.foes(u); let best = fs[0], n = 0; for (const f of fs) { const c = fs.filter(o => Math.abs(o.x - f.x) < 140).length; if (c > n) { n = c; best = f; } }
        b.fx({ t: 'meteor', x: best.x, c: '#ff7a2b' }); const x = best.x;
        b.after(0.35, () => { b.fx({ t: 'aoe', x, r: 140, c: '#ff7a2b' }); for (const f of b.foes(u)) if (Math.abs(f.x - x) < 140) { b.hit(u, f, 2.6, { skill: 1 }); b.dot(u, f, 'burn', 4, 0.16); } }); } } },
  frost: { name: '닉스', title: '서리마녀', role: 'magic', pos: 'mid', hp: 880, atk: 102, def: 15, as: 1.6, range: 380,
    look: { body: '#6fb7e8', hair: '#e8f4ff', hat: 'wizard', weapon: 'staff', orb: '#bfeaff' },
    skill: { name: '빙결 폭풍', cd: 13, desc: '모든 적에게 130% 피해. 1.6초 빙결시키고 3초간 느리게 만든다.',
      fn(b, u) { b.fx({ t: 'screen', c: '#bfeaff' }); for (const f of b.foes(u)) { b.hit(u, f, 1.3, { skill: 1 }); b.add(f, { k: 'stun', t: 1.6, ice: 1 }); b.add(f, { k: 'buff', t: 3, mods: { spd: -0.4, as: -0.3 }, bad: 1 }); } } } },
  shaman: { name: '모르', title: '독술사', role: 'magic', pos: 'mid', hp: 920, atk: 96, def: 20, as: 1.5, range: 360,
    look: { body: '#6a8f3a', hair: '#3a4a22', hat: 'hood', weapon: 'staff', orb: '#b6ff5a' },
    skill: { name: '역병', cd: 11, desc: '모든 적을 6초간 중독시키고 받는 회복량을 절반으로 줄인다.',
      fn(b, u) { b.fx({ t: 'screen', c: '#9be05a' }); for (const f of b.foes(u)) { b.dot(u, f, 'poison', 6, 0.2); b.add(f, { k: 'wound', t: 6 }); } } } },
  bomber: { name: '붐', title: '폭탄광', role: 'bomb', pos: 'mid', hp: 960, atk: 108, def: 22, as: 1.7, range: 300, splash: 80,
    look: { body: '#f0b429', hair: '#444', hat: 'cap', weapon: 'bomb' },
    skill: { name: '대폭발', cd: 13, desc: '모든 적에게 170% 피해를 주고 5초간 방어력을 30% 깎는다. 기본 공격은 범위 피해.',
      fn(b, u) { b.fx({ t: 'screen', c: '#ffcf5a' }); for (const f of b.foes(u)) { b.fx({ t: 'aoe', x: f.x, r: 60, c: '#ffb02b' }); b.hit(u, f, 1.7, { skill: 1 }); b.add(f, { k: 'buff', t: 5, mods: { def: -0.3 }, bad: 1 }); } } } },
  rogue: { name: '셰이드', title: '그림자', role: 'ambush', pos: 'mid', hp: 980, atk: 116, def: 26, as: 0.8, range: 60, spd: 150,
    look: { body: '#3b3350', hair: '#8a7ad6', hat: 'hood', weapon: 'dagger' },
    skill: { name: '배후 습격', cd: 10, desc: '가장 뒤에 있는 적의 등 뒤로 순간이동해 300% 피해를 주고 2.5초간 모든 피해를 회피한다.',
      fn(b, u) { const tg = rearmost(b, u); b.fx({ t: 'blink', x: u.x, y: u.y }); u.x = Math.max(30, Math.min(970, tg.x + (u.team ? -50 : 50))); u.face = tg.x > u.x ? 1 : -1;
        b.hit(u, tg, 3.0, { skill: 1 }); b.add(u, { k: 'evade', t: 2.5 }); b.fx({ t: 'slash', x: tg.x, y: tg.y }); } } },
  archer: { name: '린', title: '명사수', role: 'ranged', pos: 'rear', hp: 760, atk: 108, def: 15, as: 1.0, range: 460,
    look: { body: '#4f9d5d', hair: '#7a4a2a', hat: 'feather', weapon: 'bow' },
    skill: { name: '속사', cd: 9, desc: '체력 비율이 가장 낮은 적에게 70% 피해의 화살을 5발 쏜다.',
      fn(b, u) { for (let i = 0; i < 5; i++) b.after(i * 0.12, () => { if (!u.alive) return; const fs = b.foes(u); if (!fs.length) return; const tg = lowest(fs); b.fx({ t: 'proj', a: u, b: tg, c: '#d8ff8a' }); b.hit(u, tg, 0.7, { skill: 1 }); }); } } },
  sniper: { name: '카이', title: '저격수', role: 'ranged', pos: 'rear', hp: 720, atk: 150, def: 12, as: 1.9, range: 540,
    look: { body: '#4a5568', hair: '#d6d6d6', hat: 'cap', weapon: 'gun' },
    skill: { name: '헤드샷', cd: 12, desc: '공격력이 가장 높은 적에게 반드시 치명타로 340% 피해를 준다.',
      fn(b, u) { const tg = b.foes(u).reduce((a, f) => f.atk > a.atk ? f : a); b.fx({ t: 'proj', a: u, b: tg, c: '#ffffff', big: 1 }); b.hit(u, tg, 3.4, { skill: 1, crit: 1 }); } } },
  priest: { name: '엘라', title: '사제', role: 'heal', pos: 'rear', hp: 900, atk: 70, def: 22, as: 1.4, range: 400,
    look: { body: '#f4f1e6', hair: '#f0c6d8', hat: 'halo', weapon: 'wand', orb: '#9dffb0' },
    skill: { name: '치유의 빛', cd: 8, ai: 'heal', desc: '모든 아군을 공격력의 300%만큼 회복시킨다. 가장 위험한 아군은 250% 추가 회복.',
      fn(b, u) { const as = b.allies(u); for (const a of as) b.heal(u, a, u.atk * 3.0); b.heal(u, lowest(as), u.atk * 2.5); b.fx({ t: 'screen', c: '#9dffb0' }); } } },
  bard: { name: '리코', title: '음유시인', role: 'support', pos: 'rear', hp: 900, atk: 74, def: 22, as: 1.3, range: 400,
    look: { body: '#b05bd6', hair: '#ffd66b', hat: 'feather', weapon: 'lute' },
    skill: { name: '전장의 노래', cd: 12, desc: '6초간 모든 아군의 공격력 +35%, 공격 속도 +25%. 공격력의 120%만큼 회복시킨다.',
      fn(b, u) { for (const a of b.allies(u)) { b.add(a, { k: 'buff', t: 6, mods: { atk: 0.35, as: 0.25 } }); b.heal(u, a, u.atk * 1.2); } b.fx({ t: 'screen', c: '#e0a8ff' }); } } },

  /* ---- 졸개 ---- */
  slime: { name: '슬라임', title: '졸개', role: 'mob', pos: 'front', hp: 800, atk: 48, def: 20, as: 1.3, range: 56, look: { kind: 'slime', body: '#6fd68a' } },
  skel: { name: '해골 병사', title: '졸개', role: 'mob', pos: 'front', hp: 950, atk: 66, def: 35, as: 1.2, range: 62,
    look: { body: '#7a7a8a', hair: '#eee', skin: '#f2f2ea', hat: 'skull', weapon: 'sword' },
    skill: { name: '뼈 방패', cd: 12, reach: 150, desc: '최대 체력 20%의 보호막을 얻는다.', fn(b, u) { b.add(u, { k: 'shield', t: 5, v: u.maxHp * 0.2 }); } } },
  goblin: { name: '고블린 궁수', title: '졸개', role: 'mob', pos: 'rear', hp: 560, atk: 70, def: 10, as: 1.3, range: 420, look: { body: '#7a5a2a', hair: '#5a8f3a', skin: '#8fd66f', hat: 'none', weapon: 'bow' } },
  bat: { name: '박쥐', title: '졸개', role: 'mob', pos: 'mid', hp: 520, atk: 58, def: 8, as: 0.7, range: 54, spd: 170, look: { kind: 'bat', body: '#6a4a8a' } },

  /* ---- 보스 ---- */
  ogre: { name: '오우거 족장', title: '1장 보스', role: 'boss', pos: 'front', hp: 5200, atk: 105, def: 50, as: 1.6, range: 84, spd: 90,
    look: { body: '#5a7a3a', hair: '#3a2a1a', skin: '#8fb85a', hat: 'horn', weapon: 'club', size: 1.7 },
    skill: { name: '대지 강타', cd: 9, reach: 160, desc: '주변 넓은 범위의 적에게 170% 피해와 1초 기절.',
      fn(b, u) { b.fx({ t: 'aoe', x: u.x + u.face * 60, r: 230, c: '#c8a15a' }); b.fx({ t: 'shake', v: 14 }); for (const f of b.foes(u)) if (Math.abs(f.x - u.x) < 240) { b.hit(u, f, 1.7, { skill: 1 }); b.add(f, { k: 'stun', t: 1 }); } } } },
  lich: { name: '리치', title: '2장 보스', role: 'boss', pos: 'mid', hp: 4400, atk: 125, def: 35, as: 1.6, range: 400, spd: 90,
    look: { body: '#4a2a6a', hair: '#222', skin: '#cfe8d8', hat: 'crown', weapon: 'staff', orb: '#c06bff', size: 1.5 },
    skill: { name: '영혼 흡수', cd: 10, desc: '모든 적에게 130% 피해를 주고 준 피해의 60%만큼 회복한다.',
      fn(b, u) { b.fx({ t: 'screen', c: '#c06bff' }); let sum = 0; for (const f of b.foes(u)) { sum += b.hit(u, f, 1.3, { skill: 1 }); b.fx({ t: 'proj', a: f, b: u, c: '#c06bff' }); } b.heal(u, u, sum * 0.6); } } },
  dragon: { name: '흑룡 바르가스', title: '최종 보스', role: 'boss', pos: 'front', hp: 4300, atk: 96, def: 60, as: 1.8, range: 190, spd: 80, splash: 110,
    look: { kind: 'dragon', body: '#3a2a4a', size: 2.1 },
    skill: { name: '흑염 브레스', cd: 10, desc: '모든 적에게 180% 피해와 5초 화상. 체력이 절반 이하면 공격 속도가 오른다.',
      fn(b, u) { b.fx({ t: 'screen', c: '#a04bff' }); b.fx({ t: 'shake', v: 16 }); for (const f of b.foes(u)) { b.hit(u, f, 1.8, { skill: 1 }); b.dot(u, f, 'burn', 5, 0.14); }
        if (u.hp < u.maxHp * 0.5) b.add(u, { k: 'buff', t: 10, mods: { as: 0.4 } }); } } },
};
export const HEROES = ['knight', 'lancer', 'archer', 'priest', 'mage', 'rogue', 'bard', 'berserk', 'frost', 'bomber', 'guardian', 'sniper', 'shaman', 'paladin'];
export const START = ['knight', 'lancer', 'archer', 'priest'];
export const ALL = Object.keys(UNITS);
export const MAXLV = 20;
export const lvCost = lv => 30 + 30 * lv;

const T = (lv, ...ids) => ids.map(id => ({ id, lv }));
export const CHAPTERS = [
  { name: '1장 · 잿빛 숲', bg: 0 }, { name: '2장 · 얼어붙은 성채', bg: 1 }, { name: '3장 · 흑룡의 둥지', bg: 2 },
];
export const STAGES = [
  { ch: 0, name: '숲의 입구', foes: T(1, 'slime', 'slime', 'slime', 'goblin'), talk: [['로엔', '새벽 길드, 첫 의뢰다. 숲에 퍼진 잿빛 안개의 근원을 찾는다.'], ['린', '안개 속에 뭔가 꿈틀거려. 슬라임이네, 몸풀기로 딱이야.']] },
  { ch: 0, name: '버려진 야영지', foes: T(2, 'slime', 'skel', 'goblin', 'goblin'), unlock: 'mage', talk: [['엘라', '누가 여기서 야영을 했어요. 불씨가 아직 따뜻한데…'], ['이그니', '거기 길드! 나 좀 도와줘. 해골들이 내 지팡이를 노리고 있다고!']] },
  { ch: 0, name: '뼈의 길', foes: T(3, 'skel', 'skel', 'bat', 'goblin'), unlock: 'rogue', talk: [['이그니', '이 해골들, 누군가 일으켜 세운 거야. 숲 안쪽에서 마력이 흘러나와.'], ['???', '…뒤를 조심해. 박쥐는 뒷줄부터 문다.']] },
  { ch: 0, name: '타락한 기사', foes: T(4, 'knight', 'skel', 'goblin', 'bat'), talk: [['로엔', '저 갑옷… 우리 기사단의 문장이다. 안개에 삼켜진 건가.'], ['셰이드', '감상은 나중에. 방패 든 놈은 내가 뒤로 돌아가서 흔들게.']] },
  { ch: 0, name: '오우거 족장', boss: true, foes: T(5, 'ogre', 'skel', 'goblin', 'goblin'), unlock: 'bard', talk: [['바르', '저 덩치가 안개를 뿜는 향로를 지키고 있어!'], ['로엔', '강타가 오면 뭉쳐 있다간 전멸이다. 버텨라!']] },
  { ch: 1, name: '성채의 다리', foes: T(6, 'lancer', 'skel', 'archer', 'bat'), unlock: 'berserk', talk: [['리코', '향로 속 지도는 북쪽 성채를 가리키네요. 노래 한 곡 붙여도 될까요?'], ['바르', '다리 위에 창병이 있다. 정면 승부다.']] },
  { ch: 1, name: '얼음 병영', foes: T(7, 'guardian', 'berserk', 'goblin', 'priest'), talk: [['그룬', '크하하! 저 골렘, 내 도끼로 깨질지 한번 볼까!'], ['엘라', '뒤에 사제가 있어요. 먼저 끊지 않으면 끝이 안 날 거예요.']] },
  { ch: 1, name: '서리의 회랑', foes: T(8, 'frost', 'skel', 'skel', 'archer'), unlock: 'frost', talk: [['닉스', '내 회랑에 발을 들인 대가는 얼음 조각상이 되는 것.'], ['이그니', '얼음 대 불이라. 누가 더 뜨거운지 보자고.']] },
  { ch: 1, name: '왕좌 앞', foes: T(9, 'knight', 'rogue', 'mage', 'priest'), unlock: 'bomber', talk: [['닉스', '…졌다. 리치가 내 의지를 얼려뒀을 뿐이야. 같이 가겠어.'], ['셰이드', '저쪽에도 나 같은 놈이 있군. 뒷줄, 정신 차려.']] },
  { ch: 1, name: '리치', boss: true, foes: T(10, 'lich', 'skel', 'skel', 'shaman'), unlock: 'guardian', talk: [['리치', '안개는 시작일 뿐. 흑룡이 깨어나면 대륙의 영혼은 모두 나의 것이다.'], ['붐', '말이 길다! 터뜨리면 조용해지겠지!']] },
  { ch: 2, name: '화산 기슭', foes: T(11, 'paladin', 'berserk', 'sniper', 'bard'), unlock: 'sniper', talk: [['테라', '리치의 봉인석이 부서졌다. 흑룡의 둥지가 열린다.'], ['로엔', '둥지를 지키는 건 용을 섬기는 기사단이다. 만만치 않아.']] },
  { ch: 2, name: '용암 다리', foes: T(12, 'guardian', 'lancer', 'bomber', 'frost'), talk: [['카이', '조준경 너머로 봤는데, 저쪽은 뭉치면 터뜨리고 흩어지면 찌르는 구성이야.'], ['린', '그럼 우리는 그 전에 끝내면 되지.']] },
  { ch: 2, name: '독의 제단', foes: T(13, 'knight', 'rogue', 'shaman', 'priest'), unlock: 'shaman', talk: [['모르', '역병은 공평하다. 기사도, 사제도, 영웅도 똑같이 썩지.'], ['엘라', '제 치유가 절반밖에 안 들어요… 빨리 끝내야 해요!']] },
  { ch: 2, name: '용의 근위대', foes: T(14, 'paladin', 'berserk', 'mage', 'sniper'), unlock: 'paladin', talk: [['아인', '나는 맹세에 묶여 있다. 나를 쓰러뜨려 그 맹세를 끊어다오.'], ['로엔', '…기사 대 기사로 답하지.']] },
  { ch: 2, name: '흑룡 바르가스', boss: true, foes: [{ id: 'dragon', lv: 15 }, ...T(12, 'guardian', 'frost', 'priest')], talk: [['바르가스', '작은 것들아. 새벽은 오지 않는다.'], ['로엔', '새벽 길드, 전원 돌격! 이 밤을 끝낸다!']] },
];
export const stageGold = i => 150 + 70 * i;
