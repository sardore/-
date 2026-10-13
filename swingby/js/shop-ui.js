/* 별 조각 상점 화면과 시작·사망 화면의 상점 버튼. 상품·가격은 shop-data.js, 저장·구매 규칙은 shop.js.
 * 위쪽 미리보기에서 고른 상품을 실제 기체에 입혀 보여 주고, 아래 목록에서 고른 뒤 막대의 버튼으로 구매·장착한다. */
import { G, V, g } from './state.js';
import { TAU, rnd, clamp } from './util.js';
import { SHIPS } from './ships.js';
import { drawShip, SHIP_SC } from './ship-art.js';
import { rr, txt } from './gfx.js';
import { TABS, SLOTS, LIST, ITEMS, GLOW_BLUR, SPEC_STATS, SPEC_STEP, SPEC_PRICE } from './shop-data.js';
import { SHOP, priceOf, owned, equipped, specLv, buy, equip, unequip } from './shop.js';
import { cfgFor, paintDef, shipOpts, glowOf, hslOf, emitDecor } from './cos.js';
import { DECOR } from './decor.js';
import { drawTrail2, drawFxLayers2 } from './draw-fx2.js';
import { drawAura } from './draw-world.js';
import { stepParts } from './fx.js';
import { startRun } from './progress.js';
import { beep } from './audio.js';

const PW = 372, ROW = 52, ROW_SPEC = 58, HEAD = 40, GOLD = '#ffe27a';

/** 화면 상태: 탭 · 스크롤 · 고른 상품 · 안내 문구 · 드래그 중인 손가락 · 미리보기용 입자 */
const P = { tab: 'fx', scroll: 0, sel: null, msg: '', msgT: 0, d: null, parts: [], fxr: [], last: 0, nextRing: 0, nextStar: 0, starOff: 0 };

/* ---------- 열기·닫기 ---------- */
export function openShop() { Object.assign(P, { tab: 'fx', scroll: 0, sel: null, msg: '', d: null, parts: [], fxr: [], last: G.T, nextRing: 0, nextStar: 0 }); G.st = 'shop'; beep(520, .08); }
/** 디버그/테스트: 상점을 열고 그 상품을 골라 미리보기 한다 */
export function previewItem(id) { const it = ITEMS[id]; if (!it) return; openShop(); P.tab = it.tab; P.sel = id; }
/** 닫으면 시작화면으로: 새 판을 만들어 구매한 초기 스펙을 반영한다 */
export function closeShop() { startRun(); G.st = 'title'; beep(380, .08); }

/* ---------- 배치 ---------- */
function layout() {
  const x = V.VW / 2 - PW / 2, listTop = 238, listBot = V.VH - 112;
  return {
    x, back: { x, y: 12, w: 84, h: 30 }, prev: { x, y: 50, w: PW, h: 140 }, tabY: 198, tabW: PW / TABS.length,
    list: { x, y: listTop, w: PW, h: Math.max(60, listBot - listTop) }, bar: { x, y: V.VH - 106, w: PW, h: 46 }
  };
}
const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** 현재 탭의 목록: 칸 머리글과 상품 행을 위에서부터 쌓는다 */
function rows() {
  const out = []; let y = 0;
  const push = (r, h) => { r.y = y; r.h = h; y += h; out.push(r); };
  if (P.tab === 'spec') {
    push({ head: '시작 능력치 (영구)', note: '단계당 +' + SPEC_STEP + '%p, 최대 +' + SPEC_STEP * SPEC_PRICE.length + '%p · 점수 배율은 일부러 뺐다' }, HEAD);
    LIST.filter(it => it.tab === 'spec').forEach(it => push({ it }, ROW_SPEC));
  } else for (const sl of SLOTS) {
    if (sl.tab !== P.tab) continue;
    push({ head: sl.n, note: sl.note }, HEAD);
    LIST.filter(it => it.slot === sl.k).forEach(it => push({ it }, ROW));
  }
  return { out, total: y + 8 };
}
const maxScroll = () => Math.max(0, rows().total - layout().list.h);

/* ---------- 입력 ---------- */
export function shopDown(x, y) { P.d = { x, y, s0: P.scroll, moved: false }; }
export function shopMove(y) {
  const d = P.d; if (!d) return;
  if (Math.abs(y - d.y) > 8) d.moved = true;
  if (d.moved && inRect(layout().list, d.x, d.y)) P.scroll = clamp(d.s0 - (y - d.y), 0, maxScroll());
}
export const shopWheel = dy => { P.scroll = clamp(P.scroll + dy * .6, 0, maxScroll()); };
/** 손가락을 뗐다: 거의 움직이지 않았으면 탭으로 처리 (x 가 없으면 취소) */
export function shopUp(x, y) {
  const d = P.d; P.d = null;
  if (!d || x == null || d.moved) return;
  const L = layout();
  if (inRect(L.back, x, y)) { closeShop(); return; }
  if (y >= L.tabY && y <= L.tabY + 30 && x >= L.x && x <= L.x + PW) { const t = TABS[Math.min(TABS.length - 1, Math.floor((x - L.x) / L.tabW))]; if (t.k !== P.tab) { P.tab = t.k; P.scroll = 0; P.sel = null; beep(480, .05); } return; }
  if (inRect(barBtn(L), x, y)) { act(); return; }
  if (inRect(L.list, x, y)) {
    const ly = y - L.list.y + P.scroll, r = rows().out.find(q => q.it && ly >= q.y && ly < q.y + q.h);
    if (r) { P.sel = r.it.id; beep(640, .04); }
  }
}
const barBtn = L => ({ x: L.bar.x + L.bar.w - 118, y: L.bar.y + 6, w: 110, h: 34 });

/** 막대의 버튼 상태: 라벨과 누를 수 있는지 */
function barState(it) {
  if (!it) return null;
  const p = priceOf(it);
  if (it.spec) return p == null ? { label: '최대', ok: false } : { label: '강화 ◆ ' + p, ok: SHOP.shards >= p };
  if (!owned(it)) return { label: '구매 ◆ ' + p, ok: SHOP.shards >= p };
  return equipped(it) ? { label: '해제', ok: true } : { label: '장착', ok: true };
}
function act() {
  const it = ITEMS[P.sel]; if (!it) return;
  const st = barState(it), say = s => { P.msg = s; P.msgT = 1.6; };
  if (!st || !st.ok && (it.spec || !owned(it))) { say(st && st.label === '최대' ? '이미 최대야' : '별 조각이 부족해'); beep(160, .1, 'sawtooth', .06); return; }
  if (it.spec || !owned(it)) { if (buy(it) === 'ok') { say('구매 완료'); beep(880, .1); beep(1180, .12); } return; }
  if (equipped(it)) { unequip(it); say('해제했어'); } else { equip(it); say('장착됨'); }
  beep(700, .06);
}

/* ---------- 그리기 ---------- */
const shard = (x, y, r) => { // 별 조각 아이콘
  g.fillStyle = GOLD; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .72, y - r * .15); g.lineTo(x + r * .4, y + r); g.lineTo(x - r * .4, y + r); g.lineTo(x - r * .72, y - r * .15); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .72, y - r * .15); g.lineTo(x, y + r * .1); g.closePath(); g.fill();
};
export function drawShop() {
  const { VW, VH } = V, L = layout();
  g.fillStyle = 'rgba(5,6,15,.82)'; g.fillRect(0, 0, VW, VH);
  rr(L.back.x, L.back.y, L.back.w, L.back.h, 15); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
  txt('◀ 돌아가기', L.back.x + L.back.w / 2, L.back.y + 20, 12, '#fff', 'center', 700);
  txt('별 조각 상점', VW / 2 + 22, 34, 17, '#fff', 'center', 900);
  shard(L.x + PW - txt0(String(SHOP.shards), L.x + PW, 34, 15) - 14, 29, 7);
  drawPreview(L.prev);
  TABS.forEach((t, i) => { // 탭
    const x = L.x + i * L.tabW, on = t.k === P.tab;
    rr(x + 2, L.tabY, L.tabW - 4, 30, 9); g.fillStyle = on ? 'rgba(255,226,122,.16)' : 'rgba(255,255,255,.05)'; g.fill(); g.strokeStyle = on ? GOLD : 'rgba(255,255,255,.18)'; g.lineWidth = on ? 1.6 : 1; g.stroke();
    txt(t.n, x + L.tabW / 2, L.tabY + 20, 13, on ? GOLD : 'rgba(255,255,255,.7)', 'center', 800);
  });
  drawList(L);
  drawBar(L);
}
/** 오른쪽 정렬 글자를 그리고 그 너비를 돌려준다 */
function txt0(s, x, y, size) { g.font = '900 ' + size + 'px system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif'; const w = g.measureText(s).width; txt(s, x, y, size, GOLD, 'right', 900); return w; }

function drawList(L) {
  const { out, total } = rows(), R = L.list;
  P.scroll = clamp(P.scroll, 0, Math.max(0, total - R.h));
  g.save(); g.beginPath(); g.rect(R.x - 4, R.y, R.w + 8, R.h); g.clip(); g.translate(R.x, R.y - P.scroll);
  for (const r of out) {
    if (r.y + r.h < P.scroll || r.y > P.scroll + R.h) continue;
    if (r.head) { txt(r.head, 2, r.y + 20, 14, '#fff', 'left', 800); txt(r.note, 2, r.y + 34, 10, 'rgba(255,255,255,.45)', 'left', 500); continue; }
    drawRow(r);
  }
  g.restore();
  if (total > R.h) { // 스크롤 표시
    const th = Math.max(24, R.h * R.h / total), ty = R.y + (R.h - th) * P.scroll / (total - R.h);
    rr(R.x + R.w + 3, ty, 3, th, 1.5); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
  }
}

function drawRow(r) {
  const it = r.it, on = P.sel === it.id, own = owned(it), eqp = !it.spec && equipped(it), h = r.h - 4;
  rr(0, r.y, PW, h, 11); g.fillStyle = on ? 'rgba(255,226,122,.12)' : 'rgba(255,255,255,.05)'; g.fill();
  g.strokeStyle = on ? GOLD : eqp ? 'rgba(125,255,170,.55)' : 'rgba(255,255,255,.12)'; g.lineWidth = on ? 1.8 : 1; g.stroke();
  swatch(it, 26, r.y + h / 2);
  txt(it.n, 52, r.y + (it.d ? 22 : 29), 14, own && !it.spec ? '#fff' : 'rgba(255,255,255,.92)', 'left', 800);
  if (it.d) txt(it.d, 52, r.y + 38, 10.5, 'rgba(255,255,255,.55)', 'left', 500);
  if (it.spec) { // 단계 점과 다음 가격
    const mx = it.spec === 'shield' ? 1 : SPEC_PRICE.length, lv = specLv(it.spec);
    for (let i = 0; i < mx; i++) { g.fillStyle = i < lv ? it.c : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(PW - 100 + i * 12 + (mx === 1 ? 24 : 0), r.y + 20, 4, 0, TAU); g.fill(); }
    const p = priceOf(it); txt(p == null ? 'MAX' : '◆ ' + p, PW - 12, r.y + 42, 12, p == null ? '#7dffaa' : SHOP.shards >= p ? GOLD : '#ff9a8a', 'right', 800);
    return;
  }
  if (eqp) txt('장착중', PW - 12, r.y + h / 2 + 5, 12, '#7dffaa', 'right', 800);
  else if (own) txt('보유', PW - 12, r.y + h / 2 + 5, 12, 'rgba(255,255,255,.55)', 'right', 700);
  else txt('◆ ' + it.price, PW - 12, r.y + h / 2 + 5, 13, SHOP.shards >= it.price ? GOLD : '#ff9a8a', 'right', 800);
}

/** 상품 아이콘: 색은 색 방울, 글로우는 번지는 빛, 장식은 작은 기체 */
function swatch(it, x, y) {
  const v = it.v || {};
  g.save();
  if (it.slot === 'glow') { g.shadowColor = '#9fd8ff'; g.shadowBlur = GLOW_BLUR[v.lv][1] * .8; g.fillStyle = '#e6f6ff'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
  else if (it.ship) { g.translate(x, y); g.rotate(-.6); drawShip(g, SHIPS[it.ship], .8, G.T, .5, { art: DECOR[it.ship].art }); }
  else if (v.style) { g.strokeStyle = '#d8ecff'; g.lineWidth = 1.2; for (const [dx, dy] of v.style === 'dust' ? [[-7, 4], [1, -5], [8, 3]] : [[-8, 0], [-2, 0], [4, 0]]) { g.globalAlpha = v.style === 'ghost' ? .4 + (dx + 8) / 24 : 1; g.beginPath(); g.moveTo(x + dx - 3, y + dy); g.lineTo(x + dx + 3, y + dy); g.moveTo(x + dx, y + dy - 3); g.lineTo(x + dx, y + dy + 3); g.stroke(); } }
  else if (v.rb) { const gr = g.createLinearGradient(x - 11, y - 11, x + 11, y + 11); ['#ff6a6a', '#ffd24a', '#6aff9a', '#6ac8ff', '#c08aff'].forEach((c, i) => gr.addColorStop(i / 4, c)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  else if (v.h != null) { g.fillStyle = hslOf(v, 0, 0, 62); g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.stroke(); }
  else if (it.spec) { g.fillStyle = it.c; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
  g.restore();
}

/** 아래 막대: 고른 상품의 이름과 버튼, 안내 문구 */
function drawBar(L) {
  const B = L.bar, it = ITEMS[P.sel], st = barState(it);
  rr(B.x, B.y, B.w, B.h, 12); g.fillStyle = 'rgba(18,20,44,.96)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.stroke();
  if (P.msgT > 0) { P.msgT -= 1 / 60; txt(P.msg, B.x + 14, B.y + 28, 14, GOLD, 'left', 800); }
  else if (it) { txt(it.n, B.x + 14, B.y + 20, 14, '#fff', 'left', 800); txt(it.d || '미리보기 중', B.x + 14, B.y + 36, 10.5, 'rgba(255,255,255,.55)', 'left', 500); }
  else txt('상품을 눌러 미리보기', B.x + 14, B.y + 28, 13, 'rgba(255,255,255,.55)', 'left', 600);
  if (!st) return;
  const b = barBtn(L), on = st.ok;
  rr(b.x, b.y, b.w, b.h, 10); g.fillStyle = on ? 'rgba(255,226,122,.2)' : 'rgba(255,255,255,.06)'; g.fill(); g.strokeStyle = on ? GOLD : 'rgba(255,255,255,.2)'; g.lineWidth = 1.6; g.stroke();
  txt(st.label, b.x + b.w / 2, b.y + 22, 14, on ? GOLD : 'rgba(255,255,255,.4)', 'center', 800);
}

/* ---------- 미리보기: 행성을 도는 기체에 장착(+고른) 상품을 입혀 보여 준다 ---------- */
function drawPreview(R) {
  rr(R.x, R.y, R.w, R.h, 14); g.fillStyle = 'rgba(12,14,34,.95)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.stroke();
  const sel = ITEMS[P.sel];
  if (P.tab === 'spec') { drawSpecSummary(R); return; }
  const eq = Object.assign({}, SHOP.eq); if (sel && !sel.spec) eq[sel.slot] = sel.id;
  const id = sel && sel.ship ? sel.ship : 'gal', c = cfgFor(eq, id), def = paintDef(SHIPS[id], c), T = G.T;
  const dt = clamp(T - P.last, 0, .05); P.last = T;
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2 + 2, rad = 42, a = T * 2.4, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, vx = -Math.sin(a) * 100, vy = Math.cos(a) * 100, ps = 1.9 / SHIP_SC[def.t];   // ps: 어느 기체든 길이가 비슷하게 보이는 크기
  g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
  const pg = g.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 15); pg.addColorStop(0, '#7fb0ff'); pg.addColorStop(1, '#2a3a8a'); g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.stroke();
  // 이벤트: 착지 링(행성), 별 먹기(오른쪽 위)
  if (T >= P.nextRing) { P.nextRing = T + 2.2; const col = c.land ? hslOf(c.land, 200, T, 72, .95) : 'rgba(150,200,255,.8)'; P.fxr.push({ x: cx, y: cy, c: col, r0: 14, r1: 62, t: 0, dur: .7, w: 4 }); if (c.land) P.fxr.push({ x: cx, y: cy, c: '#fff', r0: 14, r1: 44, t: 0, dur: .4, w: 2 }); }
  const sx = cx + 104, sy = cy - 36;
  if (T >= P.nextStar) {
    P.nextStar = T + 1.8; P.starOff = T + .5; const col = c.starfx ? hslOf(c.starfx, 46, T, 70) : GOLD;
    for (let i = 0; i < 9; i++) { const an = rnd(0, TAU), v = rnd(40, 110); P.parts.push({ x: sx, y: sy, vx: Math.cos(an) * v, vy: Math.sin(an) * v, t: 0, l: rnd(.3, .7), c: col, s: 3 }); }
    P.fxr.push({ x: sx, y: sy, c: col, r0: 3, r1: 24, t: 0, dur: .35, w: 2 });
  }
  if (T > P.starOff) { g.fillStyle = GOLD; g.beginPath(); g.arc(sx, sy, 4 + Math.sin(T * 5), 0, TAU); g.fill(); }
  // 꼬리
  const tr = []; for (let i = 16; i >= 0; i--) { const aa = a - i * .07; tr.push(cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad); }
  drawTrail2({ trail: tr, mode: 'free', boost: 1, heat: 0 }, def, c.trail);
  const heading = a + Math.PI / 2, o = shipOpts(c, def, T), gl = glowOf(c, def, true, T);
  if (c.trail && c.trail.style === 'ghost') for (let i = 4; i >= 1; i--) { const aa = a - i * .2; g.save(); g.translate(cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad); g.rotate(aa + Math.PI / 2); g.globalAlpha = .45 - i * .09; g.shadowColor = gl.col; g.shadowBlur = 8; drawShip(g, def, 1, T, ps, o); g.restore(); }
  emitDecor(c, x, y, vx, vy, dt, 1.2, P.parts);
  if (c.heat && Math.random() < dt * 80) P.parts.push({ x: x - Math.cos(heading) * 8, y: y - Math.sin(heading) * 8, vx: -vx * .2 + rnd(-30, 30), vy: -vy * .2 + rnd(-30, 30), t: 0, l: rnd(.3, .5), c: hslOf(c.heat, def.L.h, T, rnd(55, 78)), s: rnd(3, 5) });
  stepParts(P.parts, dt); for (let i = P.fxr.length - 1; i >= 0; i--) { P.fxr[i].t += dt; if (P.fxr[i].t > P.fxr[i].dur) P.fxr.splice(i, 1); }
  g.save(); g.translate(x, y); g.rotate(heading);
  if (gl.aura) drawAura(gl.col, T, 30);
  g.shadowColor = gl.col; g.shadowBlur = gl.blur; drawShip(g, def, 1, T, ps, o); g.restore();
  drawFxLayers2(P.fxr, P.parts);
  g.restore();
  txt('미리보기 · ' + SHIPS[id].n, R.x + 12, R.y + 20, 11, 'rgba(255,255,255,.5)', 'left', 600);
  if (sel && !sel.spec) txt(owned(sel) ? (equipped(sel) ? '장착중' : '보유') : '◆ ' + sel.price, R.x + R.w - 12, R.y + 20, 12, equipped(sel) ? '#7dffaa' : GOLD, 'right', 800);
}

/** 초기 스펙 탭: 지금 단계의 요약 */
function drawSpecSummary(R) {
  txt('다음 판 시작 능력치', R.x + 14, R.y + 24, 13, '#fff', 'left', 800);
  const rowsS = SPEC_STATS.concat([{ k: 'shield', n: '추진기', c: '#ff9d7a' }]);
  rowsS.forEach((s, i) => {
    const y = R.y + 48 + i * 18, lv = specLv(s.k), mx = s.k === 'shield' ? 1 : SPEC_PRICE.length;
    txt(s.n, R.x + 14, y, 12, s.c, 'left', 700);
    for (let j = 0; j < mx; j++) { g.fillStyle = j < lv ? s.c : 'rgba(255,255,255,.15)'; rr(R.x + 80 + j * 28, y - 9, 24, 8, 3); g.fill(); }
    txt(s.k === 'shield' ? '+' + lv : '+' + lv * SPEC_STEP + '%p', R.x + R.w - 14, y, 12, lv ? '#fff' : 'rgba(255,255,255,.4)', 'right', 700);
  });
}

/* ---------- 시작·사망 화면의 버튼 ---------- */
/** 시작화면 왼쪽 위 아이콘 메뉴 (앞으로 도감·기록 같은 메뉴를 같은 줄에 더 놓을 수 있다) */
const MENU = [{ k: 'shop', n: '상점' }];
const menuRect = i => ({ x: V.OX + 14 + i * 56, y: 14, w: 46, h: 46 });
export function drawTitleMenu() {
  MENU.forEach((m, i) => {
    const r = menuRect(i);
    rr(r.x, r.y, r.w, r.h, 12); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = 'rgba(255,226,122,.55)'; g.lineWidth = 1.4; g.stroke();
    shard(r.x + r.w / 2, r.y + r.h / 2 - 1, 11);
    txt(m.n, r.x + r.w / 2, r.y + r.h + 13, 11, 'rgba(255,255,255,.7)', 'center', 700);
  });
  const w = txt0(String(SHOP.shards), V.OX + 420 - 14, 38, 15); shard(V.OX + 420 - 14 - w - 12, 33, 7);   // 보유 별 조각
}
export function titleMenuHit(x, y) { const i = MENU.findIndex((m, j) => inRect(menuRect(j), x, y)); return i < 0 ? null : MENU[i].k; }

const deadBtn = () => ({ x: V.VW / 2 - 70, y: V.VH - 156, w: 140, h: 38 });
export function drawDeadShopBtn() {
  const r = deadBtn();
  rr(r.x, r.y, r.w, r.h, 12); g.fillStyle = 'rgba(255,226,122,.14)'; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 1.5; g.stroke();
  shard(r.x + 24, r.y + r.h / 2, 8); txt('별 조각 상점', r.x + r.w / 2 + 10, r.y + 24, 14, GOLD, 'center', 800);
}
export const deadShopHit = (x, y) => inRect(deadBtn(), x, y);
