/* 소형 적함 그리기: 검정·회색 철갑에 붉은 불빛(적). 드론은 눈 달린 원반, 포함은 포탑이 도는 쐐기, 쾌속정은 날렵한 화살. 입체 표현은 ops-ship-art.js 의 면 그리기를 같이 쓴다 */
import { G } from './state.js';
import { TAU, PI } from './util.js';
import { ART } from './ops-ship-art.js';
import { fs } from './stats.js';
import { REP, CHG, TRK, trkNose } from './ops-mook-ai.js';
import { drawZone } from './draw-boss.js';

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
const VIO = '#c8a0ff', ROSE = '#ff6a8a';
/** 산탄 포함: 포함보다 넓은 쐐기에 포신 셋 */
function barrage(c, m, T) {
  shape(c, mir([[-10, 0], [-7, 6.6], [3, 9], [11, 6], [12, 0]]).map(q => [q[1], -q[0]]), PAL.black);
  shape(c, [[-3.4, 9.4], [3.4, 9.4], [4.6, 5], [-4.6, 5]], PAL.gun, { noShadow: true });
  for (const s of [-1, 1]) { lamp(c, s * 7.6, 3.4, .9, RED, .5 + .5 * Math.sin(T * 5 + s)); shape(c, [[s * 5, -5], [s * 8.6, -3], [s * 8.2, 2], [s * 5, 1]], PAL.gun, { noShadow: true }); }
  c.save(); c.rotate(m.a); for (const da of [-.3, 0, .3]) { c.save(); c.rotate(da); barrel(c, 0, 12, 0, 1.9, PAL.gun); c.restore(); } c.restore();
  ball(c, 0, 0, 4.8, 4.8, PAL.gun);
  const ch = m.aim > 0 ? 1 - m.aim / .8 : 0;
  if (ch > 0) for (const da of [-.3, 0, .3]) glow(c, Math.cos(m.a + da) * 12, Math.sin(m.a + da) * 12, 4 + 6 * ch, .8);
  lamp(c, 0, 0, 1.4, RED, .6 + .4 * Math.sin(T * 6));
}
/** 척력정: 둥근 몸 둘레에 보랏빛 방출기 셋. 충전 중에는 방출기가 밝아진다 */
function repeller(c, m, T) {
  const ch = m.warn > 0 ? 1 - m.warn / REP.warn : 0;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU + m.t * .4 - PI / 2, ex = Math.cos(a) * 11, ey = Math.sin(a) * 11;
    c.save(); c.translate(ex, ey); c.rotate(a); shape(c, [[-3, -2.4], [3, -3.4], [4.6, 0], [3, 3.4], [-3, 2.4]], PAL.gun, { noShadow: true }); c.restore();
    lamp(c, ex, ey, 1.5 + 1.2 * ch, VIO, .5 + .5 * ch + .2 * Math.sin(T * 6 + i));
  }
  ball(c, 0, 0, 8, 8, PAL.black);
  c.strokeStyle = PAL.gun[1]; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 5.4, 0, TAU); c.stroke();
  glow2(c, 0, 0, 6 + 5 * ch, .55 + .4 * ch);
  lamp(c, 0, 0, 2.4, VIO, .6 + .4 * Math.sin(T * 5 + m.ph)); lamp(c, -.6, -.7, .7, '#fff', .8);
}
function glow2(c, x, y, r, a) { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(190,140,255,' + a + ')'); gr.addColorStop(1, 'rgba(190,140,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
/** 돌격정: 창끝 같은 몸. 코가 +x 방향(그릴 때 m.a 로 돌린다) */
function charger(c, m, T) {
  const dash = m.st === 'dash', fl = dash ? 9 + 4 * Math.sin(T * 50) : 3 + Math.sin(T * 30 + m.ph);
  const gr = c.createLinearGradient(-9, 0, -9 - fl, 0); gr.addColorStop(0, 'rgba(255,190,150,.9)'); gr.addColorStop(1, 'rgba(255,70,40,0)');
  c.fillStyle = gr; c.beginPath(); c.moveTo(-8, -2.2); c.lineTo(-8 - fl, 0); c.lineTo(-8, 2.2); c.closePath(); c.fill();
  for (const s of [-1, 1]) shape(c, [[2, s * 2], [-8, s * 7.4], [-10, s * 6.6], [-7, s * 2.4]], PAL.gun, { noShadow: true });
  shape(c, mir([[14, 0], [6, 3], [-6, 4.2], [-9, 0]]), PAL.black);
  shape(c, [[16, 0], [11, -1.6], [11, 1.6]], PAL.gun, { noShadow: true });   // 충각
  const ch = m.st === 'aim' ? 1 - Math.max(0, m.aim) / .85 : dash ? 1 : 0;
  if (ch > 0) glow(c, 14, 0, 5 + 6 * ch, .8);
  lamp(c, 5, 0, 1.2, RED, .6 + .4 * Math.sin(T * 9)); lamp(c, -2, 0, .7, '#fff', .5);
}
/** 추적정: 화면 아래에 걸친 큼직한 철갑 함선. 코(위쪽)에서 광선을 쏜다 */
function tracker(c, m, T) {
  const ch = m.warn > 0 ? 1 - m.warn / TRK.warn : 0, on = m.beam > 0;
  shape(c, mir([[13, 0], [6, 4], [-4, 9], [-12, 8], [-14, 0]]).map(q => [q[1], -q[0]]), PAL.black);
  shape(c, [[-3, 7], [3, 7], [4, -2], [-4, -2]], PAL.gun, { noShadow: true });
  for (const s of [-1, 1]) { shape(c, [[s * 9, -4], [s * 14, 0], [s * 13, 7], [s * 9, 6]], PAL.gun, { noShadow: true }); lamp(c, s * 11.4, 2.4, 1, RED, .5 + .5 * Math.sin(T * 4 + s)); }
  c.fillStyle = PAL.gun[1]; c.fillRect(-1.6, -15, 3.2, 8);
  glow(c, 0, -15, 5 + 9 * ch + (on ? 8 : 0), .5 + .5 * ch);
  lamp(c, 0, -2, 2, ROSE, .6 + .4 * Math.sin(T * 6)); lamp(c, -.6, -2.6, .6, '#fff', .8);
}
const DRAW = { drone, gunboat, skiff, barrage, repeller, charger, tracker };
const ROT = { skiff: 1, charger: 1 };
const ROT_UP = { tracker: 1 };   // 코가 위(-y)인 종류는 m.a(조준 각도)+90° 로 돌린다   // 이 종류는 진행 방향(m.a)으로 몸을 돌려 그린다

/** 월드 좌표에서 그리는 예고선·충격파·광선 (몸체와 달리 크기를 곱하지 않는다) */
function extras(c, m, T, top) {
  const k = fs();
  if (m.kind === 'repeller') {
    if (m.warn > 0) { const p = 1 - m.warn / REP.warn; c.save(); c.strokeStyle = VIO; c.globalAlpha = .15 + .35 * p * (.6 + .4 * Math.sin(T * 30)); c.lineWidth = 2; c.setLineDash([6, 7]); c.beginPath(); c.arc(m.x, m.y, REP.reach * k, 0, TAU); c.stroke(); c.restore(); }
    if (m.ring) { const f = 1 - m.rr / (REP.reach * k); c.save(); c.strokeStyle = VIO; c.globalAlpha = .25 + .75 * f; c.lineWidth = 3 + 4 * f; c.shadowColor = VIO; c.shadowBlur = 12; c.beginPath(); c.arc(m.x, m.y, m.rr, 0, TAU); c.stroke(); c.restore(); }
  } else if (m.kind === 'charger' && m.st === 'aim') {
    const len = CHG.speed * CHG.dash * k, p = 1 - Math.max(0, m.aim) / CHG.aim; c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.strokeStyle = '#ff5a40'; c.globalAlpha = .2 + .5 * p; c.lineWidth = 2 + 3 * p; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(m.R, 0); c.lineTo(len, 0); c.stroke(); c.restore();
  } else if (m.kind === 'tracker' && (m.warn > 0 || m.beam > 0)) {   // 보스 광선과 같은 존 그림(draw-boss.js 의 drawZone): 충전 → 발사 → 잔광
    const o = trkNose(m), t = m.warn > 0 ? TRK.warn - m.warn : TRK.warn + (TRK.beam - m.beam);
    drawZone({ shape: 'w', x: o.x, y: o.y, a: m.ba, half: TRK.half, len: TRK.len * k, delay: 0, fuse: TRK.warn, blast: TRK.beam, fade: .3, col: '#ff6a8a', t });
  }
}

export function drawMookList(c, top, bot, T) {
  for (const m of G.ops.mooks) {
    if (m.kind !== 'tracker' && (m.y < top - 80 || m.y > bot + 80)) continue;
    const s = m.R / 10 * (.4 + .6 * m.born) * (1 + m.sq * .12);
    extras(c, m, T, top);
    c.save(); c.translate(m.x, m.y); c.scale(s, s);
    if (ROT[m.kind]) c.rotate(m.a); else if (ROT_UP[m.kind]) c.rotate(m.ba + PI / 2);
    if (m.out > 0) c.globalAlpha = Math.max(0, 1 - m.out);   // 떠나는 추적정은 흐려진다
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
