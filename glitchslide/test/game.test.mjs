import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { CH, DX, DY } from '../js/gen.js';

function slide(w, c, r, d) { while (!w.wall(c + DX[d], r + DY[d])) { c += DX[d]; r += DY[d]; } return [c, r]; }
// 위로 올라가는 최단 슬라이드 경로의 첫 방향
function nextDir(g) {
  const w = g.w, p = g.p, goal = (Math.floor(p.r / CH) + 1) * CH;
  const seen = new Set([p.r * 16 + p.c]), q = [[p.c, p.r, -1]];
  while (q.length) {
    const [x, y, first] = q.shift();
    if (y >= goal) return first;
    for (let d = 0; d < 4; d++) {
      const [nx, ny] = slide(w, x, y, d), k = ny * 16 + nx;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny, first < 0 ? d : first]); }
    }
  }
  return 0;
}

test('봇이 60초씩 플레이해도 상태가 깨지지 않는다', () => {
  let rows = 0, deaths = 0, menus = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const g = new Game(seed * 31);
    for (let f = 0; f < 60 * 180 && !g.dead; f++) {
      if (g.menu) { menus++; if (g.menu.type === 'pick') g.choose(0); else { g.buy(0); g.buy(2); g.leave(); } }
      if (!g.p.moving) g.swipe(nextDir(g));
      if (f % 7 === 0) g.tap();
      g.update(1 / 180);
      assert.ok(Number.isFinite(g.p.x) && Number.isFinite(g.p.y) && Number.isFinite(g.score) && Number.isFinite(g.glitch));
      assert.ok(!g.w.wall(g.p.c, g.p.r) || g.p.moving, '플레이어가 벽 안에 멈춤');
      assert.ok(g.bits >= 0 && g.hp <= g.maxHp);
    }
    rows += g.maxRow; deaths += g.dead ? 1 : 0;
  }
  console.log(`평균 도달 ${Math.round(rows / 25)}줄, 사망 ${deaths}/25, 메뉴 ${menus}회`);
  assert.ok(rows / 25 > CH * 3);
  assert.ok(menus > 10);
});
