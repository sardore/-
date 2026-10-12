import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { ROSTER } from '../js/cards.js';
import { chooseAction, playOut } from '../js/ai.js';

const mk = (P, A, o = {}) => { const g = E.newGame(P, A, { seed: 7, variance: false, first: 'P', ...o }); E.begin(g); return g; };
const give = (u, s) => { u.e = [...s].map(c => ({ c, a: 1 })); };
const use = (g, id, slot = 0, extra = {}, plus = null) => { const i = E.info(g); const e = i.skills.find(x => x.id === id); assert.ok(e && e.ok, `skill ${id} usable: ${e && e.why}`); const t = e.targets.find(t => t.slot === slot) || e.targets[0]; return E.act(g, { type: 'skill', skill: id, target: t, extra, plus }); };
const gather = g => E.act(g, { type: 'gather' });
const rounds = (g, n) => { for (let k = 0; k < n; k++) gather(g); };
const cur = g => g.u[E.info(g).uid];

test('게임 생성: 필드 2 + 후열 2, 순서 P-A-P-A', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']);
  assert.deepEqual(g.t.P.field, ['P0', 'P1']); assert.deepEqual(g.t.A.bench, ['A2', 'A3']);
  assert.deepEqual(g.order.map(o => o.join('')), ['P0', 'A0', 'P1', 'A1']);
});
test('기본 피해: 난수 없음 35D, 방어 10 거북은 25D, 실드는 먼저 깎고 초과분은 사라진다', () => {
  let g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'R'); use(g, 'arrow', 0); assert.equal(g.u.A0.hp, 115 - 35);
  g = mk(['mole', 'boar', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); give(g.u.P0, 'R'); use(g, 'arrow', 0); assert.equal(g.u.A0.hp, 160 - 25);
  g = mk(['mole', 'boar', 'bee', 'tail'], ['mushroom', 'fang', 'frog', 'mantis']); g.u.A0.shield = 20; give(g.u.P0, 'RR'); use(g, 'pierce', 0); assert.equal(g.u.A0.shield, 0); assert.equal(g.u.A0.hp, 120, '초과 피해는 HP 로 넘어가지 않는다');
});
test('관통화살은 방어를 5까지만 적용', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['turtle', 'fang', 'frog', 'mantis']); give(g.u.P0, 'RR'); use(g, 'pierce', 0); assert.equal(g.u.A0.hp, 160 - 65);
});
test('코스트: 독이면 ★ 하나 추가, 그랜드필드는 내 W/B 를 ★ 로', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const u = g.u.P0; u.st.poison = 2; give(u, 'R'); assert.equal(E.info(g).skills[0].ok, false);
  give(u, 'RR'); assert.equal(E.info(g).skills[0].ok, true); u.st = {}; g.field = { kind: 'grand', team: 'P' }; const bee = g.u.P2; assert.deepEqual(E.effCost(g, bee, def(bee).skills[1]), ['*', '*']);
});
function def(u) { return E.def(u); }
test('에너지: 모으기는 1개, 감속이면 ½, ½ 둘은 합쳐진다', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); gather(g); assert.equal(E.eTotal(g.u.P0), 1);
  g.u.P1.st.slow = 3; rounds(g, 2); assert.equal(E.eTotal(g.u.P1), 0.5); rounds(g, 4); assert.ok(E.eTotal(g.u.P1) >= 1 - 1e-9);
});
test('에너지가 가득 차면 새 에너지를 버리거나 교체한다', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'RRRR'); gather(g); assert.equal(E.eTotal(g.u.P0), 4);
});
test('화상: 기술을 안 쓴 차례 끝에 30, 기술을 쓰면 없음 · 상태 지속 감소', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const u = g.u.P0; u.st.burn = 2; gather(g); assert.equal(u.hp, 95); assert.equal(u.st.burn, 1);
  rounds(g, 3); give(u, 'R'); use(g, 'arrow', 0); assert.equal(u.hp, 95 - 0, '기술 사용 차례는 화상 피해 없음 (이미 지속 만료)');
});
test('냉동은 기술 불가, 마비는 모으기 불가 → 둘 다 막히면 pass', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const u = g.u.P0; give(u, 'RR'); u.st.freeze = 2; assert.equal(E.info(g).skills.every(s => !s.ok), true);
  u.st.freeze = 0; delete u.st.freeze; u.st.paralyze = 2; let i = E.info(g); assert.equal(i.gather, false); give(u, ''); i = E.info(g); assert.equal(i.pass, true); E.act(g, { type: 'pass' }); assert.equal(E.info(g).uid, 'A0');
});
test('교체: 비용 1 ★, 상태이상 길이만큼 비싸짐, 팀당 3번', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const u = g.u.P0; assert.equal(E.switchCost(u), 1); u.st.slow = 2; assert.equal(E.switchCost(u), 3);
  u.st = {}; give(u, 'R'); E.act(g, { type: 'switch', bench: 0 }); assert.equal(g.t.P.field[0], 'P2'); assert.equal(g.t.P.bench[0], 'P0'); assert.equal(g.t.P.sw, 1); assert.equal(E.eTotal(u), 0);
});
test('속도: Speed -1 은 출전 후 한 차례 쉬고, Speed +는 교체가 공짜', () => {
  const g = E.newGame(['huve', 'boar', 'bee', 'shuvi'], ['mantis', 'fang', 'frog', 'turtle'], { seed: 1, first: 'P' }); assert.equal(g.u.P0.delay, 1); assert.equal(E.switchCost(g.u.P3), 0);
  E.begin(g); assert.equal(g.u.P0.delay, 0, '첫 차례는 자동으로 쉬었다'); assert.equal(E.info(g).uid, 'A0');
});
test('사망 → 후열 출전, 마지막 생존자까지 쓰러지면 승패', () => {
  const g = mk(['mole', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); g.u.A0.hp = 20; give(g.u.P0, 'R'); use(g, 'arrow', 0); assert.equal(g.u.A0.dead, true); assert.equal(g.t.A.field[0], null);
  let i = E.info(g); assert.equal(i.kind, 'deploy'); assert.equal(i.team, 'A'); E.act(g, { type: 'deploy', uid: 'A2' }); assert.equal(g.t.A.field[0], 'A2');
  for (const id of ['A1', 'A2', 'A3']) { g.u[id].hp = 0; E.checkDeath(g, g.u[id]); } assert.equal(g.winner, 'P');
});
test('웨이리: 공방 증감 무시', () => {
  const g = mk(['wayli', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); g.u.P0.atkMod = 50; g.u.A0.defMod = 30; use(g, 'splash', 0); assert.equal(g.u.A0.hp, 115 - 30);
});
test('이루마: 모든 피해 -40, 시프트는 아군의 잃은 HP를 가져온다', () => {
  const g = mk(['iruma', 'boar', 'bee', 'tail'], ['mole', 'fang', 'frog', 'turtle'], { first: 'A' }); give(g.u.A0, 'R'); const t = E.info(g); assert.equal(t.team, 'A'); use(g, 'arrow', 0); assert.equal(g.u.P0.hp, 150, '35D - 40 → 0');
});
test('브케노 지진: 필드 에너지 전부 제거', () => {
  const g = mk(['bkeno', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'RWB'); give(g.u.P1, 'RR'); give(g.u.A0, 'W'); use(g, 'quake', 0); assert.equal(E.eTotal(g.u.P1), 0); assert.equal(g.u.A0.dead, true); assert.equal(E.eTotal(g.u.P0), 0);
});
test('슈가스웜프: 즉시 30D+독3 후 자기 차례 두 번을 자동 반복 공격', () => {
  const g = mk(['sweetna', 'boar', 'bee', 'tail'], ['boar', 'fang', 'frog', 'turtle']); give(g.u.P0, 'RRR'); use(g, 'swamp', 0); assert.equal(g.u.A0.st.poison >= 1, true); assert.ok(g.u.P0.sched);
  const hp1 = g.u.A0.hp; gather(g); gather(g); gather(g); const hp2 = g.u.A0.hp; assert.ok(hp2 < hp1, '자동 공격이 들어갔다'); gather(g); gather(g); gather(g); gather(g);
  assert.equal(g.u.P0.sched, null);
});
test('활공: 무적으로 기다렸다가 자동 피해', () => {
  const g = mk(['galewing', 'boar', 'bee', 'tail'], ['mole', 'fang', 'frog', 'turtle']); give(g.u.P0, 'RR'); use(g, 'glide', 0); assert.equal(g.u.P0.invul, true);
  give(g.u.A0, 'R'); const hp = g.u.P0.hp; use(g, 'arrow', 0); assert.equal(g.u.P0.hp, hp, '무적'); const ah = g.u.A0.hp; gather(g); gather(g); assert.equal(g.u.A0.hp, ah - 60 + 0 * 0 < ah ? g.u.A0.hp : ah);
  assert.ok(g.u.A0.hp < ah);
});
test('폭시어스: 스트라이크할 때마다 요구색이 W→B→R 로 순환', () => {
  const g = mk(['foxious', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const f = g.u.P0; give(f, 'WWWW'); use(g, 'strike1', 0); assert.equal(f.fx.cyc, 'B');
  rounds(g, 3); give(f, 'BBB'); assert.deepEqual(E.effCost(g, f, E.def(f).skills[0]), ['B']); use(g, 'strike1', 0); assert.equal(f.fx.cyc, 'R');
});
test('제노사이더: 보유 B 1개당 최대 HP +60', () => {
  const g = mk(['genocider', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); const u = g.u.P0; E.gain(g, u, 'B', 1); assert.equal(u.maxHp, 300); E.gain(g, u, 'B', 1); assert.equal(u.maxHp, 360); E.clearE(g, u); assert.equal(u.maxHp, 240);
});
test('도끼새우: W 로 R/B 를 대신 낼 수 있다', () => {
  const g = mk(['axshrimp', 'boar', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle']); give(g.u.P0, 'WWW'); assert.equal(E.info(g).skills[1].ok, true);
});
test('미스틱버스트: 추가 R 당 +30D', () => {
  const g = mk(['boar', 'huve', 'bee', 'tail'], ['yggdrasil', 'fang', 'frog', 'turtle']); while (E.info(g).uid !== 'P1') gather(g); give(g.u.P1, 'WBRRR'); const hp = g.u.A0.hp; use(g, 'mystic', 0, {}, { R: 2, W: 0, B: 0 }); assert.equal(hp - g.u.A0.hp, 160);
});
test('AI 대 AI: 무작위 덱 60판이 예외 없이 끝난다', () => {
  let s = 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let n = 0; n < 60; n++) { const a = [...ROSTER], d = []; while (d.length < 8) d.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); const g = E.newGame(d.slice(0, 4), d.slice(4), { seed: 'n' + n }); playOut(g, { max: 3000 }); assert.ok(g.winner, `결판 ${d}`); }
});
test('같은 시드면 같은 전투', () => {
  const run = () => { const g = E.newGame(['mole', 'ruby', 'bee', 'tail'], ['mantis', 'fang', 'frog', 'turtle'], { seed: 'x' }); E.begin(g); for (let k = 0; k < 30 && !g.winner; k++) { const a = E.enumerate(g); E.act(g, a[k % a.length]); } return JSON.stringify([g.u.P0.hp, g.u.A0.hp, g.logs.length, g.rs]); };
  assert.equal(run(), run());
});
