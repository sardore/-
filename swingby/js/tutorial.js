/* 튜토리얼: 실제 게임 엔진 위에서 한 판을 안내한다. 말보다 그림(화살표·손가락·강조 링)으로 보여 주고, 마지막에 태양(sun.js)과 싸운다.
 * 이 파일은 진행(단계 전환·보스 힌트 선택·보상)만 맡고, 그림은 tutorial-draw.js 가 그린다.
 * 튜토리얼 중(G.tuto)에는 점수·기록·별 조각 정산을 하지 않고, 태양을 깰 때만 별 조각 30개를 준다. */
import { G, V, newRun } from './state.js';
import { W0 } from './util.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, ringFx, flashScreen, shakeAdd } from './fx.js';
import { grantShards } from './shop.js';
import { TUTO_SHARDS, addTutoClear } from './sun.js';
import { DASH_MIN } from './impact.js';
import { startRun } from './progress.js';

/** 새 튜토리얼 판 시작. 상점의 초기 스펙은 얹지 않고, 보스 앞까지는 떨어져도 되살려 준다 */
export function startTutorial() {
  newRun();
  G.tuto = { step: 'launch', st: 0, t: 0, h0: 0, od: 0, flags: {}, shown: {}, bh: null, cleared: 0 };
  G.stats.shield = 99; G.nextBoss = 8; G.nextOffer = Infinity; G.st = 'play'; G.ship.grace = 9;
  beep(520, .1);
}

const next = id => { const T = G.tuto; T.step = id; T.st = 0; T.h0 = G.hops; T.od = 0; if (id === 'decay') G.ship.grace = 0; beep(740, .08, 'sine'); };

/** 플레이 중 한 틱 */
export function updateTutorial(dt) {
  const T = G.tuto, s = G.ship; T.t += dt; T.st += dt;
  if (G.boss) { bossHints(dt, G.boss); return; }
  if (s.mode === 'free') T.flags.launched = true;
  if (s.mode === 'free' && s.boost > DASH_MIN) T.flags.dashed = true;
  if (s.mode === 'orb' && T.step !== 'decay') s.grace = Math.max(s.grace, 1);   // 배우는 동안은 궤도가 줄지 않는다
  switch (T.step) {
    case 'launch': if (T.flags.launched) next('aim'); break;
    case 'aim': if (G.hops >= 2) next('star'); break;
    case 'star': if (G.starScore > 0 || G.hops >= T.h0 + 2) next('decay'); break;
    case 'decay': if (s.mode === 'orb') T.od += dt; if (T.od > 4.5) next('dash'); break;
    case 'dash': if (T.flags.dashed) next('free'); break;
  }
}

/* ---------- 보스전 힌트: 한 번에 하나, 각자 한 번만 보여 준다 ---------- */
const warned = () => G.haz.some(h => h.k !== 'hole' && h.k !== 'horizon' && !h.dead);
const HINTS = [
  { id: 'zone',   pri: 3, max: 6, on: warned },
  { id: 'hit',    pri: 1, max: 6, done: b => b.hp < b.max },
  { id: 'scroll', pri: 1, max: 5, after: 'hit' },
  { id: 'count',  pri: 1, max: 9, after: 'scroll', done: b => b.turn >= 2 }
];
const expired = (T, h, b) => (T.shown[h.id] || 0) >= h.max || (h.done && h.done(b));
function bossHints(dt, b) {
  const T = G.tuto; T.bh = null;
  if (b.state !== 'fight') return;
  const by = id => HINTS.find(h => h.id === id);
  for (const h of HINTS.slice().sort((p, q) => q.pri - p.pri)) {
    if (expired(T, h, b)) continue;
    if (h.after && !expired(T, by(h.after), b)) continue;
    if (h.on && !h.on(b)) continue;
    T.shown[h.id] = (T.shown[h.id] || 0) + dt; T.bh = h.id; return;
  }
}

/* ---------- 화면 구석 버튼 ---------- */
export const exitRect = () => ({ x: V.OX + W0 - 74, y: 8, w: 66, h: 26 });
export const skipRect = () => ({ x: V.OX + W0 - 74, y: 38, w: 66, h: 26 });
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
/** 터치한 곳이 튜토리얼 버튼이면 처리하고 true */
export function tutoPress(x, y) {
  const T = G.tuto; if (!T) return false;
  if (inR(exitRect(), x, y)) { startRun(); return true; }                     // 타이틀로
  if (!G.boss && T.step !== 'free' && inR(skipRect(), x, y) && G.st === 'play') { // 지금 단계를 건너뛴다
    const order = ['launch', 'aim', 'star', 'decay', 'dash', 'free'], i = order.indexOf(T.step);
    if (T.step === 'dash') T.flags.dashed = true; else if (T.step === 'launch') T.flags.launched = true;
    next(order[Math.min(i + 1, order.length - 1)]); return true;
  }
  return false;
}

/** 태양을 쓰러뜨렸다: 깬 횟수를 올리고 별 조각 30개를 준다 */
export function tutorialClear() {
  const T = G.tuto, n = addTutoClear();
  grantShards(TUTO_SHARDS); G.shardGain = TUTO_SHARDS; T.cleared = n;
  G.st = 'clear'; G.clearT = 0; G.held = false;
  flashScreen(.5, '#ffe27a'); shakeAdd(8); thump(90, 30, .5, .35); noise(.5, .2, 4000, 200); vibe([40, 30, 90]);
  [0, 1, 2, 3].forEach(i => setTimeout(() => beep(520 * Math.pow(1.26, i), .16, 'triangle', .1), i * 90));
  burst(G.ship.x, G.ship.y, '#ffe27a', 30, 280); ringFx(G.ship.x, G.ship.y, '#ffe27a', 6, 160, .7, 4);
}
