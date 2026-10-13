/* 보스 아레나: 서 있던 행성을 기준으로 전투장을 만들고(행성 배치·보스 등장), 부서진 행성을 되살린다 */
import { G, V } from './state.js';
import { W0, TAU, rnd, clamp } from './util.js';
import { BOSSES, STAGES, BIOMES } from './data.js';
import { capOf, bossO2, fs, arenaK } from './stats.js';
import { arenaH } from './camera.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, ringFx, flashScreen } from './fx.js';
import { mkPlanet } from './planets.js';

const ARENA_RING = .78;               // 보스전에서 서 있던 행성의 포획 링 폭 비율 (아레나 행성은 처음부터 좁게 만든다)
export const SWAY_FROM = 1, SWAY_Y = 26;   // 보스가 움직이기 시작하는 스테이지(0부터)와 위아래 흔들림 폭
export const aliveP = () => G.planets.filter(p => !p.dead && !p.ghost);

/* ---------- 스크롤 ----------
 * 보스전의 맵은 계속 뒤로(화면 아래로) 밀려난다. 보스는 화면 위에 붙어 있고 새 행성은 보스 아래쪽에서 나타난다.
 * 화면 아래로 밀려나면 일반 지형과 똑같이 심우주로 표류해 죽는다. 속도는 화면 기준 px/초이고 필드 폭(arenaK)에 비례해 늘린다. */
export const SCROLL = { base: 12, max: 1.4, ton: 1.8, accel: .8, gap: [58, 86] };
/** 새 행성은 보스 바로 아래에서 유령(투명·포획 불가)으로 나타나, 등장선에서 ACT.ghost 만큼 더 내려와야 실체가 된다(ACT.ramp 동안 서서히 짙어진다) */
const ACT = { ghost: 40, ramp: 24, alpha: .1 };
/** 이동 템포 배율: 첫 보스 1.0 → 후반 보스 1.4(스테이지에 따라 일정하게), TON 618 은 예외로 1.8 */
export const scrollTempo = b => b.d.kind === 'quasar' ? SCROLL.ton : 1 + (SCROLL.max - 1) * Math.min(b.stage, STAGES.length - 2) / (STAGES.length - 2);
const scrollSpeed = b => SCROLL.base * scrollTempo(b) * arenaK();   // 행성 간격은 거리 기준이라 빨라지면 행성이 나오는 빈도(시간당)도 같은 비율로 늘어난다

/* ---------- 시작: 아레나 ---------- */
/** 지금 서 있는 행성을 기준으로 보스 아레나를 만든다 */
export function startBoss() {
  const s = G.ship, P = s.p, bi = G.nextBi, d0 = BOSSES[bi];
  // 아레나는 보스가 시작될 때의 필드 폭 그대로(진행할수록 넓다). 필드 폭은 보스전 동안 고정이고, 크기는 fk(√), 거리는 K(선형) 배율을 따른다
  const fk = fs(), K = arenaK();
  P.x = clamp(P.x, 70 * fk, G.w - 70 * fk); G.vz = W0 / G.w;
  const stage = G.kills % STAGES.length, loop = Math.floor(G.kills / STAGES.length);
  const ks = clamp(V.VH / 860, .78, 1), d = Object.assign({}, d0, { R: d0.R * ks * fk });
  G.arenaBot = P.y + 110 * K; G.arenaTop = G.arenaBot - arenaH();
  const by = G.arenaTop + (V.VH < 760 ? 150 : 178) * K + d.R * .6;
  G.stars = []; G.holes = []; G.mons = [];
  P.cap = P.R + (P.cap - P.R) * ARENA_RING; s.r = Math.min(s.r, Math.max(P.R + 14, capOf(P) - 6));   // 서 있던 행성의 포획 범위도 같이 줄인다
  const sway = stage >= SWAY_FROM ? SWAY_Y : 0, list = buildArena(P, by, d.R, sway, ACT.ghost * K);
  P.seen = true; list.sort((a, b) => b.y - a.y); G.planets = list;
  if (G.biome === 'belt') list.forEach(q => { q.brittle = true; }); // 소행성대의 보스: 아레나 행성도 떠나면 부서진다
  const hp = Math.round(d.hp * (1 + .6 * loop));
  G.boss = {
    bi, stage, loop, d, hp, max: hp, R: d.R, hr: d.kind === 'quasar' ? d.R * 1.35 : d.R, x: G.w / 2, y: by, hx: G.w / 2, hy: by, mt: 0, mv: 1,
    idle: 0, cast: 0, st: 0, state: 'intro', flash: 0, sq: 0, q: [], turn: 0, phase: 0, hitT: 0, last: '', ph: rnd(0, TAU),
    off: by - G.arenaTop, spawnOff: by - G.arenaTop + d.R + (50 + sway) * fk,   // 화면 윗변에서 보스·새 행성 등장선까지의 거리 (실체가 되는 선은 ACT.ghost 아래)
    sv: 0, lastY: Math.min(...list.map(q => q.y)), gap: rnd(...SCROLL.gap) * K, made: 0     // 현재 스크롤 속도 · 마지막 행성 높이 · 다음 행성까지의 간격
  };
  G.bo2max = G.bo2 = bossO2(stage, loop); G.bcombo = 0; s.hitF = false; s.charging = false; G.haz = [];
  G.banner = { t: 0, dur: 3, a: 'BOSS ' + (stage + 1) + ' / ' + STAGES.length + (loop ? '  ·  ' + (loop + 1) + '회차' : ''), b: d.n, c: 'hsl(' + d.hue + ',100%,70%)', sub: d.line };
  G.shake = 8; flashScreen(.35, 'hsl(' + d.hue + ',100%,70%)'); thump(70, 28, 1.4, .4); noise(1.6, .25, 900, 60); vibe([40, 30, 80]);
}

/** 아레나용 행성: 일반 행성보다 포획 링이 좁다 (gas 면 가스행성) */
function arenaPlanet(x, y, gas) {
  const fk = fs(), q = mkPlanet(G.genI++, x, y, 'normal', gas ? 'g' : 'n');
  q.R = (gas ? rnd(32, 38) : rnd(20, 27)) * fk; q.cap = q.R + (gas ? 58 : rnd(40, 48)) * fk; q.hue = gas ? 36 : rnd(...BIOMES[G.biome].ph); q.seen = true;
  if (G.biome === 'belt') q.brittle = true;
  return q;
}

/** 보스로 향하는 직선을 가로막지 않는 행성 배치를 찾는다 */
function buildArena(P, by, bossR, sway, skip) {
  const fk = fs(), K = arenaK();
  const yMin = by + bossR + (50 + sway) * fk + skip, yMax = P.y + (V.VH < 760 ? 18 : -60) * K, want = Math.round(5 * K);
  const clear = (p, L) => { // p→보스 선분 근처에 다른 행성이 없어야 한다
    const ax = p.x, ay = p.y, vx = G.w / 2 - ax, vy = by - ay, len2 = vx * vx + vy * vy;
    for (const q of L) {
      if (q === p) continue;
      const t = ((q.x - ax) * vx + (q.y - ay) * vy) / len2; if (t <= 0 || t >= 1) continue;
      if (Math.hypot(q.x - (ax + vx * t), q.y - (ay + vy * t)) < capOf(q) * .55 + 10 * fk) return false;
    }
    return true;
  };
  let list = [P];
  for (let att = 0; att < 80; att++) {
    const L = [P];
    for (let tries = 0; tries < 300 && L.length < want + (att % 2); tries++) {
      const x = rnd(58 * fk, G.w - 58 * fk), y = rnd(yMin, Math.max(yMin + 10, yMax));
      if (!L.every(q => Math.hypot(q.x - x, q.y - y) > 118 * fk)) continue;
      L.push(arenaPlanet(x, y, L.length === 3));
    }
    if (L.length >= 4 && L.every(q => clear(q, L))) { list = L; break; }
    if (att === 79) list = L;
  }
  return list;
}

/** 한 틱의 스크롤: 아레나 창이 위로 올라가고(= 맵이 밀려난다), 보스가 따라 올라가고, 새 행성이 들어오고, 지나간 행성이 사라진다 */
export function scrollArena(b, dt) {
  b.sv += (scrollSpeed(b) - b.sv) * Math.min(1, dt * SCROLL.accel);
  const dy = b.sv * dt;
  G.arenaTop -= dy; G.arenaBot -= dy; b.hy = G.arenaTop + b.off;
  for (const h of G.haz) if (h.anchor) h.y -= dy;            // 보스에 붙은 광선·제트·플레어는 보스와 함께 올라간다
  feedPlanets(b);
  const act = G.arenaTop + b.spawnOff + ACT.ghost * arenaK(), ramp = ACT.ramp * arenaK();
  for (const p of G.planets) { p.ghost = p.y < act; p.fa = p.ghost ? ACT.alpha : ACT.alpha + (1 - ACT.alpha) * clamp((p.y - act) / ramp, 0, 1); }
  const s = G.ship;
  G.planets = G.planets.filter(p => p.y < G.arenaBot + capOf(p) + 20 || (s.mode === 'orb' && s.p === p));
}
/** 등장선(보스 아래쪽)이 마지막 행성에서 충분히 멀어지면 새 행성을 만든다 */
function feedPlanets(b) {
  const fk = fs(), K = arenaK(), line = G.arenaTop + b.spawnOff;
  if (b.lastY - line < b.gap) return;
  for (let tries = 0; tries < 24; tries++) {
    const x = rnd(58 * fk, G.w - 58 * fk), y = line + rnd(0, 20 * K);
    if (!G.planets.every(q => Math.hypot(q.x - x, q.y - y) > 118 * fk)) continue;
    const q = arenaPlanet(x, y, ++b.made % 4 === 0); q.born = 0;
    G.planets.push(q); b.lastY = y; b.gap = rnd(...SCROLL.gap) * K;
    ringFx(x, y, 'rgba(160,220,255,.7)', 4, q.R + 18 * fk, .5, 2);
    return;
  }
}

/** 유령 상태를 모두 걷어낸다(보스전이 끝났을 때) */
export function solidifyAll() { for (const p of G.planets) { p.ghost = false; p.fa = 1; } }

export function regrow(p) {
  p.dead = false; p.born = 0; p.pulse = 1;
  ringFx(p.x, p.y, 'rgba(160,255,200,.9)', 4, capOf(p), .6, 3); burst(p.x, p.y, '#9dffb0', 14, 120); beep(520, .1, 'sine');
}
export function regrowAll() { for (const p of G.planets) if (p.dead) regrow(p); }
