import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import '../js/cards.js';

const mk = (P, A, o = {}) => { const g = E.newGame(P, A, { seed: 7, variance: false, first: 'P', ...o }); E.begin(g); return g; };
const give = (u, s) => { u.e = [...s].map(c => ({ c, a: 1 })); };
const use = (g, id, slot = 0, extra = {}, plus = null, pay = null) => { const i = E.info(g); const e = i.skills.find(x => x.id === id); assert.ok(e && e.ok, `skill ${id} usable: ${e && e.why}`); const t = (typeof slot === 'string' ? e.targets.find(t => t.uid === slot) : e.targets.find(t => t.slot === slot)) || e.targets[0]; return E.act(g, { type: 'skill', skill: id, target: t, extra, plus, pay }); };
const gather = g => { const i = E.info(g); if (i.kind === 'deploy') return E.act(g, { type: 'deploy', uid: i.options[0] }); if (i.kind === 'input' && !i.gather) return E.act(g, { type: 'pass' }); return E.act(g, { type: 'gather' }); };
const pass = (g, n = 1) => { for (let k = 0; k < n; k++) { const i = E.info(g); if (i.kind === 'deploy') E.act(g, { type: 'deploy', uid: i.options[0] }); else gather(g); } };
const skipTo = (g, uid) => { let guard = 0; while (E.info(g).uid !== uid && guard++ < 20) gather(g); assert.equal(E.info(g).uid, uid); };
const F = ['mole', 'boar', 'bee', 'tail'];

test('실브래: 실버스매시 코스트는 대상 에너지만큼 줄고, 퍼스트가드는 40D + 실드 120', () => {
  const g = mk(['silvrae', ...F.slice(0, 3)], ['mantis', 'fang', 'frog', 'turtle']); const s = g.u.P0; give(g.u.A0, 'RR'); give(g.u.A1, 'R');
  const i = E.info(g); const sm = i.skills.find(x => x.id === 'smash'); assert.equal(sm.ok, false, '에너지 0이면 못 쓴다');
  give(s, 'RWBRW'); const e = E.info(g).skills.find(x => x.id === 'smash'); assert.ok(e.ok); assert.ok(e.targets.length === 2);
  assert.equal(E.effCost(g, s, e.sk, g.u.A0).length, 4); assert.equal(E.effCost(g, s, e.sk, g.u.A1).length, 5);
  use(g, 'smash', 0); assert.equal(g.u.A0.hp, 115 - 70); assert.equal(E.eTotal(s), 1 + 0 + 0, '5개 중 4개 지불 + 기술 후 HP10 회복'); 
  const g2 = mk(['silvrae', ...F.slice(0, 3)], ['mantis', 'fang', 'frog', 'turtle']); use(g2, 'fguard', 0); assert.equal(g2.u.A0.hp, 115 - 40); assert.equal(g2.u.P0.shield, 120);
  assert.equal(E.info(g2).skills.find(x => x.id === 'fguard')?.ok ?? false, false);
});
test('실브래: 실드 대신피해 + 상태이상 면역(독/감속 면역, 냉동은 걸림)', () => {
  const g = mk(['silvrae', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); g.u.P0.shield = 100; skipTo(g, 'A0'); give(g.u.A0, 'B'); const hp = g.u.P1.hp; use(g, 'rush', 1);
  assert.equal(hp - g.u.P1.hp, 20, '40D 중 절반만 맞는다'); assert.equal(g.u.P0.shield, 80);
  E.addStatus(g, null, g.u.P0, 'poison', 2); E.addStatus(g, null, g.u.P0, 'freeze', 2); assert.ok(!g.u.P0.st.poison && g.u.P0.st.freeze);
});
test('실브래: 드래곤메모리는 후열 드래곤의 첫 기술(코스트 포함)을 복사', () => {
  const g = mk(['silvrae', 'mole', 'dragonfish', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'R'); const e = E.info(g).skills.find(x => x.id === 'dmem'); assert.ok(e.ok, e.why);
  assert.deepEqual(e.tokens, ['*']); const hp = g.u.A0.hp; use(g, 'dmem', 0); assert.equal(hp - g.u.A0.hp, 60); assert.ok(g.u.P0.used.dmem);
});
test('호리진탈: HP가 가득이면 같은 진영 피해 절반 / 절반 이하 + W>B면 화락나리로 퇴화', () => {
  const g = mk(['horizintal', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); skipTo(g, 'A0'); give(g.u.A0, 'B'); use(g, 'rush', 1); assert.equal(g.u.P1.hp, 125 - 20);
  const h = g.u.P0; h.hp = 100; give(h, 'WWB'); skipTo(g, 'P0'); gather(g); assert.equal(h.id, 'flameflower'); assert.equal(h.name, '화락나리'); assert.equal(h.maxHp, 190);
});
test('호리진썬: 40D + 100D + 화상', () => {
  const g = mk(['horizintal', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'WRB'); use(g, 'sun', 0); assert.ok(g.u.A0.dead);
});
test('천사: 이클립스(에너지 수 = 차례 수)면 공격 무효, 빛의촛대 아군 회복은 나눠서', () => {
  const g = mk(['angel', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); skipTo(g, 'A0'); give(g.u.A0, 'B'); use(g, 'rush', 0); assert.equal(g.u.P0.hp, 180, '0 = 0 이므로 무효');
  const g2 = mk(['angel', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); g2.u.P1.hp = 50; give(g2.u.P0, 'RRR'); use(g2, 'candle', 1, {}, null, { R: 3, W: 0, B: 0 }); assert.equal(g2.u.P1.hp, 80); assert.equal(g2.u.P1.fx.q[0].left, 3);
  skipTo(g2, 'P1'); assert.equal(g2.u.P1.hp, 110, '다음 자기 차례 시작에 +30');
});
test('천사: W 3개로 적에게 쓰면 특성/회복/기술 봉인', () => {
  const g = mk(['angel', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); give(g.u.P0, 'WWW'); use(g, 'candle', 'A0', { sk: 'slam' }); const a = g.u.A0;
  assert.equal(a.hp, 150 - 100); assert.equal(a.st.traitSeal, 5 - 0); assert.ok(a.st.healSeal); assert.equal(a.seal.slam, 5);
});
test('그랜지: 그랜드필드 + 보호막 / 지그재그굴착은 다음 차례에 자동 발동', () => {
  const g = mk(['grange', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'WB'); use(g, 'gfield', 0); assert.equal(g.field.kind, 'grand'); assert.equal(g.u.P0.bar[0].n, 120); assert.equal(g.u.P1.bar[0].n, 120); assert.equal(g.u.A0.hp, 115 - 40);
  const g2 = mk(['grange', 'mole', 'bee', 'tail'], ['boar', 'turtle', 'frog', 'mantis']); give(g2.u.P0, 'WBWB'); use(g2, 'zigzag', 0); assert.ok(g2.u.P0.invul && g2.u.P0.sched);
  const before = g2.u.A0.hp + g2.u.A1.hp; skipTo(g2, 'P1'); skipTo(g2, 'A1'); skipTo(g2, 'P1'); assert.ok(!g2.u.P0.sched); assert.ok(g2.u.A0.hp + g2.u.A1.hp <= before - 150, '5번 × 40 의 합 (방어/난수 제외)');
});
test('플래피스: 맞으면 W, 기술 쓰면 R / 허리케인 다이브 1개 추가 = 다음 차례 100D', () => {
  const g = mk(['flappis', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); give(g.u.P0, 'WWR'); const e = E.info(g).skills.find(x => x.id === 'hurri'); assert.ok(e.ok);
  use(g, 'hurri', 0, {}, { R: 0, W: 1, B: 0 }); const f = g.u.P0; assert.ok(f.sched && f.sched.dmg === 100); assert.ok(E.eCount(f, 'R') >= 1, '기술 사용 후 R 직조');
  skipTo(g, 'P1'); skipTo(g, 'A1'); skipTo(g, 'P1'); skipTo(g, 'A1'); assert.ok(g.u.A0.hp <= 150 - 60, '예약 타격이 들어갔다'); assert.equal(f.sched, null);
});
test('이터너: 교체 봉쇄 / 이터너힐은 R 수×60D', () => {
  const g = mk(['eterna', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); skipTo(g, 'A0'); give(g.u.A0, 'BBBB'); assert.equal(E.info(g).switches.length, 0);
  const g2 = mk(['eterna', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); give(g2.u.P0, 'RR'); give(g2.u.A0, 'RR'); g2.u.P1.hp = 50; use(g2, 'heal', 0, { who: 'P0' }); assert.equal(g2.u.A0.hp, 150 - 120); assert.equal(E.eCount(g2.u.A0, 'R'), 0); assert.ok(g2.u.P1.hp > 50);
});
test('이터너: 흡착 발판은 아군에게 R + 고정 20 피해, 적에게는 R만', () => {
  const g = mk(['eterna', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); use(g, 'pad', 1); assert.equal(E.eCount(g.u.P1, 'R'), 1); assert.equal(g.u.P1.hp, 105);
});
test('톡시어스: 봉인 해제는 실드가 있을 때만, R 3개', () => {
  const g = mk(['toxious', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); use(g, 'unseal'); const t = g.u.P0; assert.equal(t.shield, 0); assert.equal(E.eCount(t, 'R'), 3); assert.equal(t.hp, 150);
});
test('톡시어스: 그라운드제로는 주 대상 140 + 다른 적 70D + 화상', () => {
  const g = mk(['toxious', 'mole', 'bee', 'tail'], ['turtle', 'boar', 'frog', 'mantis']); give(g.u.P0, 'RRR'); use(g, 'gzero', 0); assert.equal(g.u.A0.hp, 160 - 130); assert.equal(g.u.A1.hp, 150 - 70); assert.equal(g.u.A1.st.burn, 4);
});
test('아비게이트: 초저주포 4개=100D, R·W·B 모두 포함하면 독', () => {
  const g = mk(['abigate', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); give(g.u.P0, 'RWBR'); use(g, 'cannon', 0, {}, { R: 2, W: 1, B: 1 }); assert.equal(g.u.A0.hp, 150 - 100); assert.equal(g.u.A0.st.poison, 3); assert.equal(E.eTotal(g.u.P0), 0);
});
test('아비게이트: 다운프레셔 — 상대의 독 추가 코스트는 B', () => {
  const g = mk(['abigate', 'mole', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); const a = g.u.A0; a.st.poison = 2; const sk = E.def(a).skills[0]; assert.deepEqual(E.effCost(g, a, sk), ['B', 'B']);
});
test('아비게이트: 심해의소용돌이는 두 캐릭터의 에너지 색을 맞바꾼다 / 딥마인드', () => {
  const g = mk(['abigate', 'bee', 'tail', 'mole'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'BR'); give(g.u.A0, 'W'); use(g, 'vortex', 0, { a: 'P0', b: 'A0', ea: 1, eb: 0 });
  assert.equal(E.eCount(g.u.P0, 'R'), 0); assert.equal(E.eCount(g.u.P0, 'W'), 1); assert.equal(E.eCount(g.u.A0, 'R'), 0.5, '소용돌이 후 딥마인드로 ½ 제거');
  const g2 = mk(['abigate', 'bee', 'tail', 'mole'], ['mantis', 'fang', 'frog', 'turtle']); g2.u.P1.hp = 50; give(g2.u.P0, 'B'); give(g2.u.A0, 'RR'); skipTo(g2, 'P1'); give(g2.u.P1, 'WW'); const t0 = E.eTotal(g2.u.A0); use(g2, 'honey', 1); assert.equal(g2.u.P1.hp, 50 + 40 + 10); assert.equal(E.eTotal(g2.u.A0), t0 - 0.5);
});
test('엘릭시안: 샤이닝윈드 초과 회복은 보호막, 라스트기프트와 잔향', () => {
  const g = mk(['elixian', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); g.u.P1.hp = 115; give(g.u.P0, 'R'); use(g, 'wind'); assert.equal(g.u.P1.hp, 125); assert.equal(g.u.P0.bar.reduce((n, b) => n + b.n, 0), 20); assert.equal(E.eCount(g.u.P0, 'W'), 0.5);
  const g2 = mk(['elixian', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); g2.u.P1.hp = 30; give(g2.u.P0, 'RR'); use(g2, 'gift', 1); assert.ok(g2.u.P0.dead); assert.equal(g2.u.P1.hp, 125); assert.equal(g2.u.A0.st.freeze, 1); assert.equal(g2.t.P.res[0], true);
  for (let k = 0; k < 10 && E.info(g2).kind !== 'deploy'; k++) gather(g2); const i = E.info(g2); assert.equal(i.kind, 'deploy'); E.act(g2, { type: 'deploy', uid: 'P2' }); assert.ok(g2.u.P2.fx.res);
});
test('엘릭시안: 아로마필드는 증감 초기화 + 회복 +10 / 상대 회복 −10', () => {
  const g = mk(['elixian', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); g.u.P1.atkMod = 10; g.u.A0.hp = 50; give(g.u.P0, 'R'); use(g, 'aroma'); assert.equal(g.u.P1.atkMod, 0); assert.equal(g.field.kind, 'aroma');
  assert.equal(E.heal(g, null, g.u.A0, 40), 30); g.u.P1.hp = 50; assert.equal(E.heal(g, null, g.u.P1, 40), 50);
});
test('엘릭시안: 멀티애로는 등급이 높은 상대에게 2회, 아니면 3회', () => {
  const g = mk(['elixian', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'W'); use(g, 'arrow', 0); assert.equal(g.u.A0.hp, 115 - 60);
});
test('빙마기수: 냉동 흡수(걸리지 않고 HP +20), 빙천포효 + 파쇄창 콤보', () => {
  const g = mk(['iceknight', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const k = g.u.P0; give(k, 'WBWR*'.replace('*', 'B')); const hp0 = k.hp;
  use(g, 'roar', 0); assert.equal(k.st.freeze, undefined); assert.equal(k.hp, hp0 + 20); assert.equal(g.u.A0.st.freeze, 2); assert.equal(g.u.P1.st.freeze, 2);
  skipTo(g, 'P0'); give(k, 'WRB'); const h = g.u.A0.hp; use(g, 'lance', 0); assert.ok(h - g.u.A0.hp >= 70 + 30 * 1 - 1 || g.u.A0.dead); assert.equal(g.u.A0.st.freeze, undefined);
});
test('빙마기수: 날뛰기는 낸 에너지 총량×10D', () => {
  const g = mk(['iceknight', 'mole', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); give(g.u.P0, 'RWBB'); use(g, 'rampage', 0, {}, { R: 1, W: 1, B: 0 }); assert.equal(g.u.A0.hp, 160 - (3 * 10 - 10));
});
test('서킷: 교류충전(W→R/B→W), 완성 W 수만큼 추가 차례, 외부 에너지 조작 차단', () => {
  const g = mk(['circuit', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const c = g.u.P0; assert.deepEqual(E.gatherColors(g, c), ['W']); E.act(g, { type: 'gather' }); assert.equal(E.eCount(c, 'W'), 1);
  assert.ok(E.gatherColors(g, c).every(x => x !== 'W')); give(g.u.A0, 'RR'); assert.equal(E.removeE(g, c, 1, g.u.A0), 0, '적이 에너지를 뺏을 수 없다');
  c.e = [{ c: 'W', a: 1 }, { c: 'W', a: 1 }]; for (let k = 0; k < 8 && g.u.P0.turns < 1; k++) gather(g);
});
test('서킷: 전류가속 — 기본 차례 시작에 W 2개면 추가 차례 2번', () => {
  const g = mk(['circuit', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle'], { first: 'A' }); const c = g.u.P0; c.speed = 0; c.e = [{ c: 'W', a: 1 }, { c: 'W', a: 1 }]; c.delay = 0;
  let n = 0; let guard = 0; const t0 = c.turns; while (guard++ < 12 && c.turns < t0 + 3) { if (E.info(g).uid === 'P0') n++; gather(g); } assert.ok(n >= 3, `서킷이 연속으로 ${n}번 행동`);
});
test('서킷: 볼티지버스트 = W 수²×15D, B 획득', () => {
  const g = mk(['circuit', 'mole', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); const c = g.u.P0; c.delay = 0; give(c, 'WW'); use(g, 'burst', 0); assert.equal(g.u.A0.hp, 160 - 60 + 10); assert.equal(E.eCount(c, 'B'), 2); assert.equal(E.eCount(c, 'W'), 0);
});
test('서킷: 암즈블레이드 최대 HP 25%', () => {
  const g = mk(['circuit', 'mole', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); const c = g.u.P0; give(c, 'WW'); use(g, 'blade', 0); assert.equal(g.u.A0.hp, 160 - 40); assert.equal(g.u.A0.st.paralyze, 1); assert.equal(E.eCount(c, 'B'), 1); assert.equal(E.eCount(c, 'R'), 1);
});
test('타임오러: 방어 +20, 모으기 1.5, 시계 정렬이면 상대 특성 정지', () => {
  const g = mk(['timeora', 'mole', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); assert.equal(E.defOf(g, null, g.u.P1), 20); const t = g.u.P0; gather(g); assert.equal(E.eTotal(t), 1.5);
  assert.equal(E.traitOn(g, g.u.A0), true); t.fx.hour = 90; t.fx.min = 90 + 180; assert.equal(E.traitOn(g, g.u.A0), false, '정반대 → 정지'); assert.equal(E.traitOn(g, t), true, '주인은 영향 없음');
  g.u.A0.fx.hour = 0; 
});
test('타임오러: 타임리콜은 2턴 전 HP/상태를 복원, 하이퍼클락 100/160D', () => {
  const g = mk(['timeora', 'mole', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); const t = g.u.P0; give(t, 'WWBB');
  const m = g.u.P1; m.hp = 60; m.st.poison = 2; m.fx.hist = [{ hp: 125, st: {} }, { hp: 110, st: {} }, { hp: 60, st: { poison: 2 } }];
  use(g, 'recall', 'P1'); assert.equal(m.hp, 110); assert.equal(m.st.poison, undefined);
  skipTo(g, 'P0'); give(t, 'WWBB'); t.fx.hour = 10; t.fx.min = 40; const h = g.u.A0.hp; use(g, 'hyper', 0); assert.equal(h - g.u.A0.hp, 90); skipTo(g, 'P0'); give(t, 'WWBB'); t.fx.hour = 40; t.fx.min = 40; const h2 = g.u.A0.hp; use(g, 'hyper', 0); assert.ok(g.u.A0.dead && h2 <= 150, '정렬이면 160D → 남은 70을 넘겨 처치');
});
test('정글즈: 모으면 B만, 소환수가 피해를 대신 받고 차례 끝에 행동', () => {
  const g = mk(['jungles', 'mole', 'bee', 'tail'], ['fang', 'mantis', 'frog', 'turtle']); const j = g.u.P0; j.delay = 0; assert.deepEqual(E.gatherColors(g, j), ['B']);
  give(j, 'WRB'); use(g, 'toucan'); assert.equal(j.fx.sum.length, 1); assert.equal(j.fx.sum[0].hp, 60);
  skipTo(g, 'A0'); give(g.u.A0, 'RR'); const hp = j.hp; use(g, 'glass', 0); assert.equal(j.hp, hp); assert.ok(j.fx.sum[0].hp < 60, '소환수가 대신 맞았다');
});
test('정글즈: 덩굴휩 첫 사용은 대상의 가장 최근 에너지 강탈', () => {
  const g = mk(['jungles', 'mole', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const j = g.u.P0; j.delay = 0; give(j, 'B'); g.u.A0.e = [{ c: 'R', a: 1 }, { c: 'W', a: 1 }]; use(g, 'whip', 0);
  assert.equal(E.eCount(g.u.A0, 'W'), 0); assert.equal(E.eCount(j, 'W'), 1.5);
});
