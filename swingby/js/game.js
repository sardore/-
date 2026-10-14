/* 게임 루프의 논리 부분: 한 프레임의 갱신(update)과 상태별 진행(step) */
import { G } from './state.js';
import { viewBot, updateCamera } from './camera.js';
import { stepShip } from './player.js';
import { updateBoss } from './boss.js';
import { gen, growField } from './world.js';
import { animatePlanets } from './planets.js';
import { updateMonsters } from './monsters.js';
import { checkProgress } from './progress.js';
import { updateFx } from './fx.js';
import { musicSet } from './audio.js';
import { orbSpd } from './stats.js';
import { updateTutorial } from './tutorial.js';
import { updateOps, cullOps } from './ops.js';

/** 플레이 중 한 틱 */
function update(dt) {
  if (G.tuto) updateTutorial(dt);
  if (G.boss) updateBoss(dt);
  if (!stepShip(dt)) return;
  updateCamera(dt);
  if (G.ops) updateOps(dt);
  if (!G.boss) { growField(dt); gen(); updateMonsters(dt); cull(); }
  if (!G.boss && G.ship.mode === 'orb') checkProgress();
}

/** 화면 아래로 멀어진 오브젝트 정리 */
function cull() {
  const lim = viewBot() + 260, s = G.ship;
  if (G.planets.length > 14) G.planets = G.planets.filter(p => p.y < lim || p === s.p);
  if (G.stars.length > 40) G.stars = G.stars.filter(t => t.y < lim && !t.got);
  if (G.mons.length > 4) G.mons = G.mons.filter(m => m.y < lim);
  if (G.holes.length > 12) G.holes = G.holes.filter(h => h.y < lim);
  if (G.ops) cullOps(lim);
}

/** 곡 상태: 보스전엔 보스곡, 평소엔 잔잔한 곡, 사망·격파 중엔 끈다 */
function musicWant() {
  if (G.st === 'dead') return { mode: 'off', bi: 0, phase: 0 };
  const b = G.boss;
  if (b) return b.state === 'dying' ? { mode: 'off', bi: 0, phase: 0 } : { mode: 'boss', bi: b.stage, phase: b.phase };
  return { mode: 'calm', bi: 0, phase: 0 };
}

/** 한 프레임의 논리 갱신. 그리기에 쓸 dt(G.gdt)도 여기서 정한다 */
export function step(dt) {
  G.T += dt; musicSet(musicWant());
  if (G.ops && G.st === 'play') G.ops.t += dt;   // 블랙쉽의 작전 시간(스피드런 기록)은 실제 시간. 진화·강화 선택 중에는 멈춘다
  if (G.freeze > 0) { G.freeze -= dt; G.gdt = dt * .1; updateFx(dt, G.gdt); return; }
  const sd = dt * G.ts; G.gdt = sd;
  updateFx(dt, sd);
  animatePlanets(sd);
  switch (G.st) {
    case 'title': { // 타이틀: 첫 행성을 천천히 돈다
      const s = G.ship; s.a += sd * orbSpd() / s.r; s.x = s.p.x + Math.cos(s.a) * s.r; s.y = s.p.y + Math.sin(s.a) * s.r;
      s.trail.push(s.x, s.y); if (s.trail.length > 48) s.trail.splice(0, 2); break;
    }
    case 'play': update(sd / 2); if (G.st === 'play') update(sd / 2); break;
    case 'pick': G.pickT += dt; break;
    case 'shop': break;   // 상점 화면은 입력과 그리기(shop-ui.js)만 쓴다
    case 'dead': G.deadT += dt; if (G.boss) G.boss.st += sd; break;
    case 'clear': G.clearT += dt; break;
  }
}
