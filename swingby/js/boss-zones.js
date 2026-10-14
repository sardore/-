/* 고유 패턴이 쓰는 범용 존: 패턴별 존 구성(uniqueZones), 정의(z)를 지금 보스 위치에 맞춰 놓고(place), 존 안의 임의의 점을 뽑는다.
 * 모양: c 원(x,y,r) · w 부채꼴(x,y,a,half,len) · b 띠(x,y,w,hh: 가로·세로 반폭) · o 도넛(x,y,r1,r2) */
import { G } from './state.js';
import { PI, TAU, rnd, clamp, pickOf, shuffle } from './util.js';
import { arenaH } from './camera.js';
import { opsZones } from './ops-zones.js';

/** rel 이면 좌표가 보스 기준(보스와 함께 올라감), vert 이면 아레나 전체 높이를 덮는 세로 띠 */
export function place(z, b) {
  const o = Object.assign({}, z);
  if (z.rel) { o.x = b.x + z.x; o.y = b.y + z.y; }
  if (z.vert) { o.y = (G.arenaTop + G.arenaBot) / 2; o.hh = arenaH() * .7; }
  return o;
}

/** 존 안의 임의의 점 (파티클·불꽃 위치용) */
export function randIn(h) {
  if (h.shape === 'b') return { x: clamp(h.x + rnd(-h.w, h.w), 0, G.w), y: clamp(h.y + rnd(-h.hh, h.hh), G.arenaTop, G.arenaBot) };
  if (h.shape === 'o') { const a = rnd(0, TAU), r = rnd(h.r1, h.r2); return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }; }
  const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * (h.r || 0); return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r };
}

/** 보스마다 하나씩 가진 고유 패턴의 존 구성 (좌표는 예고 때 정해지고, rel/vert 인 것만 보스·아레나를 따라간다) */
export function uniqueZones(k, b, al, fk, K, ymin, ymax) {
  const pl = al.length ? al : G.planets, tg = G.ship.mode === 'orb' && Math.random() < .5 && !G.ship.p.dead ? G.ship.p : pickOf(pl);
  const zs = [];
  switch (k) {
    case 'cross': // 십자 섬광: 한 행성의 높이를 가로로, 그 x 를 세로로 가른다
      zs.push({ shape: 'b', x: G.w / 2, y: tg.y, w: G.w, hh: 21 * fk, fuse: 1.0, blast: .5 }, { shape: 'b', x: tg.x, vert: true, w: 21 * fk, fuse: 1.0, blast: .5 }); break;
    case 'spokes': { // 방사 광선: 보스에서 60° 간격 6줄기
      const a0 = rnd(0, TAU);
      for (let i = 0; i < 6; i++) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: a0 + i * PI / 3, half: .12, len: 950 * K, fuse: 1.15, blast: .9 }); break;
    }
    case 'spiral': { // 나선 폭발: 보스 둘레로 나선을 그리며 차례로 터진다
      const sg = Math.random() < .5 ? -1 : 1, r = 32 * fk;
      for (let i = 0; i < 7; i++) {
        const an = PI / 2 + sg * (i / 6 - .5) * PI * 1.25, d = (100 + i * 30) * K;
        zs.push({ shape: 'c', rel: true, x: clamp(b.x + Math.cos(an) * d, r, G.w - r) - b.x, y: Math.sin(an) * d, r, delay: i * .2, fuse: .7, blast: .25, fade: .6 });
      } break;
    }
    case 'twin': { // 쌍성 폭격: 한 행성과 그 좌우 대칭 자리가 동시에 터진다
      const dx = Math.max(Math.abs(tg.x - G.w / 2), 70 * fk), r = 62 * fk;
      zs.push({ shape: 'c', x: G.w / 2 - dx, y: tg.y, r, fuse: 1.0, blast: .35 }, { shape: 'c', x: G.w / 2 + dx, y: tg.y, r, fuse: 1.0, blast: .35 }); break;
    }
    case 'pool': { // 독 웅덩이: 행성 세 곳에 오래 남는 독
      const ps = pl.slice().sort(() => Math.random() - .5).slice(0, 3);
      for (const p of ps) zs.push({ shape: 'c', x: p.x, y: p.y, r: 48 * fk, fuse: .9, blast: 3.6, fade: 1.2 }); break;
    }
    case 'quake': { // 지축 균열: 행성 두 개의 높이를 따라 가로로 갈라진다
      const ps = pl.slice().sort(() => Math.random() - .5), a = ps[0], c = ps.find(p => Math.abs(p.y - a.y) > 70 * K);
      for (const p of c ? [a, c] : [a]) zs.push({ shape: 'b', x: G.w / 2, y: p.y, w: G.w, hh: 24 * fk, fuse: 1.1, blast: .5 }); break;
    }
    case 'pulse': // 맥동파: 보스에서 바깥으로 두 겹의 고리
      zs.push({ shape: 'o', rel: true, x: 0, y: 0, r1: 150 * K, r2: 205 * K, fuse: 1.0, blast: .4 }, { shape: 'o', rel: true, x: 0, y: 0, r1: 300 * K, r2: 355 * K, delay: .5, fuse: 1.0, blast: .4 }); break;
    case 'hex': { // 육각 결정: 한 행성을 여섯 개의 결정이 둘러싼다 (한가운데와 결정 사이 틈은 안전)
      const r = 36 * fk, d = 98 * fk, a0 = rnd(0, PI / 3);
      for (let i = 0; i < 6; i++) { const an = a0 + i * PI / 3; zs.push({ shape: 'c', x: clamp(tg.x + Math.cos(an) * d, r, G.w - r), y: tg.y + Math.sin(an) * d, r, delay: i * .07, fuse: .95, blast: .3 }); } break;
    }
    case 'nova': // 초신성: 보스 주위 거대한 폭발 — 아래쪽 멀리가 안전하다
      zs.push({ shape: 'c', rel: true, x: 0, y: 0, r: 310 * K, fuse: 2.2, blast: .55, fade: 1 }); break;
    case 'rain': { // 별똥비 (무한 모드 전용): 세로 기둥이 x 좌표가 가까운 것끼리 두세 묶음이 되어, 묶음마다 1.5초 간격으로 한꺼번에 내리꽂힌다(다음 묶음이 오기 전에 다른 구역으로 피해야 한다)
      const n = Math.max(5, Math.round(G.w / 70)), groups = n >= 8 ? 3 : 2, order = shuffle([...Array(groups).keys()]);
      for (let i = 0; i < n; i++) zs.push({ shape: 'b', vert: true, x: (i + .5) / n * G.w + rnd(-8, 8) * fk, w: 16 * fk, delay: order[Math.floor(i * groups / n)] * 1.5, fuse: .8, blast: .35 });
      break;
    }
    case 'ripple': // 공명파 (전용): 보스에서 퍼지는 세 겹의 고리가 차례로 터진다
      for (let i = 0; i < 3; i++) zs.push({ shape: 'o', rel: true, x: 0, y: 0, r1: (105 + i * 115) * K, r2: (160 + i * 115) * K, delay: i * .45, fuse: .9, blast: .35 });
      break;
    case 'grid': { // 격자망 (전용): 두 행성의 높이를 가로로, 다른 두 행성의 x 를 세로로 가른다
      const ps = pl.slice().sort(() => Math.random() - .5), hs = [], vs = [];
      for (const p of ps) { if (hs.length < 2 && hs.every(q => Math.abs(q.y - p.y) > 80 * K)) hs.push(p); else if (vs.length < 2 && vs.every(q => Math.abs(q.x - p.x) > 80 * fk)) vs.push(p); }
      for (const p of hs) zs.push({ shape: 'b', x: G.w / 2, y: p.y, w: G.w, hh: 19 * fk, fuse: 1.1, blast: .5 });
      for (const p of vs) zs.push({ shape: 'b', vert: true, x: p.x, w: 19 * fk, fuse: 1.1, blast: .5 });
      break;
    }
    case 'sweep': { // 소탕선 (전용): 보스 아래쪽 부채꼴이 한쪽에서 반대쪽으로 쓸고 지나간다
      const sg = Math.random() < .5 ? -1 : 1;
      for (let i = 0; i < 7; i++) zs.push({ shape: 'w', rel: true, x: 0, y: 0, a: PI / 2 + sg * (i / 6 - .5) * 2.2, half: .13, len: 950 * K, delay: i * .17, fuse: .6, blast: .3 });
      break;
    }
    case 'snare': { // 올가미 (전용): 두 행성의 궤도 고리가 터진다 — 행성 표면 바로 위(안쪽)만 안전하다
      const ps = pl.slice().sort(() => Math.random() - .5);
      for (const p of ps.slice(0, 2)) zs.push({ shape: 'o', x: p.x, y: p.y, r1: p.R + 24 * fk, r2: p.R + 110 * fk, fuse: 1.0, blast: .5 });
      break;
    }
    case 'lobes': // 쌍엽 분출: 보스 양옆으로 세로 기둥 두 줄
      zs.push({ shape: 'b', rel: true, vert: true, x: -92 * fk, w: 30 * fk, fuse: 1.1, blast: .9 }, { shape: 'b', rel: true, vert: true, x: 92 * fk, w: 30 * fk, delay: .3, fuse: 1.1, blast: .9 }); break;
    default: return opsZones(k, b, pl, tg, fk, K, ymin, ymax);   // 블랙쉽 모드의 적 함선 전용 패턴
  }
  return zs;
}
