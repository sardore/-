// 재의 마을 애쉬폴 — 이동만으로 돌아다니는 허브
import { T, P, DECOR } from './data.js';
import { W, H } from './gen.js';
import { RNG } from './rng.js';
const I = (x, y) => y * W + x;
export function buildVillage(meta, seed = 77) {
  const R = RNG(seed), t = new Uint8Array(W * H).fill(T.WALL), p = new Uint8Array(W * H), s = new Uint8Array(W * H);
  const x0 = 3, x1 = 48, y0 = 3, y1 = 32;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { t[I(x, y)] = T.GROUND; s[I(x, y)] = R.chance(0.35) ? DECOR.GRASS : 0; }
  // 경계: 나무와 울타리
  for (let x = x0 - 1; x <= x1 + 1; x++) for (const y of [y0, y0 + 1, y1, y1 - 1]) if (x >= x0 && x <= x1) { p[I(x, y)] = R.chance(0.8) ? P.TREE : 0; }
  for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1, x1 - 1]) p[I(x, y)] = R.chance(0.8) ? P.TREE : 0;
  // 길
  const path = (ax, ay, bx, by) => { let x = ax, y = ay; for (let g = 0; g < 200 && (x !== bx || y !== by); g++) { s[I(x, y)] = DECOR.PATH; p[I(x, y)] = 0; if (x !== bx && (y === by || R.chance(0.5))) x += Math.sign(bx - x); else y += Math.sign(by - y); } s[I(bx, by)] = DECOR.PATH; };
  const cx = 25, cy = 18;
  const house = (hx, hy, w, lit = true) => { for (let x = hx; x < hx + w; x++) { p[I(x, hy)] = P.HOUSE; s[I(x, hy)] = 1; p[I(x, hy + 1)] = P.HOUSE; s[I(x, hy + 1)] = x === hx + (w >> 1) ? 3 : (lit && (x - hx) % 2 === 1 ? 20 : 2); t[I(x, hy)] = t[I(x, hy + 1)] = T.GROUND; } p[I(hx + (w >> 1), hy + 1)] = 0; };
  // 집들 (문 앞에 주민이 선다)
  house(9, 8, 6); house(34, 8, 7); house(9, 24, 6); house(36, 22, 5); house(20, 6, 5); house(29, 6, 4);
  path(cx, cy, 12, 11); path(cx, cy, 37, 11); path(cx, cy, 12, 27); path(cx, cy, 38, 25); path(cx, cy, cx, 28); path(cx, cy, 22, 9); path(cx, cy, 31, 9);
  // 중앙 모닥불(꺼져 가는 불)
  p[I(cx, cy)] = P.CAMP; s[I(cx, cy)] = 0;
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { p[I(cx + dx, cy + dy)] = P.LAMPPOST; }
  // 구덩이 (북동쪽이 아니라 동쪽 끝)
  const px = 42, py = 18;
  for (let y = py - 3; y <= py + 3; y++) for (let x = px - 3; x <= px + 3; x++) { const edge = Math.abs(x - px) === 3 || Math.abs(y - py) === 3; if (edge && !(x === px - 3 && y === py)) { p[I(x, y)] = P.FENCE; } else if (!edge) s[I(x, y)] = DECOR.CRACK; }
  t[I(px, py)] = T.WELL; p[I(px, py)] = 0; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p[I(px + dx, py + dy)] = 0;
  path(cx, cy, px - 3, py); s[I(px - 3, py)] = DECOR.PATH;
  // 묘지
  const graveCells = []; for (let i = 0; i < 12; i++) graveCells.push([15 + (i % 6) * 2, 28 + ((i / 6) | 0) * 2 - 0]);
  graveCells.forEach(([gx, gy], i) => { if (i < (meta.dead?.length || 0)) { p[I(gx, gy)] = P.GRAVE; s[I(gx, gy)] = 0; } });
  // 소품
  for (const [x, y] of [[8, 12], [7, 14], [40, 12], [41, 13], [30, 27], [31, 28], [6, 20], [44, 27]]) p[I(x, y)] = R.pick([P.BARREL, P.BARREL, P.TREE]);
  for (let i = 0; i < 40; i++) { const x = R.range(x0 + 2, x1 - 2), y = R.range(y0 + 2, y1 - 2); if (!p[I(x, y)] && s[I(x, y)] !== DECOR.PATH && Math.abs(x - cx) + Math.abs(y - cy) > 6 && t[I(x, y)] === T.GROUND) p[I(x, y)] = R.chance(0.6) ? P.TREE : P.BARREL; }
  for (const [x, y] of [[8, 14], [41, 14]]) p[I(x, y)] = 0;
  p[I(29, 20)] = P.SHELF; p[I(30, 20)] = P.SHELF; // 기록지기의 책장
  p[I(cx, 24)] = P.SIGN; // 안내판
  const npcs = [
    { role: 'elder', name: '할머니 로즈마', x: 12, y: 11, look: 'elder' },
    { role: 'smith', name: '대장장이 둔', x: 37, y: 11, look: 'smith' },
    { role: 'nun', name: '수녀 아다', x: 12, y: 27, look: 'nun' },
    { role: 'lamp', name: '등불장이 렌', x: 38, y: 25, look: 'lamp' },
    { role: 'herb', name: '약초꾼 베라', x: 22, y: 9, look: 'herb' },
    { role: 'archive', name: '기록지기 올브', x: 31, y: 20, look: 'scribe' },
    { role: 'kid', name: '아이 핀', x: 25, y: 22, look: 'kid' },
    { role: 'miner', name: '늙은 광부 토르', x: 31, y: 9, look: 'miner' },
  ];
  // 후계자 후보 3명 (할머니 집 앞마당)
  const heirs = [[17, 14], [19, 14], [21, 14]];
  for (const [x, y] of heirs) { t[I(x, y)] = T.GROUND; p[I(x, y)] = 0; }
  for (const n of npcs) { t[I(n.x, n.y)] = T.GROUND; p[I(n.x, n.y)] = 0; }
  // 출발 지점
  const spawn = { x: cx, y: cy + 3 };
  p[I(spawn.x, spawn.y)] = 0;
  return { t, p, s, w: W, h: H, zone: -1, village: true, spawn, npcs, heirs: heirs.map(([x, y]) => ({ x, y })), pit: { x: px, y: py }, bonfire: { x: cx, y: cy }, graves: graveCells, depth: -1, boss: false, slots: { E: [], N: [], Q: [], K: [] } };
}
