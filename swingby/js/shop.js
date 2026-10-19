/* 별 조각 상점의 저장 상태와 규칙: 보유 별 조각·구매·장착·초기 스펙 단계, 판이 끝날 때의 정산.
 * 그리기는 shop-ui.js, 장착한 이펙트를 실제로 쓰는 쪽은 cos.js. */
import { G } from './state.js';
import { load, save } from './util.js';
import { ITEMS, SPEC_STEP, SPEC_PRICE, SHIELD_PRICE, SHARD_RATE, LEGACY_REFUND, LEGACY_PAINT, PAINT_TARGETS } from './shop-data.js';

const KEY = 'swingby_shop', KEY_SHARDS = 'swingby_shards';

/** 저장되는 상태. own 보유 상품 · eq 칸별 장착 상품 · spec 초기 스펙 단계(shield 는 0/1). ver 는 바뀔 때마다 오른다(캐시 무효화) */
export const SHOP = { shards: 0, own: {}, eq: {}, spec: {}, ver: 0 };

(function restore() {
  SHOP.shards = Math.max(0, Math.floor(+load(KEY_SHARDS, 0) || 0));
  let o; try { o = JSON.parse(load(KEY, '{}')) || {}; } catch (e) { o = {}; }
  let refund = 0, dirty = false;
  for (const id of o.own || []) {
    if (ITEMS[id]) SHOP.own[id] = 1;
    else if (LEGACY_PAINT[id]) { SHOP.own[LEGACY_PAINT[id]] = 1; dirty = true; }   // 예전 기체 도색 → 같은 색 페인트
    else if (LEGACY_REFUND[id]) refund += LEGACY_REFUND[id];                       // 없어진 부품별 색 상품 → 별 조각으로
  }
  if (refund) SHOP.shards += refund;
  for (const slot in o.eq || {}) {
    const sl = slot === 'paint' ? 'hull' : slot, id = slot === 'paint' ? LEGACY_PAINT[o.eq[slot]] || o.eq[slot] : o.eq[slot], it = ITEMS[id];
    if (it && SHOP.own[it.id] && (it.slot === sl || (it.slot === 'pt' && PAINT_TARGETS.some(t => t.k === sl)))) SHOP.eq[sl] = it.id;
  }
  for (const k in o.spec || {}) SHOP.spec[k] = Math.max(0, Math.min(k === 'shield' ? 1 : SPEC_PRICE.length, o.spec[k] | 0));
  if (refund || dirty) persist();   // 초기 스펙까지 불러온 뒤에 저장한다
})();

function persist() {
  SHOP.ver++;
  save(KEY, JSON.stringify({ own: Object.keys(SHOP.own), eq: SHOP.eq, spec: SHOP.spec }));
  save(KEY_SHARDS, SHOP.shards);
}

export const specLv = k => SHOP.spec[k] || 0;
const specMax = k => k === 'shield' ? 1 : SPEC_PRICE.length;
/** 지금 사야 하는 가격 (초기 스펙은 다음 단계 가격, 다 올렸으면 null) */
export function priceOf(it) {
  if (!it.spec) return it.price;
  const lv = specLv(it.spec); if (lv >= specMax(it.spec)) return null;
  return it.spec === 'shield' ? SHIELD_PRICE : SPEC_PRICE[lv];
}
export const owned = it => it.spec ? specLv(it.spec) >= specMax(it.spec) : !!SHOP.own[it.id];
/** 페인트는 부위(target)마다 따로 칠한다: 그 부위에 칠해져 있는지. 다른 상품은 자기 칸에 장착돼 있는지 */
export const equipped = (it, target) => it.slot === 'pt' ? SHOP.eq[target] === it.id : SHOP.eq[it.slot] === it.id;
/** 이 페인트가 칠해진 부위들 */
export const paintedOn = it => PAINT_TARGETS.filter(t => SHOP.eq[t.k] === it.id).map(t => t.k);

/** 구매. 결과: 'ok' · 'poor'(별 조각 부족) · 'have'(이미 보유/최대) */
export function buy(it, target) {
  const p = priceOf(it);
  if (p == null || (!it.spec && SHOP.own[it.id])) return 'have';
  if (SHOP.shards < p) return 'poor';
  SHOP.shards -= p;
  if (it.spec) SHOP.spec[it.spec] = specLv(it.spec) + 1;
  else { SHOP.own[it.id] = 1; SHOP.eq[it.slot === 'pt' ? target || 'hull' : it.slot] = it.id; }   // 산 상품은 바로 장착 (페인트는 고른 부위에)
  persist(); return 'ok';
}
export function equip(it, target) { if (!SHOP.own[it.id]) return; SHOP.eq[it.slot === 'pt' ? target : it.slot] = it.id; persist(); }
export function unequip(it, target) { delete SHOP.eq[it.slot === 'pt' ? target : it.slot]; persist(); }

/** 판이 끝났다(사망·클리어): 이번 판 별 점수(배율·체인 반영 후)의 2/10(SHARD_RATE)을 별 조각으로 저장한다. 같은 판에서 두 번 불러도 중복 지급하지 않는다.
 * 디버그판은 저장하지 않는다. TON 618 을 쓰러뜨린 뒤(무한 모드)에도 계속 쌓인다. 이번에 얻은 개수를 돌려준다 */
export function settleRun() {
  if (G.debug || G.tuto) return 0;
  const gain = Math.max(0, Math.floor(G.starScore * SHARD_RATE) - G.starPaid);
  if (!gain) return 0;
  G.starPaid += gain; G.shardGain += gain; SHOP.shards += gain; persist();
  return gain;
}

/** 별 조각을 직접 지급한다 (튜토리얼 보상) */
export function grantShards(n) { SHOP.shards += n; persist(); }

/** 새 판의 시작 능력치에 영구 초기 스펙을 얹는다 (디버그판 제외) */
export function applyStartSpecs(stats) {
  for (const k in SHOP.spec) if (k === 'shield') stats.shield += SHOP.spec[k]; else stats[k] += SPEC_STEP * SHOP.spec[k];
}

/** 별 조각을 쓴다(블랙쉽 티켓 같은 내부 결제용). 모자라면 false */
export function spendShards(n) {
  if (SHOP.shards < n) return false;
  SHOP.shards -= n; persist(); return true;
}
