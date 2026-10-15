/* 특수 이동 행성: 후반 난이도를 올리는 움직이는 행성 3종. 보스 1 격파 뒤부터 나오기 시작해 보스를 잡을수록 자주 나온다. 보스전에는 나오지 않고(freezeSpecial), 보스가 시작되면 평범한 행성으로 굳는다.
 *   lift  승강기: 세로로 크게 오르내린다. 다음 행성은 승강기가 가장 올라갔을 때만 닿는 거리에 두고, 대신 궤도 붕괴가 느리다
 *   moon  위성:   행성(host)의 포획 범위가 확 줄어든 대신 그 둘레를 도는 작은 위성이 있고, 위성의 궤도를 타고 나아간다
 *   pulse 맥동:   커졌다 작아졌다 한다. 일반 모드는 포획 링 폭이 그대로 따라 커지고, 블랙쉽은 링이 고정이라 몸이 부풀수록 링이 좁아진다 (더 빠르고 더 크게 출렁인다)
 * 가로 시야가 잘리지 않도록 세 종류 모두 가장 멀리 퍼졌을 때의 범위가 벽 안에 들어오게 x 를 고른다. */
import { G } from './state.js';
import { rnd, clamp, TAU } from './util.js';
import { fs } from './stats.js';

export const SPECIAL = {
  from: 1,                 // 이 보스 수 이상 격파해야 나온다
  base: .12, step: .06, max: .45,   // 새 행성이 특수일 확률: 보스 1 격파 12% → 한 보스마다 +6%p → 최대 45%
  leadOff: 3,              // 다음 보스까지 이만큼(행성 수) 남았으면 만들지 않는다
  ringFac: 1.5,            // 포획 링은 인력 능력치로 이만큼까지 커질 수 있다: 가로 여유 계산용
  liftDec: .5, moonDec: .8 // 궤도 붕괴 속도 배율 (승강기는 이것만 거쳐 가는 배치라 느리게)
};

/** 이번에 만들 행성이 특수 행성이면 그 종류, 아니면 null */
export function pickSpecial(prev) {
  const k = G.kills, F = G.fork;
  if (G.tuto || G.boss || k < SPECIAL.from || prev.sp || prev.drift) return null;
  if (F && (F.state !== 'queued' || G.genI >= F.at - 1)) return null;     // 갈림길이 놓일 자리 앞뒤는 평범하게
  if (G.nextBoss - G.hops <= SPECIAL.leadOff) return null;
  if (Math.random() >= Math.min(SPECIAL.base + SPECIAL.step * (k - SPECIAL.from), SPECIAL.max)) return null;
  const r = Math.random();
  return r < .34 ? 'lift' : r < .67 ? 'moon' : 'pulse';
}

const reach = (R, ring) => R + ring * SPECIAL.ringFac;   // 포획 링이 가장 넓게 퍼졌을 때 중심에서의 거리

/** p(방금 만든 평범한 행성)를 특수 행성으로 바꾼다. mk = 행성 생성 함수(위성용). 반환: { post: 다음 행성 앞에 더 비울 간격, moon: 같이 만든 위성 }  */
export function applySpecial(kind, p, mk) {
  const k = fs(), ring = p.cap - p.R;
  let pre = 0, post = 0, ext = 0, moon = null;
  switch (kind) {
    case 'lift': {
      const A = rnd(88, 112) * k;
      pre = A; post = A * .9; ext = reach(p.R, ring);
      p.y -= pre; p.hue = 178;
      p.sp = { k: 'lift', y0: p.y, A, w: rnd(.75, .95), t: rnd(0, TAU), dec: SPECIAL.liftDec };
      break;
    }
    case 'moon': {
      const Rm = p.R + 64 * k;
      moon = mk(p.i, p.x, p.y, G.biome, 'n');
      moon.R = rnd(13, 16) * k; moon.cap = moon.R + 52 * k; moon.hue = 268;
      p.cap = p.R + Math.max(ring * .38, 26 * k); p.hue = 262;   // 위성이 도는 행성은 포획 범위가 확 줄어든다
      pre = Rm * .6; post = Rm * .6; ext = Rm + reach(moon.R, moon.cap - moon.R);
      p.y -= pre;
      p.sp = { k: 'host', moon, dec: 1 };
      moon.sp = { k: 'moon', host: p, Rm, w: (Math.random() < .5 ? -1 : 1) * rnd(.6, .8), t: rnd(0, TAU), dec: SPECIAL.moonDec };
      break;
    }
    default: {   // pulse
      const o = !!G.ops, R0 = p.R, hi = o ? 1.7 : 1.55;
      p.sp = { k: 'pulse', v: o ? 'o' : 'n', R0, ring0: ring, cap0: p.cap, lo: o ? .5 : .62, hi, w: o ? 2.1 : 1.35, t: rnd(0, TAU), dec: 1 };
      p.hue = o ? 150 : 325;
      ext = o ? reach(R0 * .5, p.cap - R0 * .5) : reach(R0 * hi, ring);   // 블랙쉽은 링이 고정이라 몸이 가장 작을 때 가장 넓다
      pre = post = R0 * (hi - 1) * .5; p.y -= pre;
    }
  }
  p.x = G.w < 2 * ext + 12 ? G.w / 2 : clamp(p.x, ext + 6, G.w - ext - 6);   // 가장 퍼졌을 때도 좌우 벽 안에 들어오게
  if (moon) animateSpecial(moon, 0);
  return { post, moon };
}

/** 매 프레임: 특수 행성을 움직인다 */
export function animateSpecial(p, dt) {
  const q = p.sp; if (!q) return;
  if (G.boss) { freezeSpecial(p); return; }
  q.t += dt * (q.w || 0);
  switch (q.k) {
    case 'lift': p.y = q.y0 + Math.sin(q.t) * q.A; break;
    case 'moon': p.x = q.host.x + Math.cos(q.t) * q.Rm; p.y = q.host.y + Math.sin(q.t) * q.Rm; break;
    case 'pulse': {
      const R = q.R0 * (q.lo + (q.hi - q.lo) * (Math.sin(q.t) + 1) / 2), dR = R - p.R, s = G.ship;
      p.R = R; p.cap = q.v === 'o' ? q.cap0 : R + q.ring0;
      if (dR > 0 && s.mode === 'orb' && s.p === p) s.r += dR;   // 몸이 부풀면 도는 기체를 바깥으로 민다
    }
  }
}

/** 보스전이 시작될 때: 움직임을 멈추고 평범한 행성으로 굳힌다 */
export function freezeSpecial(p) {
  const q = p.sp; if (!q) return;
  if (q.k === 'pulse') {
    p.R = q.R0; p.cap = q.cap0;
    const s = G.ship; if (s && s.mode === 'orb' && s.p === p) s.r = Math.max(s.r, p.R + 16 * fs());
  }
  p.sp = null;
}
