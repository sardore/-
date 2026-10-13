/* 기체별 전용 장식(Lv4 기체): 선체 위에 덧그리는 그림(art)과 비행 중 뿜는 입자(emit). 어떤 기체에 무엇이 있는지는 shop-data.js 의 DECOR_LIST.
 *   art(c, tm, L, h): 기체 좌표계(코가 +x, 길이 약 20)에 그린다 · emit(o): 입자를 o.out 에 넣는다 (x,y 기체 위치, bx,by 뒤쪽 단위 벡터, dt, k 크기 배율)
 *   flame / glowcol / trail: 상점에서 따로 장착하지 않았을 때 쓰는 기본 색 */
import { TAU, rnd } from './util.js';

const count = (dt, rate) => { const m = dt * rate; return Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); };
const put = (o, vx, vy, l, c, s, ex) => o.out.push(Object.assign({ x: o.x + o.bx * 7 * o.k + rnd(-2, 2), y: o.y + o.by * 7 * o.k + rnd(-2, 2), vx, vy, t: 0, l, c, s }, ex));
const back = (o, sp) => [o.bx * rnd(sp * .6, sp) + rnd(-25, 25), o.by * rnd(sp * .6, sp) + rnd(-25, 25)];
const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';
const poly = (c, pts) => { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); };

export const DECOR = {
  gol: { flame: { h: 46, s: 100 }, glowcol: { h: 46, s: 100 },
    art(c, tm) { for (let i = 0; i < 3; i++) { const a = tm * 1.8 + i * 2.09, w = .6 + 1.9 * Math.abs(Math.cos(tm * 4 + i)); c.fillStyle = '#ffd24a'; c.strokeStyle = '#fff3b0'; c.lineWidth = .5; c.beginPath(); c.ellipse(Math.cos(a) * 13, Math.sin(a) * 8.5, w, 2.2, 0, 0, TAU); c.fill(); c.stroke(); } },
    emit(o) { for (let n = count(o.dt, 22); n > 0; n--) { const [vx, vy] = back(o, 120); put(o, vx, vy, rnd(.45, .75), '#ffd24a', 3.6, { coin: 1, ph: rnd(0, 6) }); } } },
  dre: { flame: { h: 10, s: 100 },
    art(c, tm) { for (const y of [-2.8, 2.8]) { const r = 3 + Math.sin(tm * 9 + y); const gr = c.createRadialGradient(13, y, 0, 13, y, r * 2); gr.addColorStop(0, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = gr; c.beginPath(); c.arc(13, y, r * 2, 0, TAU); c.fill(); } },
    emit(o) { for (let n = count(o.dt, 18); n > 0; n--) put(o, rnd(-30, 30) + o.bx * 40, rnd(-70, -20), rnd(.5, .9), Math.random() < .5 ? '#ff8a3a' : '#ffd070', rnd(2, 3.4)); } },
  jug: { glowcol: { h: 20, s: 100 },
    art(c, tm) { const a = .5 + .4 * Math.sin(tm * 3); c.strokeStyle = hsl(22, 100, 60, a); c.lineWidth = .9; for (const sg of [-1, 1]) { poly(c, [[6, sg * 3], [3, sg * 1.2], [.5, sg * 3.4], [-2.5, sg * 1.6], [-5, sg * 3.6]]); c.stroke(); } },
    emit(o) { for (let n = count(o.dt, 10); n > 0; n--) put(o, rnd(-12, 12), rnd(10, 40), rnd(.6, 1), '#ff6a20', rnd(2, 3.2), { x: o.x + rnd(-5, 5) * o.k, y: o.y + rnd(-4, 4) * o.k }); } },
  ph: { flame: { h: 200, s: 60 }, glowcol: { h: 200, s: 70 }, trail: { style: 'ghost' },
    art(c, tm) { c.strokeStyle = 'rgba(190,230,255,' + (.25 + .15 * Math.sin(tm * 4)) + ')'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(-1, 0, 15, 7, 0, 0, TAU); c.stroke(); },
    emit(o) { for (let n = count(o.dt, 12); n > 0; n--) { const [vx, vy] = back(o, 40); put(o, vx, vy, rnd(.6, 1), 'rgba(190,230,255,.7)', rnd(3, 5)); } } },
  tem: { flame: { h: 190, s: 100 }, glowcol: { h: 190, s: 100 },
    art(c, tm) { c.strokeStyle = 'hsla(190,100%,82%,.9)'; c.lineWidth = .8; const seed = Math.floor(tm * 18);
      for (let i = 0; i < 3; i++) { const a = (seed * 1.7 + i * 2.1) % TAU, pts = []; for (let j = 0; j < 4; j++) { const r = 4 + j * 3.2 + ((seed * 7 + i * 3 + j * 5) % 5) * .5, w = a + (((seed + j * 3 + i) % 5) - 2) * .12; pts.push([Math.cos(w) * r, Math.sin(w) * r * .8]); } poly(c, pts); c.stroke(); } },
    emit(o) { for (let n = count(o.dt, 25); n > 0; n--) { const a = rnd(0, TAU), v = rnd(60, 160); put(o, Math.cos(a) * v, Math.sin(a) * v, rnd(.12, .25), '#aef2ff', 2, { line: 1, x: o.x, y: o.y }); } } },
  cit: { glowcol: { h: 150, s: 90 },
    art(c, tm, L, h) { c.strokeStyle = hsl(h, 100, 75, .8); c.lineWidth = .9; c.save(); c.rotate(tm * .8); poly(c, [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6) * 15, Math.sin(i * TAU / 6) * 15])); c.closePath(); c.stroke(); c.fillStyle = hsl(h, 100, 80, .8); for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * TAU / 6) * 15, Math.sin(i * TAU / 6) * 15, 1, 0, TAU); c.fill(); } c.restore(); } },
  aeg: { glowcol: { h: 46, s: 100 },
    art(c, tm) { c.strokeStyle = 'rgba(255,214,90,.8)'; c.lineWidth = .8; for (const r of [11, 14]) { c.beginPath(); c.ellipse(0, 0, r, r * .75, 0, 0, TAU); c.stroke(); } c.fillStyle = '#ffd24a'; poly(c, [[3, 0], [.5, -2.4], [-2.2, 0], [.5, 2.4]]); c.closePath(); c.fill(); },
    emit(o) { for (let n = count(o.dt, 8); n > 0; n--) put(o, rnd(-15, 15), rnd(-35, -10), rnd(.7, 1.1), '#ffd870', rnd(1.8, 2.8), { x: o.x + rnd(-8, 8) * o.k, y: o.y + rnd(-6, 6) * o.k }); } },
  ark: { flame: { h: 130, s: 100 }, glowcol: { h: 130, s: 100 },
    art(c, tm) { for (let i = 0; i < 4; i++) { const x = 4 - i * 4.2, y = (i % 2 ? 1 : -1) * 6.5, r = 2 + Math.sin(tm * 3 + i * 1.7) * .8, gr = c.createRadialGradient(x, y, 0, x, y, r * 2.2); gr.addColorStop(0, 'rgba(190,255,170,.95)'); gr.addColorStop(1, 'rgba(60,220,110,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill(); } },
    emit(o) { for (let n = count(o.dt, 14); n > 0; n--) put(o, rnd(-25, 25), rnd(-25, 25), rnd(.8, 1.3), '#a8ffa0', rnd(2, 3.4), { x: o.x + rnd(-8, 8) * o.k, y: o.y + rnd(-8, 8) * o.k }); } },
  lei: { flame: { h: 195, s: 100 }, glowcol: { h: 200, s: 100 },
    art(c, tm) { c.strokeStyle = 'rgba(160,225,255,.7)'; c.lineWidth = .8; for (let i = 0; i < 3; i++) { const r = 10 + i * 3 + Math.sin(tm * 3 + i) * 1; c.beginPath(); c.arc(0, 0, r, Math.PI * .65 + Math.sin(tm * 2 + i), Math.PI * 1.35 + Math.sin(tm * 2 + i)); c.stroke(); } },
    emit(o) { for (let n = count(o.dt, 16); n > 0; n--) put(o, rnd(-14, 14), rnd(-40, -15), rnd(.7, 1.2), 'rgba(200,240,255,.85)', rnd(2, 4), { x: o.x + rnd(-6, 6) * o.k, y: o.y + rnd(-5, 5) * o.k }); } },
  ast: { glowcol: { h: 50, s: 80 },
    art(c, tm) { const pts = []; for (let i = 0; i < 5; i++) { const a = tm * .9 + i * TAU / 5; pts.push([Math.cos(a) * 15, Math.sin(a) * 10.5]); } c.strokeStyle = 'rgba(255,245,200,.45)'; c.lineWidth = .6; poly(c, pts); c.stroke(); c.fillStyle = '#fff7d0'; for (const q of pts) { c.beginPath(); c.arc(q[0], q[1], 1.3, 0, TAU); c.fill(); } },
    emit(o) { for (let n = count(o.dt, 12); n > 0; n--) put(o, rnd(-20, 20), rnd(-20, 20), rnd(.5, .9), '#fffbe0', rnd(1.5, 2.6), { x: o.x + rnd(-9, 9) * o.k, y: o.y + rnd(-9, 9) * o.k }); } },
  wor: { flame: { h: 285, s: 100 }, glowcol: { h: 285, s: 100 },
    art(c, tm) { c.lineWidth = .9; for (let a = 0; a < 3; a++) { c.strokeStyle = hsl(285, 100, 72, .7); c.beginPath(); for (let r = 3; r <= 16; r += 1.5) { const w = tm * 3 + a * 2.09 + r * .35, x = Math.cos(w) * r, y = Math.sin(w) * r * .8; r === 3 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); } },
    emit(o) { for (let n = count(o.dt, 20); n > 0; n--) { const a = rnd(0, TAU), v = rnd(30, 70); put(o, Math.cos(a + 1.6) * v, Math.sin(a + 1.6) * v, rnd(.4, .8), Math.random() < .5 ? '#c07aff' : '#ff9af0', rnd(2, 3.2), { x: o.x + Math.cos(a) * 12 * o.k, y: o.y + Math.sin(a) * 12 * o.k }); } } },
  gha: { flame: { rb: 1 }, glowcol: { rb: 1 },
    art(c, tm) { for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 9; i++) { const r = 3 + i * 1.5, w = tm * 2 + arm * Math.PI + i * .42; c.fillStyle = hsl(200 + i * 14, 100, 78, .85 - i * .06); c.beginPath(); c.arc(Math.cos(w) * r, Math.sin(w) * r * .8, 1 + (9 - i) * .08, 0, TAU); c.fill(); } },
    emit(o) { for (let n = count(o.dt, 20); n > 0; n--) { const [vx, vy] = back(o, 70); put(o, vx, vy, rnd(.5, .9), 'hsl(' + Math.floor(rnd(180, 320)) + ',100%,75%)', rnd(2, 3.2)); } } }
};
