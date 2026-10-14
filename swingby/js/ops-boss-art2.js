/* 적 함선 보스 뒤의 넷: 추격함 · 수용선 · 레일 순양함 · 기함. (ops-boss-art.js 에서 합쳐 쓴다) */
import { G, g } from './state.js';
import { PI, TAU, clamp, easeOut } from './util.js';
import { PAL, path, mirX, rectP, hot, plate, dome, glow, barrel, turret, lens, windows, engines, aimAngle } from './ops-boss-kit.js';

const flip = pts => pts.map(q => [-q[0], q[1]]).reverse();
const pair = (pts, pal, o) => { plate(pts, pal, o); plate(flip(pts), pal, o); };
const pulse = (sp, ph) => .55 + .45 * Math.sin(G.T * sp + (ph || 0));

export const SHIPS2 = {
  /** 추격함: 뒤로 젖힌 쐐기 날개, 붉게 달아오른 흡기구, 날개 끝의 사냥 드론 포드 */
  hound(b, h, c) {
    engines([-14, 0, 14], -42, 6, h);
    for (const s of [-1, 1]) { // 날개 끝 드론 포드
      const x = s * 47, y = -2;
      plate([[x - 4, y - 14], [x + 4, y - 14], [x + 5, y + 8], [x, y + 14], [x - 5, y + 8]], PAL.steel, { flat: true });
      glow(x, y + 4, 8, h, .45 * pulse(4, s)); g.fillStyle = hot(h, 62); g.fillRect(x - 1.5, y + 2, 3, 3);
    }
    pair([[14, -40], [48, -14], [51, 2], [44, 8], [14, 12]], PAL.gun, { seams: 3 });
    pair([[18, -14], [40, -6], [38, 2], [20, 4]], PAL.black, { flat: true });
    plate(mirX([[0, -44], [12, -40], [18, -14], [14, 14], [9, 36], [0, 52]]), PAL.black, { seams: 4 });
    plate(mirX([[0, -30], [5, -26], [6, 18], [0, 34]]), PAL.gun, { flat: true, seams: 0 });
    for (const s of [-1, 1]) { // 흡기구
      g.fillStyle = '#050607'; path([[s * 22, -26], [s * 31, -22], [s * 30, -8], [s * 22, -10]]); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = hot(h, 50, .35 + .4 * pulse(3, s)); path([[s * 24, -23], [s * 29, -20.5], [s * 28.5, -11], [s * 24, -12.5]]); g.fill(); g.restore();
      barrel(s * 8, 22, PI / 2 + (aimAngle(b, s * 8, 22, .4) - PI / 2) * .6, 28, 4.6, PAL.gun, h, c);
    }
    dome(0, -4, 6, 9, PAL.steel); g.fillStyle = hot(h, 55, .6 + .4 * c); g.fillRect(-3, -8, 6, 2.2);
  },
  /** 수용선: 불 켜진 감방 창이 줄지은 상자형 선체, 정면의 철창 문, 모서리 감시탑 */
  oubliette(b, h, c) {
    engines([-22, -8, 8, 22], -46, 6, h);
    for (const s of [-1, 1]) { // 늘어진 사슬
      g.strokeStyle = PAL.gun[1]; g.lineWidth = 1.6; g.setLineDash([2.4, 1.8]);
      g.beginPath(); g.moveTo(s * 36, -30); g.quadraticCurveTo(s * (44 + Math.sin(G.T * 1.3 + s) * 2), 4, s * 38, 38); g.stroke(); g.setLineDash([]);
    }
    pair([[34, -40], [46, -34], [46, 22], [40, 30], [34, 26]], PAL.steel, { seams: 4 });
    plate(mirX([[0, -48], [34, -48], [35, 22], [24, 38], [14, 50], [0, 52]]), PAL.gun, { seams: 2 });
    for (let r = 0; r < 4; r++) windows(-26, 26, -38 + r * 9, 7, h, r * 3, 3.2);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-30, -42, 60, 3);
    // 정면 철창 문: 안쪽의 위협색 빛 위로 쇠창살
    g.fillStyle = '#060507'; g.fillRect(-18, 0, 36, 28);
    const gl = g.createLinearGradient(0, 0, 0, 28); gl.addColorStop(0, hot(h, 25, .9)); gl.addColorStop(1, hot(h, 55, .5 + .5 * c)); g.fillStyle = gl; g.fillRect(-17, 1, 34, 26);
    for (let x = -15; x <= 15; x += 5) { plate(rectP(x - 1.3, -1, x + 1.3, 29), PAL.black, { flat: true }); }
    plate(rectP(-20, 12, 20, 15), PAL.gun, { flat: true });
    for (const s of [-1, 1]) { plate(mirX([[0, 0], [7, 0], [8, 12], [0, 14]]).map(q => [q[0] + s * 38, q[1] - 40]), PAL.steel, { flat: true }); turret(b, s * 38, -34, 6, PAL.steel, h, c, 13); }
    turret(b, 0, 42, 8, PAL.steel, h, c, 17);
    glow(0, 14, 26, h, .22 * c);
  },
  /** 레일 순양함: 길고 가는 선체 한가운데를 가르는 쌍레일, 마디마디 코일이 자홍빛으로 충전된다 */
  lancer(b, h, c) {
    engines([-9, 0, 9], -56, 5, h);
    pair([[12, -46], [38, -54], [42, -22], [38, 2], [14, -4]], PAL.gun, { seams: 3 });   // 라디에이터 날개
    pair([[22, -42], [36, -48], [38, -26], [24, -22]], PAL.black, { flat: true });
    plate(mirX([[0, -58], [11, -54], [16, -36], [16, 22], [11, 40], [0, 46]]), PAL.black, { seams: 6 });
    plate(mirX([[0, -22], [8, -20], [12, -10], [8, 4], [0, 6]]), PAL.steel, { seams: 1 });
    dome(0, -12, 5.5, 7, PAL.black); g.fillStyle = hot(h, 62, .55 + .35 * pulse(3)); g.fillRect(-3.5, -14, 7, 1.8);
    for (const s of [-1, 1]) barrel(s * 5.5, 0, PI / 2, 60, 7, PAL.steel, h, c);   // 쌍레일
    // 코일: 레일 둘레를 감은 고리
    for (let i = 0; i < 6; i++) {
      const y = 12 + i * 8;
      plate(rectP(-13, y, 13, y + 3.4), PAL.gun, { flat: true });
      g.save(); g.globalCompositeOperation = 'lighter'; const k = .25 + .75 * Math.max(0, Math.sin(G.T * (c > .5 ? 14 : 3) - i * .8)); g.fillStyle = hot(h, 58, (.25 + .6 * c) * k); g.fillRect(-12, y + .6, 24, 2.2); g.restore();
    }
    glow(0, 60, 10 + 22 * c, h, .4 + .5 * c);
    for (const s of [-1, 1]) { g.fillStyle = hot(h, 60, .5 + .5 * c); g.fillRect(s * 5.5 - 2.5, 58, 5, 2); }
  },
  /** 기함 파놉티콘: 초승달 날개로 감싼 성채. 한가운데 거대한 눈과 그 둘레를 도는 고리, 포탑 여섯 */
  panopticon(b, h, c) {
    engines([-28, -14, 0, 14, 28], -48, 7, h);
    pair([[18, -44], [48, -34], [62, -8], [56, 22], [40, 40], [44, 14], [38, -8], [20, -20]], PAL.gun, { seams: 4 });   // 초승달 날개
    pair([[26, -38], [46, -30], [54, -10], [42, -8], [30, -22]], PAL.black, { flat: true });
    plate(mirX([[0, -52], [22, -48], [30, -22], [28, 14], [18, 36], [0, 46]]), PAL.gun, { seams: 5 });
    plate(mirX([[0, -42], [14, -38], [18, -20], [0, -14]]), PAL.black, { seams: 2 });
    windows(-14, 14, -34, 6, h, 1, 2); windows(-12, 12, -27, 5, h, 4, 2);
    // 눈을 감싼 고리
    const ey = 8;
    dome(0, ey, 25, 25, PAL.black);
    g.save(); g.translate(0, ey); g.rotate(G.T * .35);
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); plate(rectP(-2.4, -23, 2.4, -17), i % 3 ? PAL.gun : PAL.steel, { flat: true }); }
    g.restore();
    g.strokeStyle = hot(h, 50, .4 + .4 * c); g.lineWidth = 1.2; g.beginPath(); g.arc(0, ey, 16, 0, TAU); g.stroke();
    lens(b, 0, ey, 13, h, c);
    for (const s of [-1, 1]) {
      turret(b, s * 36, -4, 7, PAL.steel, h, c, 15);
      turret(b, s * 22, 30, 6.5, PAL.steel, h, c, 14);
      turret(b, s * 49, 20, 5.5, PAL.steel, h, c, 12);
    }
    glow(0, ey, 34, h, .18 + .2 * c);
  },
  /** 핵 응축선: 기함이 터진 뒤 남는 작은 핵. 두 갈래 가지가 광선이 가는 방향(b.coreA)을 가리키고, 핵 둘레로 빛이 응축되며 돈다 */
  core(b, h, c) {
    const T = G.T, k = easeOut(clamp(b.coreT / 1.1, 0, 1)), pu = .5 + .5 * Math.sin(T * 6);
    g.scale(k * 1.7, k * 1.7); g.rotate((b.coreA || PI / 2) - 0);
    glow(0, 0, 60, h, .45 + .25 * pu);
    for (const s of [-1, 1]) { // 두 갈래 가지
      g.save(); g.scale(s, 1);
      plate([[13, -7], [34, -3.6], [44, 0], [34, 3.6], [13, 7]], PAL.black, { flat: true });
      plate([[17, -3], [34, -1.6], [38, 0], [34, 1.6], [17, 3]], PAL.steel, { flat: true });
      g.fillStyle = hot(h, 62, .5 + .4 * pu); g.fillRect(18, -.8, 20, 1.6);
      glow(44, 0, 11, h, .6 + .3 * pu);
      g.restore();
    }
    // 응축 고리: 바깥에서 안으로 모여드는 빛
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const f = (T * .9 + i / 4) % 1, r = 34 - f * 20; g.strokeStyle = hot(h, 62, .5 * f); g.lineWidth = 1.2 + f; g.beginPath(); g.arc(0, 0, r, T * 2 + i, T * 2 + i + 2.2); g.stroke(); }
    g.restore();
    dome(0, 0, 14, 14, PAL.black);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, hot(h, 75, .95)); gr.addColorStop(1, hot(h, 50, .2));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 9 + 1.2 * pu, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 11.5, i * 2.09 + T, i * 2.09 + T + 1.2); g.stroke(); }
  }
};
