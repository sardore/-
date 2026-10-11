import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, josa } from '../js/game.js';
import { genDungeon } from '../js/map.js';
import { KINDS, MONSTERS, CLASSES, RACES } from '../js/data.js';
import { T, walk } from '../js/map.js';

test('조사 처리', () => {
  assert.equal(josa('코볼트', '을/를'), '코볼트를'); assert.equal(josa('단검 (1d4) (+0,+0)', '을/를'), '단검 (1d4) (+0,+0)을'); assert.equal(josa('화살', '으로/로'), '화살로'); assert.equal(josa('독침 함정', '으로/로'), '독침 함정으로');
});

test('모든 층: 통행 가능한 칸이 전부 이어져 있고 계단 규칙이 맞다', () => {
  const g = new Game({ seed: 5 });
  for (let d = 1; d <= 30; d++) for (let i = 0; i < 12; i++) {
    const m = genDungeon(d, g, { noDown: d === 30 });
    assert.ok(m.ups.length >= 1); assert.equal(m.downs.length > 0, d !== 30);
    let total = 0, start = -1; for (let k = 0; k < m.t.length; k++) if (walk(m.t[k]) || m.t[k] === T.DOOR || m.t[k] === T.RUBBLE) { total++; if (start < 0) start = k; }
    const seen = new Uint8Array(m.t.length), st = [start]; seen[start] = 1; let c = 1;
    while (st.length) { const k = st.pop(); for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) { const n = k + dx + dy * m.w; if (!seen[n] && (walk(m.t[n]) || m.t[n] === T.DOOR || m.t[n] === T.RUBBLE)) { seen[n] = 1; c++; st.push(n); } } }
    assert.equal(c, total, `depth ${d}`);
  }
});

test('아이템 생성과 이름이 모든 깊이에서 동작한다', () => {
  const g = new Game({ seed: 9 });
  for (let d = 1; d <= 34; d++) for (let i = 0; i < 200; i++) { const it = g.makeItem(d, i % 3); const n = g.name(it); assert.ok(n && !n.includes('undefined') && !n.includes('NaN'), n); assert.ok(Number.isFinite(g.value(it))); g.describe(it); g.known[KINDS[it.k].id] = 1; assert.ok(!g.name(it).includes('undefined')); }
  for (let i = 0; i < MONSTERS.length; i++) g.describeMon({ r: i, hp: 5, mhp: 10, sleep: 0, fear: 0 }).forEach(s => assert.ok(!s.includes('undefined'), s));
});

// 봇: 위험하면 물약, 적이 보이면 싸우고(직업별), 아니면 탐험 → 계단
function bot(g, steps, dive) {
  const p = g.p; let stuck = 0; g.skipN = 0;
  for (let n = 0; n < steps && !g.dead && !g.won; n++) {
    const before = g.pturn + ':' + g.depth + ':' + p.x + ':' + p.y + ':' + p.hp;
    if (g.shop >= 0) g.shop = -1;
    const foe = g.mons.filter(m => !m.dead && m.direct).sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)))[0];
    const find = id => p.inv.findIndex(i => KINDS[i.k].id === id);
    if (p.hp < p.d.mhp * 0.4 && (find('p_csw') >= 0 || find('p_clw') >= 0)) g.use(find('p_csw') >= 0 ? find('p_csw') : find('p_clw'));
    else if (foe) {
      const d = Math.max(Math.abs(foe.x - p.x), Math.abs(foe.y - p.y)); p.target = foe.id; let done = false;
      const still = MONSTERS[foe.r].F.has('never');
      if (still && d > 1 && p.cls === 'warrior') { foe.direct = false; n--; if (++g.skipN > 5000) break; continue; }   // 움직이지 않는 적은 건드리지 않는다
      if (p.cls === 'mage') done = g.cast(p.lv >= 13 && p.mp >= 5 ? 'frost' : 'missile');
      if (!done && p.eq.bow && (d > 1 || p.cls === 'ranger')) done = g.fire();
      if (!done && find('flask') >= 0 && (d > 1 || p.cls === 'mage')) done = g.use(find('flask'));
      if (!done && still && d > 1) { foe.direct = false; n--; if (++g.skipN > 5000) break; continue; }
      if (!done) { if (d <= 1) g.move(foe.x - p.x, foe.y - p.y); else { g.auto = 'travel'; g.dest = g.I(foe.x, foe.y); g.autoN = 0; if (!g.continue()) g.wait(); g.auto = null; } }
    } else if (p.hp < p.d.mhp * 0.6 && p.food > 1500) { g.start('rest'); let c = 0; while (g.auto && c++ < 300) g.continue(); if (c <= 1) g.wait(); }
    else if (p.food < 2500 && find('ration') >= 0) g.use(find('ration'));
    else {
      const here = g.map.t[g.I(p.x, p.y)];
      if (here === T.DOWN && (dive || g.depth === 0 || !g.explorable)) { g.stairs(); g.explorable = true; }
      else { g.start('explore'); let c = 0; while (g.auto && c++ < 400) g.continue();
        if (c <= 1) { g.explorable = false; const k = g.nearest(T.DOWN); if (k >= 0 && k !== g.I(p.x, p.y)) { g.start('travel', k); let c2 = 0; while (g.auto && c2++ < 400) g.continue(); } else if (k < 0) { const s = p.inv.findIndex(i => ['s_deep', 's_tele'].includes(KINDS[i.k].id)); if (s >= 0) g.use(s); else g.wait(); } } }
    }
    stuck = before === g.pturn + ':' + g.depth + ':' + p.x + ':' + p.y + ':' + p.hp ? stuck + 1 : 0;
    if (stuck > 30) { g.wait(); if (stuck > 60) { g.stuckCount = (g.stuckCount || 0) + 1; const s2 = p.inv.findIndex(i => ['s_tele', 's_phase'].includes(KINDS[i.k].id)); if (s2 >= 0) g.use(s2); stuck = 0; } }
    assert.ok(Number.isFinite(p.hp) && Number.isFinite(p.exp) && Number.isFinite(p.gold) && Number.isFinite(p.d.ac), 'NaN');
    assert.ok(walk(g.map.t[g.I(p.x, p.y)]), '플레이어가 벽 안에 있다');
    assert.ok(p.inv.every(i => i.n > 0) && p.inv.length <= 22);
  }
}

test('봇 플레이: 직업·종족 조합으로 수천 턴을 돌려도 상태가 깨지지 않는다', () => {
  const rows = [];
  for (const cls of Object.keys(CLASSES)) for (const race of Object.keys(RACES)) for (let s = 1; s <= 2; s++) {
    const g = new Game({ seed: s * 977 + cls.length * 31 + race.length, cls, race }); bot(g, 2500, false);
    rows.push(`${CLASSES[cls].name}/${RACES[race].name}: ${g.dead ? '사망' : '생존'} 최대 ${g.maxDepth}층 Lv${g.p.lv} ${g.pturn}턴 처치${g.kills}${g.dead ? ' (' + g.cause + ')' : ''}`);
  }
  console.log(rows.join('\n'));
});

test('깊은 층: 강화한 캐릭터로 20~30층을 돌려도 깨지지 않는다(용 숨결, 소환, 보스 포함)', () => {
  for (const cls of Object.keys(CLASSES)) for (const depth of [12, 20, 26, 30]) {
    const g = new Game({ seed: depth * 13 + cls.length, cls }); const p = g.p;
    g.deadU['검은 부관 모르단'] = depth > 20 ? 1 : 0; p.lv = 20 + depth; p.st = { str: 20, int: 20, dex: 20, con: 20 }; g.calc(); p.hp = p.d.mhp = 5000; p.mp = p.d.mmp;
    for (let i = 0; i < 40; i++) p.inv.length < 20 && g.addInv(g.makeItem(depth, 1));
    g.enter(depth, 'down');
    for (let n = 0; n < 60 && !g.dead; n++) { p.hp = Math.max(p.hp, 3000); bot(g, 25, false); }
    assert.ok(g.depth >= 1);
  }
});

test('저장 → 불러오기가 상태를 보존하고, 같은 입력에 같은 결과를 낸다', () => {
  const a = new Game({ seed: 4242, cls: 'ranger', race: 'elf' }); bot(a, 300, true);
  const j = a.toJSON(), b = new Game({ load: JSON.parse(JSON.stringify(j)) });
  assert.deepEqual(b.toJSON(), j);
  bot(a, 200, true); bot(b, 200, true);
  assert.equal(a.pturn, b.pturn); assert.equal(a.p.hp, b.p.hp); assert.equal(a.depth, b.depth); assert.equal(a.p.exp, b.p.exp);
});

test('상점: 사고팔 때 금화와 가방이 맞게 움직인다', () => {
  const g = new Game({ seed: 3 }); g.p.gold = 1000; const before = g.p.gold, e = g.shops[0][0], pr = g.price(e), cnt = g.p.inv.reduce((s, i) => s + i.n, 0);
  assert.ok(g.buy(0, 0)); assert.equal(g.p.gold, before - pr); assert.equal(g.p.inv.reduce((s, i) => s + i.n, 0), cnt + 1);
  const i = g.p.inv.findIndex(x => KINDS[x.k].tv === 'potion'), sp = g.sellPrice(g.p.inv[i]), g2 = g.p.gold; assert.ok(g.sell(i)); assert.equal(g.p.gold, g2 + sp);
  g.p.gold = 0; assert.equal(g.buy(1, 0), false);
});
