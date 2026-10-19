/* 강화 창(바텀 시트): 상점의 강화 트랙(지금은 글로우)을 단계별로 올리고, 도달한 단계 중 하나를 골라 적용한다.
 * 단계표는 shop-data.js(UPGRADES), 규칙·저장은 shop.js(upNext/upTry/upUse). 상점 화면(shop-ui.js)이 열고 그리기·탭을 넘겨준다.
 *  - 단계 노드를 누르면 그 단계가 바로 적용된다(도달한 단계만). 적용 단계가 최고 단계일 때만 '강화하기' 버튼이 뜬다.
 *  - 강화는 단계가 오를수록 비용이 오르고 확률이 내려간다. 실패하면 별 조각만 사라지고 단계는 그대로다.
 *  - 시트는 위쪽 미리보기를 가리지 않아서, 단계를 바꾸면 미리보기의 기체 글로우가 바로 바뀐다. */
import { G, V, g } from './state.js';
import { TAU, clamp, rnd, FONT } from './util.js';
import { rr, txt, shardIcon } from './gfx.js';
import { UPGRADES } from './shop-data.js';
import { SHOP, upNext, upTry, upUse } from './shop.js';
import { beep } from './audio.js';

const GOLD = '#ffe27a', INK = '#1d1606', W = 384, SHEET_H = 420;   // 시트 높이: 화면 아래에 붙고, 낮은 화면에서도 미리보기는 가리지 않는다
const CHARGE = .9;     // 강화하기를 누른 뒤 결과가 나오기까지(초)
const SHOW = 1.6;      // 결과 띠가 보이는 시간(초)

/** 창 상태: 트랙 · 진행 중인 강화(run) · 마지막 결과(res) · 흔들림 · 시트 안 입자 · 짧은 안내(msg) */
const U = { k: null, run: null, res: null, shake: 0, fx: [], last: 0, msg: null, open: 0 };

export const upgradeOpen = () => !!U.k;
export function openUpgrade(k) { Object.assign(U, { k, run: null, res: null, shake: 0, fx: [], last: G.T, msg: null, open: G.T }); beep(620, .06); }
export function closeUpgrade() { U.k = null; }

/* ---------- 배치: 그리기와 탭 판정이 같이 쓴다 ---------- */
function layout() {
  const y = Math.max(188, V.VH - 12 - SHEET_H), x = V.VW / 2 - W / 2, h = V.VH - 12 - y, ix = x + 16, iw = W - 32;
  const n = UPGRADES[U.k].levels.length, step = iw / n;
  return {
    x, y, w: W, h, ix, iw, n, step,
    close: { x: x + W - 50, y: y + 14, w: 34, h: 34 },
    node: i => ({ x: ix + step * (i + .5), y: y + 104 }),
    card: { x: ix, y: y + 150, w: iw, h: 80 },
    act: { x: ix, y: y + 242, w: iw },
    btn: { x: ix, y: y + 324, w: iw, h: 46 }   // 아래 끝이 음소거 버튼의 터치 영역(오른쪽 아래 58)에 닿지 않게
  };
}
const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function nodeAt(L, x, y) {
  for (let i = 0; i < L.n; i++) { const p = L.node(i); if (Math.abs(x - p.x) < L.step / 2 && Math.abs(y - p.y) < 28) return i; }
  return null;
}
/** 지금 강화하기 버튼이 보이는가: 적용 단계가 최고 단계이고 더 오를 단계가 있을 때 */
function canShowTry() { const s = SHOP.up[U.k]; return s.use === s.max && !!upNext(U.k); }
const say = (s, c) => { U.msg = { s, c: c || GOLD, t: G.T }; };

/* ---------- 입력 ---------- */
/** 시트가 열려 있을 때 상점의 탭은 전부 여기로 온다 */
export function upgradeTap(x, y) {
  if (U.run) return;   // 강화 연출 중에는 입력을 받지 않는다
  const L = layout();
  if (inRect(L.close, x, y) || y < L.y) { closeUpgrade(); beep(380, .05); return; }   // 닫기 · 시트 바깥(미리보기 쪽)
  const s = SHOP.up[U.k], lv = nodeAt(L, x, y);
  if (lv != null) {
    if (lv > s.max) { say('아직 잠긴 단계야', '#ff9a8a'); beep(190, .06, 'square', .05); return; }
    if (upUse(U.k, lv)) { say('Lv ' + lv + ' 적용'); beep(520 + lv * 45, .06); }
    return;
  }
  if (canShowTry() && inRect(L.btn, x, y)) {
    if (SHOP.shards < upNext(U.k).cost) { say('별 조각이 모자라', '#ff9a8a'); beep(190, .06, 'square', .05); return; }
    U.run = { t0: G.T, tick: -1 }; U.res = null; beep(440, .06);
  }
}

/* ---------- 진행 ---------- */
function step() {
  const dt = clamp(G.T - U.last, 0, .05); U.last = G.T;
  if (U.run) {
    const k = (G.T - U.run.t0) / CHARGE, tick = Math.floor(k * 6);
    if (tick > U.run.tick && tick < 6) { U.run.tick = tick; beep(480 + tick * 95, .045, 'triangle', .05); }   // 차오르는 틱
    if (k >= 1) finish();
  }
  if (U.shake > 0) U.shake = Math.max(0, U.shake - dt);
  for (let i = U.fx.length - 1; i >= 0; i--) {
    const p = U.fx[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2.2; p.vy = p.vy * (1 - dt * 2.2) + 90 * dt;
    if (p.t > p.l) U.fx.splice(i, 1);
  }
}
/** 충전이 끝났다: 굴려서 결과를 낸다 */
function finish() {
  const nx = upNext(U.k), r = upTry(U.k); U.run = null;
  if (r === 'ok') {
    U.res = { ok: true, lv: nx.lv, cost: nx.cost, t: G.T };
    const p = layout().node(nx.lv);
    for (let i = 0; i < 34; i++) { const a = rnd(0, TAU), v = rnd(60, 260); U.fx.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, l: rnd(.5, 1.1), c: Math.random() < .35 ? '#fff' : GOLD, s: rnd(1.5, 3.2) }); }
    beep(880, .1); beep(1320, .2);
  } else if (r === 'fail') {
    U.res = { ok: false, lv: nx.lv, cost: nx.cost, t: G.T }; U.shake = .42;
    beep(170, .3, 'sawtooth', .07);
  }
}

/* ---------- 그리기 ---------- */
export function drawUpgrade() {
  step();
  const L = layout(), T = G.T, track = UPGRADES[U.k], LV = track.levels, s = SHOP.up[U.k], nx = upNext(U.k);
  const rise = clamp((T - U.open) / .18, 0, 1), oy = (1 - rise) * (1 - rise) * 60;   // 열릴 때 아래에서 올라온다
  // 뒤를 어둡게 (미리보기는 보이도록 시트 바로 위부터)
  const dim = g.createLinearGradient(0, L.y - 30, 0, L.y + 10); dim.addColorStop(0, 'rgba(3,4,12,0)'); dim.addColorStop(1, 'rgba(3,4,12,' + .6 * rise + ')');
  g.fillStyle = dim; g.fillRect(0, L.y - 30, V.VW, V.VH - L.y + 30);
  g.save(); g.translate(U.shake > 0 ? Math.sin(T * 70) * 7 * (U.shake / .42) : 0, oy);
  drawSheet(L);
  drawHeader(L, track, s);
  drawTrack(L, LV, s, T);
  drawCard(L, LV, s, T);
  drawAct(L, LV, s, nx, T);
  drawFx();
  drawResult(L, LV, T);
  g.restore();
}

function drawSheet(L) {
  const bg = g.createLinearGradient(0, L.y, 0, L.y + L.h); bg.addColorStop(0, '#191d40'); bg.addColorStop(1, '#0c0e22');
  rr(L.x, L.y, L.w, L.h + 40, 22); g.fillStyle = bg; g.fill();
  g.save(); g.clip();
  const sh = g.createRadialGradient(L.x + L.w / 2, L.y, 10, L.x + L.w / 2, L.y, L.w * .7); sh.addColorStop(0, 'rgba(255,226,122,.10)'); sh.addColorStop(1, 'rgba(255,226,122,0)');   // 위쪽에서 비치는 금빛
  g.fillStyle = sh; g.fillRect(L.x, L.y, L.w, 200); g.restore();
  rr(L.x, L.y, L.w, L.h + 40, 22); g.strokeStyle = 'rgba(255,226,122,.32)'; g.lineWidth = 1.2; g.stroke();
  rr(L.x + L.w / 2 - 18, L.y + 8, 36, 4, 2); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();   // 손잡이
}

function drawHeader(L, track, s) {
  txt(track.n + ' 강화', L.x + 20, L.y + 40, 19, '#fff', 'left', 900);
  txt('적용 Lv ' + s.use + '  ·  최고 Lv ' + s.max + ' / ' + (L.n - 1), L.x + 20, L.y + 59, 11.5, 'rgba(255,255,255,.5)', 'left', 600);
  const c = L.close, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 5, cy - 5); g.lineTo(cx + 5, cy + 5); g.moveTo(cx + 5, cy - 5); g.lineTo(cx - 5, cy + 5); g.stroke();
  if (U.msg && G.T - U.msg.t < 1.3) { g.globalAlpha = clamp((1.3 - (G.T - U.msg.t)) / .3, 0, 1); txt(U.msg.s, c.x - 10, L.y + 59, 11.5, U.msg.c, 'right', 800); g.globalAlpha = 1; }
}

/** 단계 노드 줄: 도달한 단계는 단계가 높을수록 더 강하게 빛나고, 다음 단계는 점선으로 맥동한다 */
function drawTrack(L, LV, s, T) {
  const top = L.n - 1, run = U.run ? clamp((T - U.run.t0) / CHARGE, 0, 1) : 0;
  for (let i = 0; i < top; i++) { // 잇는 선
    const a = L.node(i), b = L.node(i + 1), x0 = a.x + 12, x1 = b.x - 12;
    if (x1 <= x0) continue;
    if (i + 1 <= s.max) { g.strokeStyle = 'rgba(255,226,122,.75)'; g.lineWidth = 2.5; g.setLineDash([]); }
    else if (i + 1 === s.max + 1) { g.strokeStyle = 'rgba(255,226,122,' + (.3 + .5 * run) + ')'; g.lineWidth = 2; g.setLineDash([3, 3]); }
    else { g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 2; g.setLineDash([]); }
    g.beginPath(); g.moveTo(x0, a.y); g.lineTo(x1, a.y); g.stroke();
  }
  g.setLineDash([]);
  for (let i = 0; i <= top; i++) {
    const p = L.node(i), k = i / top, reached = i <= s.max, next = i === s.max + 1, used = i === s.use;
    const pop = U.res && U.res.ok && U.res.lv === i ? Math.max(0, 1 - (T - U.res.t) / .35) : 0, r = 10.5 * (1 + .35 * pop + (next ? .14 * run : 0));
    g.save();
    if (reached) {
      g.shadowColor = 'hsla(46,100%,62%,' + (.35 + .6 * k) + ')'; g.shadowBlur = 3 + 16 * k;
      const gr = g.createRadialGradient(p.x - r * .3, p.y - r * .3, 1, p.x, p.y, r);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.55, 'hsl(46,100%,' + (82 - 14 * k) + '%)'); gr.addColorStop(1, 'hsl(' + (46 - 10 * k) + ',100%,' + (58 - 8 * k) + '%)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
    } else {
      g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
      g.strokeStyle = next ? 'rgba(255,226,122,' + (.45 + .35 * Math.sin(T * 5)) + ')' : 'rgba(255,255,255,.16)'; g.lineWidth = 1.4;
      if (next) g.setLineDash([3, 2.6]);
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke(); g.setLineDash([]);
      if (next && run > 0) { g.strokeStyle = GOLD; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(p.x, p.y, r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * run); g.stroke(); }
      if (!next) { g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, TAU); g.fill(); }
      else txt('+', p.x, p.y + 4.5, 13, 'rgba(255,226,122,.85)', 'center', 900);
    }
    g.restore();
    if (used) { // 적용 중: 흰 고리와 위쪽 꼬리표
      g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.beginPath(); g.arc(p.x, p.y, r + 4.5, 0, TAU); g.stroke();
      rr(p.x - 15, p.y - 37, 30, 15, 7.5); g.fillStyle = GOLD; g.fill();
      txt('적용', p.x, p.y - 26, 9.5, INK, 'center', 900);
    }
    txt(String(i), p.x, p.y + 29, 11, used ? GOLD : reached ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.28)', 'center', used ? 900 : 700);
  }
}

/** 적용 중인 단계의 값: 이름 · 평소/비행 번짐 · 후광 */
function drawCard(L, LV, s, T) {
  const C = L.card, lv = LV[s.use], top = LV[LV.length - 1];
  rr(C.x, C.y, C.w, C.h, 14); g.fillStyle = 'rgba(255,255,255,.045)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.stroke();
  txt('Lv', C.x + 16, C.y + 24, 12, 'rgba(255,255,255,.5)', 'left', 800);
  txt(String(s.use), C.x + 16, C.y + 57, 32, '#fff', 'left', 900);
  txt(lv.n, C.x + 16, C.y + 72, 11, GOLD, 'left', 700);
  const bx = C.x + 128, bw = C.w - 128 - 58, row = (y, label, v, mx, val) => {
    txt(label, bx, y + 4, 11, 'rgba(255,255,255,.55)', 'left', 600);
    rr(bx + 34, y - 3, bw - 34, 7, 3.5); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
    if (v > 0) { rr(bx + 34, y - 3, Math.max(7, (bw - 34) * v / mx), 7, 3.5); const gr = g.createLinearGradient(bx + 34, 0, bx + bw, 0); gr.addColorStop(0, 'rgba(255,226,122,.55)'); gr.addColorStop(1, GOLD); g.fillStyle = gr; g.fill(); }
    txt(val, C.x + C.w - 14, y + 4, 12, v > 0 ? '#fff' : 'rgba(255,255,255,.35)', 'right', 800);
  };
  row(C.y + 20, '평소', lv.blur[0], top.blur[0], String(lv.blur[0]));
  row(C.y + 41, '비행', lv.blur[1], top.blur[1], String(lv.blur[1]));
  row(C.y + 62, '후광', lv.aura, top.aura, !lv.aura ? '없음' : lv.aura < 1 ? '약' : lv.aura < 1.2 ? '중' : '강');
}

/** 아래 칸: 강화 정보와 버튼. 적용 단계가 최고 단계가 아니면 안내만, 최고 단계를 다 올렸으면 달성 표시 */
function drawAct(L, LV, s, nx, T) {
  const A = L.act, cx = A.x + A.w / 2;
  if (!nx) { // 최고 단계 달성
    for (let i = 0; i < 5; i++) { const a = T * .8 + i / 5 * TAU, rx = cx + Math.cos(a) * 92, ry = A.y + 46 + Math.sin(a) * 18; star(rx, ry, 3 + 1.5 * Math.sin(T * 4 + i), .5 + .5 * Math.sin(T * 3 + i)); }
    txt('최대 강화 달성', cx, A.y + 52, 18, GOLD, 'center', 900);
    txt('단계를 눌러 원하는 밝기로 적용할 수 있어', cx, A.y + 78, 11.5, 'rgba(255,255,255,.5)', 'center', 600);
    return;
  }
  if (s.use < s.max) { // 아래 단계를 적용 중
    txt('강화는 최고 단계에서만 할 수 있어', cx, A.y + 48, 14, 'rgba(255,255,255,.85)', 'center', 800);
    txt('최고 단계(Lv ' + s.max + ')를 누르면 적용되고 강화하기 버튼이 나온다', cx, A.y + 72, 11.5, 'rgba(255,255,255,.5)', 'center', 600);
    return;
  }
  const p = nx.p, poor = SHOP.shards < nx.cost, pc = 'hsl(' + Math.round(10 + 110 * p) + ',90%,64%)';
  txt('다음 단계', A.x, A.y + 12, 11.5, 'rgba(255,255,255,.5)', 'left', 600);
  txt('Lv ' + s.max + '  →  Lv ' + nx.lv + '  ' + LV[nx.lv].n, A.x + A.w, A.y + 12, 13, '#fff', 'right', 800);
  txt('성공 확률', A.x, A.y + 38, 12.5, 'rgba(255,255,255,.8)', 'left', 700);
  txt(Math.round(p * 100) + '%', A.x + A.w, A.y + 40, 20, pc, 'right', 900);
  rr(A.x, A.y + 47, A.w, 6, 3); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
  rr(A.x, A.y + 47, Math.max(6, A.w * p), 6, 3); g.fillStyle = pc; g.fill();
  txt('비용', A.x, A.y + 70, 12.5, 'rgba(255,255,255,.8)', 'left', 700);
  txt('보유 ' + SHOP.shards, A.x + 34, A.y + 70, 11, 'rgba(255,255,255,.4)', 'left', 600);
  txt(String(nx.cost), A.x + A.w, A.y + 72, 18, poor ? '#ff8a7a' : GOLD, 'right', 900);
  g.font = '900 18px ' + FONT; const cw = g.measureText(String(nx.cost)).width; shardIcon(A.x + A.w - cw - 12, A.y + 66, 6.5);
  drawTryBtn(L.btn, poor, T);
  txt('실패해도 단계는 내려가지 않고 별 조각만 사라진다', cx, L.btn.y + L.btn.h + 19, 10.5, 'rgba(255,255,255,.38)', 'center', 600);
}
function star(x, y, r, a) {
  g.save(); g.globalAlpha *= a; g.fillStyle = GOLD; g.beginPath();
  for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, rr2 = i % 2 ? r * .35 : r; g.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); }
  g.closePath(); g.fill(); g.restore();
}
/** 강화하기 버튼. 누른 뒤에는 충전 막대로 바뀐다 */
function drawTryBtn(B, poor, T) {
  if (U.run) {
    const k = clamp((T - U.run.t0) / CHARGE, 0, 1);
    rr(B.x, B.y, B.w, B.h, 14); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
    g.save(); rr(B.x, B.y, B.w, B.h, 14); g.clip();
    const gr = g.createLinearGradient(B.x, 0, B.x + B.w, 0); gr.addColorStop(0, '#ffb84a'); gr.addColorStop(1, GOLD);
    g.fillStyle = gr; g.fillRect(B.x, B.y, B.w * k, B.h); g.restore();
    txt('강화 중…', B.x + B.w / 2, B.y + 30, 16, k > .5 ? INK : '#fff', 'center', 900);
    return;
  }
  rr(B.x, B.y, B.w, B.h, 14);
  if (poor) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.stroke(); txt('별 조각이 모자라', B.x + B.w / 2, B.y + 30, 15, 'rgba(255,255,255,.4)', 'center', 800); return; }
  const gr = g.createLinearGradient(0, B.y, 0, B.y + B.h); gr.addColorStop(0, '#ffeaa0'); gr.addColorStop(1, '#ffc94a');
  g.fillStyle = gr; g.fill();
  g.save(); rr(B.x, B.y, B.w, B.h, 14); g.clip();   // 지나가는 반짝임
  const sx = B.x - 80 + ((T * .6) % 1.6) / 1.6 * (B.w + 160), sh = g.createLinearGradient(sx - 40, 0, sx + 40, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.45)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(B.x, B.y, B.w, B.h); g.restore();
  txt('강화하기', B.x + B.w / 2, B.y + 31, 17, INK, 'center', 900);
}

function drawFx() {
  if (!U.fx.length) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of U.fx) { g.globalAlpha = 1 - p.t / p.l; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, TAU); g.fill(); }
  g.restore();
}

/** 결과 띠: 성공은 금빛으로 튀어 오르고, 실패는 붉게 흔들린다 */
function drawResult(L, LV, T) {
  const R = U.res; if (!R) return;
  const e = T - R.t; if (e > SHOW) return;
  const a = clamp((SHOW - e) / .35, 0, 1), sc = 1 + .22 * Math.max(0, 1 - e / .22), cx = L.x + L.w / 2, cy = L.card.y + L.card.h / 2;
  g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(sc, sc);
  rr(-130, -30, 260, 60, 18); g.fillStyle = R.ok ? 'rgba(40,32,8,.94)' : 'rgba(44,12,14,.94)'; g.fill();
  g.strokeStyle = R.ok ? GOLD : '#ff7a6a'; g.lineWidth = 1.6; g.stroke();
  if (R.ok) { txt('강화 성공!', 0, -2, 20, GOLD, 'center', 900); txt('Lv ' + R.lv + ' ' + LV[R.lv].n + ' 적용', 0, 18, 11.5, 'rgba(255,255,255,.75)', 'center', 700); }
  else { txt('강화 실패', 0, -2, 20, '#ff8a7a', 'center', 900); txt('별 조각 ' + R.cost + ' 소모 · 단계는 그대로', 0, 18, 11.5, 'rgba(255,255,255,.65)', 'center', 700); }
  g.restore();
}
