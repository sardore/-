/* 보스 몸체 그리기. 보스마다 실루엣과 표정이 다르다.
 * 좌표 원점은 보스 중심, R 은 충돌 반지름(몸통은 이 안에 그리고, 뿔·집게·광선 같은 장식은 밖으로 나가도 된다). */
import { G, g } from './state.js';
import { PI, TAU } from './util.js';

const hsl = (h, s, l, a = 1) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';

/** 몸통 그라데이션을 채운다. path() 가 현재 경로를 만든다 */
function fillBody(R, col, path) {
  const bd = g.createRadialGradient(-R * .3, -R * .35, R * .1, 0, 0, R);
  bd.addColorStop(0, col[0]); bd.addColorStop(.55, col[1]); bd.addColorStop(1, col[2]);
  g.fillStyle = bd; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  g.beginPath(); path(); g.fill(); g.stroke();
}
const circle = R => () => g.arc(0, 0, R, 0, TAU);

/** 표면의 대류 무늬와 그림자 (몸통 안쪽에만) */
function surface(R, h, cells = 6, clip = circle(R)) {
  g.save(); g.beginPath(); clip(); g.clip();
  for (let i = 0; i < cells; i++) {
    const a = i * 2.1 + G.T * (.25 + i * .03), r = R * (.3 + .4 * ((i * 37) % 10) / 10);
    g.fillStyle = hsl(h + 14, 100, 78, .28); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * .9, R * (.18 + .06 * (i % 3)), 0, TAU); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(R * .35, R * .4, R * 1.05, 0, TAU); g.arc(0, 0, R, 0, TAU, true); g.fill();
  g.restore();
}

/* ---------- 표정 ---------- */
const eye = (x, y, rx, ry, rot, h) => {
  g.fillStyle = 'rgba(20,0,0,.55)'; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
  g.fillStyle = hsl(h + 30, 100, 80, .9); g.beginPath(); g.ellipse(x, y, rx * .42, ry * .5, 0, 0, TAU); g.fill();
};
const FACE = {
  /** 화난 두 눈 */
  angry(R, h) { for (const s of [-1, 1]) eye(s * R * .34, -R * .12, R * .17, R * .1, s * .35, h); },
  /** 큰 외눈. 세로 동공 */
  cyclops(R, h) {
    const x = 0, y = -R * .05, w = R * .46, hh = R * .3;
    const gl = g.createRadialGradient(x, y, 0, x, y, w * 1.5); gl.addColorStop(0, hsl(h, 100, 70, .5)); gl.addColorStop(1, hsl(h, 100, 60, 0));
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, w * 1.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(25,4,0,.7)'; g.beginPath(); g.ellipse(x, y, w, hh, 0, 0, TAU); g.fill();
    g.fillStyle = hsl(h + 18, 100, 62, .95); g.beginPath(); g.ellipse(x, y, w * .72, hh * .78, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a0400'; g.beginPath(); g.ellipse(x, y, w * .13, hh * .72, 0, 0, TAU); g.fill();
  },
  /** 눈 세 개 */
  tri(R, h) { eye(0, -R * .3, R * .15, R * .1, 0, h); for (const s of [-1, 1]) eye(s * R * .38, R * .04, R * .14, R * .09, s * .5, h); },
  /** 가로로 빛나는 바이저 */
  visor(R, h) {
    const w = R * .62, y = -R * .06;
    g.fillStyle = 'rgba(0,10,30,.6)'; g.beginPath(); g.moveTo(-w, y); g.lineTo(-w * .8, y - R * .13); g.lineTo(w * .8, y - R * .13); g.lineTo(w, y); g.lineTo(w * .8, y + R * .1); g.lineTo(-w * .8, y + R * .1); g.closePath(); g.fill();
    g.fillStyle = hsl(h, 100, 88, .95); g.fillRect(-w * .72, y - R * .045, w * 1.44, R * .09);
  },
  /** 반짝이는 별 모양 눈 */
  spark(R, h) {
    for (const s of [-1, 1]) {
      const x = s * R * .32, y = -R * .1, r = R * .16 * (1 + .12 * Math.sin(G.T * 5));
      g.fillStyle = hsl(h, 100, 92, .95); g.beginPath();
      g.moveTo(x, y - r); g.lineTo(x + r * .28, y - r * .28); g.lineTo(x + r, y); g.lineTo(x + r * .28, y + r * .28);
      g.lineTo(x, y + r); g.lineTo(x - r * .28, y + r * .28); g.lineTo(x - r, y); g.lineTo(x - r * .28, y - r * .28); g.closePath(); g.fill();
    }
  },
  /** 각진 사선 눈 */
  angular(R, h) {
    for (const s of [-1, 1]) {
      g.fillStyle = 'rgba(0,8,30,.65)'; g.beginPath(); g.moveTo(s * R * .12, -R * .18); g.lineTo(s * R * .6, -R * .3); g.lineTo(s * R * .5, R * .02); g.lineTo(s * R * .16, -R * .02); g.closePath(); g.fill();
      g.fillStyle = hsl(h, 100, 86, .95); g.beginPath(); g.moveTo(s * R * .2, -R * .14); g.lineTo(s * R * .48, -R * .22); g.lineTo(s * R * .42, -R * .06); g.closePath(); g.fill();
    }
  },
  /** 나선 홍채 외눈 */
  swirl(R, h) {
    const r = R * .34, t = G.T;
    g.fillStyle = 'rgba(30,10,0,.6)'; g.beginPath(); g.arc(0, -R * .04, r, 0, TAU); g.fill();
    g.strokeStyle = hsl(h + 10, 100, 80, .95); g.lineWidth = 2.5; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 2.4 + t * 2.2, rr = r * .12 + r * .8 * i / 40; i ? g.lineTo(Math.cos(a) * rr, -R * .04 + Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, -R * .04 + Math.sin(a) * rr); }
    g.stroke();
  },
  /** 크기가 다른 비대칭 눈 */
  uneven(R, h) { eye(-R * .3, -R * .14, R * .2, R * .13, -.3, h); eye(R * .36, -R * .02, R * .1, R * .06, .4, h); },
  /** 세로로 길게 째진 두 눈 */
  slit(R, h) { for (const s of [-1, 1]) eye(s * R * .3, -R * .1, R * .07, R * .22, s * .12, h); }
};
const face = (name, R, h, state) => { if (state !== 'intro') FACE[name](R, h); };

/* ---------- 보스별 몸 ---------- */
const ART = {
  /** 프록시마: 작고 둥근 붉은 별. 사방으로 뻗은 짧은 광선, 가끔 길게 튀는 플레어 */
  dwarf(b, R, h) {
    const t = G.T;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + t * .25, L = R * (1.18 + .2 * Math.sin(t * 2.2 + i * 1.9) + (i % 5 === 0 ? .28 * Math.max(0, Math.sin(t * 3 + i)) : 0));
      g.strokeStyle = hsl(h, 100, 70, .55); g.lineWidth = 4; g.beginPath(); g.moveTo(Math.cos(a) * R * .96, Math.sin(a) * R * .96); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke();
    }
    fillBody(R, b.d.col, circle(R)); surface(R, h, 6); face('angry', R, h, b.state);
  },

  /** 시리우스: 뾰족한 4각 별 몸. 중심의 밝은 핵에 바이저, 십자 회절 광선, 곁을 도는 동반성 */
  spike(b, R, h) {
    const t = G.T, star = () => {
      for (let i = 0; i <= 64; i++) {
        const a = i / 64 * TAU, r = R * (.64 + .36 * Math.pow(Math.abs(Math.cos(2 * (a - t * .15))), 2));
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
    };
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4 + t * .15, L = R * (3 + .3 * Math.sin(t * 2 + i));
      const lg = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L); lg.addColorStop(0, 'rgba(255,255,255,.9)'); lg.addColorStop(1, 'rgba(160,220,255,0)');
      g.strokeStyle = lg; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke();
    }
    fillBody(R, b.d.col, star);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(0, 0, R * .5, 0, TAU); g.fill();
    face('visor', R, h, b.state);
    const ca = t * 1.3; g.fillStyle = '#fff'; g.beginPath(); g.arc(Math.cos(ca) * R * 1.9, Math.sin(ca) * R * .95, 5, 0, TAU); g.fill();
  },

  /** 베가: 빠른 자전으로 납작해진 몸, 밝은 적도대, 극에서 뿜는 제트, 파편 고리 */
  ring(b, R, h) {
    const squash = () => g.ellipse(0, 0, R, R * .8, -.3, 0, TAU);
    g.save(); g.rotate(-.3);
    for (const sg of [-1, 1]) {
      const jl = g.createLinearGradient(0, 0, 0, sg * R * 2.1); jl.addColorStop(0, hsl(h, 100, 85, .7)); jl.addColorStop(1, hsl(h, 100, 70, 0));
      g.fillStyle = jl; g.beginPath(); g.moveTo(-R * .16, sg * R * .7); g.lineTo(R * .16, sg * R * .7); g.lineTo(0, sg * R * 2.1); g.closePath(); g.fill();
    }
    g.restore();
    for (let i = 0; i < 3; i++) { g.save(); g.rotate(-.3); g.strokeStyle = 'rgba(190,215,255,' + (.5 - i * .1) + ')'; g.lineWidth = 3 - i * .6; g.beginPath(); g.ellipse(0, 0, R * (1.6 + i * .24), R * (.4 + i * .06), 0, PI, TAU); g.stroke(); g.restore(); }
    fillBody(R, b.d.col, squash);
    g.save(); g.beginPath(); squash(); g.clip(); g.rotate(-.3);
    const band = g.createLinearGradient(0, -R * .3, 0, R * .3); band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(.5, 'rgba(255,255,255,.55)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band; g.fillRect(-R, -R * .3, R * 2, R * .6); g.restore();
    face('slit', R, h, b.state);
    for (let i = 0; i < 3; i++) { g.save(); g.rotate(-.3); g.strokeStyle = 'rgba(190,215,255,' + (.6 - i * .12) + ')'; g.lineWidth = 3 - i * .6; g.beginPath(); g.ellipse(0, 0, R * (1.6 + i * .24), R * (.4 + i * .06), 0, 0, PI); g.stroke(); g.restore(); }
  },

  /** 알데바란: 황소. 굽은 두 뿔과 이글거리는 외눈 */
  bull(b, R, h) {
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const horn = () => { g.beginPath(); g.moveTo(s * R * .62, -R * .62); g.bezierCurveTo(s * R * 1.5, -R * .8, s * R * 2.1, -R * .85, s * R * 1.95, -R * 1.5); };
      g.strokeStyle = '#fff1c8'; g.lineWidth = R * .2; horn(); g.stroke();
      g.strokeStyle = hsl(h, 100, 55, .8); g.lineWidth = R * .08; horn(); g.stroke();
    }
    fillBody(R, b.d.col, circle(R)); surface(R, h, 7); face('cyclops', R, h, b.state);
  },

  /** 안타레스: 전갈. 두 집게와 머리 위로 휘어 감긴 독침 꼬리, 세 개의 눈 */
  pulse(b, R, h) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const wob = Math.sin(G.T * 2.2) * .1;
    for (const s of [-1, 1]) { // 집게
      g.strokeStyle = hsl(h, 80, 30); g.lineWidth = R * .26; g.beginPath(); g.moveTo(s * R * .85, R * .25);
      g.bezierCurveTo(s * R * 1.8, R * (.5 + wob), s * R * 2.1, -R * .3, s * R * 1.55, -R * .8); g.stroke();
      g.strokeStyle = hsl(h, 90, 50, .85); g.lineWidth = R * .1; g.stroke();
      g.fillStyle = hsl(h, 80, 40); g.beginPath(); g.moveTo(s * R * 1.5, -R * .55); g.lineTo(s * R * 1.1, -R * 1.05); g.lineTo(s * R * 1.8, -R * 1.0); g.closePath(); g.fill();
    }
    g.strokeStyle = hsl(h, 80, 30); g.lineWidth = R * .22; g.beginPath(); g.moveTo(0, -R * .9); // 꼬리
    g.bezierCurveTo(-R * .5, -R * 1.75, R * 1.2, -R * 1.9 + wob * R, R * .95, -R * 1.3); g.stroke();
    g.strokeStyle = hsl(h, 90, 50, .85); g.lineWidth = R * .08; g.stroke();
    g.fillStyle = '#ffd0b0'; g.beginPath(); g.moveTo(R * .95, -R * 1.15); g.lineTo(R * .72, -R * 1.6); g.lineTo(R * 1.2, -R * 1.5); g.closePath(); g.fill();
    fillBody(R, b.d.col, circle(R)); surface(R, h, 6); face('tri', R, h, b.state);
  },

  /** 베텔게우스: 일그러진 덩어리. 갈라진 틈의 불빛, 흩어지는 껍질 조각, 한쪽으로 뿜는 분출 */
  super(b, R, h) {
    const t = G.T, lump = () => {
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * TAU, r = R * (1 + .09 * Math.sin(a * 3 + t * 1.6) + .06 * Math.sin(a * 5 - t * 2.3) + .05 * Math.sin(a * 2 + 1));
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
    };
    const pl = g.createRadialGradient(R * .6, -R * .6, R * .2, R * 1.5, -R * 1.5, R * 1.6); pl.addColorStop(0, hsl(h + 10, 100, 65, .55)); pl.addColorStop(1, hsl(h, 100, 55, 0));
    g.fillStyle = pl; g.beginPath(); g.arc(R * 1.5, -R * 1.5, R * 1.7, 0, TAU); g.fill();
    for (let i = 0; i < 7; i++) { // 껍질 조각
      const a = i * TAU / 7 + t * .25, r = R * (1.55 + .15 * Math.sin(t * 1.3 + i)); g.strokeStyle = hsl(h, 90, 60, .55); g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, r, a, a + .22); g.stroke();
    }
    fillBody(R, b.d.col, lump); surface(R, h, 7, lump);
    g.save(); g.beginPath(); lump(); g.clip(); g.strokeStyle = hsl(h + 25, 100, 70, .8); g.lineWidth = 2; g.lineCap = 'round'; // 갈라진 틈
    const cr = [[-.7, .2, -.2, -.1, .3, .25, .75, -.05], [-.3, -.75, -.1, -.35, -.35, 0, -.15, .55], [.1, .7, .35, .35, .6, .2, .85, .4]];
    for (const c of cr) { g.beginPath(); g.moveTo(c[0] * R, c[1] * R); g.lineTo(c[2] * R, c[3] * R); g.lineTo(c[4] * R, c[5] * R); g.lineTo(c[6] * R, c[7] * R); g.stroke(); }
    g.restore(); face('uneven', R, h, b.state);
  },

  /** 아크투루스: 소용돌이 몸. 회전하는 나선 팔과 최면 같은 눈 */
  swirl(b, R, h) {
    const t = G.T; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      for (let i = 0; i <= 36; i++) {
        const f = i / 36, a = k * PI / 2 + t * .6 + f * 3.4, r = R * (.9 + f * 1.15);
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.strokeStyle = hsl(h + 6, 100, 68, .55); g.lineWidth = 7; g.stroke(); g.strokeStyle = hsl(h, 100, 85, .5); g.lineWidth = 2.5; g.stroke();
    }
    fillBody(R, b.d.col, circle(R)); surface(R, h, 7); face('swirl', R, h, b.state);
  },

  /** 폴라리스: 나침반 별. 북쪽 광선이 가장 길고 두 동반성이 궤도를 돈다 */
  twin(b, R, h) {
    const t = G.T;
    for (let i = 0; i < 4; i++) { // 북(i=0)이 가장 길다
      const a = -PI / 2 + i * PI / 2, L = R * (i === 0 ? 3.1 : 2.1) * (1 + .05 * Math.sin(t * 3 + i)), wd = R * .17, ux = Math.cos(a), uy = Math.sin(a);
      const lg = g.createLinearGradient(0, 0, ux * L, uy * L); lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(1, hsl(h, 100, 75, 0));
      g.fillStyle = lg; g.beginPath(); g.moveTo(-uy * wd, ux * wd); g.lineTo(ux * L, uy * L); g.lineTo(uy * wd, -ux * wd); g.closePath(); g.fill();
    }
    for (let i = 0; i < 2; i++) {
      const rx = R * (1.9 + i * .7), ry = rx * .45, a = t * (1.7 - i * .5) + i * 2.4, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      g.strokeStyle = 'rgba(255,245,170,.22)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
      const cg = g.createRadialGradient(x, y, 0, x, y, R * .4); cg.addColorStop(0, 'rgba(255,255,255,.95)'); cg.addColorStop(.35, hsl(h + 8, 100, 75, .7)); cg.addColorStop(1, hsl(h, 100, 60, 0));
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, R * .4, 0, TAU); g.fill();
    }
    fillBody(R, b.d.col, circle(R)); surface(R, h, 5); face('spark', R, h, b.state);
  },

  /** 리겔: 푸른 결정. 육각 몸통과 꼭짓점에서 뻗는 여섯 광선 */
  hex(b, R, h) {
    const t = G.T, poly = (r, rot) => () => { for (let i = 0; i < 6; i++) { const a = rot + i * PI / 3; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    for (let i = 0; i < 6; i++) {
      const a = -PI / 2 + i * PI / 3 + t * .1, L = R * (2.7 + .25 * Math.sin(t * 2 + i)), ux = Math.cos(a), uy = Math.sin(a), wd = R * .12;
      const lg = g.createLinearGradient(0, 0, ux * L, uy * L); lg.addColorStop(0, 'rgba(255,255,255,.9)'); lg.addColorStop(1, hsl(h, 100, 78, 0));
      g.fillStyle = lg; g.beginPath(); g.moveTo(-uy * wd, ux * wd); g.lineTo(ux * L, uy * L); g.lineTo(uy * wd, -ux * wd); g.closePath(); g.fill();
    }
    fillBody(R, b.d.col, poly(R, -PI / 2));
    g.save(); g.beginPath(); poly(R, -PI / 2)(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5; // 결정 면
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = -PI / 2 + i * PI / 3; g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); poly(R * .55, -PI / 2)(); g.fill(); g.restore();
    face('angular', R, h, b.state);
  },

  /** 에타 카리나: 위아래로 부풀어 오른 쌍엽 성운 사이의 불안정한 핵 */
  eta(b, R, h) {
    const t = G.T;
    for (const sg of [-1, 1]) {
      const cy = sg * R * (1.85 + .08 * Math.sin(t * 1.4)), lg = g.createRadialGradient(0, cy, R * .1, 0, cy, R * 1.2);
      lg.addColorStop(0, hsl(h + 14, 100, 72, .6)); lg.addColorStop(1, hsl(h, 100, 55, 0));
      g.fillStyle = lg; g.beginPath(); g.ellipse(0, cy, R * .82, R * 1.15, 0, 0, TAU); g.fill();
      g.strokeStyle = hsl(h + 14, 100, 78, .35); g.lineWidth = 2; // 엽을 감싼 필라멘트
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * R * .1, sg * R * .9); g.quadraticCurveTo(i * R * .5, sg * R * 1.7, i * R * .22, sg * R * 2.6); g.stroke(); }
    }
    const rock = () => {
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * TAU, r = R * (1 + .07 * Math.sin(a * 3 + t * 1.6) + .05 * Math.sin(a * 5 - t * 2.3));
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
    };
    fillBody(R, b.d.col, rock); surface(R, h, 6, rock);
    g.strokeStyle = hsl(h + 20, 100, 78, .6); g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, R * 1.5, R * .22, 0, 0, TAU); g.stroke(); // 적도 먼지 띠
    face('cyclops', R, h, b.state);
  },

  /** 포식성 그롬(괴물 행성 지대): 촉수를 늘어뜨린 녹색 괴수 행성. 눈 셋과 이빨 가득한 큰 입 */
  devour(b, R, h) {
    const t = G.T, sh = G.ship;
    for (let i = 0; i < 9; i++) { // 둘레에서 꿈틀대는 촉수
      const a = i / 9 * TAU + .35, w = Math.sin(t * 2.4 + i * 1.7) * R * .24, L = R * (.55 + .14 * (i % 3)), ca = Math.cos(a), sa = Math.sin(a);
      const ex = ca * (R + L) - sa * w * .7, ey = sa * (R + L) + ca * w * .7;
      g.strokeStyle = hsl(h, 70, 30); g.lineWidth = R * .15; g.beginPath(); g.moveTo(ca * R * .85, sa * R * .85); g.quadraticCurveTo(ca * (R + L * .55) - sa * w, sa * (R + L * .55) + ca * w, ex, ey); g.stroke();
      g.fillStyle = hsl(h + 25, 80, 62, .9); g.beginPath(); g.arc(ex, ey, R * .07, 0, TAU); g.fill();
    }
    fillBody(R, b.d.col, circle(R)); surface(R, h, 7);
    for (let i = 0; i < 6; i++) { // 표면의 혹
      const a = i * 1.1 + .4, r = R * (.62 + .2 * ((i * 5) % 3) / 3);
      g.fillStyle = hsl(h + 20, 60, 30, .55); g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * .9 + R * .1, R * (.06 + (i % 2) * .03), 0, TAU); g.fill();
    }
    const open = b.state === 'intro' ? .3 : .55 + .3 * Math.sin(t * 2.2) + (b.cast > 0 ? .25 : 0), mw = R * .72, mh = R * .46 * Math.min(1, open), my = R * .3;
    g.fillStyle = '#18040c'; g.beginPath(); g.ellipse(0, my, mw, mh, 0, 0, TAU); g.fill();
    g.fillStyle = hsl(335, 70, 46); g.beginPath(); g.ellipse(0, my + mh * .4, mw * .5, mh * .55, 0, 0, PI); g.fill();
    g.fillStyle = '#f2f6dc'; g.strokeStyle = '#223014'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const x = (i - 3) * mw * .29, tw = mw * .1; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(x - tw, my + sg * mh * .86); g.lineTo(x, my + sg * (mh * .86 - Math.min(mh * .9, R * .26))); g.lineTo(x + tw, my + sg * mh * .86); g.closePath(); g.fill(); g.stroke(); } }
    for (const [ex, ey, er] of [[-R * .4, -R * .38, R * .17], [0, -R * .56, R * .21], [R * .4, -R * .38, R * .17]]) { // 눈 셋: 기체를 쫓는다
      const dx = sh.x - b.x - ex, dy = sh.y - b.y - ey, d = Math.hypot(dx, dy) || 1, k = er * .32;
      g.fillStyle = '#f2ffe0'; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill(); g.strokeStyle = hsl(h, 80, 14); g.lineWidth = 2; g.stroke();
      g.fillStyle = hsl(h + 70, 90, 52); g.beginPath(); g.arc(ex + dx / d * k, ey + dy / d * k, er * .58, 0, TAU); g.fill();
      g.fillStyle = '#10051a'; g.beginPath(); g.arc(ex + dx / d * k, ey + dy / d * k, er * .3, 0, TAU); g.fill();
    }
  }
};

/** 보스 몸을 그린다. 호출 전에 보스 중심으로 translate/scale 되어 있어야 한다 */
export function drawBossBody(b) {
  g.lineCap = 'round';
  (ART[b.d.kind] || ART.dwarf)(b, b.R, b.d.hue);
  g.lineCap = 'butt';
}
