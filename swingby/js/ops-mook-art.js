/* 소형 적함 그리기: 검정·회색 철갑에 붉은 불빛(적). 드론은 눈 달린 원반, 포함은 포탑이 도는 쐐기, 쾌속정은 날렵한 화살. 입체 표현은 ops-ship-art.js 의 면 그리기를 같이 쓴다 */
import { G } from './state.js';
import { TAU, PI } from './util.js';
import { ART } from './ops-ship-art.js';

const { PAL, shape, ball, barrel, lamp, mir } = ART;
const RED = '#ff4a3a';

function glow(c, x, y, r, a) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,90,60,' + a + ')'); gr.addColorStop(1, 'rgba(255,90,60,0)');
  c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

function drone(c, m, T) {
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + m.t * .3 + PI / 2; c.strokeStyle = PAL.gun[2]; c.lineWidth = 1.2; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); c.stroke(); lamp(c, Math.cos(a) * 11, Math.sin(a) * 11, .9, RED, .5 + .5 * Math.sin(T * 5 + i)); }
  ball(c, 0, 0, 8.4, 8.4, PAL.black);
  c.strokeStyle = PAL.gun[1]; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.stroke();
  const pl = .6 + .4 * Math.sin(T * 4 + m.ph); glow(c, 0, 0, 7, .55 * pl);
  c.fillStyle = '#240806'; c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fill(); lamp(c, 0, 0, 1.9, RED, .6 + .4 * pl); lamp(c, -.5, -.6, .6, '#fff', .8);
}
function gunboat(c, m, T) {
  shape(c, mir([[-9, 0], [-6, 5.4], [3, 7.4], [10, 5], [11, 0]]).map(q => [q[1], -q[0]]), PAL.black);   // 위를 향한 쐐기 (코가 -y)
  shape(c, [[-2.6, 8.4], [2.6, 8.4], [3.6, 4.4], [-3.6, 4.4]], PAL.gun, { noShadow: true });
  for (const s of [-1, 1]) lamp(c, s * 6.4, 3, .8, RED, .5 + .5 * Math.sin(T * 5 + s));
  // 포탑: 기체를 겨눈다(m.a 는 월드 각도). 쏘기 직전에는 포구가 달아오른다
  c.save(); c.rotate(m.a); barrel(c, 0, 11, 0, 2.2, PAL.gun); c.restore();
  ball(c, 0, 0, 4.2, 4.2, PAL.gun);
  const ch = m.aim > 0 ? 1 - m.aim / .8 : 0;
  if (ch > 0) glow(c, Math.cos(m.a) * 11, Math.sin(m.a) * 11, 6 + 7 * ch, .8);
  lamp(c, 0, 0, 1.3, RED, .6 + .4 * Math.sin(T * 6));
}
function skiff(c, m, T) {
  const fl = 5 + 3 * Math.sin(T * 40 + m.ph), gr = c.createLinearGradient(-8, 0, -8 - fl, 0); gr.addColorStop(0, 'rgba(255,200,170,.9)'); gr.addColorStop(1, 'rgba(255,80,50,0)');
  c.fillStyle = gr; c.beginPath(); c.moveTo(-7, -1.6); c.lineTo(-7 - fl, 0); c.lineTo(-7, 1.6); c.closePath(); c.fill();
  for (const s of [-1, 1]) shape(c, [[0, s * 1.6], [-7, s * 6.2], [-8, s * 5.6], [-5, s * 1.8]], PAL.gun, { noShadow: true });
  shape(c, mir([[12, 0], [3, 2.4], [-6, 3], [-8, 0]]), PAL.black);
  lamp(c, 7, 0, 1.1, RED, .7 + .3 * Math.sin(T * 10)); lamp(c, -2, 0, .6, '#fff', .5);
}
const DRAW = { drone, gunboat, skiff };

export function drawMookList(c, top, bot, T) {
  for (const m of G.ops.mooks) {
    if (m.y < top - 80 || m.y > bot + 80) continue;
    const s = m.R / 10 * (.4 + .6 * m.born) * (1 + m.sq * .12);
    c.save(); c.translate(m.x, m.y); c.scale(s, s);
    if (m.kind === 'skiff') c.rotate(m.a);
    if (m.flash > 0) c.filter = 'brightness(2.2)';
    DRAW[m.kind](c, m, T);
    c.restore();
  }
  for (const b of G.ops.shots) {
    c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
    glow(c, 0, 0, 9, .8); c.fillStyle = '#fff'; c.fillRect(-5, -1, 8, 2); c.fillStyle = RED; c.fillRect(-9, -.8, 5, 1.6);
    c.restore();
  }
}
