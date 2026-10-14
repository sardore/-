/* 보스·공격 예고·존·블랙홀·항성풍 그리기 (논리 상태는 읽기만 한다) */
import { G, V, g } from './state.js';
import { PI, TAU, rnd, clamp, hexA, easeOut } from './util.js';
import { fs, arenaK } from './stats.js';
import { ATK } from './data.js';
import { drawBossBody } from './boss-art.js';
import { txt } from './gfx.js';
import { place } from './boss-zones.js';
import { drawBossGhosts } from './ops-boss-move.js';
import { isSkill, skillDrawTele, skillDraw } from './ops-skills.js';

/* ---------- 작은 도형 도우미: 현재 fillStyle / strokeStyle 로 원을 채우거나 두른다 ---------- */
const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const ring = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const dashed = (on, off, offset) => { g.setLineDash([on, off]); if (offset != null) g.lineDashOffset = offset; };
const solid = () => g.setLineDash([]);

/** 몸 바깥으로 번지는 빛의 반지름 배율 (뿔·고리가 큰 보스는 더 넓게) */
const GLOW = { bull: 3.4, swirl: 3.4, quasar: 3, ship: 1.5 };

/* ---------- 보스 ---------- */
export function drawBoss(b) {
  const R = b.R, h = b.d.hue, k = b.d.kind, dying = b.state === 'dying';
  let sc = b.state === 'intro' ? easeOut(b.st / 1.8) : 1;
  sc *= k === 'pulse' ? 1 + .06 * Math.sin(G.T * 3.2) : (k === 'super' || k === 'eta') ? 1 + .03 * Math.sin(G.T * 2) : 1;
  g.save();
  g.translate(b.x + (dying ? rnd(-4, 4) : 0), b.y + (dying ? rnd(-4, 4) : 0));
  g.scale(sc * (1 + .1 * b.sq), sc * (1 - .1 * b.sq));
  if (dying) g.globalAlpha = clamp(1 - (b.st - 1.6) / 1, 0, 1);
  const glow = GLOW[k] || 2.5, quasar = k === 'quasar';
  const gl = g.createRadialGradient(0, 0, R * .5, 0, 0, R * glow);
  gl.addColorStop(0, 'hsla(' + h + ',95%,' + (quasar ? '55' : '60') + '%,' + (quasar ? .35 : .5) + ')');
  gl.addColorStop(1, 'hsla(' + h + ',95%,60%,0)');
  g.fillStyle = gl; disc(0, 0, R * glow);
  if (b.cast > 0) { // 공격을 준비하면 바깥에서 안으로 모이는 충전 링
    const kc = b.cast / .9, cc = G.castO ? G.castO.c : '#fff';
    g.strokeStyle = hexA(cc.length === 7 ? cc : '#ffffff', .8 * (1 - kc * .6)); g.lineWidth = 3 + 4 * (1 - kc); ring(0, 0, R * (1.1 + 1.9 * kc));
    g.strokeStyle = 'rgba(255,255,255,' + .6 * (1 - kc) + ')'; g.lineWidth = 2; ring(0, 0, R * (1.05 + .9 * kc));
  }
  if (quasar) { drawQuasar(b, R); g.restore(); return; }
  if (b.gh) drawBossGhosts(g, b, h);   // 블랙쉽 함선의 급이동 잔상
  drawBossBody(b);
  if (b.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + clamp(b.flash * 5, 0, .9) + ')'; disc(0, 0, R); }
  g.restore();
}

/** TON 618: 양쪽으로 뻗는 제트, 기울어진 강착 원반, 검은 사건의 지평선 */
function drawQuasar(b, R) {
  const rot = G.T * .6, tilt = -.28;
  const diskRing = (f, arc) => { // 원반의 한 고리. f 가 클수록 바깥쪽
    const rx = R * (1.15 + f * 2.1);
    g.lineWidth = 7 - f * 4.5; g.beginPath(); g.ellipse(0, 0, rx, rx * .26, 0, 0, arc); g.stroke();
  };
  for (const sg of [-1, 1]) { // 제트
    const jl = g.createLinearGradient(0, 0, 0, sg * R * 6), w = R * (.9 + .2 * Math.sin(G.T * 5));
    jl.addColorStop(0, 'rgba(210,160,255,.75)'); jl.addColorStop(1, 'rgba(150,90,255,0)');
    g.fillStyle = jl; g.beginPath(); g.moveTo(-R * .25, 0); g.lineTo(R * .25, 0); g.lineTo(w, sg * R * 6); g.lineTo(-w, sg * R * 6); g.closePath(); g.fill();
  }
  g.save(); g.rotate(tilt);
  for (let i = 0; i < 9; i++) {
    const f = i / 9;
    g.strokeStyle = 'hsla(' + (40 - f * 60 + (f > .6 ? 240 : 0)) + ',100%,' + (80 - f * 35) + '%,' + (.9 - f * .55) + ')'; diskRing(f, TAU);
  }
  g.fillStyle = 'rgba(255,240,200,.9)'; // 원반을 도는 불꽃
  for (let i = 0; i < 5; i++) {
    const a = rot * (1.3 - i * .1) + i * 1.4, rx = R * (1.15 + (.15 + i * .17) * 2.1);
    disc(Math.cos(a) * rx, Math.sin(a) * rx * .26, 3.2);
  }
  g.restore();
  g.fillStyle = '#000'; disc(0, 0, R * .92);
  g.strokeStyle = 'rgba(255,230,190,' + (.8 + .2 * Math.sin(G.T * 4)) + ')'; g.lineWidth = 3; ring(0, 0, R * .94);
  g.strokeStyle = 'rgba(190,140,255,.5)'; g.lineWidth = 2; ring(0, 0, R * 1.08 + 2 * Math.sin(G.T * 3));
  g.save(); g.rotate(tilt); // 앞쪽 원반: 아래쪽 호만 위에 덧그린다
  for (let i = 0; i < 5; i++) { const f = i / 9; g.strokeStyle = 'hsla(' + (40 - f * 60) + ',100%,' + (80 - f * 35) + '%,' + (.9 - f * .55) + ')'; diskRing(f, PI); }
  g.restore();
  if (b.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + clamp(b.flash * 5, 0, .9) + ')'; disc(0, 0, R * .95); }
}

/* ---------- 공격 예고 ---------- */
/** 앞으로 올 공격의 범위·남은 턴을 보여 준다. 다음 턴에 터지는 것(urgent)은 더 진하게 깜빡인다 */
export function drawTele(a, b) {
  const c = ATK[a.k].c, urgent = a.t <= 1, pul = .5 + .5 * Math.sin(G.T * (urgent ? 13 : 6)), gr = easeOut(a.age / .45);
  const fa = urgent ? .18 + .07 * pul : .035, la = urgent ? .95 * (.55 + .45 * pul) : .26;
  const shape = path => { // 채우고 점선 테두리
    g.fillStyle = hexA(c, fa); path(); g.fill();
    g.strokeStyle = hexA(c, la); g.lineWidth = urgent ? 3 : 1.2; dashed(urgent ? 9 : 3, urgent ? 7 : 9, -G.T * (urgent ? 30 : 8)); path(); g.stroke(); solid();
  };
  const circ = (x, y, r) => () => { g.beginPath(); g.arc(x, y, Math.max(1, r * gr), 0, TAU); };
  const wedge = (an, half, len) => () => { g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, len * gr, an - half, an + half); g.closePath(); };
  const cnt = (x, y, sz) => { // 남은 턴 숫자
    const r = (sz || 13) * (urgent ? 1 : .8);
    g.globalAlpha = urgent ? 1 : .55; g.fillStyle = 'rgba(10,8,24,.85)'; disc(x, y, r);
    g.strokeStyle = urgent ? '#ff6a6a' : c; g.lineWidth = 2; g.stroke();
    txt(String(a.t), x, y + r * .42, r * 1.2, urgent ? '#ff8a8a' : '#fff', 'center', 800); g.globalAlpha = 1;
  };
  const warn = (x, y, sz) => { if (!urgent) return; g.globalAlpha = .5 + .5 * pul; txt('⚠', x, y + sz * .35, sz, c, 'center', 800); g.globalAlpha = 1; };
  switch (a.k) {
    case 'meteor': a.zs.forEach(z => { shape(circ(z.x, z.y, z.r)); warn(z.x, z.y - 2, 26); cnt(z.x, z.y + z.r * .62, 11); }); break;
    case 'comet': { a.zs.forEach(z => shape(circ(z.x, z.y, z.r))); const z = a.zs[0]; if (z) cnt(z.x, z.y, 11); break; }
    case 'beam': { shape(wedge(a.a, a.half, a.len)); const d = 150 * fs(); cnt(clamp(b.x + Math.cos(a.a) * d, 20, G.w - 20), b.y + Math.sin(a.a) * d); break; }
    case 'jet': for (const an of a.as) shape(wedge(an, a.half, a.len)); cnt(b.x, b.y + b.hr + 48); break;
    case 'flare': shape(circ(b.x, b.y, a.r)); cnt(clamp(b.x + Math.cos(.9) * a.r, 22, G.w - 22), b.y + Math.sin(.9) * a.r); break;
    case 'hole': case 'sing': {
      const big = a.k === 'sing' ? 1.6 : 1;
      g.strokeStyle = hexA(c, .3); g.lineWidth = 1.5; dashed(4, 8); ring(a.x, a.y, (a.pull || 150 * fs()) * gr); solid();
      shape(circ(a.x, a.y, 34 * big)); g.fillStyle = '#000'; disc(a.x, a.y, 10 * big * gr); cnt(a.x, a.y - 48 * big, 11); break;
    }
    case 'collapse': {
      const p = a.p; shape(circ(p.x, p.y, a.r));
      g.strokeStyle = hexA(c, .9 * (.5 + .5 * pul)); g.lineWidth = 3; ring(p.x, p.y, p.R + 6);
      g.strokeStyle = hexA('#ffffff', .6); g.lineWidth = 1.5; // 갈라지는 금
      g.beginPath(); g.moveTo(p.x - p.R * .5, p.y - p.R * .8); g.lineTo(p.x + 2, p.y - 2); g.lineTo(p.x - p.R * .2, p.y + p.R * .6); g.moveTo(p.x + 2, p.y - 2); g.lineTo(p.x + p.R * .7, p.y + p.R * .3); g.stroke();
      cnt(p.x, p.y - p.R - 18, 11); break;
    }
    case 'wind': { // 한쪽 벽에서 밀려오는 바람
      const x = a.dir > 0 ? 0 : G.w, bw = 120 * fs(), mid = (G.arenaTop + G.arenaBot) / 2, tx = a.dir > 0 ? 40 * fs() : G.w - 40 * fs();
      const gg = g.createLinearGradient(x, 0, x + a.dir * bw, 0);
      gg.addColorStop(0, hexA(c, .22)); gg.addColorStop(1, hexA(c, 0));
      g.fillStyle = gg; g.fillRect(a.dir > 0 ? 0 : G.w - bw, G.arenaTop, bw, G.arenaBot - G.arenaTop);
      txt(a.dir > 0 ? '▶▶▶' : '◀◀◀', tx, mid, 24 * fs(), c, 'center', 800); cnt(tx, mid - 30 * fs()); break;
    }
    case 'dump': { // 무단 투하: 쓰레기가 떨어질 길은 붉게, 비워 둔 길은 초록 줄로 보여 준다(글자 없음)
      const top = G.arenaTop, bot = G.arenaBot, fk = fs();
      g.fillStyle = hexA('#ff6a4a', .05 + .05 * pul); for (const x of a.xs) g.fillRect(x - 15 * fk, top, 30 * fk, bot - top);
      shape(() => { g.beginPath(); for (const x of a.xs) g.rect(x - 15 * fk, top, 30 * fk, bot - top); });
      g.fillStyle = hexA('#8aff9a', .13 + .07 * pul);
      for (const gp of a.gaps) { g.fillRect(gp[0], top, gp[1] - gp[0], bot - top); g.strokeStyle = hexA('#8aff9a', .5 + .3 * pul); g.lineWidth = 1.5; line(gp[0], top, gp[0], bot); line(gp[1], top, gp[1], bot); }
      cnt(G.w / 2, top + 70 * fk); break;
    }
    default: if (isSkill(a.k)) skillDrawTele(a, b, { c, shape, cnt, warn, gr, pul });
    else if (a.zones) { // 고유 패턴: 존 정의를 그대로 예고로 그린다
      const ps = a.zones.map(z => place(z, b));
      ps.forEach(p => { shape(() => zonePath(p, gr)); if (p.shape === 'c' && p.r < 200) warn(p.x, p.y - 2, 22); });
      const p0 = ps[0], fk = fs();
      if (p0.shape === 'c' && p0.r < 200) cnt(p0.x, p0.y - p0.r - 12);
      else if (p0.shape === 'b' && p0.w > p0.hh) cnt(G.w - 24 * fk, p0.y);
      else if (p0.shape === 'b') cnt(clamp(p0.x, 22, G.w - 22), b.y + b.hr + 60 * fk);
      else cnt(b.x, b.y + b.hr + 48 * fk);
    }
  }
  g.globalAlpha = 1;
}

/* ---------- 존(범위 공격) ---------- */
/** 존의 모양: 원(c) · 보스에서 뻗는 부채꼴(w) · 띠(b) · 도넛(o). k 는 크기 배율 */
function zonePath(h, k) {
  g.beginPath();
  if (h.shape === 'c') g.arc(h.x, h.y, Math.max(1, h.r * k), 0, TAU);
  else if (h.shape === 'b') { const hz = h.w > h.hh, w = hz ? h.w : h.w * k, hh = hz ? h.hh * k : h.hh; g.rect(h.x - w, h.y - hh, w * 2, hh * 2); }   // 띠: 가는 쪽만 줄어든다
  else if (h.shape === 'o') { g.arc(h.x, h.y, Math.max(1, h.r2 * k), 0, TAU); g.moveTo(h.x + h.r1 * k, h.y); g.arc(h.x, h.y, Math.max(.5, h.r1 * k), 0, TAU, true); }
  else { g.moveTo(h.x, h.y); g.arc(h.x, h.y, h.len * k, h.a - h.half, h.a + h.half); g.closePath(); }
}

/** 운석: 위에서 비스듬히 떨어지는 꼬리 달린 바위 */
function drawFallingMeteor(h, f) {
  const ff = f * f, x = h.x + (1 - ff) * 70, y = h.y - (1 - ff) * (h.y - G.arenaTop + 90);
  const tailY = y - Math.max(80, (h.y - G.arenaTop) * (1 - ff) * .45);
  const tl = g.createLinearGradient(x, y, x + 70 * (1 - ff) + 10, tailY);
  tl.addColorStop(0, 'rgba(255,200,120,.95)'); tl.addColorStop(1, 'rgba(255,100,40,0)');
  g.strokeStyle = tl; g.lineWidth = 12; g.lineCap = 'round'; line(x, y, x + 70 * (1 - ff) * .45 + 8, tailY); g.lineCap = 'butt';
  g.save(); g.translate(x, y); g.rotate(G.T * 6); g.fillStyle = '#9a6244'; g.strokeStyle = '#ffd8a8'; g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, r2 = 17 * (.8 + .35 * ((i * 53) % 7) / 7);
    i ? g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2) : g.moveTo(Math.cos(a) * r2, Math.sin(a) * r2);
  }
  g.closePath(); g.fill(); g.stroke(); g.restore();
}
/** 혜성: 빠르게 내리꽂히는 밝은 머리와 꼬리 */
function drawFallingComet(h, f) {
  const ff = f * f, y = h.y - (1 - ff) * 220, x = h.x - (1 - ff) * 50;
  g.strokeStyle = 'rgba(180,240,255,.9)'; g.lineWidth = 7; g.lineCap = 'round'; line(x, y, x - 26 * (1 - ff), y - 80 * (1 - ff)); g.lineCap = 'butt';
  g.fillStyle = '#fff'; g.shadowColor = '#9fe8ff'; g.shadowBlur = 14; disc(x, y, 7); g.shadowBlur = 0;
}
/** 행성 붕괴: 대상 행성에서 균열이 뻗어 나간다 */
function drawCracking(h, f) {
  g.strokeStyle = hexA('#ffffff', .8); g.lineWidth = 2; g.beginPath();
  for (let i = 0; i < 5; i++) {
    const an = i * 1.26 + G.T * 3, r1 = h.p.R * .3, r2 = h.p.R * (.6 + f * .7);
    g.moveTo(h.p.x + Math.cos(an) * r1, h.p.y + Math.sin(an) * r1); g.lineTo(h.p.x + Math.cos(an + .3) * r2, h.p.y + Math.sin(an + .3) * r2);
  }
  g.stroke();
}

/** 존 한 개: 대기(점선) → 충전(깜빡이며 차오름) → 폭발 → 잔광 */
export function drawZone(h) {
  const t = h.t, t0 = h.delay, t1 = t0 + h.fuse, t2 = t1 + h.blast, col = h.col;
  if (t < t0) { // 아직 차례가 아니다
    g.fillStyle = hexA(col, .1); zonePath(h, 1); g.fill();
    g.strokeStyle = hexA(col, .7); g.lineWidth = 2; dashed(8, 8, -G.T * 30); g.stroke(); solid(); return;
  }
  if (t < t1) { // 충전
    const f = (t - t0) / h.fuse, bl = .5 + .5 * Math.sin(G.T * (26 + f * 20));
    g.fillStyle = hexA(col, .14 + .1 * bl); zonePath(h, 1); g.fill();
    g.fillStyle = hexA(col, .22 + .38 * f); zonePath(h, Math.max(.03, f * f * .55 + f * .45)); g.fill();
    g.strokeStyle = hexA('#ffffff', .45 + .55 * bl); g.lineWidth = 2.5 + f * 2.5; zonePath(h, 1); g.stroke();
    if (h.shape === 'c') {
      g.strokeStyle = hexA(col, .9 * (1 - f)); g.lineWidth = 2.5; ring(h.x, h.y, h.r * (1.7 - .7 * f));
      const r = h.r * .5; g.strokeStyle = hexA('#ffffff', .5); g.lineWidth = 1.5; // 조준 십자
      g.beginPath(); g.moveTo(h.x - r, h.y); g.lineTo(h.x + r, h.y); g.moveTo(h.x, h.y - r); g.lineTo(h.x, h.y + r); g.stroke();
      if (h.kind === 'meteor') drawFallingMeteor(h, f);
      else if (h.kind === 'comet') drawFallingComet(h, f);
      else if (h.kind === 'collapse' && h.p) drawCracking(h, f);
    } else if (h.shape === 'w') { // 부채꼴: 가장자리 레이저가 번쩍
      g.strokeStyle = hexA('#ffffff', .5 + .5 * bl); g.lineWidth = 2;
      for (const sg of [-1, 1]) line(h.x, h.y, h.x + Math.cos(h.a + sg * h.half) * h.len * f, h.y + Math.sin(h.a + sg * h.half) * h.len * f);
    }
    return;
  }
  if (t < t2) { // 폭발
    const k = (t - t1) / h.blast;
    if (h.kind === 'pool') drawPool(h, t - t1, t2 - t1);
    else if (h.shape === 'c') {
      const rg = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * (.85 + .3 * k));
      rg.addColorStop(0, 'rgba(255,255,255,' + (1 - k * .5) + ')'); rg.addColorStop(.45, hexA(col, .85 * (1 - k * .5))); rg.addColorStop(1, hexA(col, 0));
      g.fillStyle = rg; disc(h.x, h.y, h.r * (.85 + .3 * k));
      g.strokeStyle = hexA('#ffffff', 1 - k); g.lineWidth = 5 * (1 - k) + 1; ring(h.x, h.y, h.r * (.7 + .4 * k));
    } else if (h.shape !== 'w') { // 띠·도넛: 켜질 때·꺼질 때 서서히, 한가운데는 하얗게
      const ap = clamp(Math.min(t < t1 + .08 ? (t - t1) / .08 : 1, (t2 - t) / .2), 0, 1);
      g.save(); zonePath(h, 1); g.clip(); g.globalAlpha = ap;
      g.fillStyle = hexA(col, .8); g.fillRect(h.x - (h.w || h.r2), h.y - (h.hh || h.r2), (h.w || h.r2) * 2, (h.hh || h.r2) * 2);
      g.fillStyle = 'rgba(255,255,255,' + (.75 * (1 - k * .5)) + ')'; zonePath(h, .5); g.fill();
      g.restore(); g.globalAlpha = ap; g.strokeStyle = '#fff'; g.lineWidth = 3; zonePath(h, 1); g.stroke(); g.globalAlpha = 1;
    } else {
      g.save(); zonePath(h, 1); g.clip();
      const gg = g.createLinearGradient(h.x, h.y, h.x + Math.cos(h.a) * h.len, h.y + Math.sin(h.a) * h.len);
      gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(.3, hexA(col, .75)); gg.addColorStop(1, hexA(col, .3));
      const ap = t < t1 + .1 ? (t - t1) / .1 : t > t2 - .2 ? (t2 - t) / .2 : 1;   // 켜질 때·꺼질 때 서서히
      g.globalAlpha = clamp(ap, 0, 1); g.fillStyle = gg; g.fillRect(h.x - h.len, h.y - h.len, h.len * 2, h.len * 2);
      for (let i = 0; i < 7; i++) { // 보스에서 퍼져 나가는 파동
        const r = (G.T * 620 + i * h.len / 7) % h.len;
        g.strokeStyle = hexA('#ffffff', .5 * (1 - r / h.len)); g.lineWidth = 4; g.beginPath(); g.arc(h.x, h.y, r, h.a - h.half, h.a + h.half); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { const an = h.a + i / 3 * h.half * .9; line(h.x, h.y, h.x + Math.cos(an) * h.len, h.y + Math.sin(an) * h.len); }
      g.restore(); g.globalAlpha = clamp(ap, 0, 1); g.strokeStyle = '#fff'; g.lineWidth = 3; zonePath(h, 1); g.stroke(); g.globalAlpha = 1;
    }
    return;
  }
  const fk = 1 - (t - t2) / h.fade; if (fk <= 0) return; // 잔광
  if (h.shape === 'c') { g.fillStyle = hexA(col, .16 * fk); disc(h.x, h.y, h.r * .95); g.strokeStyle = hexA(col, .5 * fk); g.lineWidth = 2; ring(h.x, h.y, h.r * .95); }
  else if (h.shape !== 'w') { g.fillStyle = hexA(col, .14 * fk); zonePath(h, 1); g.fill(); g.strokeStyle = hexA(col, .45 * fk); g.lineWidth = 2; g.stroke(); }
}

/** 독 웅덩이: 오래 남는 부글거리는 독 (e: 지나간 시간, dur: 전체) */
function drawPool(h, e, dur) {
  const a = clamp(Math.min(e / .25, (dur - e) / .6), 0, 1), pul = .5 + .5 * Math.sin(G.T * 5 + h.x);
  const rg = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
  rg.addColorStop(0, hexA('#d8ffb0', .7 * a)); rg.addColorStop(.7, hexA('#3fd04a', .55 * a)); rg.addColorStop(1, hexA('#1f8a2a', .15 * a));
  g.fillStyle = rg; disc(h.x, h.y, h.r * (1 + .03 * pul));
  g.strokeStyle = hexA('#b8ff9a', (.55 + .35 * pul) * a); g.lineWidth = 2.5; ring(h.x, h.y, h.r);
  for (let i = 0; i < 4; i++) { // 올라오는 거품
    const f = (G.T * .7 + i * .27 + h.x * .013) % 1, an = i * 2.1 + h.y * .05, d = h.r * .6 * ((i % 2) ? .5 : 1);
    g.strokeStyle = hexA('#e8ffd0', .8 * (1 - f) * a); g.lineWidth = 1.5; ring(h.x + Math.cos(an) * d, h.y + Math.sin(an) * d - f * 10, 2 + f * 5);
  }
}

/* ---------- 위험 요소 (존 · 블랙홀 · 항성풍) ---------- */
export function drawHaz(h) {
  switch (h.k) {
    case 'rbeam': { // 핵 응축선의 광선: 반대쪽으로 뻗는 두 줄기가 느리게 돈다
      const b = G.boss; if (!b) break;
      const ap = clamp((h.t - .3) / 1.0, 0, 1), live = h.t >= 1.3, pu = .5 + .5 * Math.sin(G.T * 7);
      for (const sg of [0, PI]) {
        const an = h.ang + sg, hf = h.half * (live ? 1 : .35 + .65 * Math.min(1, (h.t - .3) / 1.0));
        g.save(); g.globalAlpha = ap;
        g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, h.len, an - hf, an + hf); g.closePath(); g.clip();
        const gg = g.createLinearGradient(b.x, b.y, b.x + Math.cos(an) * h.len, b.y + Math.sin(an) * h.len);
        gg.addColorStop(0, 'rgba(255,255,255,.95)'); gg.addColorStop(.2, 'rgba(255,170,90,' + (live ? .8 : .35) + ')'); gg.addColorStop(1, 'rgba(255,120,60,' + (live ? .3 : .1) + ')');
        g.fillStyle = gg; g.fillRect(b.x - h.len, b.y - h.len, h.len * 2, h.len * 2);
        g.strokeStyle = 'rgba(255,255,255,' + (.5 + .4 * pu) + ')'; g.lineWidth = 2.2; line(b.x, b.y, b.x + Math.cos(an) * h.len, b.y + Math.sin(an) * h.len);
        for (let i = 0; i < 5; i++) { const r = (G.T * 420 + i * h.len / 5) % h.len; g.strokeStyle = 'rgba(255,255,255,' + .4 * (1 - r / h.len) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, r, an - hf, an + hf); g.stroke(); }
        g.restore();
        if (!live) { g.save(); g.globalAlpha = .6; g.strokeStyle = 'rgba(255,200,140,.8)'; g.lineWidth = 1.5; dashed(8, 8, -G.T * 30); for (const e of [-1, 1]) line(b.x, b.y, b.x + Math.cos(an + e * h.half) * h.len, b.y + Math.sin(an + e * h.half) * h.len); solid(); g.restore(); }
      }
      break;
    }
    case 'zone': drawZone(h); break;
    default: if (h.k.startsWith('o_')) skillDraw(h); break;
    case 'hole': {
      const rr0 = h.r * easeOut(h.born);
      g.strokeStyle = 'rgba(200,140,255,.28)'; g.lineWidth = 1.5; dashed(4, 8); ring(h.x, h.y, h.pull || 150 * fs()); solid();
      const hg = g.createRadialGradient(h.x, h.y, rr0 * .6, h.x, h.y, rr0 * 6);
      hg.addColorStop(0, 'rgba(170,90,255,.6)'); hg.addColorStop(1, 'rgba(170,90,255,0)');
      g.fillStyle = hg; disc(h.x, h.y, rr0 * 6);
      g.strokeStyle = 'rgba(220,170,255,.9)'; g.lineWidth = 2;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(h.x, h.y, rr0 + 4 + k * 6, G.T * 3 + k * 1.3, G.T * 3 + k * 1.3 + 1.4); g.stroke(); }
      g.fillStyle = '#000'; disc(h.x, h.y, rr0);
      txt(String(h.turns), h.x, h.y - rr0 - 12, 14, '#d8b0ff', 'center', 800); break;
    }
    case 'horizon': drawHorizon(h); break;
    case 'wind': {
      const x = h.dir > 0 ? 0 : G.w, bw = 100 * fs(), gg = g.createLinearGradient(x, 0, x + h.dir * bw, 0);
      gg.addColorStop(0, 'rgba(138,255,200,.2)'); gg.addColorStop(1, 'rgba(138,255,200,0)');
      g.fillStyle = gg; g.fillRect(h.dir > 0 ? 0 : G.w - bw, G.arenaTop, bw, G.arenaBot - G.arenaTop); break;
    }
  }
}

/** 사건의 지평선: 아래쪽에서 솟아오르는 거대한 검은 지평선과 그 둘레를 도는 강착 고리, 아래가 보랏빛으로 짙어지는 안개 */
function drawHorizon(h) {
  const K = arenaK(), f = easeOut(h.f), T = G.T, cx = G.w / 2, R = 380 * K, top = G.arenaBot - 66 * K * f, cy = top + R, pul = .5 + .5 * Math.sin(T * 2.2);
  g.save(); g.beginPath(); g.rect(0, G.arenaBot - 420 * K, G.w, 700 * K); g.clip();
  const fog = g.createLinearGradient(0, G.arenaBot - 300 * K, 0, G.arenaBot + 60 * K);
  fog.addColorStop(0, 'rgba(90,30,170,0)'); fog.addColorStop(1, 'rgba(90,30,170,' + .38 * f + ')'); g.fillStyle = fog; g.fillRect(0, G.arenaBot - 300 * K, G.w, 400 * K);
  const rg = g.createRadialGradient(cx, cy, R * .98, cx, cy, R + 130 * K);
  rg.addColorStop(0, 'rgba(255,200,140,' + (.6 + .2 * pul) * f + ')'); rg.addColorStop(.22, 'rgba(190,90,255,' + .42 * f + ')'); rg.addColorStop(1, 'rgba(90,30,180,0)');
  g.fillStyle = rg; disc(cx, cy, R + 130 * K);
  g.fillStyle = '#000'; disc(cx, cy, R);
  for (let i = 0; i < 4; i++) { // 도는 강착 고리
    g.strokeStyle = 'hsla(' + (30 + i * 45) + ',100%,' + (74 - i * 6) + '%,' + (.62 - i * .12) * f + ')'; g.lineWidth = 3.2 - i * .6;
    dashed(60 + i * 34, 26 + i * 8, -T * (70 + i * 28) * (i % 2 ? -1 : 1)); ring(cx, cy, R + 7 + i * 15 * K);
  }
  solid(); g.strokeStyle = 'rgba(255,236,200,' + (.75 + .25 * pul) * f + ')'; g.lineWidth = 3; ring(cx, cy, R + 1);
  g.restore();
}

/** 보스전의 바닥(화면 아래)은 낙사선이다. 기체가 가까워질수록 아래쪽이 붉게 깜빡인다 (화면 좌표) */
export function drawFloorWarn() {
  const b = G.boss; if (!b || b.state !== 'fight') return;
  const { VW, VH } = V, gap = (G.arenaBot - G.ship.y) / arenaK();   // 화면 기준으로 남은 높이
  const d = clamp(1 - gap / 150, 0, 1), pul = .5 + .5 * Math.sin(G.T * (6 + 12 * d)), h = 64 + 50 * d;
  const gr = g.createLinearGradient(0, VH - h, 0, VH);
  gr.addColorStop(0, 'rgba(255,60,60,0)'); gr.addColorStop(1, 'rgba(255,60,60,' + (.1 + d * (.18 + .4 * pul)) + ')');
  g.fillStyle = gr; g.fillRect(0, VH - h, VW, h);
  if (d > .2) { g.globalAlpha = clamp(d * 1.4, 0, 1) * (.6 + .4 * pul); txt('▼ 추락 위험 ▼', VW / 2, VH - 78, 15, '#ff8a8a', 'center', 800); g.globalAlpha = 1; }
}
