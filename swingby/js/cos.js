/* 장착한 꾸밈(이펙트·도색·기체 장식)을 실제 그리기·연출이 쓰는 값으로 풀어 준다.
 * 게임 로직은 건드리지 않는다. 장착 정보는 shop.js 의 SHOP.eq, 상품 정의는 shop-data.js, 기체별 장식은 decor.js. */
import { G } from './state.js';
import { SHIPS } from './ships.js';
import { ITEMS, GLOW_BLUR } from './shop-data.js';
import { SHOP } from './shop.js';
import { DECOR } from './decor.js';

/** 장착 맵(eq)과 기체로 꾸밈 설정을 만든다. 상점 미리보기는 장착 맵에 고른 상품을 얹어 부른다 */
export function cfgFor(eq, shipId) {
  const v = slot => { const it = ITEMS[eq[slot]]; return it ? it.v : null; };
  const dc = DECOR[shipId] && eq['decor_' + shipId] ? DECOR[shipId] : null;   // 장착한 전용 장식이 있을 때만
  return {
    paint: v('paint'), glow: v('glow') ? v('glow').lv : 0, glowcol: v('glowcol') || (dc && dc.glowcol) || null,
    flame: v('flame') || (dc && dc.flame) || null, trail: v('trail') || (dc && dc.trail) || null,
    land: v('land'), heat: v('heat'), starfx: v('starfx'), decor: dc
  };
}

let cache = null, cacheKey = '';
/** 지금 판의 꾸밈 설정 (장착이 바뀌거나 기체가 바뀔 때만 다시 만든다) */
export function cfg() {
  const key = SHOP.ver + G.shipId;
  if (key !== cacheKey) { cache = cfgFor(SHOP.eq, G.shipId); cacheKey = key; }
  return cache;
}

/* ---------- 색 ---------- */
export const hueOf = (sp, base, T) => !sp ? base : sp.rb ? (T * 90) % 360 : sp.h == null ? base : sp.h;
export const satOf = sp => sp && sp.s != null ? sp.s : 100;
/** 색 값 sp(없으면 기본 색상 base)로 hsl/hsla 문자열. a 를 주면 hsla */
export const hslOf = (sp, base, T, l, a) => 'hsl' + (a != null ? 'a' : '') + '(' + hueOf(sp, base, T) + ',' + satOf(sp) + '%,' + l + '%' + (a != null ? ',' + a : '') + ')';

/* ---------- 기체 ---------- */
const painted = {};
/** 도색을 입힌 기체 정의 (도색이 없으면 원본) */
export function paintDef(def, c) {
  if (!c.paint) return def;
  const k = def.id + c.paint.h;
  return painted[k] || (painted[k] = Object.assign({}, def, { L: Object.assign({}, def.L, { h: c.paint.h }) }));
}
export const shipDef = () => paintDef(SHIPS[G.shipId], cfg());
export const shipHue = () => shipDef().L.h;

/** drawShip 에 넘기는 꾸밈 옵션: 엔진 불꽃 색과 기체 장식 그림 */
export function shipOpts(c, def, T) {
  const o = {};
  if (c.flame) { o.fh = hueOf(c.flame, 0, T); o.fs = satOf(c.flame); }
  if (c.decor) o.art = c.decor.art;
  return o;
}

/** 기체 글로우: 평소/비행 번짐 크기와 색. 4단계(0 = 기본, 약함) */
export function glowOf(c, def, flying, T) {
  const lv = c.glow;
  return { blur: GLOW_BLUR[lv][flying ? 1 : 0], col: hslOf(c.glowcol, def.L.h, T, 75), aura: lv >= 3 };
}

/** 비행 중 기체 장식 입자를 뿜는다 (out: 입자 배열) */
export function emitDecor(c, x, y, vx, vy, dt, k, out) {
  if (!c.decor || !c.decor.emit) return;
  const m = Math.hypot(vx, vy) || 1;
  c.decor.emit({ x, y, bx: -vx / m, by: -vy / m, dt, k, out });
}

/* ---------- 열기·착지·별 색 ---------- */
export const heatHsl = (l, a) => hslOf(cfg().heat, shipHue(), G.T, l, a);
export const landHsl = (l, a, fallbackH) => hslOf(cfg().land, fallbackH, G.T, l, a);
export const starHsl = (l, a) => cfg().starfx ? hslOf(cfg().starfx, 46, G.T, l, a) : null;
