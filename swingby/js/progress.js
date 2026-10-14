/* 성장: 기체 진화(테크트리), 강화 카드, 보스 격파 후 진행 규칙 */
import { G, newRun } from './state.js';
import { CARDS, STAT_INFO, LAST_STAGE, EVOLVE_AT } from './data.js';
import { SHIPS } from './ships.js';
import { beep, thump, noise, vibe } from './audio.js';
import { burst, ringFx, flashScreen, punch, slowmo, shakeAdd, popText } from './fx.js';
import { startBoss } from './boss-arena.js';
import { save } from './util.js';
import { applyDebugRun } from './debug-run.js';
import { applyStartSpecs, settleRun } from './shop.js';
import { opsCheck, closeRescue } from './ops.js';

/* ---------- 강화 카드 (4단 진화 이후) ---------- */
const canTake = c => G.stats[c.k] < c.cap;
export function offer(title) {
  const pool = CARDS.filter(canTake); G.cards = [];
  while (G.cards.length < 3 && pool.length) G.cards.push(pool.splice(Math.random() * pool.length | 0, 1)[0]);
  if (!G.cards.length) return;
  G.st = 'pick'; G.pickMode = 'card'; G.pickTitle = title || '강화 선택'; G.pickT = 0;
  beep(660, .12); setTimeout(() => beep(880, .14), 90);
}
function pickCard(c) {
  const was = G.stats[c.k]; G.stats[c.k] = Math.min(c.cap, was + c.step); G.st = 'play'; beep(780, .1);
  if (G.ops) G.ops.bonus[c.k] = (G.ops.bonus[c.k] || 0) + G.stats[c.k] - was;   // 승계한 함선에게도 이어지도록 카드로 얻은 몫을 적어 둔다
  const info = STAT_INFO[c.k]; popText(G.ship.x, G.ship.y - 24, c.n, info.c, 16); ringFx(G.ship.x, G.ship.y, info.c, 6, 70, .5, 3);
}

/* ---------- 기체 진화 ---------- */
export function startEvo() {
  G.evoOpts = SHIPS[G.shipId].kids.map(k => SHIPS[k]);
  if (!G.evoOpts.length) { offer(); return; }
  G.st = 'pick'; G.pickMode = 'evo'; G.pickT = 0;
  beep(520, .12, 'sine'); setTimeout(() => beep(780, .12, 'sine'), 100); setTimeout(() => beep(1040, .2, 'sine'), 200);
}
export function evolveTo(d) {
  for (const k in d.delta) G.stats[k] = (G.stats[k] || 0) + d.delta[k];
  G.tier = d.t; G.shipId = d.id; G.st = 'play';
  const s = G.ship, col = 'hsl(' + d.L.h + ',95%,66%)'; s.evoT = 1;
  G.banner = { t: 0, dur: 2.4, a: '기체 진화  Lv ' + d.t, b: d.n, c: col };
  flashScreen(.7, '#fff'); punch(.07); slowmo(.45, .9); shakeAdd(10); vibe([30, 30, 70]);
  burst(s.x, s.y, col, 40, 320); burst(s.x, s.y, '#fff', 22, 240); ringFx(s.x, s.y, '#fff', 6, 170, .7, 5); ringFx(s.x, s.y, col, 6, 120, .55, 3);
  thump(90, 30, .5, .4); noise(.6, .25, 6000, 200); [0, 1, 2, 3].forEach(i => setTimeout(() => beep(520 * Math.pow(1.26, i), .16, 'triangle', .1), i * 90));
  if (G.tier >= 4 && !G.ops) G.nextOffer = G.hops + 4;   // 블랙쉽은 주기적인 카드 없이 보스를 쓰러뜨릴 때만 준다
}

/** 새 판 시작: 상점의 영구 초기 스펙을 얹고, 디버그판이면 초고스펙 설정으로 덮어쓴다 */
export function startRun() { newRun(); applyStartSpecs(G.stats); applyDebugRun(); }

export function choose(i) {
  if (G.pickMode === 'rescue') { closeRescue(); return; }
  if (G.pickMode === 'evo') { if (G.evoOpts[i]) evolveTo(G.evoOpts[i]); return; }
  if (G.cards[i]) pickCard(G.cards[i]);
}

/* ---------- 진행 규칙 ---------- */
/** 오빗 중 매 프레임: 진화·강화·보스 등장 조건 확인 */
export function checkProgress() {
  if (G.ops) { if (!opsCheck() && G.hops >= G.nextBoss && G.st === 'play') startBoss(); return; }   // 블랙쉽: 진화는 보스 격파·보급 부두, 카드 주기는 없다
  if (G.tier === 1 && G.hops >= (G.tuto ? 4 : 8)) startEvo();          // 첫 보스 직전에 2단 진화 (튜토리얼은 더 일찍)
  else if (G.hops >= G.nextOffer) { G.nextOffer += 4; offer('강화 선택'); }
  else if (G.hops >= G.nextBoss && G.st === 'play') startBoss();
}

/** 보스를 쓰러뜨린 직후: 클리어 / 진화(EVOLVE_AT) / 강화 카드 */
export function afterBoss(stage) {
  if (stage === LAST_STAGE && !G.cleared) {
    G.cleared = true; G.st = 'clear'; G.clearT = 0; G.endHop = G.hops;   // 여기서부터 무한 모드
    if (G.score > G.best && !G.debug) { G.best = G.score; G.newBest = true; save('swingby_best', G.best); }
    settleRun();
  } else if (EVOLVE_AT[G.tier] && G.kills >= EVOLVE_AT[G.tier]) startEvo();
  else if (G.tier >= 4) offer('보스 격파 — 강화 선택');
}
