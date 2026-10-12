/* 배경: 하늘 그라데이션 · 흐르는 구름 · 먼지 · 가장자리 비네트.
 * 바이옴마다 색과 분위기가 확실히 다르고, 바이옴이 바뀌면 색이 부드럽게 넘어간다. */
import { G, V, g } from './state.js';
import { TAU, rnd } from './util.js';
import { BIOMES } from './data.js';

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, k) => a + (b - a) * k;
const hueLerp = (a, b, k) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;

/** 바이옴의 look 을 숫자 배열로 풀어 둔다 (색 보간용) */
const LOOKS = {};
for (const k in BIOMES) {
  const l = BIOMES[k].look;
  LOOKS[k] = { top: rgb(l.sky[0]), bot: rgb(l.sky[1]), haze: l.haze.slice(), cl: l.cl, dust: rgb(l.dust[0]), ds: l.dust[1], rise: l.dust[2], vig: rgb(l.vig[0]), va: l.vig[1] };
}
const copy = l => ({ top: l.top.slice(), bot: l.bot.slice(), haze: l.haze.slice(), cl: l.cl, dust: l.dust.slice(), ds: l.ds, rise: l.rise, vig: l.vig.slice(), va: l.va });
const cur = copy(LOOKS.normal);       // 지금 화면에 쓰는 (보간 중인) 모습
let lastT = 0;

function blend(to, k) {
  for (const key of ['top', 'bot', 'dust', 'vig']) cur[key] = cur[key].map((v, i) => lerp(v, to[key][i], k));
  cur.haze = [hueLerp(cur.haze[0], to.haze[0], k), lerp(cur.haze[1], to.haze[1], k), lerp(cur.haze[2], to.haze[2], k)];
  for (const key of ['cl', 'ds', 'rise', 'va']) cur[key] = lerp(cur[key], to[key], k);
}
const css = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + (a == null ? 1 : a) + ')';

const dust = [], clouds = [];
for (let i = 0; i < 110; i++) dust.push({ x: Math.random(), y: Math.random() * 2000, z: rnd(.08, .5), s: rnd(.5, 1.7) });
for (let i = 0; i < 8; i++) clouds.push({ x: Math.random(), y: i * 260 + rnd(-60, 60), r: rnd(.5, .95), z: rnd(.12, .3), ph: rnd(0, TAU), hs: rnd(-24, 24) });

export function drawBackdrop() {
  const { VW, VH } = V, T = G.T;
  blend(LOOKS[G.biome], Math.min(1, Math.max(0, T - lastT) * 2.2)); lastT = T;
  const sky = g.createLinearGradient(0, 0, 0, VH); sky.addColorStop(0, css(cur.top)); sky.addColorStop(1, css(cur.bot));
  g.fillStyle = sky; g.fillRect(0, 0, VW, VH);

  // 구름: 시차를 두고 천천히 흐르는 큰 안개 덩어리
  const m = VH + 500, [h, s, l] = cur.haze;
  for (const c of clouds) {
    const y = (((c.y - G.camY * c.z) % m) + m) % m - 250, x = (c.x + .04 * Math.sin(T * .1 + c.ph)) * VW, r = c.r * VW * 1.05;
    const cg = g.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, 'hsla(' + (h + c.hs) + ',' + s + '%,' + l + '%,' + cur.cl * (.8 + .2 * Math.sin(T * .5 + c.ph)) + ')'); cg.addColorStop(1, 'hsla(' + (h + c.hs) + ',' + s + '%,' + l + '%,0)');
    g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 먼지: 바이옴마다 색·크기·흐르는 방향이 다르다 (적색 지대는 불씨처럼 떠오른다)
  const dm = VH + 20; g.fillStyle = css(cur.dust);
  for (const b of dust) {
    g.globalAlpha = Math.min(1, .25 + b.z * 1.2); const sz = b.s * cur.ds;
    g.fillRect(b.x * VW, (((b.y - G.camY * b.z - T * cur.rise * b.z * 14) % dm) + dm) % dm - 10, sz, sz);
  }
  g.globalAlpha = 1;

  // 가장자리 비네트
  if (cur.va > .01) {
    const vg = g.createRadialGradient(VW / 2, VH / 2, VH * .22, VW / 2, VH / 2, VH * .82);
    vg.addColorStop(0, css(cur.vig, 0)); vg.addColorStop(1, css(cur.vig, cur.va)); g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
  }
  if (G.boss) { // 보스의 빛이 위에서 내려온다
    const hh = G.boss.d.hue, rg = g.createRadialGradient(VW / 2, 0, 0, VW / 2, 0, VH * .9);
    rg.addColorStop(0, 'hsla(' + hh + ',90%,50%,.16)'); rg.addColorStop(1, 'hsla(' + hh + ',90%,50%,0)'); g.fillStyle = rg; g.fillRect(0, 0, VW, VH);
  }
}
