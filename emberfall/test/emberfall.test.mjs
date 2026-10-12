// node --test test/emberfall.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { genFloor, reachable, W, H } from '../js/gen.js';
import { Game, memStore } from '../js/game.js';
import { runBot } from './bot.mjs';

test('모든 층: 시작점에서 출구/우물까지 닿는다', () => {
  for (let depth = 0; depth < 15; depth++) for (let s = 1; s <= 12; s++) {
    const f = genFloor(s * 7919 + depth, depth);
    const r = reachable(f, f.spawn);
    assert.ok(f.exit, `출구 없음 d${depth} s${s}`);
    if (f.boss) { const a = f.arena; let ok = false; for (let y = a.y; y < a.y + a.h && !ok; y++) for (let x = a.x; x < a.x + a.w; x++) if (r[y * W + x]) { ok = true; break; } assert.ok(ok, `보스방에 닿지 못함 d${depth} s${s}`); }
    else assert.ok(r[f.exit.y * W + f.exit.x], `출구에 닿지 못함 d${depth} s${s}`);
  }
});

test('저장/불러오기 왕복', () => {
  const st = memStore(); const g = new Game(st, 5); g.enterVillage(); while (g.mode === 'dialog') g.dlgNext(); g.startRun(0);
  for (let i = 0; i < 20; i++) g.wait(); g.saveRun();
  const h = new Game(st, 6); assert.ok(h.hasSavedRun()); assert.ok(h.loadRun());
  assert.equal(h.pl.x, g.pl.x); assert.equal(h.run.depth, g.run.depth); assert.equal(h.run.turns, g.run.turns);
  assert.equal(h.f.t.length, W * H);
});

test('봇 스모크: 예외 없이 여러 시드가 돈다', () => {
  for (let s = 1; s <= 6; s++) { const { g, turns } = runBot(s, 1500); assert.ok(turns > 10); assert.ok(g.mode); }
});

test('죽으면 유해가 남고 다음 세대가 열린다', () => {
  const g = new Game(memStore(), 3); g.enterVillage(); while (g.mode === 'dialog') g.dlgNext(); g.startRun(0);
  const gen = g.meta.gen; g.die('포기'); assert.equal(g.mode, 'dead'); assert.equal(g.meta.gen, gen + 1); assert.ok(g.meta.remains[0]);
  g.enterVillage(); assert.equal(g.mode, 'play');
});
