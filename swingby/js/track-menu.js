/* 곡 고르기 화면의 동작: 목록(수록곡 + 내 곡), 내 음악 파일 불러오기, 삭제, 난이도, 쪽 넘기기.
 * 그리기는 track-draw.js 가 여기의 배치(songsLayout)를 그대로 쓴다. */
import { G, V } from './state.js';
import { save, load } from './util.js';
import { beep, audioUnlock } from './audio.js';
import { LIB, refreshLibrary, addMySong, deleteMySong, loadSong } from './track-songs.js';
import { startTrack } from './track.js';

export const MENU = { page: 0, hard: load('swingby_trk_diff', '') === 'hard', confirmDel: null };
export const PER_PAGE = 5;

/* ---------- 배치 (입력 판정과 그리기가 같이 쓴다) ---------- */
export function songsLayout() {
  const cx = V.VW / 2, w = 372, x = cx - w / 2;
  const back = { x: V.OX + 14, y: 14, w: 76, h: 34 };
  const diff = { x: V.OX + 420 - 14 - 96, y: 14, w: 96, h: 34 };
  const add = { x, y: 82, w, h: 58 };
  const rows = []; for (let i = 0; i < PER_PAGE; i++) rows.push({ x, y: 152 + i * 80, w, h: 70 });
  const del = r => ({ x: r.x + r.w - 40, y: r.y + 6, w: 34, h: 30 });
  const pages = Math.max(1, Math.ceil(LIB.items.length / PER_PAGE)), py = 152 + PER_PAGE * 80 + 4;
  const prev = { x: cx - 120, y: py, w: 70, h: 34 }, next = { x: cx + 50, y: py, w: 70, h: 34 };
  return { back, diff, add, rows, del, pages, prev, next };
}
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const pageItems = () => LIB.items.slice(MENU.page * PER_PAGE, MENU.page * PER_PAGE + PER_PAGE);
export { pageItems };

/* ---------- 파일 고르기 ---------- */
let input = null;
function picker() {
  if (input) return input;
  input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*,.mp3,.m4a,.ogg,.wav,.flac,.aac'; input.style.display = 'none';
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; input.value = ''; if (!f) return;
    LIB.busy = '곡을 불러오는 중…  ' + f.name; LIB.err = '';
    try { await addMySong(f); await refreshLibrary(); MENU.page = 0; beep(780, .1); }
    catch (e) { LIB.err = (e && e.message) || '불러오지 못했어요'; beep(220, .15, 'sawtooth'); }
    LIB.busy = '';
  });
  document.body.appendChild(input); return input;
}

/** 곡 고르기 화면 열기 */
export function openSongs() { G.st = 'songs'; LIB.err = ''; MENU.confirmDel = null; beep(560, .09); refreshLibrary().then(() => { MENU.page = Math.min(MENU.page, Math.max(0, Math.ceil(LIB.items.length / PER_PAGE) - 1)); }); }

/** 'click' 이벤트(브라우저가 파일 창을 허락하는 사용자 동작)에서: 불러오기 버튼이면 파일 창을 연다 */
export function songsClick(x, y) {
  if (G.st !== 'songs' || LIB.busy) return;
  if (inR(songsLayout().add, x, y)) { audioUnlock(); picker().click(); }
}

/** 곡 고르기 화면을 눌렀을 때(pointerdown). 돌아가기는 'back' 을 돌려준다 */
export function songsPress(x, y) {
  if (LIB.busy) return null;
  const L = songsLayout();
  if (inR(L.back, x, y)) return 'back';
  if (inR(L.diff, x, y)) { MENU.hard = !MENU.hard; save('swingby_trk_diff', MENU.hard ? 'hard' : ''); beep(MENU.hard ? 660 : 520, .08); return null; }
  if (inR(L.add, x, y)) return null;   // 파일 창은 click 에서 연다
  if (L.pages > 1 && inR(L.prev, x, y)) { MENU.page = (MENU.page + L.pages - 1) % L.pages; beep(500, .05); return null; }
  if (L.pages > 1 && inR(L.next, x, y)) { MENU.page = (MENU.page + 1) % L.pages; beep(500, .05); return null; }
  const items = pageItems();
  for (let i = 0; i < items.length; i++) {
    const r = L.rows[i], it = items[i];
    if (!inR(r, x, y)) continue;
    if (it.kind === 'mine' && inR(L.del(r), x, y)) {   // 두 번 눌러야 지워진다
      if (MENU.confirmDel === it.id) { MENU.confirmDel = null; deleteMySong(it.id).then(refreshLibrary); beep(300, .1); }
      else { MENU.confirmDel = it.id; beep(400, .06); }
      return null;
    }
    MENU.confirmDel = null; play(it); return null;
  }
  MENU.confirmDel = null; return null;
}

async function play(it) {
  LIB.busy = '곡을 준비하는 중…  ' + it.name; LIB.err = '';
  try { const song = await loadSong(it); LIB.busy = ''; if (G.st === 'songs') startTrack(song, MENU.hard); }
  catch (e) { LIB.busy = ''; LIB.err = (e && e.message) || '곡을 열지 못했어요'; beep(220, .15, 'sawtooth'); }
}
