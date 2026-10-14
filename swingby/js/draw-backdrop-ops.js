/* 블랙쉽 모드 지역별 배경 장식: 기본 하늘·먼지(draw-backdrop.js) 위에 지역마다 다른 먼 풍경을 얹는다.
 * "비어 보이지 않되 복잡하지 않게" — 어두운 실루엣과 천천히 움직이는 빛 몇 가지만. 화면 좌표이며 camY 로 시차를 준다. 난수는 고정 시드(Math.random 을 쓰지 않는다) */
import { G, V, g } from './state.js';
import { TAU, PI } from './util.js';

let seed = 777; const R = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mod = (v, m) => ((v % m) + m) % m;
const rgba = (c, a) => 'rgba(' + c + ',' + a + ')';
const px = (z, y0, dm) => mod(y0 - G.camY * z, dm) - 60;   // 시차로 흘러내리는 y

const PYL = Array.from({ length: 6 }, (_, i) => ({ side: i % 2, y: R() * 1400, h: 150 + R() * 140, w: 7 + R() * 5, ph: R() * TAU }));
const DEB = Array.from({ length: 11 }, () => ({ x: R(), y: R() * 1300, r: 16 + R() * 34, a: R() * TAU, sp: (R() - .5) * .4, z: .08 + R() * .14, n: 5 + Math.floor(R() * 3), k: R() }));
const MIST = Array.from({ length: 4 }, () => ({ y: R() * 1200, h: 70 + R() * 90, sp: 6 + R() * 10, ph: R() * 900, z: .06 + R() * .1 }));
const WIN = Array.from({ length: 70 }, () => ({ x: R(), y: R() * 1300, c: R(), ph: R() * TAU, z: .1 }));
const MOTE = Array.from({ length: 26 }, () => ({ x: R(), y: R() * 900, s: .8 + R() * 1.6, sp: 8 + R() * 16, ph: R() * TAU }));

/** 가장자리 철탑: 뼈대와 깜빡이는 경고등 */
function pylons(c, beacon) {
  const { VW, VH } = V, dm = VH + 520;
  for (const p of PYL) {
    const x = p.side ? VW - p.w - 2 : 2, y = px(.12, p.y, dm), top = y - p.h;
    g.fillStyle = rgba(c, .5); g.fillRect(x, top, p.w, p.h);
    g.strokeStyle = rgba(c, .35); g.lineWidth = 1; g.beginPath();
    for (let k = 0; k < p.h; k += 22) { g.moveTo(x, top + k); g.lineTo(x + p.w, top + k + 22); g.moveTo(x + p.w, top + k); g.lineTo(x, top + k + 22); }
    g.stroke();
    const on = Math.sin(G.T * 2.2 + p.ph) > .3; g.fillStyle = on ? beacon : rgba(c, .5); g.fillRect(x - 1, top - 3, p.w + 2, 3);
    if (on) { const gr = g.createRadialGradient(x + p.w / 2, top - 2, 0, x + p.w / 2, top - 2, 26); gr.addColorStop(0, rgba('255,90,70', .35)); gr.addColorStop(1, rgba('255,90,70', 0)); g.fillStyle = gr; g.fillRect(x - 26, top - 28, p.w + 52, 52); }
  }
}
const LOOK = {
  /** 야간 정찰로: 철탑과 멀리 지나가는 수송대의 불빛 */
  o1() {
    pylons('10,16,26', '#ff5a4a');
    const { VW, VH } = V; g.fillStyle = rgba('255,214,150', .45);
    for (let i = 0; i < 7; i++) { const y = px(.05, i * 210 + 40, VH + 200), x = mod(i * 97 + G.T * (6 + i % 3 * 3), VW + 40) - 20; g.fillRect(x, y, 2, 1.6); g.fillRect(x + 7, y, 2, 1.6); g.fillRect(x + 14, y, 2, 1.6); }
  },
  /** 안개 해협: 옆으로 흐르는 안개 띠와 멀리서 도는 등대 빛 */
  o2() {
    const { VW, VH } = V, dm = VH + 400;
    for (const m of MIST) {
      const y = px(m.z, m.y, dm), x = mod(G.T * m.sp + m.ph, VW * 2) - VW * .5, gr = g.createLinearGradient(x, 0, x + VW, 0);
      gr.addColorStop(0, rgba('200,225,222', 0)); gr.addColorStop(.5, rgba('200,225,222', .09)); gr.addColorStop(1, rgba('200,225,222', 0));
      g.fillStyle = gr; g.fillRect(x, y, VW, m.h);
    }
    const a = PI * .82 + Math.sin(G.T * .35) * .5, ox = VW * .85, oy = VH * .18; g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, VH * .9); gr.addColorStop(0, rgba('220,255,245', .16)); gr.addColorStop(1, rgba('220,255,245', 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, VH * .9, a - .09, a + .09); g.closePath(); g.fill(); g.restore();
    g.fillStyle = rgba('240,255,250', .6); g.beginPath(); g.arc(ox, oy, 2.2, 0, TAU); g.fill();
  },
  /** 폐함 묘지: 천천히 도는 함선 파편 실루엣 */
  o3() {
    const { VW, VH } = V, dm = VH + 300;
    for (const d of DEB) {
      const x = d.x * VW, y = px(d.z, d.y, dm); g.save(); g.translate(x, y); g.rotate(d.a + G.T * d.sp);
      g.fillStyle = rgba('20,13,8', .55); g.strokeStyle = rgba('120,80,48', .28); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < d.n; i++) { const an = i / d.n * TAU, r = d.r * (.55 + .45 * ((i * 53 + d.k * 90) % 7) / 7); g.lineTo(Math.cos(an) * r, Math.sin(an) * r * .7); }
      g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-d.r * .4, 0); g.lineTo(d.r * .3, -d.r * .1); g.stroke(); g.restore();
    }
  },
  /** 전파 폭풍: 흐르는 주사선과 퍼지는 신호 고리, 가끔 튀는 노이즈 띠 */
  o4() {
    const { VW, VH } = V, T = G.T;
    g.fillStyle = rgba('150,255,200', .03); for (let y = mod(T * 18, 7); y < VH; y += 7) g.fillRect(0, y, VW, 1);
    for (let i = 0; i < 3; i++) {
      const k = mod(T * .22 + i / 3, 1), x = VW * (.2 + .6 * mod(i * .37 + Math.floor(T * .22 + i / 3) * .23, 1)), y = VH * (.25 + .5 * mod(i * .61 + Math.floor(T * .22 + i / 3) * .31, 1));
      g.strokeStyle = rgba('170,255,210', .28 * (1 - k)); g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 8 + k * 120, 0, TAU); g.stroke(); g.beginPath(); g.arc(x, y, 3 + k * 70, 0, TAU); g.stroke();
    }
    const gl = Math.sin(T * 1.3) * Math.sin(T * 7.7); if (gl > .75) { g.fillStyle = rgba('200,170,255', .08); g.fillRect(0, mod(T * 400, VH), VW, 6 + gl * 10); }
  },
  /** 열화상 구역: 아지랑이 기둥과 떠오르는 불씨 */
  o5() {
    const { VW, VH } = V, T = G.T;
    for (let i = 0; i < 5; i++) {
      const x = (i * .23 + .08) * VW + Math.sin(T * .5 + i) * 10, w = 46 + i % 2 * 30, gr = g.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, rgba('255,120,70', 0)); gr.addColorStop(.5, rgba('255,120,70', .07 + .03 * Math.sin(T * 1.2 + i))); gr.addColorStop(1, rgba('255,120,70', 0)); g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, VH);
    }
    for (const m of MOTE) { const y = VH - mod(m.y + T * m.sp - G.camY * .1, VH + 40) + 20, x = m.x * VW + Math.sin(T + m.ph) * 8; g.fillStyle = rgba('255,170,100', .5); g.fillRect(x, y, m.s, m.s); }
  },
  /** 수용 구역: 멀리 보이는 거대한 수용동의 창문 격자 */
  o6() {
    const { VW, VH } = V, dm = VH + 400;
    g.fillStyle = rgba('6,10,18', .45); g.fillRect(0, 0, 38, VH); g.fillRect(VW - 38, 0, 38, VH);
    for (const w of WIN) {
      const side = w.x < .5, x = side ? 6 + (w.x * 2) * 24 : VW - 30 + ((w.x - .5) * 2) * 24, y = px(w.z, w.y, dm), on = Math.sin(G.T * .9 + w.ph) > -.6;
      g.fillStyle = on ? (w.c < .75 ? rgba('255,214,150', .5) : rgba('150,200,255', .5)) : rgba('30,40,56', .6); g.fillRect(x, y, 4, 6);
    }
  },
  /** 요새 접근로: 요새 쪽 탑과 바닥에서 쓸어 올리는 탐조등 */
  o7() {
    const { VW, VH } = V, T = G.T; g.save(); g.globalCompositeOperation = 'lighter';
    for (const [ox, ph] of [[VW * .12, 0], [VW * .88, 2]]) {
      const a = -PI / 2 + Math.sin(T * .6 + ph) * .65, L = VH * 1.1, gr = g.createRadialGradient(ox, VH, 0, ox, VH, L);
      gr.addColorStop(0, rgba('220,225,255', .2)); gr.addColorStop(1, rgba('220,225,255', 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(ox, VH + 10); g.arc(ox, VH + 10, L, a - .07, a + .07); g.closePath(); g.fill();
    }
    g.restore(); pylons('4,6,20', '#ff4a4a');
  },
  /** 사령 성역: 위에서 퍼지는 황금빛 레이더 고리와 떠다니는 빛 알갱이 */
  o8() {
    const { VW, VH } = V, T = G.T, cx = VW / 2, cy = VH * .08;
    for (let i = 0; i < 5; i++) { const k = mod(T * .08 + i / 5, 1); g.strokeStyle = rgba('255,214,120', .2 * (1 - k)); g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 60 + k * VH * .95, 0, PI); g.stroke(); }
    for (const m of MOTE) { const y = mod(m.y + T * m.sp * -.5 - G.camY * .06, VH + 20), x = m.x * VW + Math.sin(T * .6 + m.ph) * 14; g.fillStyle = rgba('255,222,140', .35 + .25 * Math.sin(T * 2 + m.ph)); g.beginPath(); g.arc(x, y, m.s, 0, TAU); g.fill(); }
  }
};

export function drawOpsBackdrop() {
  const f = LOOK[G.biome];
  if (f) f();
}
