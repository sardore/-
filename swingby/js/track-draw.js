/* 음악 스테이지 화면: 월드의 신호선(인디케이터)·도착 표시, HUD(미니맵 인디케이터·박 표시·남은 시간), 곡 선택, 결과 */
import { G, V, g } from './state.js';
import { W0, TAU, clamp } from './util.js';
import { viewBot } from './camera.js';
import { rr, txt, telemetry, reducedMotion } from './gfx.js';
import { SONGS, KINDS, songBars, songSec, sectionAt, fmtMMSS, recOf, gradeOf } from './track-songs.js';
import { lineY, trackPaused } from './track.js';

const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';

/* ---------- 월드 안 (draw.js 가 월드 변환을 건 채로 부른다) ---------- */
export function drawTrackWorld() {
  const T = G.trk; if (!T) return;
  const yl = lineY(T), bot = viewBot() + 120, kc = KINDS[sectionAt(T.song, Math.max(0, T.beat)).kind].c, still = reducedMotion();
  // 도착 행성 표시: 곡이 끝나기까지 남은 박을 링으로, 위에 GOAL
  const F = T.fin;
  if (F && !F.dead) {
    const left = clamp((T.B - T.beat) / 16, 0, 1), pulse = still ? 0 : .5 + .5 * Math.sin(G.T * 3);
    g.save(); g.strokeStyle = 'rgba(255,230,150,' + (.35 + .3 * pulse) + ')'; g.lineWidth = 2; g.setLineDash([5, 8]); g.lineDashOffset = -G.T * 14;
    g.beginPath(); g.arc(F.x, F.y, F.R + 22, 0, TAU); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 4; g.beginPath(); g.arc(F.x, F.y, F.R + 22, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - left)); g.stroke(); g.restore();
    txt('GOAL', F.x, F.y - F.R - 38, 16, '#ffe9a8', 'center', 900);
    if (G.ship.p === F && G.ship.mode === 'orb') txt('도착! 곡이 끝나면 클리어', F.x, F.y - F.R - 20, 11, 'rgba(255,255,255,.85)', 'center', 700);
  }
  // 지금 도는 행성: 신호선이 닿기까지 남은 시간을 줄어드는 링으로
  const s = G.ship;
  if (s.mode === 'orb' && s.p !== F && !s.p.dead) {
    const p = s.p, remain = p.bt - T.beat, f = clamp(remain / (p.gap || 4), 0, 1), warn = remain < 2;
    g.save(); g.strokeStyle = warn ? '#ff6a6a' : kc; g.globalAlpha = warn ? .95 : .7; g.lineWidth = warn ? 4 : 3; g.lineCap = 'round';
    g.beginPath(); g.arc(p.x, p.y, p.R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * f); g.stroke(); g.restore();
  }
  // 신호선: 곡 시계에 맞춰 일정한 속도로 올라온다. 박마다 번쩍인다
  if (yl < bot) {
    const k = T.flash, h = still ? 0 : k;
    const gr = g.createLinearGradient(0, yl, 0, yl + 700);
    gr.addColorStop(0, hsl(T.song.hue, 80, 18, .88)); gr.addColorStop(.35, 'rgba(6,5,16,.9)'); gr.addColorStop(1, 'rgba(3,3,10,.96)');
    g.fillStyle = gr; g.fillRect(-500, yl, G.w + 1000, bot - yl + 700);
    g.save(); g.beginPath(); g.rect(-500, yl, G.w + 1000, bot - yl + 700); g.clip();
    g.strokeStyle = hsl(T.song.hue, 70, 60, .14); g.lineWidth = 1;
    for (let y = yl + 10 + ((G.T * 22) % 16); y < bot + 700; y += 16) { g.beginPath(); g.moveTo(-500, y); g.lineTo(G.w + 500, y); g.stroke(); }
    g.restore();
    g.shadowColor = kc; g.shadowBlur = 14 + 22 * h; g.fillStyle = kc; g.fillRect(-500, yl - 1.5 - 2.5 * h, G.w + 1000, 3 + 5 * h); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,' + (.55 + .4 * h) + ')'; g.fillRect(-500, yl - .5, G.w + 1000, 1.2);
  }
}

/* ---------- HUD (화면 좌표) ---------- */
const MAP = () => ({ x: V.OX + W0 - 26, y0: 118, h: Math.max(180, Math.min(V.VH - 300, 360)) });

export function drawTrackHud() {
  const T = G.trk, { VW, VH, OX } = V, song = T.song, s = G.ship;
  const sec = sectionAt(song, Math.max(0, T.beat)), kc = KINDS[sec.kind].c, B = T.B, beat = clamp(T.beat, 0, B), motion = !reducedMotion();
  // 위험: 신호선이 가까우면 아래 가장자리가 붉어진다
  const gap = lineY(T) - s.y, near = clamp(1 - gap / 260, 0, 1) * (s.p === T.fin && s.mode === 'orb' ? 0 : 1);
  if (near > 0) { const vg = g.createLinearGradient(0, VH * .55, 0, VH); vg.addColorStop(0, 'rgba(255,60,60,0)'); vg.addColorStop(1, 'rgba(255,60,60,' + (.4 * near * (motion ? .7 + .3 * T.flash : 1)) + ')'); g.fillStyle = vg; g.fillRect(0, VH * .55, VW, VH * .45); }
  // 점수·콤보
  telemetry(String(G.score), VW / 2, 54, 34, '#f1f1e9', 'center', 150);
  if (G.combo > 1) { telemetry('×' + G.combo, VW / 2 - 5, 80, 15, '#99e1f0', 'right'); txt('콤보', VW / 2 + 3, 80, 11, '#b5c7ce', 'left', 700); }
  // 곡 정보
  txt(song.n, OX + 14, 30, 14, hsl(song.hue, 90, 75), 'left', 800);
  txt(KINDS[sec.kind].n, OX + 14, 48, 12, kc, 'left', 800);
  telemetry(fmtMMSS(Math.max(0, T.t)) + ' / ' + fmtMMSS(songSec(song)), OX + 14, 66, 12, 'rgba(255,255,255,.7)', 'left');
  // 미니맵 인디케이터: 아래 START → 위 GOAL. 신호선과 기체가 같은 눈금 위에서 움직인다
  const M = MAP(), yOf = b => M.y0 + M.h * (1 - b / B);
  g.save();
  g.fillStyle = 'rgba(8,10,22,.55)'; rr(M.x - 14, M.y0 - 22, 28, M.h + 44, 10); g.fill();
  let b0 = 0;
  for (const [kind, n] of song.sec) { const b1 = b0 + n * 4; g.fillStyle = KINDS[kind].c; g.globalAlpha = .55; g.fillRect(M.x - 9, yOf(b1), 4, yOf(b0) - yOf(b1) - 1); b0 = b1; }
  g.globalAlpha = .35; g.fillStyle = '#fff'; g.fillRect(M.x - .5, M.y0, 1, M.h);
  g.globalAlpha = .6; for (const p of G.planets) { if (!p.bt) continue; g.fillStyle = p.dead ? 'rgba(255,255,255,.25)' : '#fff'; g.beginPath(); g.arc(M.x + 3, yOf(p.bt), p.fin ? 3 : 1.6, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  const py = yOf(beat), sb = clamp(-s.y / 42, 0, B), sy = yOf(sb);   // 기체의 위치는 맵 y 를 박 단위로 환산한다
  g.fillStyle = 'rgba(255,90,90,.28)'; g.fillRect(M.x - 12, py, 24, M.y0 + M.h + 20 - py);   // 신호선 아래: 이미 삼켜진 구간
  g.fillStyle = kc; g.shadowColor = kc; g.shadowBlur = 8; g.fillRect(M.x - 13, py - 1.5, 26, 3); g.shadowBlur = 0;   // 신호선(곡 진행)
  g.fillStyle = '#fff'; g.beginPath(); g.arc(M.x, sy, 4.2, 0, TAU); g.fill();                                           // 기체
  txt('GOAL', M.x, M.y0 - 27, 9, '#ffe9a8', 'center', 800); txt('START', M.x, M.y0 + M.h + 33, 8, 'rgba(255,255,255,.55)', 'center', 700);
  g.restore();
  // 박 표시: 4분음표 네 칸 (첫 박은 강조)
  const bi = Math.floor(Math.max(0, T.beat)) % 4;
  for (let i = 0; i < 4; i++) { const on = i === bi && T.beat >= 0, x = VW / 2 + (i - 1.5) * 20; g.fillStyle = on ? (i === 0 ? '#fff' : kc) : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(x, VH - 28, on ? 5 + 2 * T.flash : 4, 0, TAU); g.fill(); }
  // 카운트인: 곡이 막 시작할 때
  if (T.beat < 4 && !trackPaused()) { const n = 4 - Math.floor(Math.max(0, T.beat)); g.globalAlpha = .55; txt(String(n), VW / 2, VH * .52, 64, '#fff', 'center', 900); g.globalAlpha = 1; }
  if (trackPaused()) { g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, 0, VW, VH); txt('일시정지', VW / 2, VH * .44, 30, '#fff', 'center', 900); txt('터치해서 이어서', VW / 2, VH * .44 + 30, 15, 'rgba(255,255,255,.8)', 'center', 600); }
}

/* ---------- 곡 선택 ---------- */
const CARD = { w: 372, h: 100, gap: 10 };
const backRect = () => ({ x: V.OX + 14, y: 14, w: 76, h: 34 });
const cardRect = i => ({ x: V.VW / 2 - CARD.w / 2, y: 84 + i * (CARD.h + CARD.gap), w: CARD.w, h: CARD.h });
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** 곡 선택 화면에서 눌렀을 때: { back: true } | { song: 번호 } | null */
export function songsHit(x, y) {
  if (inR(backRect(), x, y)) return { back: true };
  for (let i = 0; i < SONGS.length; i++) if (inR(cardRect(i), x, y)) return { song: i };
  return null;
}

export function drawSongSelect() {
  const { VW, VH } = V; g.fillStyle = 'rgba(5,6,15,.74)'; g.fillRect(0, 0, VW, VH);
  const b = backRect(); rr(b.x, b.y, b.w, b.h, 10); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.2; g.stroke();
  txt('◀ 뒤로', b.x + b.w / 2, b.y + 22, 13, '#fff', 'center', 700);
  txt('음악 스테이지', VW / 2, 42, 22, '#fff', 'center', 900);
  txt('신호선이 도착 행성에 닿는 순간 곡이 끝난다', VW / 2, 64, 11.5, 'rgba(255,255,255,.55)', 'center', 500);
  SONGS.forEach((s, i) => {
    const r = cardRect(i), rec = recOf(s.id), grade = gradeOf(rec.clear, rec.rate), c = hsl(s.hue, 85, 68);
    rr(r.x, r.y, r.w, r.h, 14); const gr = g.createLinearGradient(r.x, 0, r.x + r.w, 0); gr.addColorStop(0, hsl(s.hue, 55, 16, .95)); gr.addColorStop(1, 'rgba(12,14,28,.95)'); g.fillStyle = gr; g.fill();
    g.strokeStyle = rec.clear ? c : 'rgba(255,255,255,.22)'; g.lineWidth = rec.clear ? 1.8 : 1; g.stroke();
    txt(String(i + 1).padStart(2, '0'), r.x + 16, r.y + 38, 28, hsl(s.hue, 80, 70, .55), 'left', 900);
    txt(s.n, r.x + 62, r.y + 28, 18, '#fff', 'left', 900); txt(s.k, r.x + 62, r.y + 46, 12, c, 'left', 700);
    telemetry('♩' + s.bpm + '  ' + fmtMMSS(songSec(s)) + '  ' + songBars(s) + '마디', r.x + r.w - 14, r.y + 26, 11, 'rgba(255,255,255,.78)', 'right');
    txt('★'.repeat(s.diff) + '☆'.repeat(4 - s.diff), r.x + r.w - 14, r.y + 46, 13, '#ffe27a', 'right', 700);
    // 곡 구성 띠: 섹션 길이에 비례한 색 막대 = 맵의 지형 흐름
    const total = songBars(s), bx = r.x + 16, bw = r.w - 32; let a = 0;
    for (const [kind, n] of s.sec) { const x0 = bx + bw * a / total, w = bw * n / total; g.fillStyle = KINDS[kind].c; g.globalAlpha = .75; g.fillRect(x0, r.y + 60, Math.max(1, w - 1.5), 6); a += n; }
    g.globalAlpha = 1;
    txt(rec.clear ? '클리어  ' + grade + '  ·  최고 ' + rec.best : '미클리어', r.x + 16, r.y + 88, 12, rec.clear ? '#ffe27a' : 'rgba(255,255,255,.5)', 'left', 700);
    if (rec.clear) txt('별 ' + Math.round(rec.rate * 100) + '%', r.x + r.w - 14, r.y + 88, 12, 'rgba(255,255,255,.7)', 'right', 600);
  });
}

/* ---------- 결과 (실패·클리어) ---------- */
const retryRect = () => ({ x: V.VW / 2 - 148, y: V.VH - 132, w: 140, h: 44 });
const songsRect = () => ({ x: V.VW / 2 + 8, y: V.VH - 132, w: 140, h: 44 });
/** 결과 화면에서 눌렀을 때: 'songs' | 'retry' */
export const trackEndHit = (x, y) => inR(songsRect(), x, y) ? 'songs' : 'retry';

export function drawTrackEnd() {
  const T = G.trk, { VW, VH } = V, song = T.song, clear = G.st === 'clear', t = clear ? G.clearT : G.deadT, a = clamp(t * 2, 0, 1), c = hsl(song.hue, 85, 70);
  g.fillStyle = 'rgba(5,6,15,' + (.74 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
  txt(song.n, VW / 2, VH * .2, 16, c, 'center', 800);
  if (clear) {
    const r = T.res;
    txt('스테이지 클리어', VW / 2, VH * .2 + 44, 36, '#ffe27a', 'center', 900);
    txt(r.grade, VW / 2, VH * .2 + 140, 92, r.grade === 'S' ? '#ffe9a8' : '#fff', 'center', 900);
    telemetry(String(r.score), VW / 2, VH * .2 + 196, 46, '#f1f1e9', 'center', 300);
    txt(r.newBest ? '★ 신기록 ★' : '', VW / 2, VH * .2 + 220, 15, '#ffe27a', 'center', 800);
    txt('별 ' + r.got + ' / ' + T.nStars + '  (' + Math.round(r.rate * 100) + '%)  ·  클리어 보너스 +' + r.bonus, VW / 2, VH * .2 + 248, 13, 'rgba(255,255,255,.8)', 'center', 600);
    if (G.shardGain > 0) txt('별 조각 +' + G.shardGain, VW / 2, VH * .2 + 270, 13, '#ffe27a', 'center', 800);
  } else {
    const pct = Math.round(clamp(T.beat / T.B, 0, 1) * 100);
    txt('실패', VW / 2, VH * .2 + 44, 36, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, VH * .2 + 74, 15, '#ff8f8f', 'center', 500);
    telemetry(String(G.score), VW / 2, VH * .2 + 150, 54, '#f1f1e9', 'center', 300);
    txt('곡의 ' + pct + '% 지점  ·  ' + fmtMMSS(Math.max(0, T.t)) + ' / ' + fmtMMSS(songSec(song)), VW / 2, VH * .2 + 184, 14, 'rgba(255,255,255,.8)', 'center', 600);
    const gw = 240, gx = VW / 2 - gw / 2; g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(gx, VH * .2 + 198, gw, 6); g.fillStyle = c; g.fillRect(gx, VH * .2 + 198, gw * pct / 100, 6);
    txt('별 조각 +' + G.shardGain, VW / 2, VH * .2 + 232, 13, '#ffe27a', 'center', 800);
  }
  if (t > .7) {
    for (const [r, label, col] of [[retryRect(), '다시 도전', c], [songsRect(), '곡 선택', '#e6dcc0']]) { rr(r.x, r.y, r.w, r.h, 12); g.fillStyle = 'rgba(255,255,255,.09)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.6; g.stroke(); txt(label, r.x + r.w / 2, r.y + 28, 16, col, 'center', 800); }
  }
  g.globalAlpha = 1;
}

