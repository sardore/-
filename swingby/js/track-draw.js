/* 음악 스테이지 화면: 월드의 신호선(인디케이터)·잠긴 행성·도착 표시, HUD(미니맵 인디케이터·박 표시·시간), 곡 고르기, 결과 */
import { G, V, g } from './state.js';
import { W0, TAU, clamp } from './util.js';
import { viewBot } from './camera.js';
import { rr, txt, telemetry, reducedMotion } from './gfx.js';
import { LIB, fmtMMSS, recOf, gradeOf, hueOf } from './track-songs.js';
import { envAt } from './track-analyze.js';
import { lineY, timeAtY, trackPaused } from './track.js';
import { MENU, songsLayout, pageItems } from './track-menu.js';

const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
/** 세기(0~1) → 색: 조용함 파랑 → 시끄러움 분홍 */
const envCol = (I, a) => hsl(200 - 150 * I, 85, 62 + 6 * I, a);
const songHue = () => G.trk.song.hue || 200;

/* ---------- 월드 안 (draw.js 가 월드 변환을 건 채로 부른다) ---------- */
export function drawTrackWorld() {
  const T = G.trk; if (!T) return;
  const yl = lineY(T), bot = viewBot() + 120, still = reducedMotion(), I = envAt(T.song.env, T.t), kc = envCol(I), s = G.ship, F = T.fin;
  // 잠긴 행성: 점선 테두리와 자물쇠
  for (const p of G.planets) {
    if (!p.lock || p.dead || p.y > bot) continue;
    g.save(); g.strokeStyle = 'rgba(200,210,255,.45)'; g.lineWidth = 1.5; g.setLineDash([3, 6]); g.beginPath(); g.arc(p.x, p.y, p.R + 6, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(220,228,255,.75)'; g.fillRect(p.x - 5, p.y - 1, 10, 8); g.strokeStyle = 'rgba(220,228,255,.75)'; g.lineWidth = 1.6; g.beginPath(); g.arc(p.x, p.y - 2, 3.4, Math.PI, 0); g.stroke(); g.restore();
  }
  // 도착 행성: 곡이 끝나기까지 남은 시간 링 + GOAL
  if (F && !F.dead) {
    const left = clamp((T.song.dur - T.t) / 20, 0, 1), pulse = still ? 0 : .5 + .5 * Math.sin(G.T * 3);
    g.save(); g.strokeStyle = 'rgba(255,230,150,' + (.35 + .3 * pulse) + ')'; g.lineWidth = 2; g.setLineDash([5, 8]); g.lineDashOffset = -G.T * 14;
    g.beginPath(); g.arc(F.x, F.y, F.R + 22, 0, TAU); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 4; g.beginPath(); g.arc(F.x, F.y, F.R + 22, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - left)); g.stroke(); g.restore();
    txt('GOAL', F.x, F.y - F.R - 38, 16, '#ffe9a8', 'center', 900);
    if (s.p === F && s.mode === 'orb') txt('도착! 곡이 끝나면 클리어', F.x, F.y - F.R - 20, 11, 'rgba(255,255,255,.85)', 'center', 700);
  }
  // 지금 도는 행성: 신호선이 닿기까지 남은 시간
  if (s.mode === 'orb' && s.p !== F && !s.p.dead && s.p.due != null) {
    const p = s.p, remain = p.due - T.t, f = clamp(remain / Math.max(.5, p.due - (p.prevDue || 0)), 0, 1), warn = remain < .8;
    g.save(); g.strokeStyle = warn ? '#ff6a6a' : kc; g.globalAlpha = warn ? .95 : .75; g.lineWidth = warn ? 4 : 3; g.lineCap = 'round';
    g.beginPath(); g.arc(p.x, p.y, p.R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * f); g.stroke(); g.restore();
  }
  // 신호선: 코스를 따라 기체의 평소 속도로 올라온다. 박마다 번쩍인다
  if (yl < bot) {
    const h = still ? 0 : T.flash, hu = songHue();
    const gr = g.createLinearGradient(0, yl, 0, yl + 700);
    gr.addColorStop(0, hsl(hu, 70, 18, .86)); gr.addColorStop(.35, 'rgba(6,5,16,.9)'); gr.addColorStop(1, 'rgba(3,3,10,.96)');
    g.fillStyle = gr; g.fillRect(-500, yl, G.w + 1000, bot - yl + 700);
    g.save(); g.beginPath(); g.rect(-500, yl, G.w + 1000, bot - yl + 700); g.clip();
    g.strokeStyle = hsl(hu, 70, 60, .13); g.lineWidth = 1;
    for (let y = yl + 10 + ((G.T * 22) % 16); y < bot + 700; y += 16) { g.beginPath(); g.moveTo(-500, y); g.lineTo(G.w + 500, y); g.stroke(); }
    g.restore();
    g.shadowColor = kc; g.shadowBlur = 14 + 22 * h; g.fillStyle = kc; g.fillRect(-500, yl - 1.5 - 2.5 * h, G.w + 1000, 3 + 5 * h); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,' + (.55 + .4 * h) + ')'; g.fillRect(-500, yl - .5, G.w + 1000, 1.2);
  }
}

/* ---------- HUD (화면 좌표) ---------- */
const MAP = () => ({ x: V.OX + W0 - 26, y0: 118, h: Math.max(180, Math.min(V.VH - 300, 360)) });

export function drawTrackHud() {
  const T = G.trk, { VW, VH, OX } = V, song = T.song, s = G.ship, dur = song.dur, motion = !reducedMotion(), I = envAt(song.env, T.t), kc = envCol(I);
  const onFin = s.p === T.fin && s.mode === 'orb';
  // 위험: 신호선이 가까우면 아래 가장자리가 붉어진다
  const near = onFin ? 0 : clamp(1 - (lineY(T) - s.y) / 240, 0, 1);
  if (near > 0) { const vg = g.createLinearGradient(0, VH * .55, 0, VH); vg.addColorStop(0, 'rgba(255,60,60,0)'); vg.addColorStop(1, 'rgba(255,60,60,' + (.42 * near * (motion ? .7 + .3 * T.flash : 1)) + ')'); g.fillStyle = vg; g.fillRect(0, VH * .55, VW, VH * .45); }
  telemetry(String(G.score), VW / 2, 54, 34, '#f1f1e9', 'center', 150);
  if (G.combo > 1) { telemetry('×' + G.combo, VW / 2 - 5, 80, 15, '#99e1f0', 'right'); txt('콤보', VW / 2 + 3, 80, 11, '#b5c7ce', 'left', 700); }
  const nm = song.name.length > 16 ? song.name.slice(0, 15) + '…' : song.name;
  txt(nm, OX + 14, 30, 13, hsl(songHue(), 90, 75), 'left', 800);
  txt(T.D.n + (song.bpm ? '  ·  ♩' + Math.round(song.bpm) : ''), OX + 14, 48, 11, 'rgba(255,255,255,.6)', 'left', 700);
  telemetry(fmtMMSS(Math.max(0, T.t)) + ' / ' + fmtMMSS(dur), OX + 14, 66, 12, 'rgba(255,255,255,.75)', 'left');
  // 미니맵 인디케이터: 아래 START → 위 GOAL = 곡의 처음 → 끝. 곡의 세기가 색 띠로 깔리고, 신호선(곡 진행)과 기체가 같은 눈금 위에서 움직인다
  const M = MAP(), yOf = t => M.y0 + M.h * (1 - clamp(t / dur, 0, 1));
  g.save();
  g.fillStyle = 'rgba(8,10,22,.55)'; rr(M.x - 14, M.y0 - 22, 28, M.h + 44, 10); g.fill();
  const seg = Math.max(1, Math.ceil(dur / 2));
  for (let i = 0; i < seg; i++) { const t0 = i * dur / seg, t1 = (i + 1) * dur / seg; g.fillStyle = envCol(envAt(song.env, t0), .7); g.fillRect(M.x - 9, yOf(t1), 4, yOf(t0) - yOf(t1) + .5); }
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(M.x - .5, M.y0, 1, M.h);
  for (const p of G.planets) { if (p.due == null) continue; g.fillStyle = p.dead ? 'rgba(255,255,255,.2)' : p.lock ? 'rgba(255,255,255,.35)' : '#fff'; g.beginPath(); g.arc(M.x + 3.5, yOf(p.due), p.fin ? 3 : 1.4, 0, TAU); g.fill(); }
  const py = yOf(T.t), sy = yOf(timeAtY(s.y));
  g.fillStyle = 'rgba(255,90,90,.26)'; g.fillRect(M.x - 12, py, 24, M.y0 + M.h + 20 - py);
  g.fillStyle = kc; g.shadowColor = kc; g.shadowBlur = 8; g.fillRect(M.x - 13, py - 1.5, 26, 3); g.shadowBlur = 0;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(M.x, sy, 4.2, 0, TAU); g.fill();
  txt('GOAL', M.x, M.y0 - 27, 9, '#ffe9a8', 'center', 800); txt('START', M.x, M.y0 + M.h + 33, 8, 'rgba(255,255,255,.55)', 'center', 700);
  g.restore();
  // 박 표시 (곡에서 추정한 BPM)
  const bi = ((Math.floor(T.beat || 0) % 4) + 4) % 4;
  for (let i = 0; i < 4; i++) { const on = i === bi && T.t >= 0, x = VW / 2 + (i - 1.5) * 20; g.fillStyle = on ? (i === 0 ? '#fff' : kc) : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(x, VH - 28, on ? 5 + 2 * T.flash : 4, 0, TAU); g.fill(); }
  if (T.t < 2.6 && !trackPaused()) { g.globalAlpha = .6; txt('신호선이 올라오기 전에 출발!', VW / 2, VH * .56, 15, '#fff', 'center', 800); g.globalAlpha = 1; }
  if (trackPaused()) { g.fillStyle = 'rgba(5,6,15,.72)'; g.fillRect(0, 0, VW, VH); txt('일시정지', VW / 2, VH * .44, 30, '#fff', 'center', 900); txt('터치해서 이어서', VW / 2, VH * .44 + 30, 15, 'rgba(255,255,255,.8)', 'center', 600); }
}

/* ---------- 곡 고르기 ---------- */
function button(r, label, col, fill) { rr(r.x, r.y, r.w, r.h, 10); g.fillStyle = fill || 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.2; g.stroke(); txt(label, r.x + r.w / 2, r.y + r.h / 2 + 5, 13, col, 'center', 700); }

export function drawSongSelect() {
  const { VW, VH } = V, L = songsLayout(), T = G.T;
  g.fillStyle = 'rgba(5,6,15,.78)'; g.fillRect(0, 0, VW, VH);
  button(L.back, '◀ 뒤로', '#fff');
  button(L.diff, '난이도 ' + (MENU.hard ? '어려움' : '보통'), MENU.hard ? '#ff9a8a' : '#9dffb0');
  txt('음악 스테이지', VW / 2, 42, 20, '#fff', 'center', 900);
  txt('곡 길이 = 코스 길이 · 곡이 끝나는 순간 도착', VW / 2, 66, 11, 'rgba(255,255,255,.55)', 'center', 600);
  // 불러오기
  const a = L.add; rr(a.x, a.y, a.w, a.h, 14); g.fillStyle = 'rgba(125,211,255,.08)'; g.fill();
  g.save(); g.setLineDash([6, 6]); g.strokeStyle = '#7dd3ff'; g.lineWidth = 1.5; g.stroke(); g.restore();
  txt('＋ 내 음악 파일 불러오기', a.x + a.w / 2, a.y + 26, 16, '#bfe8ff', 'center', 800);
  txt('mp3 · m4a · ogg · wav (30초~10분). 불러온 곡은 이 기기에 저장돼요', a.x + a.w / 2, a.y + 45, 10.5, 'rgba(255,255,255,.55)', 'center', 500);
  const items = pageItems();
  if (LIB.loaded && !LIB.items.length) txt('아직 곡이 없어요. 위 버튼으로 음악 파일을 골라 보세요', VW / 2, L.rows[0].y + 40, 13, 'rgba(255,255,255,.6)', 'center', 600);
  items.forEach((it, i) => {
    const r = L.rows[i], hue = hueOf(it.id), rec = recOf(it.id, MENU.hard), grade = gradeOf(rec.clear, rec.rate), c = hsl(hue, 85, 70);
    rr(r.x, r.y, r.w, r.h, 12); const gr = g.createLinearGradient(r.x, 0, r.x + r.w, 0); gr.addColorStop(0, hsl(hue, 50, 17, .95)); gr.addColorStop(1, 'rgba(12,14,28,.95)'); g.fillStyle = gr; g.fill();
    g.strokeStyle = rec.clear ? c : 'rgba(255,255,255,.2)'; g.lineWidth = rec.clear ? 1.6 : 1; g.stroke();
    const nm = it.name.length > 22 ? it.name.slice(0, 21) + '…' : it.name;
    txt(nm, r.x + 14, r.y + 26, 15, '#fff', 'left', 800);
    txt((it.kind === 'mine' ? '내 파일' : (it.artist || '수록곡')) + (it.dur ? '  ·  ' + fmtMMSS(it.dur) : '') + (it.bpm ? '  ·  ♩' + Math.round(it.bpm) : ''), r.x + 14, r.y + 45, 11, c, 'left', 700);
    txt(rec.clear ? '클리어 ' + grade + '  ·  최고 ' + rec.best + '  ·  별 ' + Math.round(rec.rate * 100) + '%' : '미클리어', r.x + 14, r.y + 62, 10.5, rec.clear ? '#ffe27a' : 'rgba(255,255,255,.45)', 'left', 600);
    if (it.env && it.env.length) {   // 곡의 세기 곡선 = 코스의 촘촘함
      const bx = r.x + r.w - 150, bw = 100, by = r.y + 58;
      for (let k = 0; k < bw; k += 2) { const I = it.env[Math.floor(k / bw * it.env.length)]; g.fillStyle = envCol(I, .8); g.fillRect(bx + k, by - 3 - I * 14, 1.5, 3 + I * 14); }
    }
    if (it.kind === 'mine') { const d = L.del(r), conf = MENU.confirmDel === it.id; rr(d.x, d.y, d.w, d.h, 8); g.fillStyle = conf ? 'rgba(255,90,90,.35)' : 'rgba(255,255,255,.06)'; g.fill(); txt(conf ? '삭제?' : '✕', d.x + d.w / 2, d.y + 20, conf ? 10 : 14, conf ? '#ffb0b0' : 'rgba(255,255,255,.6)', 'center', 800); }
  });
  if (L.pages > 1) { button(L.prev, '◀', '#fff'); button(L.next, '▶', '#fff'); txt((MENU.page + 1) + ' / ' + L.pages, VW / 2, L.prev.y + 22, 13, 'rgba(255,255,255,.75)', 'center', 700); }
  if (LIB.err) txt(LIB.err, VW / 2, VH - 64, 13, '#ff9a9a', 'center', 700);
  if (LIB.busy) { g.fillStyle = 'rgba(5,6,15,.8)'; g.fillRect(0, 0, VW, VH); txt(LIB.busy.length > 30 ? LIB.busy.slice(0, 29) + '…' : LIB.busy, VW / 2, VH / 2, 15, '#fff', 'center', 700); g.strokeStyle = '#7dd3ff'; g.lineWidth = 3; g.beginPath(); g.arc(VW / 2, VH / 2 + 40, 14, T * 5, T * 5 + 4); g.stroke(); }
}

/* ---------- 결과 (실패·클리어) ---------- */
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const retryRect = () => ({ x: V.VW / 2 - 148, y: V.VH - 132, w: 140, h: 44 });
const songsRect = () => ({ x: V.VW / 2 + 8, y: V.VH - 132, w: 140, h: 44 });
/** 결과 화면에서 눌렀을 때: 'songs' | 'retry' */
export const trackEndHit = (x, y) => inR(songsRect(), x, y) ? 'songs' : 'retry';

export function drawTrackEnd() {
  const T = G.trk, { VW, VH } = V, song = T.song, clear = G.st === 'clear', t = clear ? G.clearT : G.deadT, a = clamp(t * 2, 0, 1), c = hsl(songHue(), 85, 70);
  g.fillStyle = 'rgba(5,6,15,' + (.76 * a) + ')'; g.fillRect(0, 0, VW, VH); g.globalAlpha = a;
  txt(song.name.length > 22 ? song.name.slice(0, 21) + '…' : song.name, VW / 2, VH * .2, 16, c, 'center', 800);
  txt(T.D.n, VW / 2, VH * .2 + 18, 11, 'rgba(255,255,255,.55)', 'center', 700);
  if (clear) {
    const r = T.res;
    txt('스테이지 클리어', VW / 2, VH * .2 + 54, 34, '#ffe27a', 'center', 900);
    txt(r.grade, VW / 2, VH * .2 + 146, 88, r.grade === 'S' ? '#ffe9a8' : '#fff', 'center', 900);
    telemetry(String(r.score), VW / 2, VH * .2 + 200, 44, '#f1f1e9', 'center', 300);
    if (r.newBest) txt('★ 신기록 ★', VW / 2, VH * .2 + 224, 15, '#ffe27a', 'center', 800);
    txt('별 ' + r.got + ' / ' + T.nStars + '  (' + Math.round(r.rate * 100) + '%)  ·  클리어 보너스 +' + r.bonus, VW / 2, VH * .2 + 250, 13, 'rgba(255,255,255,.8)', 'center', 600);
    if (G.shardGain > 0) txt('별 조각 +' + G.shardGain, VW / 2, VH * .2 + 272, 13, '#ffe27a', 'center', 800);
  } else {
    const pct = Math.round(clamp(T.t / song.dur, 0, 1) * 100);
    txt('실패', VW / 2, VH * .2 + 54, 34, '#fff', 'center', 900); txt(G.deadWhy, VW / 2, VH * .2 + 82, 15, '#ff8f8f', 'center', 500);
    telemetry(String(G.score), VW / 2, VH * .2 + 156, 52, '#f1f1e9', 'center', 300);
    txt('곡의 ' + pct + '% 지점  ·  ' + fmtMMSS(Math.max(0, T.t)) + ' / ' + fmtMMSS(song.dur), VW / 2, VH * .2 + 190, 14, 'rgba(255,255,255,.8)', 'center', 600);
    const gw = 240, gx = VW / 2 - gw / 2; g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(gx, VH * .2 + 204, gw, 6); g.fillStyle = c; g.fillRect(gx, VH * .2 + 204, gw * pct / 100, 6);
    if (G.shardGain > 0) txt('별 조각 +' + G.shardGain, VW / 2, VH * .2 + 236, 13, '#ffe27a', 'center', 800);
  }
  if (t > .7) for (const [r, label, col] of [[retryRect(), '다시 도전', c], [songsRect(), '곡 선택', '#e6dcc0']]) { rr(r.x, r.y, r.w, r.h, 12); g.fillStyle = 'rgba(255,255,255,.09)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1.6; g.stroke(); txt(label, r.x + r.w / 2, r.y + 28, 16, col, 'center', 800); }
  g.globalAlpha = 1;
}
