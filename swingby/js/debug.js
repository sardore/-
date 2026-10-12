/* 디버그/자동 테스트용 훅 (window.__dbg) + 단순 봇. 게임 로직은 건드리지 않고 공개 함수만 쓴다. */
import { G } from './state.js';
import { BOSSES, STAGES } from './data.js';
import { SHIPS } from './ships.js';
import { curDef, capOf } from './stats.js';
import { step } from './game.js';
import { draw } from './draw.js';
import { pointerDown, pointerUp } from './input.js';
import { pressStart, pressEnd } from './player.js';
import { choose, evolveTo } from './progress.js';
import { forceTele } from './boss.js';

/** 지금 발사하면 목표(보스 또는 가장 가까운 미방문 행성)에 닿을 정렬인가 */
function aimed() {
  const s = G.ship, p = s.p, hx = -Math.sin(s.a) * s.dir, hy = Math.cos(s.a) * s.dir;
  let tx, ty, tr;
  if (G.boss) { tx = G.boss.x; ty = G.boss.y; tr = G.boss.R + 2; }
  else {
    let bp = null;
    for (const q of G.planets) { if (q.seen || q.dead || q.y > s.y) continue; if (!bp || q.y > bp.y) bp = q; }
    if (!bp) return false;
    tx = bp.x; ty = bp.y; tr = capOf(bp) * .5;
  }
  const dx = tx - s.x, dy = ty - s.y, tp = dx * hx + dy * hy, perp = Math.abs(dx * hy - dy * hx);
  return (tp > 0 && perp < tr) || s.r < p.R + 13;
}

/** 한 프레임 분량의 봇 입력. 돌격 기체는 보스전에서 차지가 찬 뒤 정렬되면 놓는다 */
function botAct() {
  const s = G.ship;
  if (G.st === 'title') { pointerDown(0, 0, true); return; }
  if (G.st === 'pick') { if (G.pickT > .5) choose(0); return; }
  if (G.st === 'clear' && G.clearT > 1) { pointerDown(0, 0, true); return; }
  if (G.st === 'dead' && G.deadT > .8) { pointerDown(0, 0, true); return; }
  if (G.st !== 'play' || s.mode !== 'orb') return;
  if (G.boss && G.boss.state !== 'fight') return;
  if (s.charging) { if (aimed() && (s.charge > .7 || !G.boss)) pressEnd(); return; }
  if (curDef().dash && G.boss) { pressStart(); return; }   // 보스전: 먼저 차지를 시작해 두고 정렬을 기다린다
  if (aimed()) { pressStart(); if (s.charging) pressEnd(); }
}

export function installDebug() {
  window.__dbg = {
    G,
    get: () => ({
      st: G.st, score: G.score, hops: G.hops, combo: G.combo, mode: G.ship.mode, stats: Object.assign({}, G.stats), tier: G.tier, shipId: G.shipId,
      biome: G.biome, fork: G.fork && { state: G.fork.state, active: G.fork.active }, kills: G.kills, bo2: G.bo2, nextBi: G.nextBi, vz: +G.vz.toFixed(2),
      boss: G.boss && { n: G.boss.d.n, hp: G.boss.hp, max: G.boss.max, state: G.boss.state, turn: G.boss.turn, q: G.boss.q.map(a => a.k + a.t), phase: G.boss.phase, stage: G.boss.stage },
      haz: G.haz.length
    }),
    /** 지정한 보스(BOSSES 인덱스)와 바로 싸운다 */
    jump(bi) { if (G.st === 'title') G.st = 'play'; G.nextBi = bi; G.kills = Math.max(0, STAGES.findIndex(s => s.includes(bi))); G.hops = Math.max(G.hops, 1); G.nextBoss = 0; },
    sim(sec, o) { o = o || {}; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (!o.nobot) botAct(); step(1 / 60); if (o.draw && i % o.draw === 0) draw(); } return this.get(); },
    draw: () => draw(),
    set(o) { if (o.hp != null && G.boss) G.boss.hp = o.hp; if (o.o2 != null) G.bo2 = o.o2; if (o.shield != null) G.stats.shield = o.shield; if (o.hops != null) G.hops = o.hops; if (o.stats) Object.assign(G.stats, o.stats); },
    ev: () => ({ freeze: G.freeze, ts: G.ts, shake: G.shake, zoom: G.zoom, flashA: G.flashA }),
    /** 지정한 단계까지 진화시킨다. path 는 각 단계에서 고를 후보 번호 */
    tier(n, path) { path = path || [0, 0, 0]; while (G.tier < n) { const o = SHIPS[SHIPS[G.shipId].kids[path[G.tier - 1] || 0]]; if (!o) break; evolveTo(o); } },
    ship: () => ({ tier: G.tier, shipId: G.shipId, stats: Object.assign({}, G.stats), nextOffer: G.nextOffer, dash: curDef().dash }),
    atk: (k, t) => forceTele(k, t),
    down: () => pressStart(), up: () => pressEnd(), tapDown: () => pointerDown(0, 0, true), tapUp: () => pointerUp(),
    bot: botAct, BOSSES
  };
}
