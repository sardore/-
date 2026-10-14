/* 적 함선 보스 전용 공격 패턴의 존 구성 (boss-zones.js 의 uniqueZones 가 모르는 패턴이면 여기로 온다).
 * 존 모양은 boss-zones.js 와 같다: c 원 · w 부채꼴 · b 띠 · o 도넛. 좌표는 예고 때 정해지고 rel/vert 인 것만 보스·아레나를 따라간다 */
import { G } from './state.js';
import { PI, rnd, clamp } from './util.js';

/** 보스에서 점 p 를 겨누는 각도(아래쪽 부채꼴 안) */
const aim = (b, p) => clamp(Math.atan2(p.y - b.y, p.x - b.x), .55, PI - .55);
const spread = (list, n) => list.slice().sort(() => Math.random() - .5).slice(0, n);
/** 서로 min 이상 떨어진 행성만 n 개 고른다 */
function apart(list, n, min, key) {
  const out = [];
  for (const p of spread(list, list.length)) { if (out.length < n && out.every(q => Math.abs(q[key] - p[key]) > min)) out.push(p); }
  return out;
}

/** 무단 투하: 비워 두는 안전한 세로 길(행성 두 곳 위)과, 그 밖에서 쓰레기가 떨어질 x 들 */
export function dumpLanes(pl, fk) {
  const ps = apart(pl, 2, 110 * fk, 'x').sort((a, b) => a.x - b.x), gaps = [], xs = [];
  for (const p of ps) { const hw = Math.max(62 * fk, p.R + 30 * fk); gaps.push([clamp(p.x - hw, 0, G.w), clamp(p.x + hw, 0, G.w)]); }
  const step = 36 * fk;
  for (let x = step / 2; x < G.w; x += step) {
    if (gaps.some(gp => x > gp[0] - 14 * fk && x < gp[1] + 14 * fk)) continue;
    xs.push(x + rnd(-9, 9) * fk); if (Math.random() < .4) xs.push(x + rnd(-9, 9) * fk);   // 일부 길에는 한 조각 더
  }
  return { gaps, xs };
}

export function opsZones(k, b, pl, tg, fk, K, ymin, ymax) {
  const zs = [];
  switch (k) {
    case 'sniper': { // 저격: 가는 광선이 한 행성을, 곧이어 다른 행성을 꿰뚫는다
      const ps = [tg, ...spread(pl.filter(p => p !== tg), 1)];
      ps.forEach((p, i) => zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: aim(b, p), half: .075, len: 950 * K, delay: i * .55, fuse: 1.15, blast: .55 }));
      break;
    }
    case 'lockon': { // 일제 사격: 행성 서넛에 작은 포격이 차례로 떨어진다
      const n = Math.min(pl.length, 3 + (b.phase > 0 ? 1 : 0)), r = 34 * fk;
      spread(pl, n).forEach((p, i) => zs.push({ shape: 'c', x: p.x, y: p.y, r, delay: i * .2, fuse: .85, blast: .25, fade: .6 }));
      break;
    }
    case 'railgun': { // 레일건: 한 행성의 세로 줄을 위에서 아래까지 가르고, 곧이어 다른 줄도 가른다
      const ps = [tg, ...apart(pl.filter(p => p !== tg), 1, 90 * fk, 'x')];
      ps.forEach((p, i) => zs.push({ shape: 'b', vert: true, x: p.x, w: 22 * fk, delay: i * .5, fuse: 1.2, blast: .45 }));
      break;
    }
    case 'scissor': { // 교차 탐조: 바깥으로 벌어진 두 줄기가 먼저, 이어서 안쪽으로 엇갈리는 두 줄기
      const o = .72 + rnd(-.08, .08), i2 = .28 + rnd(-.06, .06);
      for (const sg of [-1, 1]) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: PI / 2 + sg * o, half: .1, len: 950 * K, fuse: 1.05, blast: .5 });
      for (const sg of [-1, 1]) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: PI / 2 + sg * i2, half: .1, len: 950 * K, delay: .75, fuse: .85, blast: .5 });
      break;
    }
    case 'mines': { // 기뢰: 행성을 피해 흩뿌린 기뢰가 한동안 남는다
      const r = 25 * fk;
      for (let tr = 0, n = 0; n < 6 && tr < 120; tr++) {
        const x = rnd(r * 1.6, G.w - r * 1.6), y = rnd(ymin, ymax);
        if (G.planets.every(p => Math.hypot(p.x - x, p.y - y) > p.R + r + 26 * fk) && zs.every(z => Math.hypot(z.x - x, z.y - y) > r * 3)) { zs.push({ shape: 'c', x, y, r, delay: n * .12, fuse: .75, blast: 2.4, fade: 1 }); n++; }
      }
      break;
    }
    case 'curtain': { // 차단막: 행성 둘의 높이를 가로로 막되, 그 행성 둘레만 열어 둔다
      for (const p of apart(pl, 2, 80 * K, 'y')) {
        const hw = Math.max(58 * fk, p.R + 28 * fk), l = p.x - hw, r = p.x + hw;
        if (l > 6) zs.push({ shape: 'b', x: l / 2, y: p.y, w: l / 2, hh: 17 * fk, fuse: 1.1, blast: .5 });
        if (r < G.w - 6) zs.push({ shape: 'b', x: (r + G.w) / 2, y: p.y, w: (G.w - r) / 2, hh: 17 * fk, fuse: 1.1, blast: .5 });
      }
      break;
    }
    case 'vform': { // 편대 급습: 보스에서 V 자로 퍼지는 작은 폭격이 차례로 내리꽂힌다
      const r = 29 * fk;
      for (let i = 0; i < 5; i++) for (const sg of i ? [-1, 1] : [1]) {
        const x = clamp(b.x + sg * i * 52 * fk, r, G.w - r) - b.x;
        zs.push({ shape: 'c', rel: true, x, y: (96 + i * 56) * K, r, delay: i * .17, fuse: .7, blast: .25, fade: .6 });
      }
      break;
    }
  }
  return zs;
}
