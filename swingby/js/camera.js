/* 카메라: 월드 y 좌표(camY = 화면 맨 위), 갈림길 줌(vz), 보이는 범위 계산 */
import { G, V } from './state.js';

export const FORK_ZOOM = .72;      // 갈림길에서의 줌 배율(작을수록 넓게 보인다)
const HUB_FRAME = .3;              // 줌 상태에서 허브 행성이 화면 아래쪽 어디에 오는지

/** 현재 줌에서 화면에 보이는 월드 y 범위 */
export const viewTop = () => G.camY + V.VH / 2 - V.VH / 2 / G.vz;
export const viewBot = () => G.camY + V.VH / 2 + V.VH / 2 / G.vz;

export function updateCamera(dt) {
  const s = G.ship, F = G.fork, zoomed = !!(F && F.active);
  G.vz += ((zoomed ? FORK_ZOOM : 1) - G.vz) * Math.min(1, dt * 3.2);
  let ty;
  if (G.boss) ty = G.arenaCam;
  else if (zoomed) ty = F.hub.y - V.VH / 2 - HUB_FRAME * V.VH / FORK_ZOOM;
  else ty = Math.min(G.camY, (s.mode === 'orb' ? s.p.y : s.y) - V.VH * .64);
  G.camY += (ty - G.camY) * Math.min(1, dt * (G.boss ? 3 : zoomed ? 3.5 : 4.5));
}
