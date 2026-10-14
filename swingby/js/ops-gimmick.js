/* 거대 행성 기믹. 일반 행성보다 훨씬 큰 행성이 몇 개마다 하나씩 나오고, 둘이 번갈아 나온다. 글자 안내는 없고 모양과 불빛으로만 알린다.
 *   k 출격 갑판(hangar) — 주기적으로 해치가 열리고 경고등이 깜박인 뒤 쾌속정을 내보낸다(경고는 가로 방향의 점선 항로와 해치 불빛)
 *   v 보급 부두(depot) — 수송선이 정박해 있다. 처음 착지하면 수송선의 짐이 보상으로 넘어온다: 짐 표시가 진화 화살표면 진화, 불꽃이면 비상 추진기
 * 기믹 행성도 평범하게 포획되고 오래 머물러도 되는 느린 궤도다(OPS_DEC). 보스전에는 나오지 않는다 */
import { G } from './state.js';
import { rnd, PI } from './util.js';
import { OPS } from './ops-data.js';
import { fs } from './stats.js';
import { viewTop, viewBot } from './camera.js';
import { mkMook } from './ops-mook.js';
import { burst, ringFx, popText, flashScreen, shakeAdd } from './fx.js';
import { beep, thump, noise } from './audio.js';

/** 다음에 만들 행성이 기믹 거대 행성이면 그 종류('k' · 'v'), 아니면 null. 판 시작 후 9번째 행성부터, 10~14개마다 하나씩 */
export function gimmickType() {
  const m = G.ops.gim;
  if (G.boss || G.genI < m.due) return null;
  m.due = G.genI + 10 + Math.floor(Math.random() * 5); m.n++;
  return m.n % 2 ? 'k' : 'v';
}
/** 방금 만든 기믹 행성에 기믹 상태를 붙인다 */
export function giantify(p) {
  if (p.t === 'k') p.gim = { kind: 'hangar', t: rnd(2, 5), warn: 0, hatch: 0, open: 0, ang: [rnd(-.18, .12), PI + rnd(-.12, .18)] };
  else if (p.t === 'v') p.gim = { kind: 'depot', reward: G.stats.shield < 1 && Math.random() < .12 ? 'thruster' : 'evo', used: false, dock: 1, leave: 0, a: rnd(-.9, -.3) };
}
/** 보스를 쓰러뜨린 뒤 새 구간: 기믹 간격을 새로 잡는다 */
export function resetGimmicks() { G.ops.gim.due = G.genI + 8; }

export function updateGimmicks(dt) {
  const top = viewTop() - 60, bot = viewBot() + 40, k = fs();
  for (const p of G.planets) {
    const gm = p.gim; if (!gm || p.dead) continue;
    if (gm.kind === 'depot') { if (gm.used && gm.leave < 1) gm.leave = Math.min(1, gm.leave + dt * .45); continue; }
    if (p.y < top || p.y > bot) { gm.t = Math.max(gm.t, 1.5); gm.warn = 0; gm.open = Math.max(0, gm.open - dt * 2); continue; }   // 화면 밖에서는 쉰다
    gm.open = Math.max(0, Math.min(1, gm.open + (gm.warn > 0 ? dt * 3 : -dt * 1.5)));
    if (gm.warn > 0) {
      gm.warn -= dt;
      if (Math.random() < dt * 30) { const a = gm.ang[gm.hatch], r = p.R; G.parts.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 10, t: 0, l: .45, c: '#ff8a5a', s: 2.4 }); }
      if (gm.warn <= 0) launch(p, gm, k);
    } else if ((gm.t -= dt) <= 0) {
      gm.t = OPS.hangarPeriod * rnd(.85, 1.15);
      if (G.ops.mooks.filter(m => m.kind === 'skiff').length < OPS.hangarMax) { gm.warn = OPS.hangarWarn; gm.hatch = gm.hatch ? 0 : 1; beep(300, .1, 'square', .05); }
    }
  }
}
function launch(p, gm, k) {
  const a = gm.ang[gm.hatch], sp = 150 * k, r = p.R + 6 * k;
  G.ops.mooks.push(mkMook('skiff', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, born: .5 }));
  burst(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, '#ffb48a', 12, 160); ringFx(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, '#ff8a5a', 4, 38, .35, 3); beep(180, .12, 'sawtooth', .08); noise(.25, .1, 2500, 300);
}

/** 기믹 행성에 착지했을 때(player.js 의 latch). 보급 부두는 처음 한 번만 보상을 준다 */
export function onLand(p) {
  const gm = p.gim; if (!gm || gm.kind !== 'depot' || gm.used) return;
  gm.used = true; const o = G.ops, s = G.ship;
  if (gm.reward === 'thruster') { G.stats.shield++; popText(s.x, s.y - 28, '비상 추진기 +1', '#ffb08a', 17); }
  else { o.pendingEvo = true; popText(s.x, s.y - 28, '진화 준비', '#bfe8ff', 17); }
  flashScreen(.3, gm.reward === 'evo' ? '#bfe8ff' : '#ffb08a'); shakeAdd(5); thump(120, 40, .3, .3); beep(880, .12, 'triangle', .1); setTimeout(() => beep(1180, .16, 'triangle', .1), 100);
  burst(p.x, p.y - p.R, gm.reward === 'evo' ? '#bfe8ff' : '#ffb08a', 24, 240); ringFx(p.x, p.y, '#fff', p.R, p.R + 70, .5, 3);
}
