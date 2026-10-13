/* 캔버스, 화면 크기, 그리고 게임 전체가 공유하는 단일 상태 G.
 * 다른 모듈은 상태를 직접 갖지 않고 모두 G 를 읽고 쓴다. */
import { W0, PI, load } from './util.js';
import { baseStats, STAGES } from './data.js';

export const cv = document.getElementById('c');
export const g = cv.getContext('2d');

/** 화면 지표. S: 월드→화면 배율, VW/VH: 화면이 보여주는 월드 크기, OX: 가로 여백 */
export const V = { S: 1, VW: 420, VH: 700, OX: 0, DPR: 1 };
export function resize() {
  V.DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  cv.width = Math.round(cw * V.DPR); cv.height = Math.round(ch * V.DPR);
  V.S = Math.min(cw / W0, ch / 620); V.VW = cw / V.S; V.VH = ch / V.S; V.OX = (V.VW - W0) / 2;
}

/** 한 판(run) 동안만 유지되는 값. newRun() 이 새 객체로 통째로 교체한다 */
function freshRun() {
  return {
    debug: false,                      // 디버그판(?debug)이면 기록을 저장하지 않는다
    st: 'title',                       // title · shop · play · pick · clear · dead
    // 월드
    planets: [], stars: [], holes: [], mons: [], genY: 0, genI: 0, biome: 'normal', fork: null, pat: { k: '', left: 0, side: 1, gap: false },
    w: W0, camY: 0, vz: 1,             // w: 지금 필드 폭(진행할수록 넓어짐) · vz: 카메라 줌(필드가 넓어지면 줌아웃, 갈림길에서 더)
    // 진행
    score: 0, combo: 0, maxCombo: 0, hops: 0, kills: 0, cleared: false, newBest: false,
    nextOffer: Infinity, nextBoss: 10, nextBi: STAGES[0][0], starChain: 0,
    starScore: 0, starPaid: 0, shardGain: 0, endHop: null,   // 별에서 얻은 점수 · 이미 별 조각으로 정산한 몫 · 이번 판에 얻은 별 조각 · TON 618 격파(무한 모드 시작) 때의 행성 수
    // 기체
    ship: null, stats: baseStats(), tier: 1, shipId: 'base',
    // 선택 화면
    cards: [], evoOpts: [], pickMode: 'card', pickTitle: '', pickT: 0,
    deadT: 0, deadWhy: '', clearT: 0, held: false,   // 지금 누르고 있는가(비행 중에 미리 눌러 두면 궤도에 안착할 때부터 충전)
    // 보스전
    boss: null, haz: [], bo2: 0, bo2max: 0, arenaTop: 0, arenaBot: 0, bcombo: 0,
    // 연출
    parts: [], texts: [], fxr: [], shake: 0, freeze: 0, ts: 1, tsT: 0, zoom: 0,
    flashA: 0, flashC: '#fff', banner: null, toastO: null, castO: null, lowO2: 0
  };
}

export const G = Object.assign(freshRun(), {
  T: 0, gdt: 0,                                       // 누적 시간 / 화면용 dt(히트스톱 반영)
  best: +load('swingby_best', 0) || 0,
  bestBoss: +load('swingby_boss', 0) || 0
});

/** 새 판 시작: 첫 행성에서 궤도를 돌고 있는 상태로 만든다 */
export function newRun() {
  Object.assign(G, freshRun());
  const p = {
    i: 0, x: W0 / 2, y: 0, R: 26, cap: 110, t: 'n', hue: 205, seen: true, ph: 0,
    dead: false, re: 0, born: 1, sq: 0, pulse: 0
  };
  G.planets.push(p); G.genI = 1; G.genY = 0; G.camY = -V.VH * .64;
  G.ship = {
    mode: 'orb', p, a: PI / 2, r: p.R + 52, dir: 1, x: p.x, y: p.y + p.R + 52, vx: 0, vy: 0,
    air: 0, swept: 0, trail: [], last: null, inv: 0, ramT: 0, hitF: false, evoT: 0, grace: 0,
    charging: false, charge: 0, boost: 1, heat: 0, ghosts: []
  };
}
