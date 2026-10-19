/* 월드 생성: 필드 폭의 성장, 지형 패턴에 따른 행성·별·블랙홀·독 행성 배치 (행성 자체는 planets.js, 갈림길은 fork.js) */
import { G } from './state.js';
import { W0, rnd, clamp, TAU } from './util.js';
import { viewTop } from './camera.js';
import { fs } from './stats.js';
import { mkPlanet } from './planets.js';
import { pickSpecial, applySpecial } from './special.js';
import { addStars, maybeHole } from './scatter.js';
import { buildFork } from './fork.js';
import { maybeMonster } from './monsters.js';
import { opsGen, opsSqueeze } from './ops.js';

/* ---------- 필드 폭 ----------
 * 진행할수록 필드가 점점 넓어지고(카메라는 줌아웃) 행성·간격도 같이 커진다. 보스 아레나는 항상 기본 폭. */
const FIELD_MAX = 220;     // 기본 폭에서 최대로 더 넓어지는 양
/** 행성 하나 지날 때마다 조금씩 넓어진다 */
const fieldTarget = () => W0 + Math.min(FIELD_MAX, G.hops * 2.2);
export function growField(dt) {
  if (G.boss || (G.fork && G.fork.state === 'hub')) return;   // 보스전·갈림길 선택 중에는 고정
  const w0 = G.w;
  G.w += (fieldTarget() - G.w) * Math.min(1, dt * .9);
  if (G.w < w0) squeeze(G.w / w0);
}
/** 확대된 보스 아레나(boss-arena.js 의 arenaGrow)가 끝나고 필드가 원래 폭으로 돌아올 때, 남은 오브젝트가 벽 밖에 남지 않도록 가로로 같이 줄인다 */
function squeeze(r) {
  for (const p of G.planets) { p.x *= r; if (p.drift) p.drift.x0 *= r; }
  for (const L of [G.stars, G.holes]) for (const o of L) o.x *= r;
  for (const m of G.mons) { m.x *= r; if (m.x0 != null) m.x0 *= r; }
  if (G.ops) opsSqueeze(r);
  if (G.ship && G.ship.mode === 'free') G.ship.x *= r;
}

/* ---------- 지형 패턴 ----------
 * 행성 몇 개마다 배치 방식이 바뀐다. 필드가 넓어질수록(진행할수록) 더 다양한 패턴이 열린다.
 *   scatter 흩뿌림 · zigzag 좌우 번갈아 · column 중앙 기둥 · cluster 3개 군집 뒤 긴 공백 · giant 거대 가스행성 · drift 좌우로 떠다님 */
const PATTERNS = [
  { k: 'scatter', from: 0,  w: 3, len: [3, 5] },
  { k: 'zigzag',  from: 10, w: 2, len: [4, 6] },
  { k: 'column',  from: 14, w: 1, len: [3, 4] },
  { k: 'giant',   from: 16, w: 1, len: [1, 1] },
  { k: 'cluster', from: 18, w: 1.5, len: [3, 3] },
  { k: 'drift',   from: 22, w: 1.5, len: [3, 4] }
];
function nextPattern(prevK) {
  const open = PATTERNS.filter(p => G.genI >= p.from), other = open.filter(p => p.k !== prevK), pool = other.length ? other : open;
  const tot = pool.reduce((a, p) => a + p.w, 0);
  let r = Math.random() * tot, pick = pool[0];
  for (const p of pool) { if ((r -= p.w) <= 0) { pick = p; break; } }
  return { k: pick.k, left: Math.round(rnd(pick.len[0], pick.len[1])), side: Math.random() < .5 ? -1 : 1, gap: G.pat.gap };
}

/** 다음 행성의 위치와 모양을 패턴에 따라 정한다 */
function place(prev) {
  if (G.pat.left <= 0) G.pat = nextPattern(G.pat.k);
  const P = G.pat, k = fs(), m = 58 * k, lo = m, hi = G.w - m, first = !P.started;
  P.started = true; P.left--;
  let dy = (rnd(150, 200) + Math.min(G.genI * 1.2, 40)) * k, x, mod = null;
  if (P.gap) { dy *= 1.55; P.gap = false; }
  switch (P.k) {
    case 'zigzag': { P.side = -P.side; x = P.side > 0 ? rnd(G.w * .64, hi) : rnd(lo, G.w * .36); break; }
    case 'column': { x = clamp(G.w / 2 + rnd(-36, 36) * k, lo, hi); dy *= .92; break; }
    case 'giant': { x = rnd(G.w * .3, G.w * .7); dy *= 1.1; mod = 'giant'; break; }
    case 'cluster': {
      if (first) x = rnd(G.w * .3, G.w * .7);
      else { P.side = -P.side; x = clamp(prev.x + P.side * rnd(78, 104) * k, lo, hi); }
      dy = first ? dy : rnd(78, 100) * k;
      if (P.left === 0) P.gap = true;
      break;
    }
    case 'drift': { x = rnd(lo + 60 * k, hi - 60 * k); mod = 'drift'; break; }
    default: { let n = 0; do { x = rnd(lo, hi); } while (Math.abs(x - prev.x) < 75 * k && n++ < 20); }
  }
  return { x, dy, mod };
}

/** 화면 위쪽이 비지 않도록 행성을 이어서 만든다. 갈림길 선택 대기 중에는 멈춘다 */
export function gen() {
  const F = G.fork;
  if (F && F.state === 'hub') return;
  while (G.genY > viewTop() - 320) {
    const prev = G.planets[G.planets.length - 1];
    if (F && F.state === 'queued' && G.genI >= F.at) { buildFork(prev); return; }
    const { x, dy, mod } = place(prev);
    G.genY -= dy;
    const gt = G.ops && opsGen.type();   // 블랙쉽: 거대 행성 기믹이 나올 차례인가
    const kind = !gt && mod !== 'giant' && mod !== 'drift' && pickSpecial(prev);   // 후반의 특수 이동 행성(special.js)
    const p = mkPlanet(G.genI++, x, G.genY, G.biome, kind ? 'n' : gt || (mod === 'giant' && G.biome !== 'belt' ? 'g' : undefined));
    if (gt) opsGen.giantify(p);
    if (mod === 'giant' && p.t === 'g') { const ring = p.cap - p.R; p.R *= 1.5; p.cap = p.R + ring * 1.35; p.giant = true; }
    if (mod === 'drift' && p.t !== 'm') p.drift = { x0: x, amp: Math.min(70 * fs(), x - 40, G.w - 40 - x), sp: rnd(.5, .8), t: rnd(0, TAU) };
    if (kind) { const { post, moon } = applySpecial(kind, p, mkPlanet); if (moon) G.planets.push(moon); G.genY = p.y - post; }
    G.planets.push(p);
    if (G.safeGen > 0) { G.safeGen--; addStars(prev, p); continue; }   // 보스 격파 직후 구간: 블랙홀·독 행성·벽·소형함 없음
    if (kind || prev.sp) continue;   // 특수 행성 앞뒤로는 별·블랙홀·독 행성·벽·소형함을 두지 않는다(움직이는 행성과 겹치지 않게)
    addStars(prev, p);
    maybeHole(prev, p, dy);
    if (G.biome === 'monster') maybeMonster(prev, p, dy);
    if (G.ops) opsGen.extras(prev, p, dy);   // 벽·소형함
  }
}
