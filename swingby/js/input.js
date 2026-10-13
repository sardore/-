/* 입력: 터치/마우스/키보드를 게임 동작으로 연결한다.
 * 누르는 동안 차지하고 떼면 발사. */
import { G, V, cv } from './state.js';
import { audioUnlock, toggleMute, beep } from './audio.js';
import { pressStart, pressEnd } from './player.js';
import { choose, offer, startRun } from './progress.js';
import { pickLayout } from './draw-pick.js';
import { MUTE_HIT } from './draw-ui.js';
import { openShop, closeShop, shopDown, shopMove, shopUp, shopWheel, titleMenuHit, deadShopHit } from './shop-ui.js';

/** 눌렀을 때. screen 좌표(px,py)는 화면 픽셀, key 가 true 면 키보드 입력 */
export function pointerDown(px, py, key) {
  audioUnlock();
  const x = px / V.S, y = py / V.S;
  if (!key && x > V.VW - MUTE_HIT && y > V.VH - MUTE_HIT) { toggleMute(); return; }
  switch (G.st) {
    case 'title': if (!key && titleMenuHit(x, y) === 'shop') openShop(); else { G.st = 'play'; beep(520, .1); } break;
    case 'shop': if (!key) shopDown(x, y); break;
    case 'play': pressStart(); break;
    case 'pick': {
      if (G.pickT < .45 || key) return;
      pickLayout().rects.forEach((r, i) => { if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) choose(i); });
      break;
    }
    case 'clear': if (G.clearT > 1) { offer(); if (G.st === 'clear') G.st = 'play'; } break;
    case 'dead': if (G.deadT > .7) { if (!key && deadShopHit(x, y)) openShop(); else { startRun(); G.st = 'play'; } } break;
  }
}
/** 뗐을 때. 상점에서는 탭·드래그 판정에 위치가 필요하다 (위치가 없으면 취소) */
export function pointerUp(px, py) {
  if (G.st === 'shop') shopUp(px == null ? null : px / V.S, py == null ? null : py / V.S);
  else pressEnd();
}

export function bindInput() {
  cv.addEventListener('pointerdown', e => { e.preventDefault(); pointerDown(e.clientX, e.clientY, false); });
  cv.addEventListener('pointerup', e => pointerUp(e.clientX, e.clientY));
  cv.addEventListener('pointercancel', () => pointerUp());
  cv.addEventListener('pointermove', e => { if (G.st === 'shop') shopMove(e.clientY / V.S); });
  cv.addEventListener('wheel', e => { if (G.st === 'shop') shopWheel(e.deltaY); }, { passive: true });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => pointerUp());
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
    if (G.st === 'shop') { if (e.key === 'Escape') closeShop(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pointerDown(0, 0, true); }
    else if (G.st === 'pick' && G.pickT > .45 && '123'.includes(e.key)) choose(+e.key - 1);
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') pointerUp(); });
}
