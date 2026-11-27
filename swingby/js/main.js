/* 진입점: 초기화와 메인 루프 */
import { resize, g } from './state.js';
import { startRun } from './progress.js';
import { step } from './game.js';
import { draw } from './draw.js';
import { bindInput } from './input.js';
import { installDebug } from './debug.js';
import { startOpsFromUrl } from './ops.js';

window.addEventListener('resize', resize);
resize();
startRun();
bindInput();
installDebug();
startOpsFromUrl(new URLSearchParams(location.search));   // ?ops 로 블랙쉽 바로 시작

let last = 0;
const seen = new Set();
/** 한 프레임의 예외가 게임 전체를 멈추지 않게 한다: 다음 프레임을 먼저 예약하고, 갱신·그리기를 따로 감싸 같은 오류는 한 번만 남긴다 */
function fail(where, e) {
  const k = where + ':' + (e && e.message);
  if (!seen.has(k)) { seen.add(k); console.error('[swingby] ' + where + ' 오류', e); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.033, (now - last) / 1000 || 0); last = now;
  try { step(dt); } catch (e) { fail('step', e); }
  try { draw(); } catch (e) { fail('draw', e); if (g.reset) g.reset(); }   // 그리다 만 save() 가 쌓이지 않게 캔버스 상태를 처음으로 되돌린다
}
requestAnimationFrame(frame);
