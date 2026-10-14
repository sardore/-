/* 보스의 공격: 예고(텔레그래프) 만들기·턴 진행, 발동, 존·블랙홀·항성풍 판정, 기체 피격 */
import { G } from './state.js';
import { PI, TAU, rnd, clamp, pickOf, shuffle } from './util.js';
import { ATK } from './data.js';
import { spd, shipR, fs, arenaK } from './stats.js';
import { beep, thump, sweep, noise, vibe } from './audio.js';
import { burst, sparks, ringFx, hitstop, punch, shakeAdd, flashScreen, popText, toast } from './fx.js';
import { die } from './player.js';
import { heatReset } from './heat.js';
import { regrow, aliveP } from './boss-arena.js';
import { place, randIn } from './boss-zones.js';

/* ---------- 공격 예고 ---------- */
function mkTele(k) {
  const b = G.boss, o = { k, t: 2, age: 0 }, fk = fs(), K = arenaK(), ymin = b.y + b.hr + 40 * fk, ymax = G.arenaBot - 125 * K, al = aliveP();
  if (k === 'meteor') {
    const n = 2 + (b.phase > 0 ? 1 : 0) + (Math.random() < .4 ? 1 : 0), r = (58 + (b.phase > 0 ? 6 : 0)) * fk; o.zs = [];
    for (let tr = 0; o.zs.length < n && tr < 80; tr++) {
      let x, y;
      if (Math.random() < .65 && al.length) { const p = pickOf(al); x = p.x + rnd(-24, 24) * fk; y = p.y + rnd(-24, 24) * fk; } else { x = rnd(50 * fk, G.w - 50 * fk); y = rnd(ymin, ymax); }
      x = clamp(x, r * .6, G.w - r * .6); y = clamp(y, ymin, ymax);
      if (o.zs.every(z => Math.hypot(z.x - x, z.y - y) > r * 1.5)) o.zs.push({ x, y, r });
    }
  } else if (k === 'comet') {
    const n = 5 + (b.phase > 0 ? 2 : 0), r = 34 * fk; o.zs = [];
    for (let tr = 0; o.zs.length < n && tr < 120; tr++) { const x = rnd(36 * fk, G.w - 36 * fk), y = rnd(ymin, ymax); if (o.zs.every(z => Math.hypot(z.x - x, z.y - y) > r * 2.1)) o.zs.push({ x, y, r }); }
    o.zs.sort((u, v) => u.x - v.x);
  } else if (k === 'beam') {
    const tg = G.ship.mode === 'orb' && Math.random() < .5 ? G.ship.p : pickOf(al.length ? al : G.planets);
    o.tx = tg.x; o.ty = tg.y; o.jit = rnd(-.08, .08); o.half = .3; o.len = 950 * K; o.a = beamAngle(o, b);
  } else if (k === 'jet') { o.as = [PI / 2 - .82, PI / 2 + .82]; o.half = .24; o.len = 950 * K; }
  else if (k === 'flare') o.r = b.hr + (150 + (b.phase > 0 ? 28 : 0)) * fk;
  else if (k === 'hole') { for (let n = 0; n < 40; n++) { o.x = rnd(60 * fk, G.w - 60 * fk); o.y = rnd(ymin + 20 * fk, ymax); if (G.planets.every(p => Math.hypot(p.x - o.x, p.y - o.y) > p.R + 60 * fk)) break; } }
  else if (k === 'collapse') { o.p = pickHigh(al); o.t = 3; o.r = o.p.R + 78 * fk; }
  else if (k === 'wind') { o.dir = Math.random() < .5 ? -1 : 1; o.t = 1; }
  else if (k === 'sing') { // 특이점: 필드 한가운데 가까이 생기는 거대한 블랙홀
    o.pull = 260 * fk; o.hr = 26 * fk;
    for (let n = 0; n < 40; n++) { o.x = rnd(G.w * .3, G.w * .7); o.y = rnd(ymin + 40 * fk, ymax - 60 * K); if (G.planets.every(p => Math.hypot(p.x - o.x, p.y - o.y) > p.R + 60 * fk)) break; }
  } else { o.zones = uniqueZones(k, b, al, fk, K, ymin, ymax); if (k === 'nova') o.t = 3; }
  return o;
}

/** 보스마다 하나씩 가진 고유 패턴의 존 구성 (좌표는 예고 때 정해지고, rel/vert 인 것만 보스·아레나를 따라간다) */
function uniqueZones(k, b, al, fk, K, ymin, ymax) {
  const pl = al.length ? al : G.planets, tg = G.ship.mode === 'orb' && Math.random() < .5 && !G.ship.p.dead ? G.ship.p : pickOf(pl);
  const zs = [];
  switch (k) {
    case 'cross': // 십자 섬광: 한 행성의 높이를 가로로, 그 x 를 세로로 가른다
      zs.push({ shape: 'b', x: G.w / 2, y: tg.y, w: G.w, hh: 21 * fk, fuse: 1.0, blast: .5 }, { shape: 'b', x: tg.x, vert: true, w: 21 * fk, fuse: 1.0, blast: .5 }); break;
    case 'spokes': { // 방사 광선: 보스에서 60° 간격 6줄기
      const a0 = rnd(0, TAU);
      for (let i = 0; i < 6; i++) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: a0 + i * PI / 3, half: .12, len: 950 * K, fuse: 1.15, blast: .9 }); break;
    }
    case 'spiral': { // 나선 폭발: 보스 둘레로 나선을 그리며 차례로 터진다
      const sg = Math.random() < .5 ? -1 : 1, r = 32 * fk;
      for (let i = 0; i < 7; i++) {
        const an = PI / 2 + sg * (i / 6 - .5) * PI * 1.25, d = (100 + i * 30) * K;
        zs.push({ shape: 'c', rel: true, x: clamp(b.x + Math.cos(an) * d, r, G.w - r) - b.x, y: Math.sin(an) * d, r, delay: i * .2, fuse: .7, blast: .25, fade: .6 });
      } break;
    }
    case 'twin': { // 쌍성 폭격: 한 행성과 그 좌우 대칭 자리가 동시에 터진다
      const dx = Math.max(Math.abs(tg.x - G.w / 2), 70 * fk), r = 62 * fk;
      zs.push({ shape: 'c', x: G.w / 2 - dx, y: tg.y, r, fuse: 1.0, blast: .35 }, { shape: 'c', x: G.w / 2 + dx, y: tg.y, r, fuse: 1.0, blast: .35 }); break;
    }
    case 'pool': { // 독 웅덩이: 행성 세 곳에 오래 남는 독
      const ps = pl.slice().sort(() => Math.random() - .5).slice(0, 3);
      for (const p of ps) zs.push({ shape: 'c', x: p.x, y: p.y, r: 48 * fk, fuse: .9, blast: 3.6, fade: 1.2 }); break;
    }
    case 'quake': { // 지축 균열: 행성 두 개의 높이를 따라 가로로 갈라진다
      const ps = pl.slice().sort(() => Math.random() - .5), a = ps[0], c = ps.find(p => Math.abs(p.y - a.y) > 70 * K);
      for (const p of c ? [a, c] : [a]) zs.push({ shape: 'b', x: G.w / 2, y: p.y, w: G.w, hh: 24 * fk, fuse: 1.1, blast: .5 }); break;
    }
    case 'pulse': // 맥동파: 보스에서 바깥으로 두 겹의 고리
      zs.push({ shape: 'o', rel: true, x: 0, y: 0, r1: 150 * K, r2: 205 * K, fuse: 1.0, blast: .4 }, { shape: 'o', rel: true, x: 0, y: 0, r1: 300 * K, r2: 355 * K, delay: .5, fuse: 1.0, blast: .4 }); break;
    case 'hex': { // 육각 결정: 한 행성을 여섯 개의 결정이 둘러싼다 (한가운데와 결정 사이 틈은 안전)
      const r = 36 * fk, d = 98 * fk, a0 = rnd(0, PI / 3);
      for (let i = 0; i < 6; i++) { const an = a0 + i * PI / 3; zs.push({ shape: 'c', x: clamp(tg.x + Math.cos(an) * d, r, G.w - r), y: tg.y + Math.sin(an) * d, r, delay: i * .07, fuse: .95, blast: .3 }); } break;
    }
    case 'nova': // 초신성: 보스 주위 거대한 폭발 — 아래쪽 멀리가 안전하다
      zs.push({ shape: 'c', rel: true, x: 0, y: 0, r: 310 * K, fuse: 2.2, blast: .55, fade: 1 }); break;
    case 'rain': { // 별똥비 (무한 모드 전용): 세로 기둥이 x 좌표가 가까운 것끼리 두세 묶음이 되어, 묶음마다 1.5초 간격으로 한꺼번에 내리꽂힌다(다음 묶음이 오기 전에 다른 구역으로 피해야 한다)
      const n = Math.max(5, Math.round(G.w / 70)), groups = n >= 8 ? 3 : 2, order = shuffle([...Array(groups).keys()]);
      for (let i = 0; i < n; i++) zs.push({ shape: 'b', vert: true, x: (i + .5) / n * G.w + rnd(-8, 8) * fk, w: 16 * fk, delay: order[Math.floor(i * groups / n)] * 1.5, fuse: .8, blast: .35 });
      break;
    }
    case 'ripple': // 공명파 (전용): 보스에서 퍼지는 세 겹의 고리가 차례로 터진다
      for (let i = 0; i < 3; i++) zs.push({ shape: 'o', rel: true, x: 0, y: 0, r1: (105 + i * 115) * K, r2: (160 + i * 115) * K, delay: i * .45, fuse: .9, blast: .35 });
      break;
    case 'grid': { // 격자망 (전용): 두 행성의 높이를 가로로, 다른 두 행성의 x 를 세로로 가른다
      const ps = pl.slice().sort(() => Math.random() - .5), hs = [], vs = [];
      for (const p of ps) { if (hs.length < 2 && hs.every(q => Math.abs(q.y - p.y) > 80 * K)) hs.push(p); else if (vs.length < 2 && vs.every(q => Math.abs(q.x - p.x) > 80 * fk)) vs.push(p); }
      for (const p of hs) zs.push({ shape: 'b', x: G.w / 2, y: p.y, w: G.w, hh: 19 * fk, fuse: 1.1, blast: .5 });
      for (const p of vs) zs.push({ shape: 'b', vert: true, x: p.x, w: 19 * fk, fuse: 1.1, blast: .5 });
      break;
    }
    case 'sweep': { // 소탕선 (전용): 보스 아래쪽 부채꼴이 한쪽에서 반대쪽으로 쓸고 지나간다
      const sg = Math.random() < .5 ? -1 : 1;
      for (let i = 0; i < 7; i++) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: PI / 2 + sg * (i / 6 - .5) * 2.2, half: .13, len: 950 * K, delay: i * .17, fuse: .6, blast: .3 });
      break;
    }
    case 'snare': { // 올가미 (전용): 두 행성의 궤도 고리가 터진다 — 행성 표면 바로 위(안쪽)만 안전하다
      const ps = pl.slice().sort(() => Math.random() - .5);
      for (const p of ps.slice(0, 2)) zs.push({ shape: 'o', x: p.x, y: p.y, r1: p.R + 24 * fk, r2: p.R + 110 * fk, fuse: 1.0, blast: .5 });
      break;
    }
    case 'lobes': // 쌍엽 분출: 보스 양옆으로 세로 기둥 두 줄
      zs.push({ shape: 'b', rel: true, vert: true, x: -92 * fk, w: 30 * fk, fuse: 1.1, blast: .9 }, { shape: 'b', rel: true, vert: true, x: 92 * fk, w: 30 * fk, delay: .3, fuse: 1.1, blast: .9 }); break;
  }
  return zs;
}
/** 위쪽 행성일수록 훨씬 잘 뽑힌다 (가장 높은 행성 대비 높이 비율의 세제곱으로 가중). 행성 붕괴가 아래쪽 안전한 행성이 아니라 위쪽을 노리게 한다 */
function pickHigh(list) {
  const hs = list.map(p => Math.max(0, G.arenaBot - p.y)), top = Math.max(1, ...hs), w = hs.map(h => .05 + Math.pow(h / top, 3));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
  return list[list.length - 1];
}
/** 빔은 보스가 움직여도 목표를 계속 겨눈다 */
export const beamAngle = (o, b) => clamp(Math.atan2(o.ty - b.y, o.tx - b.x) + o.jit, .55, PI - .55);

/** 직전 턴에 한 번 더 강하게 알리는 링 */
function telePing(a) {
  const c = ATK[a.k].c, b = G.boss;
  const fk = fs();
  if (a.zs) for (const z of a.zs) ringFx(z.x, z.y, c, z.r * .3, z.r * 1.1, .5, 3);
  else if (a.zones) { let any = false; for (const z of a.zones) { const p = place(z, b); if (p.shape === 'c' && p.r < 200) ringFx(p.x, p.y, c, p.r * .3, p.r * 1.1, .5, 3); else if (!any) { any = true; ringFx(b.x, b.y, c, b.hr, b.hr + 75 * fk, .5, 3); } } }
  else if (a.k === 'beam' || a.k === 'jet') ringFx(b.x, b.y, c, b.hr, b.hr + 75 * fk, .5, 3);
  else if (a.k === 'flare') ringFx(b.x, b.y, c, b.hr, a.r, .6, 3);
  else if (a.k === 'hole' || a.k === 'sing') ringFx(a.x, a.y, c, 10 * fk, 80 * fk, .5, 3);
  else if (a.k === 'collapse') ringFx(a.p.x, a.p.y, c, a.p.R, a.r, .5, 3);
}
export function queueAttack(kind) {
  const b = G.boss;
  let pool = b.d.pat.filter(k => k !== b.last && !(k === 'collapse' && aliveP().length < 4) && !(k === 'hole' && G.haz.filter(h => h.k === 'hole').length >= 2) && !(k === 'sing' && G.haz.some(h => h.k === 'hole')) && !b.q.some(a => a.k === k));
  if (!pool.length) pool = b.d.pat.filter(k => !(k === 'collapse' && aliveP().length < 4));
  const fav = b.d.favor; if (fav) pool = pool.concat(pool.filter(k => fav.includes(k)));   // 우대 패턴은 뽑힐 확률이 두 배
  const k = kind || pickOf(pool); b.last = k;
  const a = mkTele(k); b.q.push(a); return a;
}
/** 디버그/테스트용: 지정한 공격을 t 턴 뒤 발동으로 예고 */
export function forceTele(k, t) { if (k === 'horizon') { startHorizon(G.boss); return; } const a = mkTele(k); a.t = t; G.boss.q.push(a); telePing(a); }

/* ---------- 턴 진행 ---------- */
/** 플레이어가 행성에 착지할 때마다 1턴 */
export function bossTurn() {
  const b = G.boss; if (!b || b.state !== 'fight') return;
  b.turn++;
  if (b.d.kind === 'quasar' && !b.horizon && b.hp <= b.max / 3) startHorizon(b);   // 체력이 1/3 이하가 된 다음 턴
  for (const a of b.q) a.t--;
  const due = b.q.filter(a => a.t <= 0); b.q = b.q.filter(a => a.t > 0);
  for (const a of due) execAttack(a);
  for (const h of G.haz) if (h.turns != null) h.turns--;
  G.haz = G.haz.filter(h => h.turns == null || h.turns > 0);
  for (const p of G.planets) if (p.dead && --p.re <= 0) regrow(p);
  // 매 턴 쓰지 않는다: 가끔 새 공격을 예고하고, 오래 쉬면 확정 예고
  b.idle = (b.q.length || due.length) ? 0 : b.idle + 1;
  if (b.q.length < b.d.q + b.phase && (Math.random() < (b.d.fill != null ? b.d.fill : .27 + .1 * b.phase) || b.idle >= (b.d.fill != null ? 2 : 4))) { queueAttack(); b.idle = 0; }   // fill: 태양처럼 예고를 자주 채우는 보스
  for (const a of b.q) if (a.t === 1) { telePing(a); beep(560, .08, 'square', .06); }
}

/* ---------- 사건의 지평선 (TON 618) ---------- */
/** 맵이 밀려나는 속도를 2배로 올리는 중력장. 보스전이 끝날 때까지 풀리지 않는다 */
function startHorizon(b) {
  const at = ATK.horizon;
  b.horizon = true; G.haz.push({ k: 'horizon', t: 0, f: 0 });
  G.castO = { t: 0, dur: 1.3, name: at.cast, c: at.c }; b.cast = 1;
  sweep(60, 300, 1.4, .13); thump(60, 25, 1.2, .4); noise(1.4, .2, 900, 60); shakeAdd(12); flashScreen(.3, at.c);
  toast('맵이 2배로 빨라진다 — 멈추면 떨어져!', at.c);
}
/** 사건의 지평선의 실제 효과는 맵이 밀려나는 속도 2배다(boss-arena.js 의 scrollSpeed). 여기서는 연출(아래로 쏟아지는 빛줄기)만 키운다 */
function updateHorizon(h, dt) {
  h.f = Math.min(1, h.f + dt * .9);
  if (Math.random() < dt * 50 * h.f) { // 아래로 쏟아지는 빛줄기
    const K = arenaK();
    G.parts.push({ x: rnd(0, G.w), y: G.arenaBot - rnd(120, 460) * K, vx: 0, vy: rnd(260, 480), t: 0, l: .55, c: Math.random() < .5 ? 'rgba(190,140,255,.75)' : 'rgba(255,190,130,.6)', s: 2.6, line: true });
  }
}

/* ---------- 공격 발동 ---------- */
function zone(o) { G.haz.push(Object.assign({ k: 'zone', t: 0, delay: 0, fuse: .9, blast: .3, fade: .8, fired: false }, o)); }
function execAttack(a) {
  const b = G.boss, at = ATK[a.k], c = at.c, pow = at.pow;
  G.castO = { t: 0, dur: 1.1, name: b.d.endless ? '???' : at.cast, c }; b.cast = .9;
  sweep(110, 460, .9, .11); beep(240, .08, 'square', .05); shakeAdd(3);
  switch (a.k) {
    case 'meteor': a.zs.forEach((z, i) => zone({ kind: 'meteor', shape: 'c', x: z.x, y: z.y, r: z.r, delay: i * .2, fuse: .95, blast: .3, col: c, pow })); break;
    case 'comet': a.zs.forEach((z, i) => zone({ kind: 'comet', shape: 'c', x: z.x, y: z.y, r: z.r, delay: i * .15, fuse: .62, blast: .22, fade: .6, col: c, pow })); break;
    case 'beam': zone({ kind: 'beam', shape: 'w', anchor: true, x: b.x, y: b.y, a: a.a, half: a.half, len: a.len, fuse: 1.05, blast: .9, col: c, pow }); break;
    case 'jet': for (const an of a.as) zone({ kind: 'jet', shape: 'w', anchor: true, x: b.x, y: b.y, a: an, half: a.half, len: a.len, fuse: 1.15, blast: 1, col: c, pow }); break;
    case 'flare': zone({ kind: 'flare', shape: 'c', anchor: true, x: b.x, y: b.y, r: a.r, fuse: 1.05, blast: .4, fade: 1, col: c, pow }); break;
    case 'hole': G.haz.push({ k: 'hole', x: a.x, y: a.y, turns: at.keep, r: 16 * fs(), t: 0, born: 0, pow }); beep(150, .4, 'sawtooth', .12); break;
    case 'wind': G.haz.push({ k: 'wind', dir: a.dir, turns: at.keep }); noise(1.2, .12, 1800, 300); break;
    case 'collapse': if (!a.p.dead) zone({ kind: 'collapse', shape: 'c', x: a.p.x, y: a.p.y, r: a.r, p: a.p, fuse: 1.1, blast: .4, fade: .9, col: c, pow }); break;
    case 'sing': G.haz.push({ k: 'hole', x: a.x, y: a.y, turns: at.keep, r: a.hr, pull: a.pull, str: 26000, t: 0, born: 0, pow }); beep(90, .7, 'sawtooth', .14); shakeAdd(6); break;
    default: if (a.zones) a.zones.forEach(z => zone(Object.assign({ kind: a.k, col: c, pow }, place(z, b), { anchor: !!(z.rel || z.vert) }))); break;
  }
}

/* ---------- 존 판정 ---------- */
function inZone(h, s) {
  const pad = shipR() * .6;
  if (h.shape === 'c') return Math.hypot(s.x - h.x, s.y - h.y) < h.r + pad;
  if (h.shape === 'b') return Math.abs(s.x - h.x) < h.w + pad && Math.abs(s.y - h.y) < h.hh + pad;
  if (h.shape === 'o') { const d = Math.hypot(s.x - h.x, s.y - h.y); return d > h.r1 - pad && d < h.r2 + pad; }
  const dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy); if (d > h.len) return false;
  let df = Math.atan2(dy, dx) - h.a; df = Math.atan2(Math.sin(df), Math.cos(df));
  return Math.abs(df) < h.half + Math.atan2(pad, Math.max(d, 30));
}
function zoneBlast(h) {
  const col = h.col, big = h.shape === 'c' && h.r > 100;
  if (h.shape === 'c') {
    burst(h.x, h.y, col, Math.round(10 + h.r * .3), 180 + h.r); burst(h.x, h.y, '#fff', 8, 150);
    ringFx(h.x, h.y, '#fff', 6, h.r * 1.05, .4, 5); ringFx(h.x, h.y, col, 4, h.r * 1.35, .65, 3);
    thump(big ? 90 : 130, 38, .4, big ? .42 : .3); noise(.55, big ? .34 : .22, 3500, 200);
    shakeAdd(h.kind === 'comet' ? 3.5 : big ? 13 : 8); if (big) { flashScreen(.22, col); punch(.04); }
    if (h.kind === 'collapse') {
      const p = h.p;
      if (!p.dead) { p.dead = true; p.re = 4; burst(p.x, p.y, 'hsl(' + p.hue + ',90%,70%)', 32, 320); hitstop(.06); }
      const sh = G.ship;
      if (sh.mode === 'orb' && sh.p === p) { const an = Math.atan2(sh.y - p.y, sh.x - p.x); sh.mode = 'free'; sh.last = null; sh.vx = Math.cos(an) * spd() * .7; sh.vy = Math.sin(an) * spd() * .7; sh.air = 0; sh.hitF = false; sh.charging = false; }
    }
  } else if (h.shape !== 'w') { // 띠·도넛
    thump(85, 35, .6, .36, 'sawtooth'); noise(.8, .24, 3500, 250); shakeAdd(8); flashScreen(.12, col); punch(.025);
    for (let i = 0; i < 24; i++) { const p = randIn(h); sparks(p.x, p.y, i % 3 ? col : '#fff', 1, 220, -PI / 2, 1.3); }
  } else {
    thump(80, 35, .8, .4, 'sawtooth'); noise(1, .27, 3500, 250); shakeAdd(9); flashScreen(.16, col); punch(.03);
    for (let i = 0; i < 26; i++) { const an = h.a + rnd(-h.half, h.half), r = rnd(80, h.len * .85); sparks(h.x + Math.cos(an) * r, h.y + Math.sin(an) * r, i % 3 ? col : '#fff', 1, 220, an, .7); }
  }
}
function hurtZone(h, s) {
  if (h.shape === 'c' || h.shape === 'o') { hurt(h.x, h.y, h.pow); return; }
  if (h.shape === 'b') { if (h.w > h.hh) hurt(s.x, s.y + 30, h.pow); else hurt(h.x, s.y, h.pow); return; }   // 가로 띠는 위로, 세로 띠는 옆으로 튕겨 낸다
  const dx = s.x - h.x, dy = s.y - h.y, sg = (-dx * Math.sin(h.a) + dy * Math.cos(h.a)) >= 0 ? 1 : -1;
  hurt(s.x + Math.sin(h.a) * sg * 30, s.y - Math.cos(h.a) * sg * 30, h.pow);
}

/* ---------- 피격 / 충돌 ---------- */
/** 보스 공격에 맞았다: 보스마다 다른 atk(초) × 패턴 배율만큼 산소를 잃는다 */
export function hurt(x, y, pow = 1) {
  const s = G.ship, b = G.boss; if (s.inv > 0 || G.st !== 'play' || !b) return;
  const dm = b.d.atk * pow * (1 + .15 * b.loop);
  s.inv = 1.3; s.gd = 0; G.bo2 -= dm; G.bcombo = 0; G.combo = 0; s.charging = false; heatReset();
  G.shake = 15; hitstop(.1); flashScreen(.5, '#ff4040'); punch(.06); vibe(70);
  burst(s.x, s.y, '#ff6a6a', 22, 260); sparks(s.x, s.y, '#fff', 12, 320, Math.atan2(s.y - y, s.x - x), .8); ringFx(s.x, s.y, '#ff6a6a', 6, 60, .35, 3);
  thump(140, 35, .3, .4, 'sawtooth'); noise(.3, .3, 5000, 300);
  popText(s.x, s.y - 24, '-' + dm.toFixed(1) + '초', '#ff8f8f', 17);
  const an = Math.atan2(s.y - y, s.x - x);
  if (s.mode === 'orb') { s.mode = 'free'; s.last = s.p; s.vx = Math.cos(an) * spd() * .85; s.vy = Math.sin(an) * spd() * .85; s.air = 0; s.hitF = false; s.boost = 1; }
  else { s.vx += Math.cos(an) * 150 * fs(); s.vy += Math.sin(an) * 150 * fs(); }
  if (G.bo2 <= 0) { G.bo2 = 0; die('산소 고갈 — 보스의 공격'); }
}

function updateZone(h, dt, b, s) {
  const t0 = h.delay, t1 = t0 + h.fuse, t2 = t1 + h.blast;
  if (h.t < t0) return;
  if (h.t < t1) {
    const f = (h.t - t0) / h.fuse;
    if (h.shape === 'c') {
      if (Math.random() < dt * 60 * clamp(h.r / 70, .5, 2.2)) { const an = rnd(0, TAU), r = h.r * 1.15; G.parts.push({ x: h.x + Math.cos(an) * r, y: h.y + Math.sin(an) * r, vx: -Math.cos(an) * r * 1.7, vy: -Math.sin(an) * r * 1.7, t: 0, l: .5, c: h.col, s: 2.5 }); }
    } else if (h.shape !== 'w') {
      if (Math.random() < dt * 50) { const p = randIn(h); G.parts.push({ x: p.x, y: p.y, vx: 0, vy: -140, t: 0, l: .5, c: h.col, s: 2.5 }); }
    } else if (f > .35 && Math.random() < dt * 90) {
      const an = h.a + rnd(-h.half, h.half), sp = rnd(300, 700);
      G.parts.push({ x: h.x + Math.cos(an) * b.hr, y: h.y + Math.sin(an) * b.hr, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, t: 0, l: .5, c: h.col, s: 3, line: true });
    }
    if (h.kind === 'meteor' && !h.whoosh && f > .4) { h.whoosh = true; noise(.55, .1, 1800, 300); }
  } else if (h.t < t2) {
    if (!h.fired) { h.fired = true; zoneBlast(h); }
    if (h.kind === 'pool' && Math.random() < dt * 18) { const p = randIn(h); G.parts.push({ x: p.x, y: p.y, vx: rnd(-10, 10), vy: -rnd(30, 70), t: 0, l: .9, c: '#9bff8a', s: 3 }); }
    if (inZone(h, s)) hurtZone(h, s);
  } else if (h.t > t2 + h.fade) h.dead = true;
}
function updateHole(h, dt, s) {
  h.born = Math.min(1, h.born + dt * 2);
  if (s.mode === 'free') {
    const fk = fs(), dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
    if (d < (h.pull || 150 * fk)) { const a = (h.str || 16000) * fk / (d / fk + 40); s.vx += dx / d * a * dt; s.vy += dy / d * a * dt; }
    if (d < h.r + shipR() - 1) hurt(h.x, h.y, h.pow);
  }
  if (Math.random() < dt * 50) { const an = rnd(0, TAU); G.parts.push({ x: h.x + Math.cos(an) * 80, y: h.y + Math.sin(an) * 80, vx: -Math.cos(an) * 100, vy: -Math.sin(an) * 100, t: 0, l: .7, c: '#c88aff', s: 2 }); }
}

/** 매 프레임 위험 요소(존·블랙홀·항성풍)를 갱신한다 */
export function updateHaz(dt, b) {
  const s = G.ship;
  for (const h of G.haz) {
    h.t = (h.t || 0) + dt;
    if (h.k === 'zone') updateZone(h, dt, b, s);
    else if (h.k === 'hole') updateHole(h, dt, s);
    else if (h.k === 'horizon') updateHorizon(h, dt);
    else if (h.k === 'wind') {
      if (s.mode === 'free') s.vx += h.dir * 230 * fs() * dt;
      if (Math.random() < dt * 40) G.parts.push({ x: h.dir > 0 ? -5 : G.w + 5, y: rnd(G.arenaTop, G.arenaBot), vx: h.dir * rnd(300, 500), vy: rnd(-10, 10), t: 0, l: .9, c: 'rgba(150,255,210,.6)', s: 2, line: true });
    }
  }
  G.haz = G.haz.filter(h => !h.dead);
}
