/* 블랙쉽 모드의 선단: 구출한 함선이 본체 뒤를 따라다니고, 본체가 쓰러지면 가장 센 함선이 뒤를 잇는다.
 * 따라다니는 함선은 판정이 없는 동행이다. 본체가 지나온 길(hist)을 일정 간격으로 따라가므로 궤도를 돌 때도 같은 원을 그리며 따라온다 */
import { G } from './state.js';
import { TAU, rnd, pickOf, angDiff } from './util.js';
import { baseStats } from './data.js';
import { SHIPS } from './ships.js';
import { OPS, OPS_ROOT, fleetBonus } from './ops-data.js';
import { fs } from './stats.js';
import { drawShip } from './ship-art.js';
import { ringFx, burst, flashScreen, popText, punch, shakeAdd, slowmo } from './fx.js';
import { beep, thump } from './audio.js';

const STEP = 7, GAP = 4, HMAX = 80 * GAP + 40;   // 길 표본 간격(px) · 함선 사이 표본 수 · 보관할 표본 수

/* ---------- 기체 계보 ---------- */
const parent = {};
for (const id in SHIPS) for (const k of SHIPS[id].kids) parent[k] = id;
/** 루트부터 이 기체까지의 id 목록 */
export function lineage(id) { const c = []; for (let x = id; x; x = parent[x]) c.unshift(x); return c; }
/** 이 기체가 계보를 따라 진화해 왔을 때의 능력치 + 강화 카드로 얻은 증가량(bonus). 추진기(shield)는 계보에서만 온다 */
export function statsFor(id, bonus) {
  const st = baseStats();
  for (const x of lineage(id)) for (const k in SHIPS[x].delta) st[k] += SHIPS[x].delta[k];
  for (const k in bonus) if (k !== 'shield') st[k] += bonus[k];
  return st;
}
/** 후계자를 고를 때의 세기: 단계가 먼저, 같으면 능력치 합 */
export function powerOf(id) {
  const st = statsFor(id), sum = ['spd', 'ram', 'grav', 'decay', 'o2', 'mult'].reduce((a, k) => a + st[k], 0) + st.shield * 30;
  return SHIPS[id].t * 10000 + sum;
}
/** 구출되는 함선: 스카우트나 Lv2. 뒤로 갈수록 Lv2 가 많다 */
export function captiveId(stage) {
  if (Math.random() > .3 + .08 * stage) return OPS_ROOT;
  return pickOf(SHIPS[OPS_ROOT].kids);
}

/* ---------- 선단 ---------- */
export const hasBay = () => !!G.ops && G.ops.bay && G.tier >= OPS.bayTier;
export const fleetMul = () => 1 + (G.ops ? fleetBonus(G.ops.fol) : 0);

/** 구출: 보스가 있던 자리(x, y)에서 n 척이 풀려난다. 동행이 가득 차 있으면 새로 합류하는 대신 가진 함선 하나가 한 단계 오른다
 * (Lv2 가 있으면 Lv2 → Lv3 가 먼저, 없으면 스카우트 → Lv2. 모두 Lv3 이면 더 올릴 곳이 없다). { join: 합류한 수, up: 올라간 함선 목록 } 을 돌려준다 */
export function rescue(n, stage, x, y) {
  const o = G.ops, res = { join: 0, up: [] };
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), r = rnd(20, 60), cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r;
    if (o.fol.length < OPS.maxFollowers) {
      const id = captiveId(stage);
      o.fol.push({ id, t: SHIPS[id].t, x: cx, y: cy, a: rnd(0, TAU), born: 0 });
      res.join++; o.rescued++;
      ringFx(cx, cy, '#fff', 4, 50, .5, 3);
    } else {
      const up = upgradeOne(); if (!up) break;
      res.up.push(up); o.rescued++;
    }
  }
  if (res.join || res.up.length) { beep(660, .1, 'triangle', .1); setTimeout(() => beep(990, .16, 'triangle', .1), 110); }
  return res;
}
/** 가장 높은 단계(Lv3 미만)의 동행 함선 하나를 다음 단계로 올린다. 올릴 함선이 없으면 null */
function upgradeOne() {
  const o = G.ops, c = o.fol.filter(f => f.t < 3 && SHIPS[f.id].kids.length);
  if (!c.length) return null;
  const top = Math.max(...c.map(f => f.t)), f = pickOf(c.filter(g => g.t === top)), from = SHIPS[f.id], to = SHIPS[pickOf(from.kids)];
  f.id = to.id; f.t = to.t; f.born = .3;
  const col = 'hsl(' + to.L.h + ',95%,66%)';
  burst(f.x, f.y, col, 14, 160); ringFx(f.x, f.y, '#fff', 6, 70, .5, 3); popText(f.x, f.y - 20, 'Lv' + from.t + ' → Lv' + to.t, col, 14);
  return { from: from.t, to: to.t, name: to.n };
}

/** 지나온 길을 비우고 지금 자리에서 다시 시작한다(필드 폭이 바뀌거나 되살아나 자리가 크게 바뀔 때) */
export function resetTrail() { if (G.ops) G.ops.hist = [{ x: G.ship.x, y: G.ship.y }]; }

/** 매 틱: 길 표본을 쌓고 함선을 그 위의 제 자리로 부드럽게 옮긴다 */
export function updateFleet(dt) {
  const o = G.ops, s = G.ship, H = o.hist, last = H[H.length - 1];
  if (!last || Math.hypot(s.x - last.x, s.y - last.y) >= STEP) { H.push({ x: s.x, y: s.y }); if (H.length > HMAX) H.splice(0, H.length - HMAX); }
  const k = Math.min(1, dt * 12);
  o.fol.forEach((f, i) => {
    f.born = Math.min(1, f.born + dt * 1.4);
    const t = H[Math.max(0, H.length - 1 - (i + 1) * GAP)] || s, nx = f.x + (t.x - f.x) * k, ny = f.y + (t.y - f.y) * k;
    if (Math.hypot(nx - f.x, ny - f.y) > .4) f.a += angDiff(Math.atan2(ny - f.y, nx - f.x), f.a) * Math.min(1, dt * 10);
    f.x = nx; f.y = ny;
  });
}

/** 본체 뒤에 선단을 그린다(월드 좌표 그리기 안에서 부른다) */
export function drawFleet(g, T, flying) {
  const o = G.ops; if (!o || !o.fol.length) return;
  const k = fs() * .82;
  for (let i = o.fol.length - 1; i >= 0; i--) {
    const f = o.fol[i], d = SHIPS[f.id];
    g.save(); g.translate(f.x, f.y); g.rotate(f.a); g.globalAlpha = Math.min(1, f.born * 1.3);
    g.shadowColor = 'hsl(' + d.L.h + ',100%,70%)'; g.shadowBlur = 5;
    drawShip(g, d, flying ? .8 : .4, T + i * .7, k * (.4 + .6 * f.born), { nobay: true });
    g.restore();
  }
}

/* ---------- 승계 ---------- */
const SUCC_KEEP = .6;   // 후계자가 앞 함선보다 모자란 능력치의 몇 %를 몰래 채워 받는가
/** 본체가 쓰러졌을 때 선단에서 가장 센 함선이 뒤를 잇는다. 이을 함선이 없으면 false.
 * 후계자는 수송 능력을 잃고(다시는 얻지 못한다), 능력치는 자기 계보 + 지금까지 받은 강화 카드로 정해진다 */
export function succeed() {
  const o = G.ops; if (!o || !o.fol.length) return false;
  let bi = 0;
  o.fol.forEach((f, i) => { if (powerOf(f.id) > powerOf(o.fol[bi].id)) bi = i; });
  const f = o.fol.splice(bi, 1)[0], d = SHIPS[f.id], s = G.ship;
  const prev = G.stats, nx = statsFor(d.id, o.bonus);
  for (const k of ['spd', 'ram', 'grav', 'decay', 'o2', 'mult']) if (prev[k] > nx[k]) nx[k] += (prev[k] - nx[k]) * SUCC_KEEP;   // 몰래 얹는 보정: 앞 함선과의 격차를 메워 승계해도 너무 약해지지 않게
  G.shipId = d.id; G.tier = d.t; G.stats = nx; o.bay = false; o.succ++;
  s.evoT = 1; G.combo = 0;
  const col = 'hsl(' + d.L.h + ',95%,66%)';
  G.banner = { t: 0, dur: 2.4, a: '승계  Lv ' + d.t, b: d.n, c: col, sub: o.fol.length ? '남은 동행 ' + o.fol.length + '척' : '마지막 함선' };
  flashScreen(.5, '#fff'); punch(.05); slowmo(.4, .8); shakeAdd(8);
  burst(s.x, s.y, col, 30, 280); burst(s.x, s.y, '#fff', 16, 200); ringFx(s.x, s.y, '#fff', 6, 150, .6, 4); ringFx(s.x, s.y, col, 6, 110, .5, 3);
  thump(90, 30, .5, .4); [0, 1, 2].forEach(i => setTimeout(() => beep(440 * Math.pow(1.26, i), .16, 'triangle', .1), i * 100));
  popText(s.x, s.y - 28, d.n + ' 승계', col, 17);
  return true;
}
