/* 기체 비행 보정: 보스전·격파 직후의 눈에 안 보이는 안전장치. 둘 다 속도는 그대로 두고 방향만 슬쩍 꺾는다 */
import { G } from './state.js';
import { clamp, angDiff } from './util.js';
import { capOf, fs, arenaK } from './stats.js';

/** 보스에 부딪혀 튕긴 비행에만 붙는 눈에 안 보이는 안전망: 아래로 내려가 화면 밑이 가까워질수록 비행 방향을 가장 가까운 행성 쪽으로 슬쩍 꺾는다.
 * 속도는 그대로고 방향만 돌리며, 바닥에서 멀 때는 거의 손대지 않는다. 행성에 붙거나 다시 발사하면 꺼진다(s.net) */
export function netAssist(dt) {
  const s = G.ship, K = arenaK(), u = clamp((s.y - (G.arenaBot - 340 * K)) / (300 * K), 0, 1);
  if (u <= 0 && s.vy <= 0) return;
  let best = null, bd = 1e9;
  for (const p of G.planets) {
    if (p.dead || p.ghost || p.y > G.arenaBot - 30 * K) continue;
    const d = Math.hypot(p.x - s.x, p.y - s.y) - capOf(p);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  const want = Math.atan2(best.y - s.y, best.x - s.x), cur = Math.atan2(s.vy, s.vx);
  const turn = clamp(angDiff(want, cur), -(.35 + 4.2 * u * u) * dt, (.35 + 4.2 * u * u) * dt), v = Math.hypot(s.vx, s.vy), a = cur + turn;
  s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
}

/** 보스를 쓰러뜨린 직후 튕겨 나간 비행에 붙는 눈에 안 보이는 구조: 행성이 없는 줄을 좌우 벽만 오가다 산소가 다 닳지 않도록,
 * 지금 항로가 어느 행성의 포획 범위도 지나지 않으면 비행 방향을 가까운 행성 쪽으로 슬쩍 꺾는다. 속도는 그대로고, 시간이 갈수록 조금씩 더 꺾는다.
 * 행성에 붙거나 다시 발사하면 꺼진다(s.net) */
export function rescueAssist(dt) {
  const s = G.ship, v = Math.hypot(s.vx, s.vy); if (v < 1) return;
  const hx = s.vx / v, hy = s.vy / v, cur = Math.atan2(s.vy, s.vx), look = 420 * fs();
  let best = null, bc = 1e9;
  for (const p of G.planets) {
    if (p.dead || p.ghost || p === s.last) continue;
    const dx = p.x - s.x, dy = p.y - s.y, along = dx * hx + dy * hy, cap = capOf(p);
    if (along > 0 && along < look && Math.abs(dx * hy - dy * hx) < cap * .8) return;   // 이미 붙을 항로다
    const c = Math.hypot(dx, dy) - cap + 180 * Math.abs(angDiff(Math.atan2(dy, dx), cur)) * fs();   // 가깝고 진행 방향에 가까운 행성을 고른다
    if (c < bc) { bc = c; best = p; }
  }
  if (!best) return;
  const diff = angDiff(Math.atan2(best.y - s.y, best.x - s.x), cur), rate = (.6 + .5 * clamp(s.air + 2.5, 0, 6)) * dt, a = cur + clamp(diff, -rate, rate);
  s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
}
