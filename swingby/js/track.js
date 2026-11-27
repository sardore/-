/* 음악 스테이지(트랙) 모드: 음악 파일 하나가 한 스테이지다. 플레이 시간 = 곡 길이가 되도록 맵과 인디케이터를 곡에 묶는다.
 *
 * 1) 코스는 기체 속도로 짠다 — 행성 하나를 건너는 예상 시간 = 궤도에서 발사 각도를 기다리는 시간(궤도 반 바퀴 × WAIT)
 *    + 비행 거리 ÷ 비행 속도 + 반응 시간. 곡 길이만큼 그 시간을 쌓아 행성을 깔고, 남는 몇 % 는 전체에 고르게 나눠
 *    도착 행성의 예정 시각이 정확히 곡 끝이 되게 한다. 곡이 시끄러운 구간은 짧고 촘촘한 도약, 조용한 구간은 길고 느긋한 도약.
 * 2) 신호선(인디케이터)은 행성마다의 예정 시각(due)을 따라 코스를 올라온다 → 기체가 평소 속도로 가면 선과 나란히 간다.
 *    선에 닿으면 끝(뒤처짐 방지). 궤도 붕괴는 없다 — 압박은 신호선 하나다.
 * 3) 앞서가도 소용없다: 행성 k 는 신호선이 행성 k-2 에 닿을 때까지 잠겨 있어 붙을 수 없다(앞서감 방지, 최대 2칸).
 *    → 도착 행성에는 곡이 끝나기 직전에야 닿고, 곡이 끝나는 순간 클리어.
 * 곡·분석은 track-songs.js / track-analyze.js, 화면은 track-draw.js. 이 판의 상태는 모두 G.trk (newRun 이 비운다). */
import { G, newRun, V } from './state.js';
import { W0, clamp, rnd, save, TAU } from './util.js';
import { baseStats } from './data.js';
import { mkPlanet } from './planets.js';
import { songPlay, songStop, songClock, audioPaused, audioSuspend, beep, thump, vibe } from './audio.js';
import { burst, ringFx, flashScreen, shakeAdd, punch } from './fx.js';
import { startRun } from './progress.js';
import { die } from './death.js';
import { grantShards, settleRun } from './shop.js';
import { recOf, recKey, gradeOf, hueOf } from './track-songs.js';
import { envAt } from './track-analyze.js';

/** 난이도: ramp 비행·궤도 속도 가산(기본 235) · wait 발사 각도까지 기다리는 몫(궤도 반 바퀴 기준, 작을수록 빨리 쏴야 한다) · d 도약 거리 범위(조용함→시끄러움) */
export const TRACK_DIFF = {
  normal: { n: '보통',  ramp: 20, wait: 1.0, react: .35, d: [270, 175], red: .12 },
  hard:   { n: '어려움', ramp: 70, wait: .8, react: .28, d: [290, 160], red: .3 }
};
const LEAD_IN = 3;          // 곡 시작 뒤 신호선이 출발 행성에 닿기까지(초)
const GATE = 2;             // 신호선보다 최대 몇 칸 앞까지 붙을 수 있나
const KILL_PAD = 22;        // 비행 중: 신호선이 기체보다 이만큼 위로 올라오면 따라잡힌 것

/** 시드 난수: 같은 곡·난이도는 언제나 같은 코스 */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** 행성 a 에서 b 로 건너는 예상 시간(초): 이 모드의 기체 속도로 계산한다 */
/** 궤도 반지름은 이 값으로 서서히 맞춰진다(궤도 붕괴 대신): 예상 시간 계산과 실제 회전 속도가 같아지게 */
export const ORBIT_R = p => p.R + 46;
export function hopTime(a, b, D) {
  const v = 235 + D.ramp, r = ORBIT_R(a);
  return D.wait * Math.PI * r / v + Math.hypot(a.x - b.x, a.y - b.y) / v + D.react;
}

function buildMap(song, start, D) {
  const real = Math.random, rand = mulberry(hueOf(song.id) * 7919 + (D === TRACK_DIFF.hard ? 13 : 0) + Math.round(song.dur));
  Math.random = rand;   // mkPlanet 의 크기·색 난수도 시드를 따르게
  try {
    const list = [start], stars = [], END = song.dur;
    start.x = W0 / 2; start.y = 0; start.due = LEAD_IN;
    let prev = start, t = LEAD_IN, side = rand() < .5 ? -1 : 1;
    const place = (type, dist) => {
      let dx = 0, dy = 0;
      for (let k = 0; k < 6; k++) {   // 벽 안쪽, 그리고 두 칸 전 행성과도 겹치지 않는 자리
        const th = rnd(.45, 1.0), d = dist;   // 수직에서 25~57° 기울어진 방향으로 좌우 번갈아
        dx = side * Math.sin(th) * d; let x = prev.x + dx;
        if (x < 62 || x > W0 - 62) { dx = -dx; x = prev.x + dx; }
        x = clamp(x, 62, W0 - 62); dx = x - prev.x; dy = Math.sqrt(Math.max(d * d - dx * dx, 95 * 95));
        const p2 = list[list.length - 2];
        if (!p2 || Math.hypot(x - p2.x, prev.y - dy - p2.y) > 150) break;
      }
      side = dx >= 0 ? -1 : 1;
      if (type === 'r' && Math.hypot(dx, dy) > 240) type = 'n';   // 먼 거리의 좁은 적색왜성은 가혹하다
      const p = mkPlanet(list.length, prev.x + dx, prev.y - dy, song.biome || 'normal', type);
      p.seen = false; p.due = t + hopTime(prev, p, D); p.prevDue = prev.due;
      const n = Math.hypot(dx, dy) > 200 ? 1 + (rand() < .6 ? 1 : 0) + (rand() < .25 ? 1 : 0) : rand() < .6 ? 1 : 0;   // 별: 행성 사이 항로에
      for (let j = 0; j < n; j++) { const f = (j + 1) / (n + 1); stars.push({ x: clamp(prev.x + (p.x - prev.x) * f + rnd(-16, 16), 14, W0 - 14), y: prev.y + (p.y - prev.y) * f + rnd(-12, 12), got: false, ph: rnd(0, TAU) }); }
      list.push(p); prev = p; t = p.due; return p;
    };
    // 곡 길이가 찰 때까지 행성을 깐다. 세기 0(조용함) → 먼 도약·가스행성, 1(시끄러움) → 짧은 도약·적색왜성
    while (true) {
      const I = envAt(song.env, t), dist = (D.d[0] + (D.d[1] - D.d[0]) * I) * rnd(.9, 1.1);
      const r = rand(), type = r < D.red * I ? 'r' : r < D.red * I + .3 * (1 - I) ? 'g' : 'n';
      const guess = t + D.wait * Math.PI * (28 + 46) / (235 + D.ramp) + dist / (235 + D.ramp) + D.react;
      if (guess > END - 1) break;
      place(type, dist);
    }
    const fin = place('m', 230); fin.fin = true; fin.R = 62; fin.cap = 62 + 104;   // 도착 행성: 거대 암석
    // 예정 시각을 고르게 늘이거나 줄여 도착 행성 = 곡 끝으로 맞춘다
    const k = (END - LEAD_IN) / (fin.due - LEAD_IN);
    for (const p of list) { p.due = LEAD_IN + (p.due - LEAD_IN) * k; }
    for (let i = 1; i < list.length; i++) { list[i].prevDue = list[i - 1].due; list[i].unlock = i <= GATE ? -1 : list[i - GATE].due; }
    return { planets: list, stars, fin, scale: k };
  } finally { Math.random = real; }
}

/** 코스 위 높이 y 를 신호선 시각으로 바꾼다(미니맵에서 기체 위치 표시용) */
export function timeAtY(y) {
  const P = G.trk.path; if (y >= P[0].y) return P[0].due;
  for (let i = 1; i < P.length; i++) if (y >= P[i].y) { const a = P[i - 1], b = P[i]; return a.due + (b.due - a.due) * (y - a.y) / (b.y - a.y); }
  return P[P.length - 1].due;
}

/** 지금 시각의 신호선 높이: 행성의 예정 시각을 이어서 코스를 따라 올라간다 */
export function lineY(T) {
  const P = G.trk.path, t = T.t;
  if (t <= P[0].due) { const v = (P[0].y - P[1].y) / Math.max(.5, P[1].due - P[0].due); return P[0].y + Math.min(420, (P[0].due - t) * v); }
  let i = T.seg; while (i < P.length - 1 && P[i + 1].due <= t) i++; T.seg = i;
  if (i >= P.length - 1) return P[P.length - 1].y;
  const a = P[i], b = P[i + 1]; return a.y + (b.y - a.y) * clamp((t - a.due) / (b.due - a.due), 0, 1);
}

let runId = 0;
/** 곡 하나를 시작한다. song: track-songs.js 의 loadSong 결과(buf 가 없으면 소리 없이 실제 시간으로) */
export function startTrack(song, hard, opt) {
  opt = opt || {};
  newRun();
  const D = hard ? TRACK_DIFF.hard : TRACK_DIFF.normal;
  G.trk = { song, hard: !!hard, D, ramp: D.ramp, run: ++runId, t: 0, seg: 0, path: null, fin: null, nStars: 0, lastBeat: -1, flash: 0, done: false, manual: !!opt.manual || !song.buf, res: null };
  const map = buildMap(song, G.planets[0], D);
  G.planets = map.planets; G.stars = map.stars; G.genI = map.planets.length;
  Object.assign(G.trk, { path: map.planets, fin: map.fin, nStars: map.stars.length, scale: map.scale });
  G.stats = baseStats(); G.tier = 1; G.shipId = 'base'; G.biome = 'normal'; G.nextBoss = Infinity; G.nextOffer = Infinity;
  const s = G.ship, p = map.planets[0]; s.p = p; s.r = p.R + 52; s.x = p.x; s.y = p.y + s.r;
  G.camY = p.y - V.VH * .64; G.camTop = null;
  G.st = 'play'; G.held = false;
  G.banner = { t: 0, dur: 2.2, a: D.n + '  ·  ' + Math.round(song.dur / 60) + '분 코스', b: song.name.length > 14 ? song.name.slice(0, 13) + '…' : song.name, c: 'hsl(' + (song.hue || 200) + ',90%,72%)', sub: song.artist || '' };
  if (!G.trk.manual && !songPlay(song.buf, .12)) G.trk.manual = true;   // 재생할 수 없으면 실제 시간으로 센다
}

/** 오디오가 멈춰 있으면(탭이 가려졌다 돌아옴 등) 곡 시계도 멈췄으니 게임도 멈춘다. 터치하면 이어진다 */
export const trackPaused = () => !!G.trk && !G.trk.manual && audioPaused();

/** 실제 시간 dt 마다(히트스톱·슬로모션과 무관): 곡 시계를 읽는다 */
export function trackTick(dt) {
  const T = G.trk; if (!T || G.st !== 'play' || trackPaused()) return;
  const c = T.manual ? null : songClock();
  T.t = c != null ? c : T.t + dt;
  const so = T.song, bs = 60 / (so.bpm || 120), b = Math.floor((T.t - (so.beat0 || 0)) / bs);
  if (b !== T.lastBeat && T.t >= 0) { T.lastBeat = b; T.flash = b % 4 === 0 ? 1 : .55; }
  T.flash = Math.max(0, T.flash - dt * 4);
  T.beat = (T.t - (so.beat0 || 0)) / bs;
}

/** 플레이 중 한 틱(game.js 의 update): 잠금, 신호선 판정, 도착 */
export function updateTrack(dt) {
  const T = G.trk, s = G.ship; if (!T || G.st !== 'play') return;
  const yl = lineY(T);
  for (const p of G.planets) {
    p.lock = p.unlock != null && T.t < p.unlock; p.fa = p.lock ? .38 : 1;           // 앞서감 방지: 아직 붙을 수 없다(흐리게)
    if (p.dead || p === T.fin || p.y < yl || (s.mode === 'orb' && s.p === p)) continue;
    p.dead = p.gone = true; burst(p.x, p.y, 'hsl(' + p.hue + ',80%,65%)', 14, 160); ringFx(p.x, p.y, 'rgba(255,255,255,.5)', p.R, p.R + 40, .4, 2);   // 신호선이 지나간 행성은 사라진다
  }
  if (s.mode === 'orb') { s.grace = 1; s.r += (ORBIT_R(s.p) - s.r) * Math.min(1, dt * 1.6); T.leftAt = null; }   // 궤도는 무너지지 않고 표준 반지름으로 맞춰진다: 압박은 신호선 하나
  else if (T.leftAt == null) T.leftAt = T.t;
  const onFin = s.p === T.fin && s.mode === 'orb';
  // 궤도 중: 신호선이 도는 행성의 중심에 닿으면(= 그 행성의 예정 시각) 끝. 비행 중: 기체에 닿으면 끝(막 출발한 0.6초는 출발 행성 아래쪽이어도 봐준다)
  const caught = s.mode === 'orb' ? !onFin && yl <= s.p.y : s.y > yl + KILL_PAD && (T.t - T.leftAt > .6 || s.y > yl + 160);
  if (caught) { die('신호선에 따라잡혔다'); return; }
  if (T.t >= T.song.dur && onFin) finish();
}

/** 곡이 끝났고 기체가 도착 행성에 있다: 클리어 */
function finish() {
  const T = G.trk, song = T.song, s = G.ship; T.done = true;
  const got = G.stars.filter(t => t.got).length, rate = T.nStars ? got / T.nStars : 1, grade = gradeOf(true, rate), prev = recOf(song.id, T.hard);
  const bonus = Math.round((300 + got * 15) * (1 + rate) * (T.hard ? 1.6 : 1));
  G.score += bonus;
  const first = !prev.clear, newBest = G.score > prev.best;
  if (!G.debug) {
    save(recKey(song.id, T.hard), JSON.stringify({ clear: 1, best: Math.max(prev.best, G.score), rate: Math.max(prev.rate, rate) }));
    settleRun(); if (first) { const g = T.hard ? 30 : 15; grantShards(g); G.shardGain += g; }
  }
  T.res = { got, rate, grade, bonus, first, newBest, score: G.score };
  G.st = 'clear'; G.clearT = 0; G.held = false;
  flashScreen(.6, '#fff'); shakeAdd(8); punch(.06); thump(90, 30, .5, .35); vibe([40, 40, 90]);
  [0, 1, 2, 3].forEach(i => setTimeout(() => beep(440 * Math.pow(1.26, i), .18, 'triangle', .1), i * 110));
  burst(s.x, s.y, '#fff', 30, 280); ringFx(s.x, s.y, 'hsl(' + (song.hue || 200) + ',90%,70%)', 6, 170, .7, 4);
}

/** 탭이 가려지면 오디오를 멈춘다(곡 시계도 멈춤). 돌아와 터치하면 이어진다 */
export function bindTrackVisibility() { document.addEventListener('visibilitychange', () => { if (document.hidden && G.trk && G.st === 'play') audioSuspend(); }); }

/** 테스트용 곡(소리 없음): ?track=test&sec=90 — 세기 곡선은 조용함→시끄러움→조용함 */
export function testSong(sec) {
  sec = Math.max(30, +sec || 90); const env = []; for (let i = 0; i < sec * 2; i++) env.push(Math.round(100 * (.5 - .5 * Math.cos(i / (sec * 2) * TAU))) / 100);
  return { id: 'test_' + sec, name: 'TEST ' + sec + 's', artist: '테스트', buf: null, dur: sec, bpm: 120, beat0: 0, env, hue: 200 };
}
/** 주소의 ?track=test(&sec=초)(&hard) 로 소리 없는 테스트 코스를 바로 시작한다. 기록은 저장하지 않는다 */
export function startTrackFromUrl(q) {
  if (!q.has('track')) return;
  startTrack(testSong(q.get('sec')), q.has('hard'), { manual: true }); G.debug = true;
}

/** 사망·클리어 화면에서 다시 하기·곡 고르기 */
export const retryTrack = () => { const T = G.trk, dbg = G.debug; startTrack(T.song, T.hard, { manual: T.manual && !T.song.buf }); G.debug = dbg; };
export function backToSongs() { songStop(.3); startRun(); G.st = 'songs'; beep(440, .08); }   // 코스가 깔린 월드를 새 판으로 치우고 곡 고르기로
export function exitSongs() { G.st = 'title'; beep(420, .08); }
