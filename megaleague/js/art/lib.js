// 캐릭터 일러스트 공용 도구 — 모든 캐릭터는 같은 스티커 스타일(굵은 외곽선, 납작한 색면, 흰 하이라이트)로 그린다.
export const K = '#231738';
export const REG = {};
export const art = (id, pal, fn) => { REG[id] = { pal, fn }; };
const f = n => (Math.round(n * 10) / 10);
export const e = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${x}/>`;
export const c = (cx, cy, r, fill, x = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${x}/>`;
export const p = (d, fill, x = '') => `<path d="${d}" fill="${fill}" ${x}/>`;
export const poly = (pts, fill, x = '') => `<polygon points="${pts}" fill="${fill}" ${x}/>`;
export const rect = (x, y, w, h, r, fill, ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${ex}/>`;
export const tube = (d, w, fill, x = '') => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round" ${x}/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const line = (d, w = 3, col = K, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
export const hl = (cx, cy, rx, ry, o = 0.4, rot = 0) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fff" opacity="${o}" stroke="none" transform="rotate(${rot} ${f(cx)} ${f(cy)})"/>`;
export const shade = (d, col = '#000', o = 0.18) => `<path d="${d}" fill="${col}" opacity="${o}" stroke="none"/>`;
export const dot = (cx, cy, r, fill) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" stroke="none"/>`;
export const star = (cx, cy, R, r, fill, x = '', n = 5, rot = -90) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; pts.push(f(cx + Math.cos(a) * rr) + ',' + f(cy + Math.sin(a) * rr)); } return `<polygon points="${pts.join(' ')}" fill="${fill}" ${x}/>`; };
export const eye = (x, y, r = 8, look = 0, lid = 0) => `<g><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff"/><circle cx="${f(x + look)}" cy="${f(y + r * 0.12)}" r="${f(r * 0.6)}" fill="${K}" stroke="none"/><circle cx="${f(x + look - r * 0.22)}" cy="${f(y - r * 0.2)}" r="${f(r * 0.24)}" fill="#fff" stroke="none"/>${lid ? `<path d="M${f(x - r)} ${f(y - r * 0.1)} Q${f(x)} ${f(y - r * lid)} ${f(x + r)} ${f(y - r * 0.1)} L${f(x + r)} ${f(y - r)} L${f(x - r)} ${f(y - r)}Z" fill="var(--lid,#888)" stroke="none" opacity="0"/>` : ''}</g>`;
export const eyeAngry = (x, y, r = 8, dir = 1, look = 0) => `<g>${eye(x, y, r, look)}<path d="M${f(x - r * 1.25)} ${f(y - r * (dir > 0 ? 1.1 : 0.55))} L${f(x + r * 1.25)} ${f(y - r * (dir > 0 ? 0.55 : 1.1))}" stroke="${K}" stroke-width="4.5" stroke-linecap="round"/></g>`;
export const eyeDot = (x, y, r = 5) => `<g><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${K}" stroke="none"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.34)}" fill="#fff" stroke="none"/></g>`;
export const smile = (x, y, w = 14, d = 7) => line(`M${f(x - w)} ${f(y)} Q${f(x)} ${f(y + d * 2)} ${f(x + w)} ${f(y)}`, 3.5);
export const grin = (x, y, w = 16, d = 12, fill = '#7a1f3a') => `<path d="M${f(x - w)} ${f(y)} Q${f(x)} ${f(y + d * 1.6)} ${f(x + w)} ${f(y)} Z" fill="${fill}" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>`;
export const blush = (x, y, r = 6, col = '#ff7a8a') => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.6)}" fill="${col}" opacity=".55" stroke="none"/>`;
export const flame = (cx, cy, s = 1, a = '#ff7a2a', b = '#ffd23a', x = '') => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})" ${x}><path d="M0 -34 C 12 -20 22 -10 20 6 C 18 20 8 26 0 26 C -10 26 -20 18 -20 4 C -20 -8 -8 -14 -6 -26 C -2 -22 0 -28 0 -34Z" fill="${a}"/><path d="M0 -10 C 7 -2 11 4 9 12 C 7 20 0 21 -3 20 C -10 17 -11 8 -6 2 C -3 -2 -1 -4 0 -10Z" fill="${b}" stroke="none"/></g>`;
export const drop = (cx, cy, s = 1, fill = '#58b8ff', x = '') => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})" ${x}><path d="M0 -16 C 10 -2 14 4 14 9 C 14 16 8 20 0 20 C -8 20 -14 16 -14 9 C -14 4 -10 -2 0 -16Z" fill="${fill}"/><ellipse cx="-4" cy="7" rx="3" ry="5" fill="#fff" opacity=".5" stroke="none" transform="rotate(20 -4 7)"/></g>`;
export const bolt = (cx, cy, s = 1, fill = '#ffe14a', x = '') => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})" ${x}><polygon points="4,-22 -12,2 -2,2 -6,22 14,-6 3,-6 10,-22" fill="${fill}"/></g>`;
export const leaf = (cx, cy, s = 1, rot = 0, fill = '#5ccf6a', x = '') => `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${rot}) scale(${s})" ${x}><path d="M0 -20 C 16 -10 16 10 0 20 C -16 10 -16 -10 0 -20Z" fill="${fill}"/><path d="M0 -14 L0 16" stroke="${K}" stroke-width="2.5" fill="none" opacity=".6"/></g>`;
export const gem = (cx, cy, s = 1, fill = '#7fe0ff', x = '') => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})" ${x}><polygon points="0,-20 16,-6 10,16 -10,16 -16,-6" fill="${fill}"/><polygon points="0,-20 6,-6 0,16 -6,-6" fill="#fff" opacity=".45" stroke="none"/><path d="M-16 -6 L16 -6" stroke="${K}" stroke-width="2" opacity=".5" fill="none"/></g>`;
export const sparkle = (cx, cy, s = 1, fill = '#fff') => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})"><path d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5Z" fill="${fill}" stroke="none"/></g>`;
export const shadowEl = (rx = 52) => `<ellipse class="shadow" cx="100" cy="187" rx="${rx}" ry="9" fill="rgba(10,6,24,.32)"/>`;
export function renderArt(id, o = {}) {
  const r = REG[id]; if (!r) return `<svg viewBox="0 0 200 200" class="art"><text x="100" y="110" text-anchor="middle" font-size="28" fill="#fff">?</text></svg>`;
  return `<svg viewBox="0 0 200 200" class="art art-${id}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" overflow="visible">${o.noShadow ? '' : shadowEl(r.pal.sh || 52)}<g class="rig"><g class="bodyg" stroke="${K}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${r.fn(r.pal)}</g></g></svg>`;
}
export const palOf = id => REG[id]?.pal || { a: '#888', b: '#aaa', c: '#fff' };
