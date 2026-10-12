// 픽셀 드로잉 도우미 + 자동 외곽선/명암 후처리 (32px 스프라이트를 코드로 그린다)
export const mk = (w = 32, h = 32) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hex = h => { if (h[0] === '#') h = h.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
export const shade = (c, f) => { const [r, g, b] = hex(c); return f >= 0 ? rgb(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgb(r * (1 + f), g * (1 + f), b * (1 + f)); };
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return rgb(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
export class Pix {
  constructor(w = 32, h = 32) { this.w = w; this.h = h; this.c = mk(w, h); this.g = this.c.getContext('2d', { willReadFrequently: true }); this.g.imageSmoothingEnabled = false; }
  px(x, y, c) { this.g.fillStyle = c; this.g.fillRect(x | 0, y | 0, 1, 1); return this; }
  rect(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(x | 0, y | 0, w | 0, h | 0); return this; }
  disc(cx, cy, r, c) { this.g.fillStyle = c; for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.g.fillRect(x, y, 1, 1); return this; }
  ell(cx, cy, rx, ry, c) { this.g.fillStyle = c; for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.g.fillRect(x, y, 1, 1); return this; }
  line(x0, y0, x1, y1, c) { this.g.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy; for (let i = 0; i < 200; i++) { this.g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } } return this; }
  poly(pts, c) { // 스캔라인 채우기
    this.g.fillStyle = c; let minY = Infinity, maxY = -Infinity; for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) { const xs = []; const yy = y + 0.5; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; if ((y1 <= yy && y2 > yy) || (y2 <= yy && y1 > yy)) xs.push(x1 + (yy - y1) / (y2 - y1) * (x2 - x1)); } xs.sort((a, b) => a - b); for (let i = 0; i + 1 < xs.length; i += 2) this.g.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1); }
    return this; }
  noise(x, y, w, h, c, p, seed = 1) { let s = seed * 9301 + 49297; this.g.fillStyle = c; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { s = (s * 9301 + 49297) % 233280; if (s / 233280 < p) this.g.fillRect(x + i, y + j, 1, 1); } return this; }
}
// 외곽선 + 윗면 하이라이트 + 아랫면 그림자
export function finish(pix, o = {}) {
  const { w, h, g } = pix, img = g.getImageData(0, 0, w, h), d = img.data, out = g.createImageData(w, h), od = out.data;
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
  const outline = o.outline || [22, 14, 26];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 40) {
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      if (o.shade !== false) {
        const up = A(x, y - 1) < 40, lf = A(x - 1, y) < 40, dn = A(x, y + 1) < 40, rt = A(x + 1, y) < 40;
        if (up || lf) { r += (255 - r) * 0.2; gg += (255 - gg) * 0.2; b += (255 - b) * 0.2; }
        else if (dn || rt) { r *= 0.72; gg *= 0.72; b *= 0.74; }
      }
      od[i] = r; od[i + 1] = gg; od[i + 2] = b; od[i + 3] = 255;
    } else if (A(x - 1, y) > 40 || A(x + 1, y) > 40 || A(x, y - 1) > 40 || A(x, y + 1) > 40) { od[i] = outline[0]; od[i + 1] = outline[1]; od[i + 2] = outline[2]; od[i + 3] = 235; }
  }
  g.putImageData(out, 0, 0); return pix.c;
}
export const tint = (src, color, a = 1) => { const c = mk(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c; };
export const flipH = src => { const c = mk(src.width, src.height), g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; };
