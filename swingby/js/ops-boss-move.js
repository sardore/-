/* 적 함선 보스의 움직임: 늘 조금씩 흔들리고, 가끔 한 번씩 확 옮겨 간다(옮겨 가는 동안 위협색 잔상이 남는다).
 * 보스가 아레나와 함께 위로 밀려 올라가므로(b.hy) 위치는 늘 hy 를 기준으로 한 오프셋(ox, oy)으로 가진다. 잔상(b.gh)도 같은 기준이라 보스에서 떨어져 나가지 않는다.
 * 보스에 붙은 광선·부채꼴(anchor 존)이 나가는 동안(planted)은 급이동을 쉰다. */
import { G } from './state.js';
import { TAU, rnd } from './util.js';
import { fs } from './stats.js';

const DASH_T = .42;   // 급이동에 걸리는 시간(초)

export function moveOpsBoss(b, dt, planted) {
  const fk = fs(), t = G.T;
  if (b.ox == null) { b.ox = 0; b.oy = 0; b.tx = 0; b.ty = 0; b.nd = rnd(1.8, 3); b.dash = 0; b.gt = 0; b.gh = []; b.wp = rnd(0, TAU); }
  const lim = Math.min(G.w / 2 - b.hr - 26 * fk, 95 * fk), ymax = 46 * fk;
  if (b.dash > 0) {   // 확 움직인다
    b.dash -= dt; const k = Math.min(1, dt * 10);
    b.ox += (b.tx - b.ox) * k; b.oy += (b.ty - b.oy) * k;
    if ((b.gt -= dt) <= 0) { b.gt = .03; b.gh.push({ x: b.x, gy: b.y - b.hy, t: 0 }); }
  } else {
    const k = Math.min(1, dt * 1.2); b.ox += (b.tx - b.ox) * k; b.oy += (b.ty - b.oy) * k;
    if (!planted && (b.nd -= dt) <= 0) {
      let tx = rnd(-lim, lim); for (let i = 0; i < 8 && Math.abs(tx - b.ox) < lim * .55; i++) tx = rnd(-lim, lim);
      b.tx = tx; b.ty = rnd(0, ymax); b.dash = DASH_T; b.nd = rnd(3, 5.5);
    }
  }
  // 늘 흔들린다: 주기가 다른 두 진동을 겹친 잔떨림
  b.x = b.hx + b.ox + (Math.sin(t * 1.9 + b.wp) * 4.5 + Math.sin(t * 4.3 + b.wp * 2) * 2.2) * fk;
  b.y = b.hy + b.oy + (Math.cos(t * 1.5 + b.wp) * 3.2 + Math.sin(t * 3.7 + b.wp) * 1.8) * fk;
  for (const q of b.gh) q.t += dt;
  if (b.gh.length && b.gh[0].t >= .5) b.gh = b.gh.filter(q => q.t < .5);
}

/** 급이동 잔상(draw-boss.js 의 drawBoss 가 보스 중심 좌표계에서 부른다): 위협색으로 번지는 타원이 보스 뒤로 흩어진다 */
export function drawBossGhosts(g, b, h) {
  if (!b.gh || !b.gh.length) return;
  const R = b.R;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const q of b.gh) {
    const f = 1 - q.t / .5, dx = q.x - b.x, dy = b.hy + q.gy - b.y;
    const gr = g.createRadialGradient(dx, dy, 0, dx, dy, R * 1.05);
    gr.addColorStop(0, 'hsla(' + h + ',100%,66%,' + .34 * f + ')'); gr.addColorStop(.6, 'hsla(' + h + ',100%,50%,' + .2 * f + ')'); gr.addColorStop(1, 'hsla(' + h + ',100%,45%,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(dx, dy, R * .72, R * 1.0, 0, 0, TAU); g.fill();
  }
  g.restore();
}
