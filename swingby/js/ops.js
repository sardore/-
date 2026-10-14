/* 블랙쉽 모드(첩보 작전)의 진행: 시작·타이머·기록, 보스 앞뒤의 처리(구출·진화·다음 구역·클리어).
 * 일반 항해와 같은 엔진 위에서 돌고, 이 모드의 상태는 모두 G.ops 에 있다(newRun 이 비운다). 규칙 상수는 ops-data.js,
 * 선단(구출·따라오기·승계)은 ops-fleet.js, 벽·소형함·거대 행성 기믹은 각각 ops-walls/ops-mook/ops-gimmick.js */
import { G, newRun } from './state.js';
import { load, save } from './util.js';
import { baseStats } from './data.js';
import { SHIPS } from './ships.js';
import { OPS, OPS_ROOT, OPS_ZONES, OPS_BOSSES, OPS_BIOMES, opsTarget } from './ops-data.js';
import { beep, thump } from './audio.js';
import { toast, popText, flashScreen, punch, shakeAdd, burst, ringFx } from './fx.js';
import { evolveTo, startEvo, offer } from './progress.js';
import { spendShards, grantShards, settleRun } from './shop.js';
import { hasBay, rescue, updateFleet, resetTrail } from './ops-fleet.js';
import { updateWalls, clearWalls, maybeWall, hitWalls, hitLanded, squeezeWalls, cullWalls } from './ops-walls.js';
import { updateMooks, clearMooks, maybeMook, hitMooks, squeezeMooks, cullMooks } from './ops-mook.js';
import { updateGimmicks, resetGimmicks, gimmickType, giantify } from './ops-gimmick.js';
import { hurt } from './boss-attacks.js';

/** 기록: time 최단 클리어 시간(초, 0 이면 없음) · best 최고 점수 · boss 가장 멀리 간 보스 수 */
export const OPSREC = { time: +load('swingby_ops_time', 0) || 0, best: +load('swingby_ops_best', 0) || 0, boss: +load('swingby_ops_boss', 0) || 0 };
export const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

const freshOps = () => ({
  t: 0,                 // 작전 시간(초, 플레이 중에만 흐른다)
  bay: true,            // 수송 능력 보유(승계하면 잃는다)
  fol: [], hist: [],    // 따라다니는 함선 · 본체가 지나온 길
  bonus: {},            // 강화 카드로 올린 능력치(후계자에게 이어진다)
  rescued: 0, succ: 0,  // 구출한 함선 수(누적) · 승계 횟수
  walls: [], mooks: [], shots: [], gim: { due: 9, n: 0 },
  pendingEvo: false,    // 보급 부두의 보상: 다음 오빗에서 진화를 고른다
  newTime: false, newBest: false
});

/** 새 작전을 시작한다. 티켓이 켜져 있으면(OPS.ticketOn) 별 조각 OPS.ticket 개를 내야 한다. 시작하지 못하면 false.
 * 상점의 영구 초기 스펙은 얹지 않는다(기록 경쟁이 공평하도록) */
export function startOps() {
  if (OPS.ticketOn && !spendShards(OPS.ticket)) return false;
  newRun();
  G.ops = freshOps();
  G.stats = baseStats(); G.tier = 1; G.shipId = OPS_ROOT; G.biome = OPS_ZONES[0];
  G.nextBoss = OPS.first; G.nextBi = -3; G.nextOffer = Infinity; G.st = 'play';
  resetTrail();
  G.banner = { t: 0, dur: 2.6, a: 'OPERATION', b: '블랙쉽', c: '#e6d8b0', sub: OPS_BIOMES[G.biome].n };
  beep(520, .1);
  return true;
}

/** 주소의 ?ops 로 바로 시작: &stage=N 은 N번째 보스(0부터)로 곧장, &tier=T 는 그 단계 기체로, &fleet=n 은 동행 n척으로(기록은 저장하지 않는다) */
export function startOpsFromUrl(q) {
  if (!q.has('ops') || !startOps()) return;
  if (!q.has('stage') && !q.has('tier') && !q.has('fleet')) return;
  G.debug = true;
  const stage = Math.min(OPS_BOSSES.length - 1, Math.max(0, +q.get('stage') || 0));
  const tier = Math.min(4, Math.max(1, +q.get('tier') || (stage >= 3 ? 4 : stage >= 1 ? 3 : stage === 0 && q.has('stage') ? 2 : 1)));
  while (G.tier < tier) { const d = SHIPS[SHIPS[G.shipId].kids[0]]; if (!d) break; evolveTo(d); }
  if (q.has('stage')) { G.kills = stage; G.biome = OPS_ZONES[stage]; G.hops = 12; G.nextBoss = 0; }
  const n = Math.min(OPS.maxFollowers, +q.get('fleet') || 0);
  if (n) rescue(n, stage, G.ship.x, G.ship.y);
  G.banner = null;
}

/* ---------- 매 틱 ---------- */
/** 플레이 중 한 틱(game.js 의 update). 작전 시간은 game.js 가 실제 시간으로 센다 */
export function updateOps(dt) {
  updateFleet(dt); updateWalls(dt);
  if (G.boss && G.boss.state === 'fight') hitLanded((x, y) => hurt(x, y, .9));
  if (!G.boss) { updateMooks(dt); updateGimmicks(dt); }
}

/** 보스전이 시작될 때: 길목의 벽·소형함·기믹을 치우고 선단을 보스 앞 자리에 모은다 */
export function opsPrepare() {
  clearWalls(); clearMooks(); resetTrail();
}

/* ---------- 보스 격파 후 ---------- */
/** 보스를 쓰러뜨린 직후. 구출(수송 능력이 있을 때) · 기록 · 다음 구역. 마지막 보스면 클리어하고 true */
export function opsAfterBoss(b) {
  const o = G.ops, s = G.ship;
  let got = 0;
  if (b.d.cap) {
    if (hasBay()) got = rescue(b.d.cap, b.stage, b.x, b.y);
    if (got) { toast('함선 ' + got + '척 구출 — 뒤를 따라온다', '#e6e0c8'); popText(b.x, b.y - 30, '+' + got + '척 구출', '#fff', 20); flashScreen(.35, '#fff'); }
    else toast(hasBay() ? '동행이 가득 찼다' : '수송 능력이 없어 갇힌 함선을 두고 간다', '#c8b89a');
  }
  if (!G.debug && G.kills > OPSREC.boss) { OPSREC.boss = G.kills; save('swingby_ops_boss', OPSREC.boss); }
  if (G.kills >= OPS_BOSSES.length) { opsClear(); return true; }
  G.biome = OPS_ZONES[G.kills]; G.nextBoss = G.hops + OPS.gap; G.nextBi = -3;
  resetGimmicks();
  const z = OPS_BIOMES[G.biome];
  G.banner = { t: 0, dur: 2.8, a: 'ZONE ' + (G.kills + 1), b: z.n, c: z.c, sub: '다음 목표  ' + OPS_BOSSES[G.kills].n };
  void s;
  return false;
}

/** 보스 격파 뒤의 성장: 정해진 단계까지는 진화, 그 뒤로는 강화 카드. 오래 못 올린 후계자는 한 번에 한 단계씩 따라잡는다 */
export function opsProgress() {
  if (G.tier < opsTarget(G.kills) && SHIPS[G.shipId].kids.length) startEvo();
  else offer('보스 격파 — 강화 선택');
}

/** 오빗 중 매 프레임(progress.js 의 checkProgress): 진화 조건. 처리했으면 true */
export function opsCheck() {
  const o = G.ops;
  if (o.pendingEvo && G.st === 'play') { o.pendingEvo = false; if (G.tier < 4 && SHIPS[G.shipId].kids.length) startEvo(); else offer('보급 — 강화 선택'); return true; }
  if (G.tier === 1 && G.kills === 0 && G.hops >= OPS.evolveHops) { startEvo(); return true; }   // 첫 보스 직전에 Lv2
  return false;
}

function opsClear() {
  const o = G.ops, fleet = o.fol.length;
  G.cleared = true; G.st = 'clear'; G.clearT = 0; G.held = false; G.endHop = G.hops;
  const bonus = OPS.clearBonus + OPS.clearPer * fleet;
  if (!G.debug) {
    settleRun(); grantShards(bonus); G.shardGain += bonus;
    if (!OPSREC.time || o.t < OPSREC.time) { OPSREC.time = o.t; o.newTime = true; save('swingby_ops_time', o.t); }
    if (G.score > OPSREC.best) { OPSREC.best = G.score; o.newBest = true; save('swingby_ops_best', G.score); }
  }
  flashScreen(.6, '#ffe9b0'); shakeAdd(8); punch(.06); thump(90, 30, .5, .35);
  [0, 1, 2, 3].forEach(i => setTimeout(() => beep(440 * Math.pow(1.26, i), .18, 'triangle', .1), i * 110));
  burst(G.ship.x, G.ship.y, '#ffe9b0', 30, 280); ringFx(G.ship.x, G.ship.y, '#ffe9b0', 6, 160, .7, 4);
}

/** 사망·클리어 화면에서 터치: 작전을 다시 시작한다(티켓이 켜져 있어 못 시작하면 false) */
export const restartOps = () => startOps();

/* ---------- 다른 모듈이 부르는 짧은 훅 (한 곳에 모아 둔다) ---------- */
/** world.js 의 월드 생성에 끼어드는 훅: 거대 행성 기믹과 길목의 벽·소형함 */
export const opsGen = {
  type: () => gimmickType(),
  giantify: p => { giantify(p); p.gimmick = true; },
  extras: (prev, p, dy) => { if (p.gim) return; maybeWall(prev, p, dy); maybeMook(prev, p, dy); }
};
/** 필드 폭이 줄 때 벽·소형함도 같이 줄인다 */
export const opsSqueeze = r => { squeezeWalls(r); squeezeMooks(r); };
/** 화면 아래로 멀어진 것을 치운다 */
export const cullOps = lim => { cullWalls(lim); cullMooks(lim); };
/** 비행 중 충돌(player.js): 벽과 소형함. 떨어지는 쓰레기 벽에 맞으면 보스 공격과 같이 아프다 */
export const hitOps = () => { hitWalls((x, y) => hurt(x, y, .9)); hitMooks(); };
