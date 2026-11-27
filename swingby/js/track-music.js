/* 음악 스테이지의 곡 연주: SONGS 데이터(코드 진행·섹션·스타일)를 합성음으로 연주한다.
 * 난수는 곡 시드와 스텝 번호로만 정해서 항상 같은 곡이 나오고, 마지막 마디가 끝나는 순간 곡이 정확히 끝난다(그 뒤는 무음).
 * 한 마디 = 16스텝(16분음표). audio.js 가 스텝 간격을 BPM 으로 정해 부른다. */
import { MUSIC_MODES, SYNTH } from './audio.js';
import { SONGS, sectionAt, songBars } from './track-songs.js';

const SONG_BY_ID = Object.fromEntries(SONGS.map(s => [s.id, s]));
/** 시드와 스텝으로 정해지는 0~1 난수 */
function hash(seed, n) { let h = (seed * 374761393 + n * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const TRIAD = { m: [0, 3, 7, 10], M: [0, 4, 7, 11] };   // 7화음까지

function trackStep(t, sd, w, step) {
  const song = SONG_BY_ID[w.song]; if (!song || !SYNTH.on) return;
  const bars = songBars(song), bar = Math.floor(step / 16), k = step % 16;
  if (bar >= bars) return;                                  // 곡이 끝났다
  const sec = sectionAt(song, bar * 4), kind = sec.kind, first = bar === sec.bar0, last = bar === bars - 1, st = song.style;
  const [off, q] = song.prog[bar % 4], root = song.key + off, tones = TRIAD[q].map(x => root + 12 + x), r = n => hash(song.seed, step * 7 + n);
  const drive = kind === 'drop' || kind === 'build', soft = kind === 'intro' || kind === 'break' || kind === 'outro';

  /* 패드: 마디마다 화음. 곡이 끝나는 마지막 마디는 길게 울린다 */
  if (k === 0) {
    const len = last ? sd * 44 : sd * 17, v = kind === 'break' ? .06 : drive ? .03 : .045;
    tones.slice(0, 3).forEach((m, i) => SYNTH.note(t, m, len, drive ? 'sawtooth' : 'triangle', v, { a: last ? .4 : .25, lp: drive ? 1100 : 1500, send: .5, det: i * 5 - 5 }));
    if (last) SYNTH.note(t, root - 12, sd * 44, 'sine', .2, { a: .05, lp: 500 });
  }
  /* 베이스 */
  if (!soft || kind === 'outro' && st.bass > 1) {
    if (kind === 'drop') {
      const lv = st.bass;
      if (lv === 1 && (k === 0 || k === 8)) SYNTH.note(t, root - 12, sd * 6, 'sine', .17, { a: .02, lp: 420 });
      if (lv >= 2 && k % 2 === 0) SYNTH.note(t, root - 12 + (k === 6 || k === 14 ? 12 : 0), sd * 1.7, 'sawtooth', .1, { lp: 520 });
      if (lv >= 3 && k % 2 === 1 && r(1) < .5) SYNTH.note(t, root - 12 + 7, sd * .8, 'square', .05, { lp: 700 });
    } else if (kind === 'verse' || kind === 'build') {
      if (k === 0 || k === 8 || (st.bass > 1 && k === 11)) SYNTH.note(t, root - 12, sd * (k === 11 ? 3 : 7), 'sine', .16, { a: .02, lp: 420 });
    }
  }
  /* 드럼 */
  if (kind === 'drop' || (kind === 'build' && bar >= sec.bar0 + 1)) { if (k % 4 === 0) SYNTH.kick(t, .3); }
  else if ((kind === 'verse' && st.bass > 1) && (k === 0 || k === 8)) SYNTH.kick(t, .2);
  if (kind === 'build' && bar === sec.bar0 + sec.bars - 1 && k % 2 === 0) SYNTH.kick(t, .16);   // 드롭 직전 스네어 롤 느낌의 킥 연타
  if ((kind === 'drop' || kind === 'build') && (k === 4 || k === 12)) SYNTH.noise(t, .1, .12, 1700, true);
  if (kind !== 'intro' && kind !== 'break' && kind !== 'outro') {
    if (k % 4 === 2) SYNTH.noise(t, .05, .06, 7000);
    if (st.hat >= 3 && drive && k % 2 === 1 && r(3) < .6) SYNTH.noise(t, .03, .035, 8500);
  }
  if (kind === 'verse' && st.hat === 1 && k % 8 === 4) SYNTH.noise(t, .04, .03, 8000);
  if (first && kind === 'drop' && k === 0) SYNTH.noise(t, 1.1, .13, 4500);   // 드롭의 크래시
  if (kind === 'build') { const p = (bar - sec.bar0) / sec.bars; if (k % 4 === 0) SYNTH.noise(t, sd * 4, .02 + .06 * p, 3000 + p * 4000, true); }   // 점점 높아지는 라이저

  /* 멜로디 아르페지오: 화음음을 시드 난수로 고른다 (같은 곡은 항상 같은 멜로디) */
  const dens = kind === 'drop' ? [.85, .55, 1][st.arp - 1] : kind === 'verse' ? .5 : kind === 'build' ? .7 : kind === 'break' ? .25 : .3;
  const step2 = kind === 'drop' ? 1 : 2;
  if (k % step2 === 0 && r(5) < dens) {
    const pat = [0, 2, 3, 2, 1, 3, 4, 3][(k >> (step2 === 1 ? 0 : 1)) % 8], pool = tones.concat(tones.map(m => m + 12)), m = pool[(pat + (r(9) < .25 ? 1 : 0)) % pool.length];
    SYNTH.note(t, m + (kind === 'break' ? 12 : 0), sd * (kind === 'break' ? 6 : 1.8), kind === 'drop' ? 'square' : 'triangle', kind === 'drop' ? .03 : .045, { lp: kind === 'drop' ? 2400 : 2800, send: kind === 'break' ? .9 : .6 });
  }
  /* 마지막 마디: 종이 울리듯 으뜸화음을 한 번 더 */
  if (last && k === 8) tones.slice(0, 3).forEach(m => SYNTH.note(t, m + 12, sd * 24, 'sine', .05, { a: .02, send: 1 }));
}

MUSIC_MODES.track = trackStep;
export const TRACK_MUSIC_READY = true;
