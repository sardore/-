/* 보스 아레나: 서 있던 행성을 기준으로 전투장을 만들고(행성 배치·보스 등장), 부서진 행성을 되살린다 */
import { G, V } from './state.js';
import { W0, TAU, rnd, clamp } from './util.js';
import { BOSSES, STAGES, BIOMES } from './data.js';
import { capOf, bossO2 } from './stats.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, ringFx, flashScreen } from './fx.js';
import { mkPlanet } from './planets.js';

const ARENA_RING = .78;               // 보스전에서 서 있던 행성의 포획 링 폭 비율 (아레나 행성은 처음부터 좁게 만든다)
export const SWAY_FROM = 1, SWAY_Y = 26;   // 보스가 움직이기 시작하는 스테이지(0부터)와 위아래 흔들림 폭
export const aliveP = () => G.planets.filter(p => !p.dead);

/* ---------- 시작: 아레나 ---------- */
/** 지금 서 있는 행성을 기준으로 보스 아레나를 만든다 */
export function startBoss() {
  const s = G.ship, P = s.p, bi = G.nextBi, d0 = BOSSES[bi];
  // 아레나는 항상 기본 폭: 필드를 기본 폭으로 되돌리고, 지금 서 있는 행성도 그 안으로 옮긴다
  P.x = clamp(P.x * W0 / G.w, 70, W0 - 70); G.w = W0; G.vz = 1;
  const stage = G.kills % STAGES.length, loop = Math.floor(G.kills / STAGES.length);
  const ks = clamp(V.VH / 860, .78, 1), d = Object.assign({}, d0, { R: d0.R * ks });
  G.arenaCam = P.y - V.VH + 110;
  const by = G.arenaCam + (V.VH < 760 ? 150 : 178) + d.R * .6;
  G.stars = []; G.holes = []; G.mons = [];
  P.cap = P.R + (P.cap - P.R) * ARENA_RING; s.r = Math.min(s.r, Math.max(P.R + 14, capOf(P) - 6));   // 서 있던 행성의 포획 범위도 같이 줄인다
  const list = buildArena(P, by, d.R, stage >= SWAY_FROM ? SWAY_Y : 0);
  P.seen = true; list.sort((a, b) => b.y - a.y); G.planets = list;
  if (G.biome === 'belt') list.forEach(q => { q.brittle = true; }); // 소행성대의 보스: 아레나 행성도 떠나면 부서진다
  const hp = Math.round(d.hp * (1 + .6 * loop));
  G.boss = {
    bi, stage, loop, d, hp, max: hp, R: d.R, hr: d.kind === 'quasar' ? d.R * 1.35 : d.R, x: W0 / 2, y: by, hx: W0 / 2, hy: by, mt: 0, mv: 1,
    idle: 0, cast: 0, st: 0, state: 'intro', flash: 0, sq: 0, q: [], turn: 0, phase: 0, hitT: 0, last: '', ph: rnd(0, TAU)
  };
  G.bo2max = G.bo2 = bossO2(stage, loop); G.bcombo = 0; s.hitF = false; s.charging = false; G.haz = [];
  G.banner = { t: 0, dur: 3, a: 'BOSS ' + (stage + 1) + ' / ' + STAGES.length + (loop ? '  ·  ' + (loop + 1) + '회차' : ''), b: d.n, c: 'hsl(' + d.hue + ',100%,70%)', sub: d.line };
  G.shake = 8; flashScreen(.35, 'hsl(' + d.hue + ',100%,70%)'); thump(70, 28, 1.4, .4); noise(1.6, .25, 900, 60); vibe([40, 30, 80]);
}

/** 보스로 향하는 직선을 가로막지 않는 행성 배치를 찾는다 */
function buildArena(P, by, bossR, sway) {
  const yMin = by + bossR + 50 + sway, yMax = P.y + (V.VH < 760 ? 18 : -60);
  const clear = (p, L) => { // p→보스 선분 근처에 다른 행성이 없어야 한다
    const ax = p.x, ay = p.y, vx = W0 / 2 - ax, vy = by - ay, len2 = vx * vx + vy * vy;
    for (const q of L) {
      if (q === p) continue;
      const t = ((q.x - ax) * vx + (q.y - ay) * vy) / len2; if (t <= 0 || t >= 1) continue;
      if (Math.hypot(q.x - (ax + vx * t), q.y - (ay + vy * t)) < capOf(q) * .55 + 10) return false;
    }
    return true;
  };
  let list = [P];
  for (let att = 0; att < 80; att++) {
    const L = [P];
    for (let tries = 0; tries < 300 && L.length < 5 + (att % 2); tries++) {
      const x = rnd(58, W0 - 58), y = rnd(yMin, Math.max(yMin + 10, yMax));
      if (!L.every(q => Math.hypot(q.x - x, q.y - y) > 118)) continue;
      const gas = L.length === 3, q = mkPlanet(G.genI++, x, y, 'normal', gas ? 'g' : 'n');
      q.R = gas ? rnd(32, 38) : rnd(20, 27); q.cap = q.R + (gas ? 58 : rnd(40, 48)); q.hue = gas ? 36 : rnd(...BIOMES[G.biome].ph); q.seen = true; L.push(q);
    }
    if (L.length >= 4 && L.every(q => clear(q, L))) { list = L; break; }
    if (att === 79) list = L;
  }
  return list;
}

export function regrow(p) {
  p.dead = false; p.born = 0; p.pulse = 1;
  ringFx(p.x, p.y, 'rgba(160,255,200,.9)', 4, capOf(p), .6, 3); burst(p.x, p.y, '#9dffb0', 14, 120); beep(520, .1, 'sine');
}
export function regrowAll() { for (const p of G.planets) if (p.dead) regrow(p); }
