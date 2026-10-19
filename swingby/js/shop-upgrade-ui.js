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

const GOLD = '#ffe27a', INK = '#1d1606', W = 384, SHEET_H = 336;   // 시트는 화면 아래에 붙어 미리보기를 가리지 않는다
const CHARGE = .9;     // 강화하기를 누른 뒤 결과가 나오기까지(초)
const SHOW = 1.6;      // 결과 띠가 보이는 시간(초)

/** 창 상태: 트랙 · 진행 중인 강화(run) · 마지막 결과(res) · 흔들림 · 시트 안 입자 · 짧은 안내(msg) */
const U = { k: null, run: null, res: null, shake: 0, fx: [], last: 0, msg: null, open: 0 };

export const upgradeOpen = () => !!U.k;
export function openUpgrade(k) { Object.assign(U, { k, run: null, res: null, shake: 0, fx: [], last: G.T, msg: null, open: G.T }); beep(620, .06); }
export function closeUpgrade() { U.k = null; }

/* ---------- 배치: 그리기와 탭 판정이 같이 쓴다 ---------- */
function layout() {
  const y = Math.max(188, V.VH - 12 - SHEET_H), x = V.VW / 2 - W / 2, ix = x + 18, iw = W - 36, n = UPGRADES[U.k].levels.length, step = iw / n;
  return {
    x, y, w: W, h: V.VH - 12 - y, ix, iw, n, step, close: { x: x + W - 52, y: y + 14, w: 36, h: 36 },
    node: i => ({ x: ix + step * (i + .5), y: y + 92 }),
    card: { x: ix, y: y + 140, w: iw, h: 76 },
    btn: { x: ix + 112, y: y + 236, w: iw - 112, h: 52 }
  };
}
const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function nodeAt(L, x, y) {
  for (let i = 0; i < L.n; i++) { const p = L.node(i); if (Math.abs(x - p.x) < L.step / 2 && Math.abs(y - p.y) < 26) return i; }
  return null;
}
/** 강화하기 버튼은 적용 단계가 최고 단계이고 더 오를 단계가 있을 때만 보인다 */
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
    if (lv > s.max) { say('잠김', '#ff9a8a'); beep(190, .06, 'square', .05); return; }
    if (upUse(U.k, lv)) { say('Lv ' + lv + ' 적용'); beep(520 + lv * 45, .06); }
    return;
  }
  if (canShowTry() && inRect(L.btn, x, y)) {
    if (SHOP.shards < upNext(U.k).cost) { say('별 조각 부족', '#ff9a8a'); beep(190, .06, 'square', .05); return; }
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
  const L = layout(), T = G.T, LV = UPGRADES[U.k].levels, s = SHOP.up[U.k], nx = upNext(U.k);
  const rise = clamp((T - U.open) / .18, 0, 1), oy = (1 - rise) * (1 - rise) * 60;
  const dim = g.createLinearGradient(0, L.y - 30, 0, L.y + 10); dim.addColorStop(0, 'rgba(3,4,12,0)'); dim.addColorStop(1, 'rgba(3,4,12,' + .6 * rise + ')');
  g.fillStyle = dim; g.fillRect(0, L.y - 30, V.VW, V.VH - L.y + 30);
  g.save(); g.translate(U.shake > 0 ? Math.sin(T * 70) * 7 * (U.shake / .42) : 0, oy);
  drawSheet(L); drawHeader(L, s); drawTrack(L, LV, s, T); drawCard(L, LV, s, T);
  if (canShowTry()) drawTry(L, nx, T);
  drawFx(); drawResult(L, LV, T);
  g.restore();
}

function drawSheet(L) {
  const bg = g.createLinearGradient(0, L.y, 0, L.y + L.h); bg.addColorStop(0, '#1a1e44'); bg.addColorStop(1, '#0b0d20');
  rr(L.x, L.y, L.w, L.h + 40, 24); g.fillStyle = bg; g.fill();
  g.save(); g.clip(); const sh = g.createRadialGradient(L.x + L.w / 2, L.y, 8, L.x + L.w / 2, L.y, L.w * .65); sh.addColorStop(0, 'rgba(255,226,122,.13)'); sh.addColorStop(1, 'rgba(255,226,122,0)');
  g.fillStyle = sh; g.fillRect(L.x, L.y, L.w, 190); g.restore();
  rr(L.x, L.y, L.w, L.h + 40, 24); g.strokeStyle = 'rgba(255,226,122,.3)'; g.lineWidth = 1.2; g.stroke();
  rr(L.x + L.w / 2 - 18, L.y + 8, 36, 4, 2); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();
}

function drawHeader(L, s) {
  txt('글로우 강화', L.x + 22, L.y + 42, 19, '#fff', 'left', 900);
  const c = L.close, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx, cy, 17, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 5, cy - 5); g.lineTo(cx + 5, cy + 5); g.moveTo(cx + 5, cy - 5); g.lineTo(cx - 5, cy + 5); g.stroke();
  if (U.msg && G.T - U.msg.t < 1.2) { g.globalAlpha = clamp((1.2 - (G.T - U.msg.t)) / .3, 0, 1); txt(U.msg.s, c.x - 12, L.y + 41, 13, U.msg.c, 'right', 800); g.globalAlpha = 1; }
}

/** 단계 노드 줄: 도달한 단계는 구슬로 빛나고(높을수록 강하게), 다음 단계는 점선, 적용 단계는 흰 고리 */
function drawTrack(L, LV, s, T) {
  const top = L.n - 1, run = U.run ? clamp((T - U.run.t0) / CHARGE, 0, 1) : 0;
  for (let i = 0; i < top; i++) {
    const a = L.node(i), b = L.node(i + 1); g.lineWidth = 2.5; g.lineCap = 'round';
    g.strokeStyle = i + 1 <= s.max ? 'rgba(255,226,122,.7)' : 'rgba(255,255,255,.09)';
    g.beginPath(); g.moveTo(a.x + 11, a.y); g.lineTo(b.x - 11, a.y); g.stroke();
  }
  for (let i = 0; i <= top; i++) {
    const p = L.node(i), k = i / top, reached = i <= s.max, next = i === s.max + 1, used = i === s.use;
    const pop = U.res && U.res.ok && U.res.lv === i ? Math.max(0, 1 - (T - U.res.t) / .35) : 0, r = 10 * (1 + .4 * pop);
    g.save();
    if (reached) {
      g.shadowColor = 'hsla(44,100%,62%,' + (.4 + .6 * k) + ')'; g.shadowBlur = 4 + 16 * k;
      const gr = g.createRadialGradient(p.x - r * .35, p.y - r * .35, 1, p.x, p.y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.5, 'hsl(46,100%,' + (80 - 12 * k) + '%)'); gr.addColorStop(1, 'hsl(' + (44 - 12 * k) + ',100%,' + (56 - 8 * k) + '%)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
    } else {
      g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
      g.strokeStyle = next ? 'rgba(255,226,122,' + (.5 + .35 * Math.sin(T * 5)) + ')' : 'rgba(255,255,255,.14)'; g.lineWidth = 1.4; if (next) g.setLineDash([3, 2.6]);
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke(); g.setLineDash([]);
      if (next && run > 0) { g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, r + 3.5, -Math.PI / 2, -Math.PI / 2 + TAU * run); g.stroke(); }
    }
    g.restore();
    if (used) { g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.beginPath(); g.arc(p.x, p.y, r + 5, 0, TAU); g.stroke(); }
    txt(String(i), p.x, p.y + 29, 11, used ? GOLD : reached ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.25)', 'center', used ? 900 : 700);
  }
}

/** 적용 단계 카드: 실제 글로우 세기를 보여 주는 구슬 · 단계 · 이름 · 번짐 막대 */
function drawCard(L, LV, s, T) {
  const C = L.card, lv = LV[s.use], top = LV[LV.length - 1], cy = C.y + C.h / 2;
  rr(C.x, C.y, C.w, C.h, 16); g.fillStyle = 'rgba(255,255,255,.045)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; g.stroke();
  const ox = C.x + 44, k = lv.blur[1] / top.blur[1];
  g.save(); g.beginPath(); g.rect(C.x, C.y, C.w, C.h); g.clip();
  const orb = g.createRadialGradient(ox, cy, 2, ox, cy, 16 + 22 * k + 3 * Math.sin(T * 3)); orb.addColorStop(0, 'rgba(255,240,170,' + (.45 + .5 * k) + ')'); orb.addColorStop(1, 'rgba(255,226,122,0)');
  g.fillStyle = orb; g.beginPath(); g.arc(ox, cy, 40, 0, TAU); g.fill();
  g.fillStyle = '#fff6cf'; g.beginPath(); g.arc(ox, cy, 7, 0, TAU); g.fill(); g.restore();
  txt('Lv ' + s.use, C.x + 92, cy - 2, 26, '#fff', 'left', 900); txt(lv.n, C.x + 92, cy + 19, 12, GOLD, 'left', 700);
  const bx = C.x + 236, bw = C.w - 236 - 16;
  rr(bx, cy - 4, bw, 8, 4); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
  rr(bx, cy - 4, Math.max(8, bw * k), 8, 4); const gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, 'rgba(255,226,122,.5)'); gr.addColorStop(1, GOLD); g.fillStyle = gr; g.fill();
  if (!upNext(U.k) && s.use === s.max) txt('MAX', C.x + C.w - 16, C.y + 22, 11, GOLD, 'right', 900);
}

/** 강화하기: 성공 확률 원형 게이지 + 비용 + 버튼. 누르면 버튼이 충전 막대로 바뀐다 */
function drawTry(L, nx, T) {
  const B = L.btn, poor = SHOP.shards < nx.cost, gx = L.ix + 40, gy = B.y + B.h / 2 - 8, R = 30, p = nx.p, pc = 'hsl(' + Math.round(8 + 112 * p) + ',90%,64%)';
  g.lineCap = 'round'; g.lineWidth = 6;
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.arc(gx, gy, R, 0, TAU); g.stroke();
  g.strokeStyle = pc; g.beginPath(); g.arc(gx, gy, R, -Math.PI / 2, -Math.PI / 2 + TAU * p); g.stroke();
  txt(Math.round(p * 100) + '%', gx, gy + 6, 17, '#fff', 'center', 900);
  g.font = '900 14px ' + FONT; const cw = g.measureText(String(nx.cost)).width;
  shardIcon(gx - cw / 2 - 7, gy + R + 19, 5.5); txt(String(nx.cost), gx + 6, gy + R + 24, 14, poor ? '#ff8a7a' : GOLD, 'center', 900);
  if (U.run) {
    const k = clamp((T - U.run.t0) / CHARGE, 0, 1);
    rr(B.x, B.y, B.w, B.h, 16); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
    g.save(); rr(B.x, B.y, B.w, B.h, 16); g.clip(); const gr = g.createLinearGradient(B.x, 0, B.x + B.w, 0); gr.addColorStop(0, '#ffb84a'); gr.addColorStop(1, GOLD);
    g.fillStyle = gr; g.fillRect(B.x, B.y, B.w * k, B.h); g.restore(); return;
  }
  rr(B.x, B.y, B.w, B.h, 16);
  if (poor) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.stroke(); txt('강화', B.x + B.w / 2, B.y + 33, 18, 'rgba(255,255,255,.35)', 'center', 900); return; }
  const gr = g.createLinearGradient(0, B.y, 0, B.y + B.h); gr.addColorStop(0, '#ffeaa0'); gr.addColorStop(1, '#ffc94a'); g.fillStyle = gr; g.fill();
  g.save(); rr(B.x, B.y, B.w, B.h, 16); g.clip(); const sx = B.x - 80 + ((T * .6) % 1.6) / 1.6 * (B.w + 160), sh = g.createLinearGradient(sx - 40, 0, sx + 40, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.45)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(B.x, B.y, B.w, B.h); g.restore();
  txt('강화', B.x + B.w / 2, B.y + 34, 20, INK, 'center', 900);
}

function drawFx() {
  if (!U.fx.length) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of U.fx) { g.globalAlpha = 1 - p.t / p.l; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, TAU); g.fill(); }
  g.restore();
}

/** 결과: 성공 금빛 / 실패 붉은 띠. 글자는 한 줄 */
function drawResult(L, LV, T) {
  const R = U.res; if (!R) return;
  const e = T - R.t; if (e > SHOW) return;
  const a = clamp((SHOW - e) / .35, 0, 1), sc = 1 + .2 * Math.max(0, 1 - e / .22), cx = L.x + L.w / 2, cy = L.card.y + L.card.h / 2;
  g.save(); g.globalAlpha = a; g.translate(cx, cy); g.scale(sc, sc);
  rr(-110, -24, 220, 48, 16); g.fillStyle = R.ok ? 'rgba(40,32,8,.95)' : 'rgba(44,12,14,.95)'; g.fill(); g.strokeStyle = R.ok ? GOLD : '#ff7a6a'; g.lineWidth = 1.6; g.stroke();
  txt(R.ok ? '성공  Lv ' + R.lv : '실패', 0, 7, 20, R.ok ? GOLD : '#ff8a7a', 'center', 900);
  g.restore();
}
