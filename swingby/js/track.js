/* 음악 스테이지(트랙) 모드: 곡 하나가 한 스테이지다.
 * 핵심 규칙 — 플레이 시간이 곡 길이와 어긋나지 않게 맵이 곡에 묶여 있다:
 *   · 맵은 곡의 마디에 맞춰 미리 만들어 둔 고정 코스다(행성마다 "신호선이 몇 박째에 닿는가"가 정해져 있다).
 *   · 신호선(인디케이터)은 곡 시계(오디오 시계)에 맞춰 일정한 속도로 맵을 올라간다. 닿은 행성은 사라지고, 선에 따라잡히면 끝이다.
 *   · 신호선은 곡이 끝나는 순간 도착 행성에 닿는다. 먼저 도착해도 곡이 끝나야 클리어된다 — 곡 길이 = 클리어 시각.
 * 곡·시계는 track-songs.js / track-music.js / audio.js(musicClock), 화면은 track-draw.js. 이 판의 상태는 모두 G.trk (newRun 이 비운다). */
import { G, newRun } from './state.js';
import { W0, clamp, rnd, save } from './util.js';
import { baseStats } from './data.js';
import { mkPlanet } from './planets.js';
import { musicClock, audioPaused, beep, thump, vibe, audioSuspend } from './audio.js';
import { burst, ringFx, flashScreen, shakeAdd, punch } from './fx.js';
import { startRun } from './progress.js';
import { die } from './death.js';
import { grantShards, settleRun } from './shop.js';
import { SONGS, KINDS, FIRST_BEAT, songBeats, beatSec, sectionAt, recOf, gradeOf } from './track-songs.js';
import './track-music.js';   // 곡 연주를 audio.js 에 등록한다

export const PPB = 42;                      // 한 박이 맵에서 차지하는 세로 길이(px). 신호선 속도 = PPB × BPM / 60
export const beatY = b => -b * PPB;         // 박 → 월드 y (위로 갈수록 음수)
export const lineY = T => beatY(Math.max(0, T.beat));

/** 선택한 곡을 시드로 고정된 코스로 만든다. 같은 곡은 언제나 같은 맵이다 */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pickMix(mix, rand) { let r = rand() * Object.values(mix).reduce((a, w) => a + w, 0), last = 'n'; for (const k in mix) { last = k; if ((r -= mix[k]) <= 0) return k; } return last; }

function buildMap(song, startPlanet) {
  const real = Math.random, rand = mulberry(song.seed), B = songBeats(song);
  Math.random = rand;   // mkPlanet 의 크기·색 난수도 곡 시드를 따르게 한다
  try {
    const list = [startPlanet], stars = [];
    startPlanet.x = W0 / 2; startPlanet.y = beatY(FIRST_BEAT); startPlanet.bt = FIRST_BEAT; startPlanet.gap = FIRST_BEAT;
    let b = FIRST_BEAT, prev = startPlanet, side = rand() < .5 ? -1 : 1;
    const add = (beat, type) => {
      const dy = (beat - prev.bt) * PPB, lim = Math.min(170, 56 + dy * 1.15);
      const dmin = Math.max(55, Math.sqrt(Math.max(0, 128 * 128 - dy * dy))), lim2 = Math.max(lim, dmin + 30);   // 이웃 포획 범위가 겹쳐 서로 되튕기지 않게: 인접 행성은 최소 128 떨어뜨린다
      const dx = side * rnd(dmin, dy > 230 ? Math.min(lim2, 110) : lim2); let x = prev.x + dx;   // 아주 긴 도약(6박 이상)은 옆으로 많이 벌리지 않는다
      if (x < 58 || x > W0 - 58) x = clamp(prev.x - dx, 58, W0 - 58);   // 벽에 걸리면 반대쪽으로 접는다 (반대쪽도 막히면 가장자리에 붙는다)
      side = x >= prev.x ? -1 : 1;                                       // 다음은 반대쪽: 좌우로 번갈아 간다
      const y = beatY(beat) + rnd(-5, 5);
      if (type === 'r' && Math.hypot(x - prev.x, y - prev.y) > 230) type = 'n';   // 먼 거리의 좁은 적색왜성은 너무 가혹하다
      const p = mkPlanet(list.length, x, y, song.biome, type);
      p.bt = beat; p.gap = beat - prev.bt; p.seen = false;
      const n = beat - prev.bt >= 3 ? Math.max(1, Math.round(KINDS[sectionAt(song, beat).kind].stars * rnd(.5, 1.1))) : rand() < .5 ? 1 : 0;   // 간격이 넓을수록 별이 많다
      for (let j = 0; j < Math.min(n, 3); j++) { const f = (j + 1) / (n + 1); stars.push({ x: clamp(prev.x + (p.x - prev.x) * f + rnd(-18, 18), 14, W0 - 14), y: prev.y + (p.y - prev.y) * f + rnd(-14, 14), got: false, ph: rnd(0, 6.28) }); }
      list.push(p); prev = p; return p;
    };
    const typeFor = beat => { const kd = sectionAt(song, beat).kind, mix = Object.assign({}, KINDS[kd].mix); if (mix.r && song.diff < 2) mix.r *= .3; return pickMix(mix, rand); };
    while (true) {
      const sec = sectionAt(song, b), gs = (song.gaps && song.gaps[sec.kind]) || KINDS[sec.kind].gaps, gap = gs[Math.floor(rand() * gs.length)];
      if (b + gap > B - 4) break;
      b += gap; add(b, typeFor(b));
    }
    while (B - b > 8) { b += 6; add(b, 'g'); }   // 도착 직전의 긴 구간은 숨 돌릴 가스행성으로 잇는다
    const fin = add(B, 'm'); fin.fin = true; fin.R = 62; fin.cap = 62 + 104; fin.y = beatY(B);   // 도착 행성: 거대 암석 행성(붕괴가 거의 없다)
    return { planets: list, stars, fin, last: prev };
  } finally { Math.random = real; }
}

let runId = 0;
/** 곡 하나를 시작한다 */
export function startTrack(song) {
  newRun();
  const map = buildMap(song, G.planets[0]);
  G.planets = map.planets; G.stars = map.stars; G.genI = map.planets.length;
  G.stats = baseStats(); G.tier = 1; G.shipId = 'base'; G.biome = song.biome; G.nextBoss = Infinity; G.nextOffer = Infinity;
  const s = G.ship, p = map.planets[0]; s.p = p; s.r = p.R + 52; s.x = p.x; s.y = p.y + s.r; s.grace = 3;
  G.camY = p.y - 620 * .64; G.camTop = null;
  G.trk = { song, run: ++runId, t: 0, beat: 0, B: songBeats(song), fin: map.fin, nStars: map.stars.length, lastBeat: -1, flash: 0, done: false, manual: false, fell: 0, doneT: 0, res: null };
  G.st = 'play'; G.held = false;
  G.banner = { t: 0, dur: 2.2, a: 'STAGE  ' + String(SONGS.indexOf(song) + 1).padStart(2, '0'), b: song.n, c: 'hsl(' + song.hue + ',90%,70%)', sub: song.k };
  beep(520, .1);
}
export const trackWant = () => { const T = G.trk; return { mode: 'track', song: T.song.id, bpm: T.song.bpm, run: T.run, bi: 0, phase: 0 }; };

/** 오디오가 멈춰 있으면(탭이 가려졌다 돌아옴 등) 곡 시계도 멈췄으니 게임도 멈춘다. 터치하면 이어진다 */
export const trackPaused = () => !!G.trk && !G.trk.manual && audioPaused();

/** 실제 시간 dt 마다(히트스톱·슬로모션과 무관): 곡 시계를 읽어 박 번호를 갱신한다 */
export function trackTick(dt) {
  const T = G.trk; if (!T || G.st !== 'play' || trackPaused()) return;
  const c = T.manual ? null : musicClock();
  T.t = c != null ? c : T.t + dt;   // 오디오가 없거나 아직 곡이 시작 전이면 실제 시간으로 센다
  T.beat = T.t / beatSec(T.song);
  const bi = Math.floor(T.beat);
  if (bi !== T.lastBeat && T.beat >= 0) { T.lastBeat = bi; T.flash = bi % 4 === 0 ? 1 : .55; }
  T.flash = Math.max(0, T.flash - dt * 4);
}

/** 플레이 중 한 틱(game.js 의 update): 신호선 판정과 도착 */
export function updateTrack() {
  const T = G.trk, s = G.ship; if (!T || G.st !== 'play') return;
  const yl = lineY(T);
  for (const p of G.planets) {   // 신호선이 지나간 행성은 사라진다(기체가 도는 행성은 남겨 둔다)
    if (p.dead || p === T.fin || p.y < yl || (s.mode === 'orb' && s.p === p)) continue;
    p.dead = p.gone = true; burst(p.x, p.y, 'hsl(' + p.hue + ',80%,65%)', 14, 160); ringFx(p.x, p.y, 'rgba(255,255,255,.5)', p.R, p.R + 40, .4, 2);
  }
  const onFin = s.p === T.fin && s.mode === 'orb';
  if (onFin) s.grace = 1;   // 도착 행성에서는 곡이 끝날 때까지 궤도가 줄지 않는다
  if (!onFin && s.y > yl + 6) { die('신호선에 따라잡혔다'); return; }
  if (T.beat >= T.B && onFin) finish();
}

/** 곡이 끝났고 기체가 도착 행성에 있다: 클리어 */
function finish() {
  const T = G.trk, song = T.song, s = G.ship; T.done = true;
  const got = G.stars.filter(t => t.got).length, rate = T.nStars ? got / T.nStars : 1, grade = gradeOf(true, rate), prev = recOf(song.id);
  const bonus = Math.round((300 * song.diff + got * 20) * (1 + rate));   // 클리어 보너스: 난이도·수집한 별에 비례
  G.score += bonus;
  const first = !prev.clear, newBest = G.score > prev.best;
  if (!G.debug) {
    save('swingby_trk_' + song.id, JSON.stringify({ clear: 1, best: Math.max(prev.best, G.score), rate: Math.max(prev.rate, rate) }));
    settleRun(); if (first) { const g = 15 * song.diff; grantShards(g); G.shardGain += g; }
  }
  T.res = { got, rate, grade, bonus, first, newBest, score: G.score };
  G.st = 'clear'; G.clearT = 0; G.held = false;
  flashScreen(.6, '#fff'); shakeAdd(8); punch(.06); thump(90, 30, .5, .35); vibe([40, 40, 90]);
  [0, 1, 2, 3].forEach(i => setTimeout(() => beep(440 * Math.pow(1.26, i), .18, 'triangle', .1), i * 110));
  burst(s.x, s.y, '#fff', 30, 280); ringFx(s.x, s.y, 'hsl(' + song.hue + ',90%,70%)', 6, 170, .7, 4);
}

/** 가려졌던 탭이 다시 보이면 곡 시계도 이어서 흐른다(audioUnlock 이 resume) */
export function bindTrackVisibility() { document.addEventListener('visibilitychange', () => { if (document.hidden && G.trk && G.st === 'play') audioSuspend(); }); }

/** 주소의 ?track=곡id(또는 번호)로 바로 시작. &manual 은 곡 시계를 소리 없이 실제 시간으로 센다(자동 테스트용). 기록은 저장하지 않는다 */
export function startTrackFromUrl(q) {
  if (!q.has('track')) return;
  const v = q.get('track'), song = SONGS.find(s => s.id === v) || SONGS[(+v || 1) - 1] || SONGS[0];
  startTrack(song); G.debug = true; if (q.has('manual')) G.trk.manual = true;
}

/** 사망·클리어 화면에서 다시 하기·곡 고르기 */
export const retryTrack = () => startTrack(G.trk.song);
export function backToSongs() { startRun(); G.st = 'songs'; beep(440, .08); }   // 코스가 깔린 월드를 새 판으로 치우고 곡 고르기로
export function openSongs() { G.st = 'songs'; beep(560, .09); }
export function exitSongs() { G.st = 'title'; beep(420, .08); }
