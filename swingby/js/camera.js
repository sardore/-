/* 카메라: 월드 y 좌표(camY = 화면 맨 위), 갈림길 줌(vz), 보이는 범위 계산 */
import { G, V } from './state.js';
import { W0 } from './util.js';

const FORK_ZOOM = .72;      // 갈림길에서의 줌 배율(작을수록 넓게 보인다)
const HUB_FRAME = .3;              // 줌 상태에서 허브 행성이 화면 아래쪽 어디에 오는지

/** 보스 아레나의 세로 길이(월드 단위): 필드가 넓을수록 줌아웃되어 같은 화면에 더 긴 구간이 보인다 */
export const arenaH = () => V.VH * G.w / W0;

/** 현재 줌에서 화면에 보이는 월드 y 범위 */
export const viewTop = () => G.camY + V.VH / 2 - V.VH / 2 / G.vz;
export const viewBot = () => G.camY + V.VH / 2 + V.VH / 2 / G.vz;

export function updateCamera(dt) {
  const s = G.ship, F = G.fork, zoomed = !!(F && F.active);
  const tv = (W0 / G.w) * (zoomed ? FORK_ZOOM : 1);       // 필드가 넓어질수록 줌아웃, 갈림길에서는 더 넓게
  G.vz += (tv - G.vz) * Math.min(1, dt * 3.2);
  let ty;
  if (G.boss) ty = G.arenaTop + (arenaH() - V.VH) / 2;      // 아레나 윗변이 화면 맨 위에 오도록
  else if (zoomed) ty = F.hub.y - V.VH / 2 - HUB_FRAME * V.VH / tv;
  else ty = Math.min(G.camY, (s.mode === 'orb' ? s.p.y : s.y) - V.VH / 2 - .14 * V.VH / G.vz);
  if (G.boss) G.camY -= G.boss.sv * dt;                      // 보스전 스크롤을 미리 따라가서 카메라가 뒤처지지 않게
  G.camY += (ty - G.camY) * Math.min(1, dt * (G.boss ? 3 : zoomed ? 3.5 : 4.5));
}
