import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, rng } from '../js/sim.js';
import { UNITS, HEROES, ALL, STAGES, START, stageGold, lvCost, MAXLV } from '../js/data.js';

const pick = (r, pool, n) => { const p = pool.slice(), o = []; while (o.length < n) o.push(p.splice((r() * p.length) | 0, 1)[0]); return o; };

test('같은 시드는 같은 결과를 낸다', () => {
  const A = ['knight', 'mage', 'archer', 'priest'].map(id => ({ id, lv: 5 })), B = ['lancer', 'rogue', 'bomber', 'bard'].map(id => ({ id, lv: 5 }));
  const a = new Battle(A, B, 42).run(), b = new Battle(A, B, 42).run();
  assert.equal(a.winner, b.winner); assert.equal(a.t, b.t);
  assert.deepEqual(a.units.map(u => Math.round(u.hp)), b.units.map(u => Math.round(u.hp)));
});

test('모든 유닛 조합에서 전투가 끝나고 수치가 깨지지 않는다', () => {
  const r = rng(7);
  for (let i = 0; i < 600; i++) {
    const b = new Battle(pick(r, ALL, 4).map(id => ({ id, lv: 1 + (r() * 15 | 0) })), pick(r, ALL, 4).map(id => ({ id, lv: 1 + (r() * 15 | 0) })), i).run();
    assert.ok(b.over);
    for (const u of b.units) { assert.ok(Number.isFinite(u.hp) && Number.isFinite(u.x) && u.hp <= u.maxHp + 0.01, u.id); assert.ok(u.x >= 0 && u.x <= 1000, u.id + ' x=' + u.x); }
  }
});

test('빈 칸이 있어도(1대4 등) 동작한다', () => {
  const b = new Battle([{ id: 'dragon', lv: 5 }, null, null, null], ['knight', 'mage', 'archer', 'priest'].map(id => ({ id, lv: 5 })), 3).run();
  assert.ok(b.over);
});

test('밸런스 리포트: 영웅별 승률', () => {
  const r = rng(99), win = {}, n = {};
  for (let i = 0; i < 4000; i++) {
    const A = pick(r, HEROES, 4), B = pick(r, HEROES, 4), b = new Battle(A.map(id => ({ id, lv: 8 })), B.map(id => ({ id, lv: 8 })), i).run();
    for (const id of A) { n[id] = (n[id] || 0) + 1; if (b.winner === 0) win[id] = (win[id] || 0) + 1; }
    for (const id of B) { n[id] = (n[id] || 0) + 1; if (b.winner === 1) win[id] = (win[id] || 0) + 1; }
  }
  const rows = HEROES.map(id => [id, Math.round(100 * (win[id] || 0) / n[id])]).sort((a, b) => b[1] - a[1]);
  console.log(rows.map(([id, w]) => `${UNITS[id].name}(${id}) ${w}%`).join(' · '));
  for (const [id, w] of rows) assert.ok(w >= 38 && w <= 62, `${id} 승률 ${w}%`);
});

test('스토리: 자동 전투만으로도 과한 노가다 없이 끝까지 간다', () => {
  // 탐욕적 플레이어: 가진 영웅 중 레벨 높은 순으로(전열1+나머지) 편성, 골드는 편성 4명에 고르게 투자. 지면 직전 스테이지를 다시 돈다.
  const lv = Object.fromEntries(START.map(id => [id, 1])); let owned = START.slice(), gold = 0, replays = 0; const log = [];
  const team = () => { const s = owned.slice().sort((a, b) => lv[b] - lv[a]); const fr = s.filter(id => UNITS[id].pos === 'front').slice(0, 2), rest = s.filter(id => !fr.includes(id)); return fr.concat(rest).slice(0, 4); };
  const spend = () => { for (;;) { const t = team().sort((a, b) => lv[a] - lv[b])[0]; if (lv[t] >= MAXLV || gold < lvCost(lv[t])) break; gold -= lvCost(lv[t]); lv[t]++; } };
  const winRate = i => { let w = 0; const t = team().map(id => ({ id, lv: lv[id] })); for (let s = 0; s < 20; s++) if (new Battle(t, STAGES[i].foes, 1000 + s * 31 + i).run().winner === 0 && true) w++; return w / 20; };
  for (let i = 0; i < STAGES.length; i++) {
    let guard = 0;
    while (winRate(i) < 0.5) { assert.ok(i > 0 && guard++ < 12, `스테이지 ${i + 1}에서 막힘 (${log.join(' ')})`); gold += stageGold(i - 1); replays++; spend(); }
    gold += stageGold(i) * 2; if (STAGES[i].unlock) { owned.push(STAGES[i].unlock); lv[STAGES[i].unlock] = 1; } spend();
    log.push(`${i + 1}:Lv${Math.max(...team().map(id => lv[id]))}`);
  }
  console.log('클리어 시점 최고 레벨 →', log.join(' '), '| 재도전 노가다', replays, '회');
  assert.ok(replays <= 20);
});
