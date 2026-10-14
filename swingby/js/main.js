/* 진입점: 초기화와 메인 루프 */
import { resize } from './state.js';
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
function frame(now) {
  const dt = Math.min(.033, (now - last) / 1000 || 0); last = now;
  step(dt); draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
