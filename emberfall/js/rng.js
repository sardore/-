// 시드 난수 (mulberry32) — 모든 생성/전투 결과가 재현 가능하다.
export function RNG(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = { r, ri: n => (r() * n) | 0, range: (a, b) => a + ((r() * (b - a + 1)) | 0), pick: a => a[(r() * a.length) | 0], chance: p => r() < p,
    shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; },
    wpick: (items, w) => { let t = 0; for (const it of items) t += w(it); let x = r() * t; for (const it of items) { x -= w(it); if (x <= 0) return it; } return items[items.length - 1]; },
    get seed() { return s; }, set seed(v) { s = v >>> 0; } };
  return o;
}
export const hash = (...a) => { let h = 2166136261; for (const v of a) { h ^= (v | 0) + 0x9e3779b9; h = Math.imul(h, 16777619); } return h >>> 0; };
