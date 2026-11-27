/* 장애물 구간: 흩뿌리지 않고 "동선"이 있는 구간(세트피스)으로 만든다. 일반 항해에서만 나온다(튜토리얼·블랙쉽 제외).
 *
 *  플라즈마 관문   두 행성 사이, 곧게 가는 길의 한쪽을 막는 전류 한 줄. 반대쪽으로 비껴가야 한다.
 *  플라즈마 슬라롬 좌우 벽에서 번갈아 뻗어 나온 전류 사이를 행성을 따라 지그재그로.
 *  플라즈마 미로   (가끔) 가로 2칸 정사각형 격자. 격자 모서리마다 플라즈마 오브, 막힌 변에는 네온 전류(닿으면 즉사).
 *                  칸마다 행성 하나가 길을 이루고, 길이 지나는 변만 열려 있다(위로 · 같은 줄 옆 칸으로).
 *  미지 행성 관문  물음표가 그려진 검은 가스행성 양옆으로 전류가 벽까지 막는다. 지나갈 곳은 행성뿐 —
 *                  스치면 궤도에 붙지만, 한가운데로 뚫고 가면 붙지 않고 그대로 통과한다.
 *  부스트 활주로   부스트 오브(닿으면 속도가 크게 증폭) 위로 전류 벽 사이의 좁은 통로, 통로 끝에 다음 행성.
 *  중력 우회로     전류 벽이 가로를 대부분 막고 반대쪽 틈 위에 화살표 오브. 닿으면 화살표 방향으로 중력이 걸려
 *                  (색이 진할수록 세다) 벽이나 행성에 닿을 때까지 휘어 날아간다 → 벽 너머의 행성으로.
 *  반전 포탈       가로를 채우는 포탈. 지나면 화면이 위아래로 뒤집혀 아래로 내려가는 항해가 된다. 몇 행성 뒤 되돌리는 포탈.
 *
 * 상태: G.obs(장애물 목록), G.flip(목표 방향 1/-1) · G.flipK(화면 뒤집힘 정도, 애니메이션), G.piece(다음 구간 예약).
 * 그리기는 obstacles-draw.js, 월드 생성 연결은 world.js 의 gen(). */
import { G } from './state.js';
import { rnd, rint, clamp, TAU } from './util.js';
import { fs, spd, shipR } from './stats.js';
import { mkPlanet } from './planets.js';
import { die } from './death.js';
import { beep, thump, noise, sweep, vibe } from './audio.js';
import { burst, sparks, ringFx, flashScreen, shakeAdd, punch } from './fx.js';

/** 구간 종류: from 열리는 행성 번호(genI) · w 뽑힐 비중 */
const PIECES = [
  { k: 'gate',   from: 9,  w: 1.3 },
  { k: 'unk',    from: 11, w: 1.1 },
  { k: 'boost',  from: 13, w: 1 },
  { k: 'slalom', from: 15, w: 1.1 },
  { k: 'pull',   from: 18, w: 1 },
  { k: 'maze',   from: 20, w: .55 },   // 미로는 가끔만
  { k: 'portal', from: 24, w: .8 }
];
const GAP = [5, 8];   // 구간 사이에 끼우는 보통 행성 수
/** 시험용: 주소에 ?piece=maze(또는 gate·slalom·unk·boost·pull·portal) 를 붙이면 그 구간만 처음부터 자주 나온다 */
const FORCE = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('piece') : null;
export const PULL_ACC = [0, 300, 470, 660];   // 화살표 오브 세기별 가속(px/s², 지형 배율 곱)
const BOOST = 2.1, BOOST_TAU = 1.3;          // 부스트 오브: 속도 배율 · 원래 속도로 돌아오는 시간 상수

/* ---------- 예약 ---------- */
/** 이 판에서 장애물 구간이 나오는가 */
const allowed = () => !G.tuto && !G.ops;
/** world.js 의 gen() 이 행성 하나를 놓기 전에 부른다. 구간을 만들었으면 true(그 구간이 행성을 직접 놓았다) */
export function maybePiece() {
  if (!allowed() || G.safeGen > 0) return false;
  const F = G.fork;
  if (F && F.state === 'queued' && G.genI >= F.at - 7) return false;   // 갈림길 직전에는 넣지 않는다
  if (G.piece == null) G.piece = { at: FORCE ? 2 : PIECES[0].from + rint(0, 2), last: '' };
  if (G.portalBack != null && G.genI >= G.portalBack) { portalBack(); return true; }
  if (G.genI < G.piece.at || G.portalBack != null) return false;
  const open = FORCE ? PIECES.filter(p => p.k === FORCE) : PIECES.filter(p => G.genI >= p.from && p.k !== G.piece.last && (p.k !== 'maze' || G.w >= 440));
  if (!open.length) return false;
  let r = Math.random() * open.reduce((a, p) => a + p.w, 0), pick = open[0];
  for (const p of open) if ((r -= p.w) <= 0) { pick = p; break; }
  const prev = G.planets[G.planets.length - 1];
  BUILD[pick.k](prev);
  G.piece.last = pick.k; G.piece.at = G.genI + (FORCE ? 2 : rint(GAP[0], GAP[1]));
  return true;
}

/* ---------- 놓기 도우미 ---------- */
function planet(x, y, type) {
  const p = mkPlanet(G.genI++, x, y, G.biome, type || 'n');
  G.planets.push(p); G.genY = Math.min(G.genY, y); return p;
}
const node = (x, y) => { const o = { k: 'orb', x, y, r: 8 * fs() }; G.obs.push(o); return o; };
/** 두 지점 사이의 전류(양 끝에 오브) */
function arc(ax, ay, bx, by, ends) {
  G.obs.push({ k: 'arc', ax, ay, bx, by, ph: rnd(0, 99) });
  if (ends !== false) { node(ax, ay); node(bx, by); }
}
function star(x, y) { G.stars.push({ x: clamp(x, 14, G.w - 14), y, got: false, ph: rnd(0, TAU) }); }
function starLine(a, b, n) { for (let j = 1; j <= n; j++) { const f = j / (n + 1); star(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f); } }
/** 포획 범위가 칸 밖으로 넘지 않게 줄인다 */
function fitRing(p, half) { const ring = Math.max(34 * fs(), half - 18 * fs() - p.R); p.cap = Math.min(p.cap, p.R + ring); }

/* ---------- 구간 ---------- */
const BUILD = {
  /** 플라즈마 관문: 다음 행성으로 곧게 가는 선의 한쪽을 막는다 */
  gate(prev) {
    const k = fs(), W = G.w, side = prev.x < W / 2 ? 1 : -1;   // 다음 행성은 반대편 위
    const T = planet(clamp(W / 2 + side * rnd(.15, .3) * W, 70 * k, W - 70 * k), prev.y - rnd(270, 320) * k);
    const my = (prev.y + T.y) / 2, mx = (prev.x + T.x) / 2, len = rnd(110, 160) * k, tilt = rnd(-25, 25) * k;
    const dir = Math.random() < .5 ? -1 : 1, x0 = mx + dir * 46 * k;   // 곧은 길 바로 옆에서 바깥쪽으로 뻗는다
    arc(x0, my - tilt / 2, clamp(x0 + dir * len, 9, W - 9), my + tilt / 2);
    starLine(prev, T, 2);
  },

  /** 플라즈마 슬라롬: 벽에서 번갈아 뻗은 전류, 행성은 그 끝을 돌아가는 자리 */
  slalom(prev) {
    const k = fs(), W = G.w, n = rint(3, 4);
    let side = prev.x < W / 2 ? -1 : 1, last = prev;
    for (let i = 0; i < n; i++) {
      const wy = last.y - 150 * k, reach = W * rnd(.5, .6);
      arc(side < 0 ? 9 : W - 9, wy, side < 0 ? reach : W - reach, wy);           // side 쪽 벽에서 뻗는다
      const p = planet(side < 0 ? W - rnd(80, 120) * k : rnd(80, 120) * k, wy - 130 * k, Math.random() < .25 ? 'r' : 'n');   // 전류 끝의 반대편 위
      starLine(last, p, 1); last = p; side = -side;
    }
  },

  /** 플라즈마 미로: 가로 2칸 정사각형 격자 */
  maze(prev) {
    const k = fs(), W = G.w, s = W / 2, N = rint(3, 5), y0 = prev.y - 150 * k, X = [9, s, W - 9];
    // 길: 줄마다 한 칸(가끔 같은 줄의 옆 칸으로 한 번 더)을 지나 위로
    let c = Math.random() < .5 ? 0 : 1;
    const cells = [], side = [], up = [];
    for (let r = 0; r < N; r++) {
      cells.push([r, c]);
      if (r < N - 1 && Math.random() < .5 && !(side[r - 1])) { side[r] = true; c = 1 - c; cells.push([r, c]); }
      up[r] = c;   // 이 줄의 위쪽 변 중 열린 쪽
    }
    const rowY = r => y0 - r * s;   // r 번째 줄의 아래 변
    for (let r = 1; r <= N; r++) for (const cc of [0, 1]) if (up[r - 1] !== cc) arc(X[cc], rowY(r), X[cc + 1], rowY(r), false);   // 가로 변: 길이 올라가는 쪽만 연다
    for (let r = 0; r < N; r++) if (!side[r]) arc(s, rowY(r), s, rowY(r + 1), false);                                              // 가운데 세로 변: 옆으로 가는 줄만 연다
    for (let r = 0; r <= N; r++) for (const x of X) node(x, rowY(r));                                                                // 모서리마다 플라즈마 오브
    let last = prev;
    for (const [r, cc] of cells) {
      const p = planet(cc * s + s / 2 + rnd(-.1, .1) * s, rowY(r) - s / 2 + rnd(-.08, .08) * s, Math.random() < .2 ? 'r' : 'n');
      fitRing(p, s / 2); p.maze = true; if (last !== prev) starLine(last, p, 1); last = p;
    }
    const ex = planet(up[N - 1] * s + s / 2, rowY(N) - 150 * k, 'n');   // 출구: 열린 변 바로 위
    starLine(last, ex, 2);
  },

  /** 미지 행성 관문: 행성 양옆을 벽까지 전류로 막는다 */
  unk(prev) {
    const k = fs(), W = G.w, U = planet(clamp(W / 2 + rnd(-.15, .15) * W, 120 * k, W - 120 * k), prev.y - 240 * k, 'g');
    U.unk = true; U.hue = 272;
    const gap = U.R + 18 * k;
    arc(9, U.y, U.x - gap, U.y); arc(U.x + gap, U.y, W - 9, U.y);
    for (let j = -2; j <= 2; j++) if (j) star(U.x, U.y + j * U.R * .55);   // 한가운데로 줄지은 별: 뚫고 가고 싶게
    planet(clamp(U.x + (Math.random() < .5 ? -1 : 1) * rnd(70, 150) * k, 80 * k, W - 80 * k), U.y - 250 * k);
  },

  /** 부스트 활주로: 부스트 오브 → 전류 벽 사이 통로 → 다음 행성 */
  boost(prev) {
    const k = fs(), W = G.w, cx = clamp(prev.x + rnd(-40, 40) * k, 110 * k, W - 110 * k), half = 58 * k;
    const by = prev.y - 165 * k, top = by - 60 * k, end = top - 360 * k;
    G.obs.push({ k: 'boost', x: cx, y: by, r: 19 * k });
    arc(cx - half, top, cx - half, end); arc(cx + half, top, cx + half, end);         // 통로 양쪽 벽
    arc(9, top, cx - half, top, false); arc(cx + half, top, W - 9, top, false);       // 통로 입구 양옆을 벽까지 막는다
    node(9, top); node(W - 9, top);
    for (let j = 0; j < 4; j++) star(cx, top - 40 * k - j * 80 * k);
    planet(cx, end - 150 * k);
  },

  /** 중력 우회로: 넓은 전류 벽, 반대쪽 틈 위의 화살표 오브가 벽 너머 행성으로 휘어 보낸다 */
  pull(prev) {
    const k = fs(), W = G.w, L = prev.x < W / 2 ? 1 : -1;   // L: 틈이 있는 쪽(출발 행성의 반대편)
    const wy = prev.y - 250 * k, gapW = Math.max(120 * k, W * .28), wallEnd = L > 0 ? W - gapW : gapW;
    arc(L > 0 ? 9 : W - 9, wy, wallEnd, wy);
    const T = { x: L > 0 ? W * .22 : W * .78, y: wy - 230 * k };
    const o = { x: L > 0 ? W - gapW / 2 : gapW / 2, y: wy - 70 * k };
    const lv = rint(1, 3), dx = T.x - o.x, dy = T.y - 40 * k - o.y, d = Math.hypot(dx, dy);
    G.obs.push({ k: 'pull', x: o.x, y: o.y, r: 22 * k, lv, dx: dx / d, dy: dy / d });
    star(o.x, wy + 60 * k); star(o.x, wy);
    planet(T.x, T.y, 'n');
  },

  /** 반전 포탈: 지나면 화면이 뒤집혀 아래로 내려가는 항해. 몇 행성 뒤 되돌림 포탈 */
  portal(prev) {
    const k = fs(), py = prev.y - 140 * k;
    G.obs.push({ k: 'portal', y: py, to: -1, used: false });
    planet(clamp(prev.x + rnd(-90, 90) * k, 70 * k, G.w - 70 * k), py - 150 * k);
    G.portalBack = G.genI + rint(5, 8);
  }
};
/** 뒤집힌 구간이 끝나는 곳: 되돌림 포탈 */
function portalBack() {
  const prev = G.planets[G.planets.length - 1], k = fs(), py = prev.y - 140 * k;
  G.obs.push({ k: 'portal', y: py, to: 1, used: false });
  planet(clamp(prev.x + rnd(-90, 90) * k, 70 * k, G.w - 70 * k), py - 150 * k);
  G.portalBack = null; G.piece.at = Math.max(G.piece.at, G.genI + GAP[0]);
}

/* ---------- 매 프레임 ---------- */
/** 화면 뒤집힘 애니메이션(실제 시간) */
export function updateFlip(dt) { G.flipK += (G.flip - G.flipK) * Math.min(1, dt * 6); if (Math.abs(G.flip - G.flipK) < .002) G.flipK = G.flip; }
/** 보스전 시작·새 판: 장애물을 치우고 화면을 바로 세운다 */
export function clearObstacles() { G.obs = []; G.flip = 1; G.portalBack = null; }

/** 점과 선분 사이 거리 */
function segDist(px, py, o) { const vx = o.bx - o.ax, vy = o.by - o.ay, L = vx * vx + vy * vy || 1, t = clamp(((px - o.ax) * vx + (py - o.ay) * vy) / L, 0, 1); return Math.hypot(px - o.ax - vx * t, py - o.ay - vy * t); }

/** 비행 중 한 틱(player.js): 전류·오브 충돌, 중력 화살표, 부스트, 포탈. 죽었으면 false */
export function hitObstacles(dt, py0) {
  const s = G.ship, sr = shipR() * .6;
  if (s.pull) {   // 화살표 오브의 중력: 벽이나 행성에 닿을 때까지
    s.vx += s.pull.ax * dt; s.vy += s.pull.ay * dt;
    const m = Math.hypot(s.vx, s.vy), mx = spd() * Math.max(1.7, s.boost); if (m > mx) { s.vx *= mx / m; s.vy *= mx / m; }
    if (Math.random() < dt * 40) G.parts.push({ x: s.x, y: s.y, vx: -s.pull.ax * .25, vy: -s.pull.ay * .25, t: 0, l: .35, c: s.pull.c, s: 2, line: true });
  }
  for (const o of G.obs) {
    switch (o.k) {
      case 'orb': if (Math.hypot(s.x - o.x, s.y - o.y) < o.r + sr) return zap(s.x, s.y); break;
      case 'arc': if (segDist(s.x, s.y, o) < 5 * fs() + sr) return zap(s.x, s.y); break;
      case 'boost': {
        const inside = Math.hypot(s.x - o.x, s.y - o.y) < o.r + sr + 4;
        if (inside && s.lastBoost !== o) {
          s.lastBoost = o; const m = Math.hypot(s.vx, s.vy) || 1, b = Math.max(s.boost, BOOST), v = spd() * b;
          s.vx *= v / m; s.vy *= v / m; s.boost = b; s.btau = BOOST_TAU;
          const a = Math.atan2(s.vy, s.vx);
          sparks(s.x, s.y, '#ffd36a', 16, 420, a + Math.PI, .5); ringFx(o.x, o.y, '#ffd36a', o.r, o.r + 50, .4, 4); flashScreen(.15, '#ffd36a'); shakeAdd(5); punch(.03);
          sweep(400, 1600, .35, .1, 'square'); thump(200, 60, .2, .25); vibe(20);
        } else if (!inside && s.lastBoost === o) s.lastBoost = null;
        break;
      }
      case 'pull': {
        const inside = Math.hypot(s.x - o.x, s.y - o.y) < o.r + sr + 2;
        if (inside && (!s.pull || s.pull.o !== o)) {
          const a = PULL_ACC[o.lv] * fs(), c = 'hsl(195,95%,' + (78 - o.lv * 10) + '%)';
          s.pull = { o, ax: o.dx * a, ay: o.dy * a, c };
          ringFx(o.x, o.y, c, o.r, o.r + 46, .45, 3); burst(o.x, o.y, c, 14, 200); beep(300 + o.lv * 120, .12, 'sine'); noise(.4, .12, 1500, 300);
        }
        break;
      }
      case 'portal': {
        if (!o.used && py0 > o.y && s.y <= o.y) {   // 아래에서 위로 지나갔다
          o.used = true;
          if (G.flip !== o.to) G.flip = o.to;   // 반전/복귀 문구는 띄우지 않는다(화면이 뒤집히는 것으로 충분)
          flashScreen(.35, '#c79bff'); shakeAdd(6); punch(.04); sweep(900, 200, .5, .12, 'sine'); noise(.5, .15, 4000, 300);
          burst(s.x, s.y, '#c79bff', 24, 260);
        }
        break;
      }
    }
  }
  return true;
}
function zap(x, y) {
  sparks(x, y, '#ff7bf0', 22, 380, rnd(0, TAU), Math.PI); burst(x, y, '#9ff0ff', 18, 240); flashScreen(.3, '#ff7bf0');
  noise(.35, .25, 8000, 900);
  die('플라즈마 전류에 감전');
  return G.st === 'play';
}

/** 필드 폭이 줄 때(보스 뒤) 장애물도 같이 줄인다 */
export function squeezeObstacles(r) { for (const o of G.obs) { if (o.x != null) o.x *= r; if (o.ax != null) { o.ax *= r; o.bx *= r; } } }
/** 화면 아래로 멀어진 것을 치운다 */
export function cullObstacles(lim) { G.obs = G.obs.filter(o => (o.k === 'arc' ? Math.min(o.ay, o.by) : o.y) < lim); }
