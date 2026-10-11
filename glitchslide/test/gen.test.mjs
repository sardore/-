import test from 'node:test';
import assert from 'node:assert/strict';
import { World, COLS, CH, DX, DY, rng } from '../js/gen.js';

// 실제 월드 물리로 한 번 미끄러진 결과
function slide(w, c, r, d) {
  let n = 0;
  while (!w.wall(c + DX[d], r + DY[d])) { c += DX[d]; r += DY[d]; n++; }
  return [c, r, n];
}
// (c,r)에서 goal 줄 이상으로 올라갈 수 있는가
function canClimb(w, c, r, goal) {
  const seen = new Set([r * 16 + c]), q = [[c, r]];
  while (q.length) {
    const [x, y] = q.shift();
    if (y >= goal) return true;
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = slide(w, x, y, d), k = ny * 16 + nx;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return false;
}

test('청크 생성은 폴백 없이 성공한다', () => {
  let tries = 0, chunks = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = new World(seed); w.ensure(CH * 40);
    assert.equal(w.stats.fallbacks, 0, 'seed ' + seed);
    tries += w.stats.tries; chunks += w.chunks.length;
  }
  console.log('평균 시도 횟수/청크:', (tries / chunks).toFixed(1));
});

test('어디에 멈춰도 항상 위로 올라갈 길이 있다 (무작위 플레이 2만 수)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = new World(seed * 7919), rand = rng(seed);
    let c = (COLS - 1) / 2, r = 0;
    for (let i = 0; i < 1000; i++) {
      w.ensure(r + CH * 4);
      const goal = (Math.floor(r / CH) + 1) * CH;
      assert.ok(canClimb(w, c, r, goal), `seed ${seed} 수 ${i}: (${c},${r})에서 갇힘`);
      // 위쪽을 조금 선호하는 무작위 이동
      const d = rand() < 0.35 ? 0 : (rand() * 4) | 0;
      [c, r] = slide(w, c, r, d);
    }
  }
});

test('비트와 장소는 바닥 위에만 놓인다', () => {
  const w = new World(123); w.ensure(CH * 30);
  for (const k of w.items.keys()) assert.ok(!w.wall(k % 16, Math.floor(k / 16)));
  assert.ok(w.chunks.filter(c => c.place).length >= 15);
});
