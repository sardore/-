/* 카메라: 월드 y 좌표(camY = 화면 맨 위), 갈림길 줌(vz), 보이는 범위 계산 */
import { G, V } from './state.js';
import { W0 } from './util.js';
import { OPS } from './ops-data.js';
import { SPECIAL } from './special.js';

const FORK_ZOOM = .72;      // 갈림길에서의 줌 배율(작을수록 넓게 보인다)
const ORBIT_PAD = 30;               // 궤도를 돌 때 궤도 맨 아래에서 화면 아래 끝까지 최소로 남길 여유(낙사선은 그 아래 40)
const ORBIT_FOLLOW = 11;           // 위 여유를 맞추려고 카메라를 내리는 속도(보통 4.5): 붙자마자 놓아도 낙사하지 않게 빠르게
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
  let ty, rate = G.boss ? 3 : zoomed ? 3.5 : 4.5;
  if (G.boss) ty = G.arenaTop + (arenaH() - V.VH) / 2;      // 아레나 윗변이 화면 맨 위에 오도록
  else if (zoomed) ty = F.hub.y - V.VH / 2 - HUB_FRAME * V.VH / tv;
  else {
    const want = (s.mode === 'orb' ? s.p.y : s.y) - V.VH / 2 - .14 * V.VH / G.vz;
    ty = Math.min(G.camY, want);
    if (G.ops || G.kills >= SPECIAL.from) {   // 소형함·벽·넉백(블랙쉽), 승강기·위성에 실려 뒤로 가는 움직임(일반, 보스 1 격파 뒤)에 밀려 조금 내려가는 것은 허용한다. 지금까지 가장 높이 올라간 카메라보다 최대 fallSlack 만큼은 내려가서 아래 맵(이미 지나온 행성)이 남아 있다
      const slack = OPS.fallSlack * Math.sqrt(G.w / W0);
      G.camTop = G.camTop == null ? want : Math.min(G.camTop, want);
      ty = Math.max(ty, Math.min(want, G.camTop + slack));
    }
    // 화면 아래로 지나간 행성(넉백으로 밀려 내려와 이미 올라간 카메라 밑에 있는 행성)에 붙었다면 그 궤도가 통째로 보이게 카메라를 내린다. 안 그러면 궤도 아래쪽이 낙사선 밖이라 놓는 순간 '심우주로 표류'로 죽는다
    if (s.mode === 'orb') {
      const need = s.p.y + Math.max(s.r, s.p.R + 20) + ORBIT_PAD - V.VH / 2 - V.VH / 2 / G.vz;
      if (need > ty) { ty = need; rate = ORBIT_FOLLOW; }
    }
  }
  if (G.boss) G.camY -= G.boss.sv * dt;                      // 보스전 스크롤을 미리 따라가서 카메라가 뒤처지지 않게
  G.camY += (ty - G.camY) * Math.min(1, dt * rate);
}
