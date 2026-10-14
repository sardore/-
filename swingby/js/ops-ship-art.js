/* 블랙쉽 기체 그리기. 기체 14척이 저마다 다른 실루엣의 손그림 설계다(침투정 단검 · 호송정 예인선 · 그림자 스텔스 날개 · 해방선 갈래 뱃머리 · 구호선 쌍동선 · 중수송함 컨테이너 열차 ·
 * 유령선 새 날개 · 암살선 칼날 · 해방자 집게 · 습격선 포함 · 피난선 접시 · 보급함 구슬 연결선 · 철갑 수송함 장갑 · 이동 요새 십자 성채).
 * 주색은 기체마다 하양·검정·갈색(황갈) 중 하나이고, 포인트 색(acc)은 불빛 몇 점에만 아주 작게 쓴다.
 * 위에서 본 그림이지만 빛이 왼쪽 위에서 온다고 보고 입체감을 준다: 면은 가운데 선을 기준으로 윗면이 밝고 아랫면이 어둡고, 빛을 받는 모서리에 하이라이트,
 * 아래로는 그림자가 진다. 기체 앞이 +x, 크기 배율은 ship-art.js 가 계산해 sc 로 넘긴다 */
import { PI, TAU, clamp } from './util.js';
import { OPS } from './ops-data.js';
import { drawOpsFlat } from './ops-ship-flat.js';

/** [하이라이트, 밝은 면, 그늘진 면, 가장 어두운 면] */
const PAL = {
  white: ['#ffffff', '#e8e4d8', '#9a9588', '#4f4b42'],
  black: ['#727881', '#363a42', '#181a1f', '#050608'],
  brown: ['#e0b080', '#a87348', '#623f24', '#2a180a'],
  tan:   ['#f6e2b8', '#cdb184', '#8d7449', '#4a3a22'],
  gun:   ['#b7c0ca', '#6e7781', '#383e46', '#14171b']
};
const LIGHT = [-.45, -.9];   // 빛이 오는 방향(왼쪽 위)
/** 입체 표현의 정교함: 1 = Lv3(면 명암과 모서리 하이라이트만) · 2 = Lv4(그림자·광택·패널 이음선·리벳까지). Lv2 는 입체 없이 ops-ship-flat.js */
let Q = 2;

const path = (c, pts) => pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
/** 윗절반(코에서 꼬리까지, y>=0 쪽) → 좌우 대칭 전체 윤곽 */
const mir = half => half.concat(half.slice(1, -1).reverse().map(q => [q[0], -q[1]]));
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** 다각형 한 면: 바닥 그림자 → 용마루 기준 위/아래 명암 → 어두운 윤곽 → 빛을 받는 모서리 하이라이트 */
function shape(c, pts, pal, o) {
  o = o || {};
  let y0 = Infinity, y1 = -Infinity, cx = 0, cy = 0;
  for (const q of pts) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); cx += q[0]; cy += q[1]; }
  cx /= pts.length; cy /= pts.length;
  if (!o.noShadow && Q >= 2) { c.fillStyle = 'rgba(0,0,0,.36)'; c.beginPath(); path(c, pts.map(q => [q[0] + .6, q[1] + 1])); c.closePath(); c.fill(); }
  const crest = o.crest != null ? o.crest : (y0 + y1) / 2, f = clamp((crest - y0) / ((y1 - y0) || 1), .02, .97), gr = c.createLinearGradient(0, y0, 0, y1 + .01);
  gr.addColorStop(0, pal[1]); gr.addColorStop(f, pal[0]); gr.addColorStop(Math.min(.99, f + .002), pal[2]); gr.addColorStop(1, pal[3]);
  c.fillStyle = gr; c.beginPath(); path(c, pts); c.closePath(); c.fill();
  c.strokeStyle = Q >= 2 ? 'rgba(0,0,0,.7)' : 'rgba(0,0,0,.5)'; c.lineWidth = Q >= 2 ? .6 : .5; c.beginPath(); path(c, pts); c.closePath(); c.stroke();
  if (Q >= 2 && !o.noDetail) detail(c, pts, y0, y1);
  c.strokeStyle = Q >= 2 ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.4)'; c.lineWidth = .5;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, m = Math.hypot(mx, my) || 1;
    if ((mx * LIGHT[0] + my * LIGHT[1]) / m > .35) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }
}
/** Lv4 전용 정교함: 면 위의 광택(왼쪽 위에서 비스듬히), 아래쪽의 어두운 접힘, 그리고 일정 간격의 패널 이음선과 리벳 */
function detail(c, pts, y0, y1) {
  let x0 = Infinity, x1 = -Infinity; for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
  const w = x1 - x0, h = y1 - y0; if (w < 4.5 || h < 2.4) return;
  c.save(); c.beginPath(); path(c, pts); c.closePath(); c.clip();
  const sp = c.createLinearGradient(x0, y0, x0 + w * .55, y0 + h * .7); sp.addColorStop(0, 'rgba(255,255,255,.28)'); sp.addColorStop(.45, 'rgba(255,255,255,.04)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sp; c.fillRect(x0, y0, w, h);
  const ao = c.createLinearGradient(0, y1 - h * .35, 0, y1); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.4)'); c.fillStyle = ao; c.fillRect(x0, y1 - h * .35, w, h * .35);
  if (w > 7) for (const f of w > 14 ? [.27, .56, .8] : [.5]) seam(c, x0 + w * f, y0, x0 + w * f, y1);
  if (h > 5 && w > 8) { c.fillStyle = 'rgba(255,255,255,.45)'; for (let x = x0 + 1.2; x < x1 - .8; x += 2.2) { c.fillRect(x, y0 + h * .14, .4, .4); c.fillRect(x, y1 - h * .14, .4, .4); } }
  c.restore();
}
/** 타원 면(구·접시): 왼쪽 위에서 빛을 받는 방사 그라데이션 */
function ball(c, cx, cy, rx, ry, pal, o) {
  o = o || {};
  if (!o.noShadow && Q >= 2) { c.fillStyle = 'rgba(0,0,0,.36)'; c.beginPath(); c.ellipse(cx + .6, cy + 1, rx, ry, 0, 0, TAU); c.fill(); }
  const gr = c.createRadialGradient(cx - rx * .35, cy - ry * .45, Math.min(rx, ry) * .1, cx, cy, Math.max(rx, ry) * 1.05);
  gr.addColorStop(0, pal[0]); gr.addColorStop(.45, pal[1]); gr.addColorStop(.85, pal[2]); gr.addColorStop(1, pal[3]);
  c.fillStyle = gr; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .55; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .5; c.beginPath(); c.ellipse(cx, cy, rx - .3, ry - .3, 0, PI * .95, PI * 1.55); c.stroke();
  if (Q >= 2 && Math.min(rx, ry) > 1.8) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(cx - rx * .36, cy - ry * .42, rx * .2, ry * .13, -.5, 0, TAU); c.fill(); }   // 광택 점
}
/** 둥근 포신(원통형 명암) */
function barrel(c, x0, x1, y, w, pal) {
  if (Q >= 2) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0 + .4, y - w / 2 + .8, x1 - x0, w); }
  const gr = c.createLinearGradient(0, y - w / 2, 0, y + w / 2); gr.addColorStop(0, pal[1]); gr.addColorStop(.35, pal[0]); gr.addColorStop(1, pal[3]);
  c.fillStyle = gr; c.fillRect(x0, y - w / 2, x1 - x0, w);
  c.fillStyle = pal[3]; c.fillRect(x1 - 1, y - w / 2 - .2, 1, w + .4);
}
/** 패널 이음선: 어두운 선 + 밝은 선 */
function seam(c, x0, y0, x1, y1) {
  if (Q < 2) return;
  c.lineWidth = .45; c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(x0 + .45, y0 + .3); c.lineTo(x1 + .45, y1 + .3); c.stroke();
}
const lamp = (c, x, y, r, col, a) => { c.globalAlpha = a == null ? 1 : a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1; };
/** 조종석 유리: 어두운 곡면 + 흰 반사 */
function cab(k, x, y, rx, ry) {
  const c = k.c, gr = c.createLinearGradient(0, y - ry, 0, y + ry); gr.addColorStop(0, '#6a7a88'); gr.addColorStop(.5, '#141a20'); gr.addColorStop(1, '#05070a');
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x + .3, y + .5, rx, ry, 0, 0, TAU); c.fill();
  c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .4; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x + rx * .3, y - ry * .45, rx * .45, ry * .28, -.1, 0, TAU); c.fill();
  if (k.hasAcc) lamp(c, x - rx - .5, y, .4, k.acc);
}
/** 수송 구획(Lv3+): 어두운 수납구와 작은 표시등 */
function bayDoor(k, x, y, w, h) {
  if (!k.bay) return;
  const c = k.c, pl = .55 + .45 * Math.sin(k.tm * 3);
  c.fillStyle = '#07080a'; c.fillRect(x - w / 2, y - h / 2, w, h); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = .4; c.strokeRect(x - w / 2, y - h / 2, w, h);
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(x, y - h / 2); c.lineTo(x, y + h / 2); c.stroke();
  lamp(c, x - w * .25, y, .45, k.acc, .35 + .6 * pl); lamp(c, x + w * .25, y, .45, k.acc, .35 + .6 * pl);
}

/** 다른 그림 파일(적 함선·소형함·행성)이 같은 입체 표현을 쓰도록 내보낸다 */
export const ART = { PAL, shape, ball, barrel, seam, lamp, mir, rect, path };

/* ---------- 기체별 설계 ----------
 * eng: 엔진 노즐 위치 [x, y, 폭] · draw(k): 몸체 · k.M 주색 · k.T 보조색 · k.G 포·뼈대의 회색 · k.W 흰색 · k.K 검정 · k.B 갈색 */
const SHIPS = {
  /* Lv2 침투정(검정): 가늘고 긴 단검. 작은 앞날개(카나드)와 뒤로 젖힌 흰 꼬리날개 */
  os: { eng: [[-10, -.9, 1], [-10, .9, 1]], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) shape(c, [[1.5, s * 1.6], [-7.5, s * 7.4], [-9.5, s * 7], [-6.5, s * 1.8]], k.T);
    for (const s of [-1, 1]) shape(c, [[8.5, s * .8], [5, s * 4.2], [3.5, s * 1.4]], k.M);
    shape(c, mir([[15, 0], [9, .9], [2, 1.9], [-6, 2.3], [-10, 1.7], [-10, 0]]), k.M);
    c.fillStyle = k.W[1]; c.fillRect(-8, -.3, 17, .6); seam(c, -3, -2, -3, 2);
    cab(k, 6.2, 0, 1.9, .7);
  } },
  /* Lv2 호송정(갈색): 뭉툭한 예인선. 뒤쪽 양옆의 엔진 곤돌라, 앞의 집게, 등 위의 화물 */
  oh: { eng: [[-10, -5.4, 1.2], [-10, 5.4, 1.2]], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) { shape(c, rect(-3, s * 3.4 - .6, -1.2, s * 5.4 + .6), k.G, { noShadow: true }); shape(c, rect(-10, s * 5.4 - 1.7, -2.6, s * 5.4 + 1.7), k.T); }
    shape(c, mir([[7.5, 0], [7.5, 2.6], [5.6, 4.4], [-8, 4.4], [-9.5, 3.4], [-9.5, 0]]), k.M);
    for (const s of [-1, 1]) shape(c, [[7.5, s * 2], [11.4, s * 1.7], [11.4, s * .9], [7.5, s * 1.1]], k.G);
    shape(c, rect(-6, -1.9, -1.4, 1.5), k.T); c.fillStyle = 'rgba(60,35,15,.55)'; c.fillRect(-6, -.2, 4.6, .5);
    seam(c, 1, -4, 1, 4); cab(k, 4.4, 0, 1.8, 1.1);
  } },
  /* Lv3 그림자(검정): 스텔스 전익기. 얇고 넓게 젖혀진 날개 */
  os1: { eng: [[-9.5, -1.4, 1], [-9.5, 1.4, 1]], bay: [-2.5, 0, 4.4, 1.8], draw(k) {
    const c = k.c;
    shape(c, mir([[11.5, 0], [3, 5], [-6, 12.5], [-9.4, 12.2], [-5.4, 5.4], [-7.6, 3.4], [-9.6, 2.4], [-9.6, 0]]), k.M, { crest: 0 });
    shape(c, mir([[8.5, 0], [.5, 2.6], [-5.5, 2.8], [-5.5, 0]]), k.T);
    for (const s of [-1, 1]) { seam(c, 0, s * 6, -5, s * 10); lamp(c, -8.6, s * 12, .45, k.acc); }
    cab(k, 4.6, 0, 1.7, .8);
  } },
  /* Lv3 해방선(하양): 갈래 뱃머리. 가운데 뾰족한 선체를 두 개의 팔이 감싼다 */
  os2: { eng: [[-9.6, -1.2, 1], [-9.6, 1.2, 1]], bay: [-4.5, 0, 4, 1.7], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) {
      shape(c, [[-6, s * 2.6], [-6.4, s * 5.6], [13, s * 5.2], [13.6, s * 3.5], [2, s * 3.4]], k.T);
      shape(c, [[13.6, s * 3.5], [10.8, s * 2.5], [10.4, s * 3.6]], k.G, { noShadow: true });
      lamp(c, 12.4, s * 4.5, .4, k.acc); seam(c, 2, s * 4.4, 11, s * 4.4);
    }
    shape(c, mir([[9, 0], [7, 1.3], [-1, 2.7], [-9, 3.5], [-9.6, 0]]), k.M);
    lamp(c, 9.6, 0, .55, k.acc, .5 + .5 * Math.sin(k.tm * 4));
    cab(k, 3, 0, 1.9, .9);
  } },
  /* Lv3 구호선(하양): 쌍동선. 가운데 선체와 두 개의 의료 포드, 몸통의 십자 표시 */
  oh1: { eng: [[-9.6, 0, 1], [-7.4, -7.8, .8], [-7.4, 7.8, .8]], bay: [.5, 0, 4.4, 1.7], draw(k) {
    const c = k.c;
    for (const x of [-3.2, 3]) shape(c, rect(x - .9, -8, x + .9, 8), k.G, { noShadow: true });
    for (const s of [-1, 1]) {
      ball(c, 0, s * 7.8, 7, 2.7, k.M); c.fillStyle = k.T[1]; c.fillRect(-4, s * 7.8 - .35, 8, .7);
      lamp(c, 6.2, s * 7.8, .45, s < 0 ? '#ff5a4a' : '#5aff8a', .9);
    }
    shape(c, mir([[10.5, 0], [8, 1.6], [-6, 2.3], [-9.6, 1.6], [-9.6, 0]]), k.M);
    c.fillStyle = '#d8d2c4'; c.fillRect(-7.2, -.35, 2.8, .7); c.fillRect(-6.2, -1.3, .7, 2.6); lamp(c, -5.8, 0, .55, k.acc, .8);
    cab(k, 6.6, 0, 1.8, .8);
  } },
  /* Lv3 중수송함(갈색): 컨테이너 열차. 가는 뼈대에 큰 화물 상자 세 칸, 앞의 함교 */
  oh2: { eng: [[-10, -3.4, 1.3], [-10, 0, 1.3], [-10, 3.4, 1.3]], bay: [3.4, 0, 4.6, 1.8], draw(k) {
    const c = k.c;
    shape(c, mir([[11.8, 0], [11, 1.3], [-9.6, 1.8], [-10, 0]]), k.G);
    for (let i = 0; i < 3; i++) {
      const x0 = -9.6 + i * 6.7, pal = i === 1 ? k.T : k.M;
      shape(c, rect(x0, -4.9, x0 + 6, 4.9), pal);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x0, -.6, 6, 1.2); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x0, -.6, 6, .35);
      for (const x of [x0 + 2, x0 + 4]) seam(c, x, -4.9, x, 4.9);
    }
    shape(c, [[12.4, -2.4], [8.8, -3.2], [8.8, 3.2], [12.4, 2.4]], k.W); cab(k, 10.6, 0, 1, 1.2);
  } },
  /* Lv4 유령선(하양): 새처럼 뒤로 휘어 나가는 긴 날개, 깃털 같은 뒷가장자리 */
  os1a: { eng: [[-9.6, -.8, .9], [-9.6, 0, .9], [-9.6, .8, .9]], bay: [-3.4, 0, 3.8, 1.5], halo: 1, draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) shape(c, [[5, s * 1.3], [-2, s * 6], [-9, s * 11.5], [-12.6, s * 13.2], [-10.6, s * 10.2], [-12.2, s * 10.4], [-9.2, s * 7.8], [-10.8, s * 7.6], [-7.2, s * 5], [-8.4, s * 2.2]], k.T, { crest: 0 });
    shape(c, mir([[14, 0], [8, 1.1], [-3, 1.9], [-9.6, 1.3], [-9.6, 0]]), k.M);
    for (const s of [-1, 1]) seam(c, -1, s * 4, -8, s * 9);
    cab(k, 7.4, 0, 2, .7); lamp(c, -12.4, 13.2, .4, k.acc); lamp(c, -12.4, -13.2, .4, k.acc);
  } },
  /* Lv4 암살선(검정): 마름모 몸통에서 앞으로 길게 뻗은 칼날, 뒤로 벌어진 두 단검 */
  os1b: { eng: [[-8.2, -.8, .9], [-8.2, .8, .9]], bay: [-2.8, 0, 3.6, 1.5], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) { shape(c, [[-3.5, s * 2.4], [-11.6, s * 8.4], [-8, s * 2.4]], k.T); shape(c, [[3, s * 2.8], [-1, s * 5.6], [-1.6, s * 2.8]], k.M); }
    shape(c, [[26, 0], [8, 1.5], [8, -1.5]], k.G, { crest: 0 });
    shape(c, mir([[9.4, 0], [3, 3.9], [-4, 3.1], [-8.2, 1.2], [-8.2, 0]]), k.M);
    shape(c, mir([[4.6, 0], [1.4, 1.6], [-5, 1.6], [-5, 0]]), k.T);
    lamp(c, 8.4, 0, .5, k.acc, .8); cab(k, 3, 0, 1.6, .7);
  } },
  /* Lv4 해방자(하양): 게 집게. 둥근 선체에서 휘어 나가 앞으로 모이는 두 개의 굵은 팔 */
  os2a: { eng: [[-8.6, -1.8, .9], [-8.6, 0, .9], [-8.6, 1.8, .9]], bay: [-3.4, 0, 4, 1.6], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) {
      const arm = () => { c.beginPath(); c.moveTo(-6, s * 3); c.bezierCurveTo(-7, s * 10, 3, s * 12.6, 13, s * 8.4); c.lineTo(14.8, s * 5.4); };
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3.6; c.save(); c.translate(.5, .9); arm(); c.stroke(); c.restore();
      c.strokeStyle = k.T[3]; c.lineWidth = 3.4; arm(); c.stroke();
      c.strokeStyle = k.T[1]; c.lineWidth = 2.6; arm(); c.stroke();
      c.strokeStyle = k.T[0]; c.lineWidth = .7; c.save(); c.translate(0, -.7); arm(); c.stroke(); c.restore();
      ball(c, 14.8, s * 5.4, 1.4, 1.4, k.G, { noShadow: true }); lamp(c, 14.8, s * 5.4, .4, k.acc);
    }
    shape(c, mir([[8, 0], [5, 3.2], [-3, 4.2], [-8, 2.6], [-8.6, 0]]), k.M);
    shape(c, mir([[-3.6, 0], [-3.6, 3.9], [-8, 2.6], [-8.6, 0]]), k.T, { noShadow: true });
    cab(k, 3.4, 0, 2, .9);
  } },
  /* Lv4 습격선(갈색): 포함. 방패 모양 선체 양옆에 큰 포대와 앞으로 뻗은 두 포신 */
  os2b: { eng: [[-9, -2.4, 1.1], [-9, 2.4, 1.1], [-5, -9, .8], [-5, 9, .8]], bay: [-3.8, 0, 4, 1.6], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) {
      shape(c, rect(-1.2, s * 4.4, 1.2, s * 5.8), k.G, { noShadow: true });
      shape(c, rect(-5, s * 5.8 - 1.8 + (s > 0 ? 1.8 : 0) - (s > 0 ? 0 : 0), 5, s * 5.8 + 1.8 + (s > 0 ? 1.8 : 0)), k.T);
      barrel(c, 5, 17, s * 7.6, 1.5, k.G); lamp(c, 16.6, s * 7.6, .4, k.acc);
    }
    shape(c, mir([[8.6, 0], [7, 2.4], [2, 5], [-6, 5.2], [-9, 3], [-9, 0]]), k.M);
    shape(c, mir([[8.6, 0], [7, 2.4], [4, 2.7], [4, 0]]), k.T);
    seam(c, -1, -5, -1, 5); cab(k, 1.8, 0, 1.8, .9);
  } },
  /* Lv4 피난선(하양): 접시. 둥근 원반에 유리 돔, 가장자리에 도는 불빛 */
  oh1a: { eng: [[-10.6, -2.6, .9], [-10.6, 2.6, .9], [-11, 0, .9]], bay: [-4.6, 0, 4, 1.6], draw(k) {
    const c = k.c;
    ball(c, 0, 0, 11, 8.6, k.M);
    c.strokeStyle = k.T[1]; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 10, 7.7, 0, 0, TAU); c.stroke();
    ball(c, -.4, 0, 7.4, 5.7, k.T, { noShadow: true });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, on = Math.floor(k.tm * 2.4) % 2 === i % 2; lamp(c, Math.cos(a) * 10, Math.sin(a) * 7.7, .45, on ? k.acc : '#2a2a2a', on ? .95 : .8); }
    ball(c, 4, 0, 2.9, 2.2, ['#b9c9d6', '#51626f', '#1a232b', '#080b0e'], { noShadow: true });
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(4.6, -.8, 1.1, .5, -.2, 0, TAU); c.fill();
  } },
  /* Lv4 보급함(황갈): 구슬 연결선. 가는 뼈대에 연료 구체 셋이 꿰어 있다 */
  oh1b: { eng: [[-11, 0, 1.2], [-12, -7.5, .8], [-12, 7.5, .8]], bay: [2.8, 0, 3.4, 1.4], draw(k) {
    const c = k.c;
    for (const s of [-1, 1]) shape(c, [[-8, s * 3.8], [-12.4, s * 8.2], [-10, s * 3.8]], k.G);
    shape(c, mir([[13.4, 0], [12.4, 1.1], [-10.6, 1.3], [-11, 0]]), k.G);
    const balls = [[-5.2, 4.7, k.W], [2.8, 4.3, k.M], [9.6, 3.2, k.W]];
    for (const [x, r, pal] of balls) {
      ball(c, x, 0, r, r, pal);
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = .5; c.beginPath(); c.ellipse(x, 0, r * .3, r, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(x, 0, r, r * .3, 0, 0, TAU); c.stroke();
    }
    shape(c, [[13.4, -1], [11.6, -1.6], [11.6, 1.6], [13.4, 1]], k.T, { noShadow: true }); cab(k, 12.6, 0, .9, .6);
  } },
  /* Lv4 철갑 수송함(검정): 장갑 팔각 선체. 갈색 갑판, 앞의 충각, 포탑 둘 */
  oh2a: { eng: [[-10, -3.4, 1.2], [-10, 0, 1.2], [-10, 3.4, 1.2]], bay: [-.5, 0, 4.2, 1.8], draw(k) {
    const c = k.c;
    shape(c, [[16, 0], [12, 1.6], [12, -1.6]], k.G);
    shape(c, mir([[12, 0], [9.5, 3.4], [5.5, 6.4], [-6.5, 6.4], [-10, 4.8], [-10, 0]]), k.M);
    shape(c, mir([[7.6, 0], [5.8, 2.2], [3.4, 3.6], [-5.6, 3.6], [-7.6, 2.8], [-7.6, 0]]), k.G, { noShadow: true });
    for (const x of [-4.6, 3.2]) shape(c, rect(x, -1.3, x + 2.6, 1.3), k.T, { noShadow: true });
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let x = -8; x < 10; x += 2.4) { c.fillRect(x, -5.7, .5, .5); c.fillRect(x, 5.2, .5, .5); }
    for (const [x, y] of [[5.4, -3], [-4.5, 3.2]]) { barrel(c, x, x + 7, y, 1.3, k.G); ball(c, x, y, 1.9, 1.9, k.G); lamp(c, x + 6.4, y, .35, k.acc); }
    shape(c, rect(-8.4, -1.8, -5.2, 1.8), k.G); cab(k, 8.4, 0, 1.5, .8);
  } },
  /* Lv4 이동 요새(갈색): 십자 성채. 긴 선체를 가로지르는 성벽과 끝의 탑, 접시 안테나 */
  oh2b: { eng: [[-11.6, -2.4, .9], [-11.6, -.8, .9], [-11.6, .8, .9], [-11.6, 2.4, .9]], bay: [-6.6, 0, 4, 1.6], draw(k) {
    const c = k.c;
    shape(c, rect(-4.6, -10.4, 4.6, 10.4), k.T);
    c.fillStyle = k.T[3]; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) c.fillRect(-4.2 + i * 2.35, s > 0 ? 10.4 : -12, 1.5, 1.6);
    for (const s of [-1, 1]) { ball(c, 0, s * 10.6, 2.7, 2.7, k.G); lamp(c, 0, s * 10.6, .5, k.acc, .5 + .5 * Math.sin(k.tm * 3 + s)); }
    shape(c, mir([[15, 0], [12.4, 2.6], [9, 3.9], [-10, 3.9], [-11.6, 2.6], [-11.6, 0]]), k.M);
    shape(c, rect(-1, -3, 6, 3), k.G); seam(c, 2.5, -3, 2.5, 3);
    for (const s of [-1, 1]) { barrel(c, 6, 14, s * 2.6, 1.3, k.G); }
    c.strokeStyle = k.G[1]; c.lineWidth = 1.2; c.beginPath(); c.arc(-1.4, -6.6, 2.4, -PI / 2, PI / 2); c.stroke(); lamp(c, -1.4, -6.6, .5, k.acc);
    shape(c, [[13, -1], [15.2, 0], [13, 1]], k.K, { noShadow: true }); cab(k, 9.4, 0, 1.4, .8);
  } }
};

/** o: 상점 꾸밈 {fh, fs: 불꽃 색}, o.art: 기체 장식, o.nobay: 수송 구획 표시를 끈다(승계한 기체) */
export function drawOpsShip(c, d, flame, tm, sc, o) {
  if (d.t <= 2) { drawOpsFlat(c, d, flame, tm, sc, o); return; }   // Lv2 는 입체 표현 없이 단순하게
  const L = d.L, S = SHIPS[d.id]; if (!S) return;
  Q = d.t >= 4 ? 2 : 1;
  const fh = o && o.fh != null ? o.fh : L.h, fsa = o && o.fs != null ? o.fs : 30;
  const k = { c, tm, M: PAL[L.main] || PAL.black, T: PAL[L.trim] || PAL.white, G: PAL.gun, W: PAL.white, K: PAL.black, B: PAL.brown, acc: L.acc != null ? 'hsl(' + L.acc + ',100%,62%)' : '#e6edf2', hasAcc: L.acc != null, bay: d.t >= OPS.bayTier && !(o && o.nobay) };
  c.save(); c.scale(sc, sc); c.lineJoin = 'round'; c.lineCap = 'butt';
  const sb = c.shadowBlur; c.shadowBlur = 0;   // 호출한 쪽의 글로우는 몸체 실루엣에서 한 번만 쓴다(겹친 면마다 번지면 색이 번져 흐려진다)
  // 엔진 불꽃
  const fk = .25 + .75 * (flame || 0);
  S.eng.forEach(([x, y, w], i) => {
    const len = (3 + 6.5 * fk) * (1 + .25 * Math.sin(tm * 38 + i * 2)), gr = c.createLinearGradient(x, 0, x - len, 0);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.35, 'hsla(' + fh + ',' + fsa + '%,75%,.75)'); gr.addColorStop(1, 'hsla(' + fh + ',' + fsa + '%,65%,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(x, y - w); c.lineTo(x - len, y); c.lineTo(x, y + w); c.closePath(); c.fill();
  });
  if (S.halo) { const gr = c.createRadialGradient(0, 0, 4, 0, 0, 22); gr.addColorStop(0, 'rgba(235,240,255,0)'); gr.addColorStop(.7, 'rgba(235,240,255,.13)'); gr.addColorStop(1, 'rgba(235,240,255,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill(); }
  c.shadowBlur = sb; c.fillStyle = 'rgba(0,0,0,.01)'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill(); c.shadowBlur = 0;
  S.draw(k);
  if (S.bay) bayDoor(k, ...S.bay);
  S.eng.forEach(([x, y, w]) => { c.fillStyle = '#0c0d10'; c.fillRect(x - .9, y - w - .2, 1.5, w * 2 + .4); c.fillStyle = 'rgba(255,255,255,' + (.5 + .4 * fk) + ')'; c.fillRect(x - .7, y - w * .4, .7, w * .8); });
  if (o && o.art) o.art(c, tm, L, L.h);
  c.restore();
  Q = 2;   // 다른 그림(적 함선·행성)이 같은 면 그리기를 쓸 때는 항상 가장 정교하게
}
