// 휴리스틱 AI: 가능한 행동마다 상태를 복제해 한 수 앞을 시뮬레이션하고 평가값이 가장 높은 행동을 고른다.
import * as E from './engine.js';
const { clone, act, enumerate, info, eTotal, teamUnits, status } = E;

const STATUS_W = { poison: 18, slow: 12, paralyze: 28, burn: 22, freeze: 30, traitSeal: 14, skillSeal: 30, healSeal: 8 };
function unitValue(g, u) {
  if (u.dead) return 0;
  let v = 40 + u.hp + u.shield * 0.8 + u.bar.reduce((n, b) => n + b.n, 0) * 0.8 + eTotal(u) * 11 + (u.fx.sum || []).reduce((n, x) => n + x.hp, 0) * 0.8;
  for (const [s, d] of Object.entries(u.st)) v -= (STATUS_W[s] || 10) * Math.min(d, 3) * 0.6;
  v += u.defMod * 1.5 + u.atkMod * 1.5; if (u.sched) v += 16; if (u.invul) v += 8;
  return v;
}
export function evaluate(g, team) {
  if (g.winner) return g.winner === team ? 1e6 : -1e6;
  const o = E.other(team); let s = 0;
  for (const u of Object.values(g.u)) s += (u.team === team ? 1 : -1.05) * unitValue(g, u);
  return s;
}
export function chooseAction(g, team, o = {}) {
  const acts = enumerate(g); if (!acts.length) return null; if (acts.length === 1) return acts[0];
  const samples = o.samples || 2; let best = null, bs = -Infinity; const noise = o.noise ?? 3;
  for (const a of acts) {
    let sc = 0;
    for (let k = 0; k < samples; k++) { const c = clone(g); c.rs = (Math.random() * 4294967296) >>> 0; act(c, a); sc += evaluate(c, team); }
    sc /= samples; if (a.type === 'switch') sc -= 12; sc += Math.random() * noise;
    if (sc > bs) { bs = sc; best = a; }
  }
  return best;
}
export function playOut(g, o = {}) { // 테스트/시뮬용: 끝날 때까지 양쪽 AI 로 진행
  E.begin(g); let guard = 0;
  while (!g.winner && guard++ < (o.max || 3000)) { const i = info(g); if (i.kind === 'over') break; const a = chooseAction(g, i.team, o.ai || { samples: 1 }); if (!a) break; act(g, a); }
  return g;
}
