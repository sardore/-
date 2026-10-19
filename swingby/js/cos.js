/* 장착한 꾸밈(이펙트·도색·기체 장식)을 실제 그리기·연출이 쓰는 값으로 풀어 준다.
 * 게임 로직은 건드리지 않는다. 장착 정보는 shop.js 의 SHOP.eq, 상품 정의는 shop-data.js, 기체별 장식은 decor.js. */
import { G } from './state.js';
import { SHIPS } from './ships.js';
import { ITEMS, GLOW_BLUR } from './shop-data.js';
import { SHOP } from './shop.js';
import { DECOR } from './decor.js';
import { drawShip, SHIP_SC } from './ship-art.js';

/** 장착 맵(eq)과 기체로 꾸밈 설정을 만든다. 상점 미리보기는 장착 맵에 고른 상품을 얹어 부른다 */
export function cfgFor(eq, shipId) {
  const v = slot => { const it = ITEMS[eq[slot]]; return it ? it.v : null; };
  const dc = DECOR[shipId] && eq['decor_' + shipId] ? DECOR[shipId] : null;   // 장착한 전용 장식이 있을 때만
  const tStyle = v('trail') || (dc && dc.trail) || null, tCol = v('trailcol');   // 꼬리: 모양(별가루·분신)과 색(페인트)을 한 값으로 합친다
  return {
    paint: v('hull'), glow: v('glow') ? v('glow').lv : 0, glowcol: v('glowcol') || (dc && dc.glowcol) || null,
    flame: v('flame') || (dc && dc.flame) || null, trail: tStyle || tCol ? Object.assign({}, tCol, tStyle) : null,
    landshape: v('landshape'), charge: v('charge'), chargecol: v('chargecol'), heat: v('heat'), starfx: v('starfx'), decor: dc
  };
}

let cache = null, cacheKey = '';
/** 지금 판의 꾸밈 설정 (장착이 바뀌거나 기체가 바뀔 때만 다시 만든다) */
export function cfg() {
  const key = SHOP.ver + G.shipId;
  if (key !== cacheKey) { cache = cfgFor(SHOP.eq, G.shipId); cacheKey = key; }
  return cache;
}

/* ---------- 색 ----------
 * 색 값 sp: {h,s} · {rb:1} · {duo:[[h,s],[h,s]]} · 색 없음(null/모양만 있는 값 → 기본 색상 base).
 * 다색(duo)은 한 부위에 두 색이 함께 있다: 색 A 가 차지하는 비중 duoW(T)가 천천히 오르내리고(.2~.8), 두 색 사이는 부드럽게 이어진다. */
export const isDuo = sp => !!(sp && sp.duo);
/** 다색에서 색 A 의 비중 (0.2~0.8: 어느 한쪽이 사라지지 않는다) */
export const duoW = T => .5 + .3 * Math.sin(T * .9);
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
/** 위치 u(0~1)의 색 {h,s}. 다색에서 u < 비중이면 색 A 쪽, 아니면 색 B 쪽(경계는 부드럽게). u 를 안 주면 무작위(입자용) */
export function colorAt(sp, base, T, u) {
  if (!sp) return { h: base, s: 100 };
  if (sp.rb) return { h: (T * 90) % 360, s: 100 };
  if (sp.duo) {
    const w = duoW(T), t = smooth(((u == null ? Math.random() : u) - (w - .16)) / .32), A = sp.duo[0], B = sp.duo[1];
    let dh = B[0] - A[0]; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    return { h: (A[0] + dh * t + 360) % 360, s: A[1] + (B[1] - A[1]) * t };
  }
  return { h: sp.h == null ? base : sp.h, s: sp.s != null ? sp.s : 100 };
}
/** 두 번에 나눠 그릴 때 i(0|1)번째 칠의 순수한 색 (다색이 아니면 그대로) */
export const pass = (sp, i) => isDuo(sp) ? { h: sp.duo[i][0], s: sp.duo[i][1] } : sp;
export const hueOf = (sp, base, T, u) => colorAt(sp, base, T, u).h;
export const satOf = (sp, T, u) => colorAt(sp, 0, T || 0, u).s;
/** 색 값 sp(없으면 기본 색상 base)로 hsl/hsla 문자열. a 를 주면 hsla. u: 다색에서의 위치(없으면 무작위) */
export function hslOf(sp, base, T, l, a, u) {
  const c = colorAt(sp, base, T, u);
  return 'hsl' + (a != null ? 'a' : '') + '(' + c.h + ',' + c.s + '%,' + l + '%' + (a != null ? ',' + a : '') + ')';
}

/* ---------- 기체 ---------- */
const painted = {};
/** 도색을 입힌 기체 정의 (도색이 없으면 원본). i: 다색의 몇 번째 칠인지(0|1). 흰색 등 채도는 L.hs 로 */
export function paintDef(def, c, i = 0, T = G.T) {
  if (!c.paint) return def;
  const col = isDuo(c.paint) ? pass(c.paint, i) : colorAt(c.paint, def.L.h, T);
  const h = c.paint.rb ? Math.round(col.h / 15) * 15 % 360 : col.h, hs = Math.min(1, col.s / 100), k = def.id + '|' + h + '|' + hs;
  return painted[k] || (painted[k] = Object.assign({}, def, { L: Object.assign({}, def.L, { h, hs }) }));
}
export const shipDef = () => paintDef(SHIPS[G.shipId], cfg());
export const shipHue = () => shipDef().L.h;

/** drawShip 에 넘기는 꾸밈 옵션: 엔진 불꽃 색과 기체 장식 그림 (i: 다색의 몇 번째 칠) */
export function shipOpts(c, def, T, i = 0) {
  const o = {};
  if (c.flame) { const f = colorAt(pass(c.flame, i), 0, T); o.fh = f.h; o.fs = f.s; }
  if (c.decor) o.art = c.decor.art;
  if (G.ops && !G.ops.bay) o.nobay = true;   // 블랙쉽: 승계한 기체는 수송 구획이 없다
  return o;
}

/** 기체 글로우: 평소/비행 번짐 크기와 색. 4단계(0 = 기본, 약함) */
export function glowOf(c, def, flying, T, i = 0) {
  const lv = c.glow;
  return { blur: GLOW_BLUR[lv][flying ? 1 : 0], col: hslOf(pass(c.glowcol, i), def.L.h, T, 75), aura: lv >= 3 };
}

/** 다색의 '부드러운 경계': drawFn(ctx) 이 그리는 것을 (0,0) 둘레의 따로 만든 판에 그린 뒤, 경계가 번지는 그라데이션 마스크로 깎아서 얹는다.
 * 마스크는 색 A 쪽(+방향)이 1, 색 B 쪽이 0 이다. 경계선은 비중(duoW)에 따라 오가고, 방향도 천천히 흔들려서 일자로 갈라져 보이지 않는다.
 * ext 는 그릴 것의 반지름(국소 단위). 지금 g 의 변환(위치·회전·확대)을 그대로 따른다 */
let layer = null, lctx = null;
function drawSoft(g, ext, T, drawFn) {
  const m = g.getTransform(), k0 = Math.hypot(m.a, m.b) || 1, R = ext * 1.9 + 40;
  let S = Math.ceil(R * 2 * k0), k = k0; if (S > 640) { k = k0 * 640 / S; S = 640; }
  if (!layer) { layer = document.createElement('canvas'); lctx = layer.getContext('2d'); }
  if (layer.width !== S) layer.width = layer.height = S; else lctx.clearRect(0, 0, S, S);
  lctx.save(); lctx.setTransform(k, 0, 0, k, S / 2, S / 2);
  drawFn(lctx);
  lctx.shadowBlur = 0; lctx.shadowColor = 'transparent'; lctx.globalCompositeOperation = 'destination-in';
  const th = .55 + .45 * Math.sin(T * .7) + .15 * Math.sin(T * 2.3), dx = Math.cos(th), dy = Math.sin(th), c = ext * (1 - 2 * duoW(T)), soft = ext * .6;
  const gr = lctx.createLinearGradient((c - soft) * dx, (c - soft) * dy, (c + soft) * dx, (c + soft) * dy);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000');
  lctx.fillStyle = gr; lctx.fillRect(-R, -R, R * 2, R * 2);
  lctx.restore();
  g.drawImage(layer, -S / 2 / k, -S / 2 / k, S / k, S / k);
}
/** 다색 그리기: 색 B 를 먼저 그리고, 그 위에 색 A 를 부드러운 경계로 덧씌운다 (drawFn(ctx, i): i 번째 칠로 ctx 에 그린다) */
export function drawDuo(g, ext, T, drawFn) { drawFn(g, 1); drawSoft(g, ext, T, ctx => drawFn(ctx, 0)); }

/** 기체를 그린다 (이미 기체 위치로 옮기고 회전한 좌표계에서). 기체·글로우·불꽃 중 다색이 있으면 두 번 칠해 경계를 섞는다 (앞쪽이 색 A).
 * o = { flame, sc, flying, blur: 글로우에 더할 번짐, aura(col): 후광을 그리는 함수 } */
export function drawShipCos(g, base, c, T, o) {
  const duo = isDuo(c.paint) || isDuo(c.glowcol) || isDuo(c.flame);
  const one = (ctx, i) => {
    const def = paintDef(base, c, i, T), opts = shipOpts(c, def, T, i), gl = glowOf(c, def, o.flying, T, i);
    ctx.save(); ctx.shadowColor = gl.col; ctx.shadowBlur = gl.blur + (o.blur || 0);
    drawShip(ctx, def, o.flame, T, o.sc, opts); ctx.restore();
  };
  if (!duo) {
    const def = paintDef(base, c, 0, T), gl = glowOf(c, def, o.flying, T, 0);
    if (gl.aura && o.aura) o.aura(gl.col);
    one(g, 0); return;
  }
  const def0 = paintDef(base, c, 0, T), gl0 = glowOf(c, def0, o.flying, T, 0);
  if (gl0.aura && o.aura) o.aura(isDuo(c.glowcol) ? hslOf(c.glowcol, def0.L.h, T, 75, undefined, duoW(T)) : gl0.col);   // 후광은 두 색이 섞인 색 하나로
  drawDuo(g, 11 * SHIP_SC[base.t] * o.sc, T, one);
}

/** 비행 중 기체 장식 입자를 뿜는다 (out: 입자 배열) */
export function emitDecor(c, x, y, vx, vy, dt, k, out) {
  if (!c.decor || !c.decor.emit) return;
  const m = Math.hypot(vx, vy) || 1;
  c.decor.emit({ x, y, bx: -vx / m, by: -vy / m, dt, k, out });
}

/* ---------- 열기·별 색 ---------- */
export const heatHsl = (l, a, u) => hslOf(cfg().heat, shipHue(), G.T, l, a, u);
export const starHsl = (l, a) => cfg().starfx ? hslOf(cfg().starfx, 46, G.T, l, a) : null;   // 다색이면 부를 때마다 두 색 중 하나(비중대로)
