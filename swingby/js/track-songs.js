/* 음악 스테이지의 곡 목록: 진짜 음악 파일을 쓴다.
 *  - 내 곡: 플레이어가 기기에서 고른 음악 파일. IndexedDB 에 파일과 분석 결과를 저장해 다음에도 목록에 남는다
 *  - 수록곡: 레포의 music/songs.json 에 적어 둔 파일 (music/README.md 참고. 저작권이 허락된 곡만 넣는다)
 * 곡을 고르면 디코딩·분석(track-analyze.js)해서 { id, name, artist, buf, dur, bpm, beat0, env } 를 만든다. */
import { load } from './util.js';
import { decodeAudio } from './audio.js';
import { analyzeBuffer } from './track-analyze.js';

export const MAX_SEC = 10 * 60, MAX_BYTES = 80 * 1024 * 1024, MIN_SEC = 30;
export const fmtMMSS = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
/** 곡 id 로 정해지는 색 */
export const hueOf = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };

/* ---------- 기록 ---------- */
export const recKey = (id, hard) => 'swingby_trk_' + (hard ? 'h_' : '') + id;
/** { clear: 0|1, best: 최고 점수, rate: 별 수집률(0~1) } */
export function recOf(id, hard) {
  try { const r = JSON.parse(load(recKey(id, hard), 'null')); if (r && typeof r === 'object') return { clear: r.clear ? 1 : 0, best: +r.best || 0, rate: +r.rate || 0 }; } catch (e) { /* 깨진 기록은 무시 */ }
  return { clear: 0, best: 0, rate: 0 };
}
export const gradeOf = (cleared, rate) => !cleared ? '' : rate >= .95 ? 'S' : rate >= .75 ? 'A' : rate >= .5 ? 'B' : 'C';

/* ---------- IndexedDB (내 곡) ---------- */
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((ok, no) => {
    try {
      const r = indexedDB.open('swingby_music', 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('data')) d.createObjectStore('data'); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    } catch (e) { no(e); }
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return await new Promise((ok, no) => { const t = d.transaction(store, mode), r = fn(t.objectStore(store)); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
}

/* ---------- 목록 ---------- */
/** 곡 선택 화면이 읽는 상태. items: [{ id, name, artist, dur, bpm, kind:'mine'|'bundled', file? }] */
export const LIB = { items: [], loaded: false, busy: '', err: '' };
const MEM = {};   // 저장이 막힌 환경에서 이번 접속 동안만 기억하는 내 곡

export async function refreshLibrary() {
  const items = [];
  try {
    const r = await fetch('./music/songs.json', { cache: 'no-cache' });
    if (r.ok) for (const s of await r.json()) if (s && s.file) items.push({ id: 'm_' + s.file, name: s.title || s.file, artist: s.artist || '', dur: +s.dur || 0, bpm: 0, kind: 'bundled', file: s.file, license: s.license || '' });
  } catch (e) { /* 수록곡 목록이 없거나 오프라인 */ }
  let mine = [];
  try { mine = (await tx('meta', 'readonly', st => st.getAll())) || []; } catch (e) { /* 저장소를 쓸 수 없는 환경 */ }
  for (const id in MEM) if (!mine.some(m => m.id === id)) mine.push(MEM[id].meta);
  mine.sort((a, b) => b.added - a.added).forEach(m => items.push(Object.assign({ kind: 'mine' }, m)));
  LIB.items = items; LIB.loaded = true;
}

/** 기기에서 고른 파일을 내 곡으로 추가한다. 실패하면 사용자에게 보여줄 메시지로 던진다 */
export async function addMySong(file) {
  if (file.size > MAX_BYTES) throw new Error('파일이 너무 커요 (80MB 이하)');
  const ab = await file.arrayBuffer();
  let buf = null; try { buf = await decodeAudio(ab.slice(0)); } catch (e) { buf = null; }
  if (!buf) throw new Error('이 파일은 재생할 수 없어요');
  if (buf.duration < MIN_SEC) throw new Error('30초보다 긴 곡이어야 해요');
  if (buf.duration > MAX_SEC) throw new Error('10분 이하의 곡만 돼요');
  const a = analyzeBuffer(buf), id = 'f_' + hueOf(file.name) + '_' + file.size;
  const meta = { id, name: file.name.replace(/\.[^.]+$/, ''), artist: '내 파일', dur: a.dur, bpm: a.bpm, beat0: a.beat0, env: a.env, added: Date.now() };
  try { await tx('data', 'readwrite', st => st.put(ab, id)); await tx('meta', 'readwrite', st => st.put(meta)); }
  catch (e) { MEM[id] = { ab, meta }; }
  CACHE.id = id; CACHE.buf = buf;
  return meta;
}
export async function deleteMySong(id) {
  try { await tx('data', 'readwrite', st => st.delete(id)); await tx('meta', 'readwrite', st => st.delete(id)); } catch (e) { /* 무시 */ }
  delete MEM[id]; if (CACHE.id === id) { CACHE.id = null; CACHE.buf = null; }
}

/** 방금 쓴 곡 하나의 디코딩 결과를 들고 있다 (다시 하기에서 바로 쓰도록) */
const CACHE = { id: null, buf: null };

/** 목록 항목 → 플레이할 곡 객체 */
export async function loadSong(item) {
  let buf = CACHE.id === item.id ? CACHE.buf : null;
  if (!buf) {
    let ab;
    if (item.kind === 'mine') ab = MEM[item.id] ? MEM[item.id].ab : await tx('data', 'readonly', st => st.get(item.id));
    else { const r = await fetch('./music/' + encodeURIComponent(item.file)); if (!r.ok) throw new Error('곡 파일을 찾지 못했어요'); ab = await r.arrayBuffer(); }
    if (!ab) throw new Error('저장된 곡을 찾지 못했어요');
    try { buf = await decodeAudio(ab.slice(0)); } catch (e) { buf = null; }
    if (!buf) throw new Error('이 곡을 재생할 수 없어요');
    CACHE.id = item.id; CACHE.buf = buf;
  }
  const a = item.env ? item : analyzeBuffer(buf);
  return { id: item.id, name: item.name, artist: item.artist, buf, dur: buf.duration, bpm: a.bpm, beat0: a.beat0, env: a.env, hue: hueOf(item.id) };
}
