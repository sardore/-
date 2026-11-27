/* 음악 스테이지의 곡 정의. 곡은 파일이 아니라 데이터(BPM·마디 구성·코드 진행·시드)이고, 같은 데이터로
 *  - track-music.js 가 합성해 연주하고(길이가 마디 수로 정확히 정해진다)
 *  - track.js 가 맵(행성 배치)을 만든다 — 행성 하나하나가 "몇 번째 박자에 신호선이 닿는가"를 갖는다.
 * 곡을 새로 넣으려면 SONGS 에 항목 하나만 추가하면 된다. */
import { load } from './util.js';

/** 섹션 종류: 곡의 층(track-music.js)과 맵의 분위기(행성 간격·종류)를 함께 정한다 */
export const KINDS = {
  intro: { n: '인트로', c: '#7dd3ff', gaps: [6, 6, 4], mix: { n: 70, g: 30 },        stars: 2 },
  verse: { n: '벌스',   c: '#9dffb0', gaps: [4, 4, 4, 6], mix: { n: 70, g: 15, r: 15 }, stars: 2 },
  build: { n: '빌드업', c: '#ffe27a', gaps: [4, 4, 2], mix: { n: 60, r: 40 },        stars: 2 },
  drop:  { n: '드롭',   c: '#ff6a8a', gaps: [2, 2, 4, 2, 4], mix: { n: 45, r: 40, g: 15 }, stars: 3 },
  break: { n: '브레이크', c: '#b8a8ff', gaps: [6, 8], mix: { n: 40, g: 60 },         stars: 1 },
  outro: { n: '아웃트로', c: '#ffb46f', gaps: [6, 4, 6], mix: { n: 60, g: 40 },      stars: 2 }
};

/* 코드: [으뜸음 반음 오프셋, 'm' | 'M'] 이 마디마다 하나씩 돌아간다 (4마디 주기).
 * sec: [종류, 마디 수] 목록 — 곡 길이 = 마디 수 합 × 4박. 첫 행성은 8박째(2마디 카운트인), 도착 행성은 곡이 끝나는 박에 있다.
 * ramp/dec: 비행 속도 가산·궤도 붕괴 가산(난이도), gaps: 섹션 종류별 행성 간격(박) 덮어쓰기 */
export const SONGS = [
  { id: 'orbit', n: 'ORBIT', k: '잔잔한 궤도', bpm: 92, key: 50, diff: 1, hue: 205, biome: 'normal', seed: 7, ramp: 10, dec: 0,
    prog: [[0, 'm'], [-4, 'M'], [-7, 'm'], [-5, 'M']], style: { bass: 1, hat: 1, arp: 1 },
    gaps: { intro: [6, 6, 8], verse: [4, 6], build: [4, 6], drop: [4, 4, 6, 4], break: [6, 8], outro: [6, 8] },   // 입문곡: 드롭에서도 2박 간격(촘촘한 구간)이 없다
    sec: [['intro', 4], ['verse', 8], ['build', 2], ['drop', 8], ['break', 4], ['verse', 6], ['outro', 4]] },
  { id: 'perihelion', n: 'PERIHELION', k: '근일점 통과', bpm: 120, key: 52, diff: 2, hue: 275, biome: 'nebula', seed: 23, ramp: 30, dec: 0,
    prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'M']], style: { bass: 2, hat: 2, arp: 2 },
    sec: [['intro', 4], ['verse', 8], ['build', 4], ['drop', 12], ['break', 4], ['build', 2], ['drop', 12], ['outro', 4]] },
  { id: 'redshift', n: 'REDSHIFT', k: '적색편이', bpm: 140, key: 45, diff: 3, hue: 6, biome: 'redzone', seed: 41, ramp: 50, dec: 1,
    prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-7, 'm']], style: { bass: 2, hat: 3, arp: 3 },
    gaps: { drop: [2, 2, 4, 4, 2], verse: [4, 4, 6] },
    sec: [['intro', 4], ['drop', 8], ['break', 4], ['build', 4], ['drop', 16], ['break', 4], ['drop', 12], ['outro', 4]] },
  { id: 'horizon', n: 'EVENT HORIZON', k: '사건의 지평선', bpm: 150, key: 47, diff: 4, hue: 262, biome: 'void', seed: 66, ramp: 75, dec: 2,
    prog: [[0, 'm'], [-4, 'M'], [-5, 'M'], [-9, 'M']], style: { bass: 3, hat: 3, arp: 3 },
    gaps: { drop: [3, 3, 2, 4, 2], verse: [4, 6, 4], build: [4, 3, 2] },
    sec: [['intro', 4], ['verse', 8], ['build', 4], ['drop', 16], ['break', 8], ['build', 4], ['drop', 16], ['outro', 4]] }
];

export const BEATS_PER_BAR = 4;
export const FIRST_BEAT = 8;   // 첫 행성에 신호선이 닿는 박(2마디): 카운트인

export const songBars = s => s.sec.reduce((a, x) => a + x[1], 0);
export const songBeats = s => songBars(s) * BEATS_PER_BAR;
export const beatSec = s => 60 / s.bpm;
/** 곡 길이(초) */
export const songSec = s => songBeats(s) * beatSec(s);
export const fmtMMSS = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

/** 박 번호가 속한 섹션 { kind, i, bar0, bars } */
export function sectionAt(s, beat) {
  let bar = 0; const b = beat / BEATS_PER_BAR;
  for (let i = 0; i < s.sec.length; i++) { const [kind, n] = s.sec[i]; if (b < bar + n) return { kind, i, bar0: bar, bars: n }; bar += n; }
  const last = s.sec[s.sec.length - 1]; return { kind: last[0], i: s.sec.length - 1, bar0: bar - last[1], bars: last[1] };
}

/* ---------- 기록 ---------- */
const key = id => 'swingby_trk_' + id;
/** { clear: 0|1, best: 최고 점수, rate: 별 수집률(0~1) } */
export function recOf(id) {
  try { const r = JSON.parse(load(key(id), 'null')); if (r && typeof r === 'object') return { clear: r.clear ? 1 : 0, best: +r.best || 0, rate: +r.rate || 0 }; } catch (e) { /* 깨진 기록은 무시 */ }
  return { clear: 0, best: 0, rate: 0 };
}
export const gradeOf = (cleared, rate) => !cleared ? '' : rate >= .95 ? 'S' : rate >= .75 ? 'A' : rate >= .5 ? 'B' : 'C';
