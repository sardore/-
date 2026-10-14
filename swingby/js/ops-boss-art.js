/* 적 함선 보스 8척 중 앞의 넷(감시정·순찰함·호송함·전자전함) + 그리기 진입점.
 * 뒤의 넷은 ops-boss-art2.js. 부품은 ops-boss-kit.js. 좌표는 보스 중심 · 단위 R/50 · 뱃머리가 아래(+y)다 */
import { G, g } from './state.js';
import { PI, TAU } from './util.js';
import { PAL, mirX, rectP, hot, plate, dome, glow, barrel, turret, lens, windows, engines, charge, aimAngle } from './ops-boss-kit.js';
import { SHIPS2 } from './ops-boss-art2.js';

const flip = pts => pts.map(q => [-q[0], q[1]]).reverse();
/** 좌우 한 쌍의 판(날개·측면 장갑) */
const pair = (pts, pal, o) => { plate(pts, pal, o); plate(flip(pts), pal, o); };
const pulse = (sp, ph) => .55 + .45 * Math.sin(G.T * sp + (ph || 0));

const SHIPS = {
  /** 감시정: 날렵한 정찰함. 큰 붉은 눈과 긴 저격포 */
  argus(b, h, c) {
    engines([-6, 6], -46, 5, h);
    pair([[12, -34], [44, -42], [50, -32], [42, -22], [16, -4]], PAL.gun, { seams: 1 });
    pair([[16, -8], [36, -12], [34, 0], [18, 8]], PAL.steel, { flat: true });
    for (const s of [-1, 1]) { glow(s * 47, -35, 7, h, .5 * pulse(3, s)); g.fillStyle = hot(h, 65); g.fillRect(s * 47 - 1.5, -36, 3, 3); }
    plate(mirX([[0, -48], [9, -44], [15, -32], [18, -12], [16, 10], [11, 30], [5, 45], [0, 53]]), PAL.gun, { seams: 3 });
    plate([[-3.5, -32], [3.5, -32], [5, 20], [0, 28], [-5, 20]], PAL.steel, { flat: true, seams: 0 });
    barrel(0, 32, PI / 2 + (aimAngle(b, 0, 32, .5) - PI / 2) * .5, 24, 4.4, PAL.gun, h, c);
    lens(b, 0, 12, 7.5, h, c);
    windows(-9, 9, -22, 4, h, 1, 1.8);
  },
  /** 순찰함: 넓은 방벽형 선체에 포탑 넷, 가운데 지휘 돔 */
  sentry(b, h, c) {
    engines([-26, -9, 9, 26], -40, 6, h);
    pair([[34, -30], [46, -26], [48, 8], [40, 20], [34, 8]], PAL.steel, { seams: 3 });
    plate(mirX([[0, -42], [30, -42], [40, -28], [41, 4], [32, 26], [12, 40], [0, 46]]), PAL.gun, { seams: 4 });
    plate(mirX([[0, -34], [14, -34], [22, -14], [22, 6], [12, 24], [0, 28]]), PAL.black, { seams: 2 });
    windows(-26, 26, -36, 8, h, 2, 2);
    dome(0, -8, 11, 11, PAL.steel); windows(-6, 6, -8, 4, h, 4, 2);
    glow(0, -8, 20, h, .22 * c);
    for (const s of [-1, 1]) {
      turret(b, s * 27, 4, 8, PAL.steel, h, c, 17);
      turret(b, s * 14, 26, 6.5, PAL.steel, h, c, 15);
    }
    g.fillStyle = hot(h, 55, .6 + .4 * c); g.fillRect(-4, 38, 8, 4);
  },
  /** 호송함: 척추에 컨테이너 블록을 줄줄이 달았다. 컨테이너 창에 갇힌 아군의 불빛 */
  hauler(b, h, c) {
    engines([-5, 5, -34, 34], -47, 5, h);
    plate(rectP(-8, -46, 8, 38), PAL.black, { seams: 5, crest: -3 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = -42 + i * 26, x0 = s < 0 ? -42 : 10, x1 = s < 0 ? -10 : 42, pal = (i + (s > 0)) % 2 ? PAL.gun : PAL.steel;
        plate(rectP(x0, y, x1, y + 22), pal, { seams: 1 });
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0 + 3, y + 3, x1 - x0 - 6, 3.5);
        windows(x0 + 6, x1 - 6, y + 14, 4, h, i * 3 + (s > 0 ? 5 : 0), 2.2);
        g.fillStyle = PAL.black[3]; g.fillRect(s < 0 ? x1 : x0 - 2, y + 8, 2, 6);
      }
    }
    plate(mirX([[0, 30], [10, 30], [8, 42], [0, 48]]), PAL.gun, { flat: true });
    turret(b, 0, 38, 8.5, PAL.steel, h, c, 17);
    for (const s of [-1, 1]) { g.fillStyle = '#05070a'; g.fillRect(s * 24 - 5, 26, 10, 4); g.fillStyle = hot(h, 55, .35 + .5 * pulse(4, s)); g.fillRect(s * 24 - 4, 27, 8, 2); }
  },
  /** 전자전함: 회전하는 접시 안테나 둘, 안테나 기둥, 둘 사이로 튀는 방전 */
  static(b, h, c) {
    engines([-8, 8], -42, 5, h);
    for (const s of [-1, 1]) { g.strokeStyle = PAL.gun[1]; g.lineWidth = 2.4; g.beginPath(); g.moveTo(s * 10, 18); g.lineTo(s * 26, 62); g.stroke(); glow(s * 26, 62, 9, h, .7 * pulse(5, s)); g.fillStyle = hot(h, 75); g.fillRect(s * 26 - 1.5, 60.5, 3, 3); }
    plate(mirX([[0, -44], [14, -40], [24, -16], [20, 14], [10, 34], [0, 40]]), PAL.gun, { seams: 4 });
    plate(mirX([[0, -30], [8, -26], [10, 8], [0, 18]]), PAL.black, { seams: 2 });
    const t = G.T;
    for (const s of [-1, 1]) { // 접시 안테나
      const x = s * 32, y = -10;
      g.strokeStyle = PAL.gun[2]; g.lineWidth = 4; g.beginPath(); g.moveTo(s * 18, -8); g.lineTo(x, y); g.stroke();
      dome(x, y, 15, 15, PAL.steel);
      g.strokeStyle = hot(h, 58, .55 + .3 * c); g.lineWidth = 1.1;
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, y, k * 4, 0, TAU); g.stroke(); }
      g.save(); g.translate(x, y); g.rotate(t * 1.4 * s); g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(-1, -14, 2, 28); g.fillRect(-14, -1, 28, 2); g.restore();
      glow(x, y, 14, h, .35 * c);
    }
    lens(b, 0, 22, 6, h, c);
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';  // 접시에서 눈으로 튀는 전기
    for (const s of [-1, 1]) {
      g.strokeStyle = hot(h, 70, .25 + .6 * c); g.lineWidth = 1.2 + c; g.beginPath(); g.moveTo(s * 32, -10);
      for (let i = 1; i <= 5; i++) { const f = i / 5; g.lineTo(s * 32 * (1 - f) + Math.sin(t * 37 + i * 5 + s) * 3.5, -10 + 32 * f + Math.cos(t * 41 + i * 3) * 3); }
      g.stroke();
    }
    g.restore();
  }
};
Object.assign(SHIPS, SHIPS2);

/** 함선 보스 몸체 그리기 (boss-art.js 의 drawBossBody 가 호출). 호출 전에 보스 중심으로 translate/scale 되어 있어야 한다 */
export function drawOpsBoss(b) {
  const fn = SHIPS[b.d.ship]; if (!fn) return;
  g.save(); g.scale(b.R / 50, b.R / 50); g.lineJoin = 'round';
  fn(b, b.d.hue, charge(b));
  g.restore();
}
