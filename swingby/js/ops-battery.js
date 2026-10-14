/* 돌진 포대: 강한 돌진이 없는 고단계 기체 일부(철갑 수송함·이동 요새)가 가진 장비. 차지한 돌진을 시작하면 비행 중에 포탄을 연달아 쏜다.
 * 표적은 보스(전투 중) → 가까운 소형함 → 진행 방향 순. 포탄은 벽(쓰레기)과 소형함, 보스에 맞고, 피해는 충돌 능력치를 따른다. 규칙 데이터는 ships.js 의 bat {n, dmg} */
import { G, g } from './state.js';
import { PI, rnd } from './util.js';
import { SHIPS } from './ships.js';
import { ramMul } from './stats.js';
import { sparks, burst } from './fx.js';
import { beep } from './audio.js';
import { bossShot } from './boss.js';
import { shootMook } from './ops-mook.js';
import { shootWall } from './ops-walls.js';

const SPEED = 780, GAP = .085, BOSS_DMG = .2;   // 보스에게는 포탄 피해의 20% 만 들어간다(돌진하며 쏘는 포가 보스전을 쉽게 만들지 않도록)

/** 돌진을 시작할 때(player.js release) */
export function batteryStart() {
  const d = SHIPS[G.shipId], o = G.ops; if (!o || !d.bat) return;
  o.bat = { left: d.bat.n, t: .04 };
}

function aimAt(s, d) {
  const b = G.boss;
  if (b && b.state === 'fight') return Math.atan2(b.y - s.y, b.x - s.x);
  let best = null, bd = 520;
  for (const m of G.ops.mooks) { if (m.nohit) continue; const dd = Math.hypot(m.x - s.x, m.y - s.y); if (dd < bd) { bd = dd; best = m; } }
  return best ? Math.atan2(best.y - s.y, best.x - s.x) : Math.atan2(s.vy, s.vx);
}

export function updateBattery(dt) {
  const o = G.ops, s = G.ship, d = SHIPS[G.shipId];
  if (o.bat) {
    if (s.mode !== 'free') o.bat = null;
    else if ((o.bat.t -= dt) <= 0) {
      const a = aimAt(s, d) + rnd(-.05, .05), dmg = Math.max(1, Math.round(d.bat.dmg * ramMul()));
      o.shells.push({ x: s.x + Math.cos(a) * 10, y: s.y + Math.sin(a) * 10, vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, life: .9, dmg, h: d.L.h });
      beep(900 + rnd(0, 160), .03, 'square', .05); sparks(s.x + Math.cos(a) * 10, s.y + Math.sin(a) * 10, '#fff', 3, 180, a, .4);
      if (--o.bat.left <= 0) o.bat = null; else o.bat.t = GAP;
    }
  }
  if (!o.shells.length) return;
  const b = G.boss;
  for (const sh of o.shells) {
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
    let hit = false;
    if (b && b.state === 'fight' && Math.hypot(sh.x - b.x, sh.y - b.y) < b.hr + 3) { bossShot(sh.dmg * BOSS_DMG); hit = true; }
    else if (shootWall(sh.x, sh.y, sh.dmg)) hit = true;
    else for (const m of o.mooks) if (!m.nohit && Math.hypot(sh.x - m.x, sh.y - m.y) < m.R + 3) { shootMook(m, sh.dmg); hit = true; break; }
    if (hit) { sh.life = 0; burst(sh.x, sh.y, 'hsl(' + sh.h + ',100%,70%)', 5, 150); sparks(sh.x, sh.y, '#fff', 4, 260, Math.atan2(-sh.vy, -sh.vx), .9); }
  }
  o.shells = o.shells.filter(sh => sh.life > 0 && sh.x > -40 && sh.x < G.w + 40);
}

/** 포탄 그리기(월드 좌표 안에서) */
export function drawShells() {
  const o = G.ops; if (!o || !o.shells.length) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (const sh of o.shells) {
    const tx = sh.x - sh.vx * .045, ty = sh.y - sh.vy * .045;
    g.strokeStyle = 'hsla(' + sh.h + ',100%,60%,.55)'; g.lineWidth = 5; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(sh.x - sh.vx * .02, sh.y - sh.vy * .02); g.stroke();
  }
  g.restore();
}
