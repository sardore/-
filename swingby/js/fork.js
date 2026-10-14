/* 갈림길: 보스를 쓰러뜨리면 몇 개 뒤에 거대 암석 행성(허브)이 나온다. 그 궤도는 거의 줄어들지 않고,
 * 도착하면 시야가 넓어져 왼쪽/오른쪽 항로가 보인다. 항로마다 다음 보스(2개 스테이지)와 바이옴이 다르다. */
import { G } from './state.js';
import { W0, rnd, shuffle } from './util.js';
import { BIOMES, BOSSES, STAGES, MONSTER_ZONE } from './data.js';
import { fs } from './stats.js';
import { mkPlanet } from './planets.js';
import { addStars } from './scatter.js';
import { endlessNext } from './endless.js';
import { flashScreen, punch } from './fx.js';
import { thump } from './audio.js';

export function scheduleFork() {
  G.fork = { state: 'queued', at: G.genI + 3, active: false, hub: null, branches: null };
}

/** 이번 갈림길의 좌/우 선택지. 처음에는 단순한 바이옴만, 소행성대·공허대는 두 번째 갈림길부터 */
function routeOptions() {
  const stage = G.kills % STAGES.length, bis = STAGES[stage], f = G.kills - 1;
  const afterZone = (G.kills - 1) % STAGES.length === MONSTER_ZONE.stage;   // 독 행성 지대 보스 직후엔 같은 지대를 또 권하지 않는다
  const pool = f <= 0 ? ['nebula', 'redzone'] : f === 1 ? ['belt', 'void'] : Object.keys(BIOMES).filter(k => k !== 'normal' && !(k === 'monster' && afterZone));
  const biomes = shuffle(pool.slice()), bosses = endlessNext() ? [-1, -1] : bis.length > 1 ? shuffle(bis.slice()) : [bis[0], bis[0]];   // -1: 무한 모드의 보스는 가기 전까지 모른다
  return [0, 1].map(i => ({ biome: biomes[i], bi: bosses[i] }));
}

export function buildFork(prev) {
  const F = G.fork;
  G.genY -= rnd(200, 220) * fs();
  const hub = mkPlanet(G.genI++, G.w / 2, G.genY, 'normal', 'm');
  G.planets.push(hub); addStars(prev, hub);
  F.hub = hub; F.state = 'hub'; F.branches = {};
  const opts = routeOptions();
  ['L', 'R'].forEach((side, si) => {
    const o = opts[si], list = [];
    for (let j = 0; j < 2; j++) {
      const f = (82 + j * 22) / W0, x = (side === 'L' ? f : 1 - f) * G.w;
      const q = mkPlanet(G.genI++, x, hub.y - 230 - j * 185, o.biome);
      q.branch = side; G.planets.push(q); list.push(q);
    }
    addStars(list[0], list[1], side);
    F.branches[side] = { biome: o.biome, bi: o.bi, planets: list };
  });
  G.genY = hub.y - (230 + 185) * fs();
}

/** 허브에 도착: 시야를 넓힌다 */
function enterFork() {
  const F = G.fork; if (!F || F.state !== 'hub') return;
  F.active = true;
  G.banner = { t: 0, dur: 1.8, a: 'FORK', b: '갈림길', c: '#ffd9a8' };
}

/** 항로의 첫 행성에 닿았다: 반대편을 치우고 바이옴·다음 보스를 확정한다 */
function commitRoute(p) {
  const F = G.fork, side = p.branch, br = F.branches[side], other = side === 'L' ? 'R' : 'L';
  G.planets = G.planets.filter(q => q.branch !== other);
  G.stars = G.stars.filter(t => t.br !== other);
  G.biome = br.biome; G.nextBi = br.bi;
  G.genY = Math.min(...br.planets.map(q => q.y));
  G.fork = null;
  return br;
}

/** 갈림길 도착 처리: 허브면 시야가 넓어지고, 항로의 첫 행성이면 길이 정해진다.
 * 포획과 비상 추진기 복귀처럼 "그 행성에 자리 잡는" 모든 경로에서 부른다 */
export function forkArrive(p) {
  const F = G.fork;
  if (F && p === F.hub) enterFork();
  else if (F && F.state === 'hub' && p.branch) {
    const br = commitRoute(p), bm = BIOMES[br.biome];
    G.banner = { t: 0, dur: 2.6, a: '항로 결정', b: bm.n, c: bm.c, sub: '다음 보스  ' + (br.bi < 0 ? '???' : BOSSES[br.bi].n) };
    flashScreen(.25, bm.c); punch(.03); thump(110, 40, .4, .25);
  }
}
