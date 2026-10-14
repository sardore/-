/* 능력치 다각형(레이더) 차트: 7개 축, 점선 고리 = 기본 기체(100%) */
import { g } from './state.js';
import { STATS } from './data.js';
import { PI, TAU, clamp } from './util.js';
import { txt } from './gfx.js';

const RADAR_MAX = 240;    // 바깥 고리가 나타내는 퍼센트
const RADAR_MIN = 40;            // 중심이 나타내는 퍼센트(100% 근처 차이가 잘 보이도록 중심을 띄운다)

/**
 * @param cx,cy,R   중심과 반지름
 * @param series    [{stats, color, fill(0~1), dash}] 먼저 그린 것이 아래에 깔린다
 * @param opt       {labels: 축 이름 표시, fs: 글자 크기}
 */
export function drawRadar(cx, cy, R, series, opt = {}) {
  const n = STATS.length, ang = i => -PI / 2 + i / n * TAU;
  const pt = (i, pct) => { const f = clamp((pct - RADAR_MIN) / (RADAR_MAX - RADAR_MIN), 0, 1) * R; return [cx + Math.cos(ang(i)) * f, cy + Math.sin(ang(i)) * f]; };
  const ring = (pct, style, dash) => {
    g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pt(i, pct); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
    g.strokeStyle = style; g.lineWidth = 1; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
  };
  g.save();
  g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = pt(i, RADAR_MAX); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill();
  ring(RADAR_MAX, 'rgba(255,255,255,.16)');
  ring(170, 'rgba(255,255,255,.08)');
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
  for (let i = 0; i < n; i++) { const [x, y] = pt(i, RADAR_MAX); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); }
  ring(100, 'rgba(255,255,255,.4)', [3, 3]);
  for (const sr of series) {
    g.beginPath(); STATS.forEach((s, i) => { const [x, y] = pt(i, sr.stats[s.k] || 0); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    if (sr.fill) { g.globalAlpha = sr.fill; g.fillStyle = sr.color; g.fill(); g.globalAlpha = 1; }
    g.strokeStyle = sr.color; g.lineWidth = sr.w || 1.6; g.setLineDash(sr.dash ? [3, 3] : []); g.stroke(); g.setLineDash([]);
  }
  const top = series[series.length - 1];
  if (top) STATS.forEach((s, i) => { const [x, y] = pt(i, top.stats[s.k] || 0); g.fillStyle = s.c; g.beginPath(); g.arc(x, y, opt.labels ? 2.4 : 1.8, 0, TAU); g.fill(); });
  if (opt.labels) {
    const fs = opt.fs || 10;
    STATS.forEach((s, i) => {
      const a = ang(i), x = cx + Math.cos(a) * (R + fs * .9), y = cy + Math.sin(a) * (R + fs * .9) + fs * .35;
      txt(s.n, x, y, fs, s.c, Math.cos(a) > .3 ? 'left' : Math.cos(a) < -.3 ? 'right' : 'center', 700);
    });
  }
  g.restore();
}
