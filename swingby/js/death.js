/* 사망: 비상 추진기가 남았으면 가장 가까운 행성 궤도로 되돌리고, 아니면 게임 오버 */
import { G } from './state.js';
import { save } from './util.js';
import { maxOrbit } from './stats.js';
import { viewTop, viewBot } from './camera.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, ringFx, hitstop, flashScreen, slowmo, popText } from './fx.js';
import { forkArrive } from './fork.js';
import { settleRun } from './shop.js';

export function die(why) {
  const s = G.ship, st = G.stats;
  if (st.shield > 0) { // 비상 추진기: 가장 가까운 행성 궤도로 되돌린다
    st.shield--; let bp = null;
    for (const p of G.planets) { if (p.dead || p.ghost) continue; if (p.y < viewBot() - (G.boss ? 130 : 70) / G.vz && p.y > viewTop() + 50 / G.vz && (!bp || Math.hypot(p.x - s.x, p.y - s.y) < Math.hypot(bp.x - s.x, bp.y - s.y))) bp = p; }
    bp = bp || s.p;
    let a = Math.atan2(s.y - bp.y, s.x - bp.x); if (!isFinite(a)) a = 0;
    s.mode = 'orb'; s.p = bp; s.r = maxOrbit(bp) - 4; s.a = a; s.swept = 0; s.air = 0; s.last = null; s.trail.length = 0; s.inv = 1.5; s.boost = 1; s.gd = 0; s.charging = false; s.heat = 0;
    s.x = bp.x + Math.cos(a) * s.r; s.y = bp.y + Math.sin(a) * s.r;
    if (!G.boss && !bp.seen) { bp.seen = true; G.hops++; }
    if (!G.boss) forkArrive(bp);
    if (G.boss) G.bo2 = Math.max(G.bo2, 6);
    G.combo = 0; popText(s.x, s.y - 20, '비상 추진!', '#ff9d7a', 17); burst(s.x, s.y, '#ff9d7a', 22, 220); ringFx(s.x, s.y, '#ff9d7a', 6, 90, .5, 4);
    beep(220, .25, 'sawtooth'); noise(.4, .2, 3000, 200); G.shake = 10; hitstop(.1); flashScreen(.3, '#ff9d7a');
    return;
  }
  G.st = 'dead'; G.deadT = 0; G.deadWhy = why; G.shake = 18; hitstop(.14); flashScreen(.5, '#fff'); slowmo(.35, .9);
  burst(s.x, s.y, '#fff', 34, 280); burst(s.x, s.y, '#ff6a6a', 24, 200); ringFx(s.x, s.y, '#fff', 6, 140, .6, 4); ringFx(s.x, s.y, '#ff6a6a', 6, 100, .5, 3);
  beep(110, .5, 'sawtooth', .14); thump(120, 30, .6, .4); noise(.7, .3, 4000, 100); vibe([60, 40, 120]);
  if (G.score > G.best && !G.debug && !G.tuto) { G.best = G.score; G.newBest = true; save('swingby_best', G.best); }
  settleRun();
}
