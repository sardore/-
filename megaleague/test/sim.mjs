import * as E from '../js/engine.js';
import { ROSTER } from '../js/cards.js';
import { playOut } from '../js/ai.js';
const N = +process.argv[2] || 100; const fast = process.argv[3] !== 'smart';
let seed = +process.argv[4] || 1; const wins = {}, picks = {}, turns = []; let bad = 0, long = 0, errs = {};
function deck(r) { const a = [...ROSTER]; const d = []; while (d.length < 4) d.push(a.splice(Math.floor(r() * a.length), 1)[0]); return d; }
function mul(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = mul(seed++); const dp = deck(r), da = deck(r);
  try {
    const g = E.newGame(dp, da, { seed: 'b' + i }); playOut(g, { max: 2500, ai: { samples: fast ? 1 : 2 } });
    if (!g.winner) { bad++; if (bad <= 3) console.log('NO WINNER', dp, da, g.stats.turns); continue; }
    turns.push(g.stats.turns); if (g.stats.turns > 400) long++;
    for (const [t, d] of [['P', dp], ['A', da]]) for (const id of d) { picks[id] = (picks[id] || 0) + 1; if (g.winner === t) wins[id] = (wins[id] || 0) + 1; }
  } catch (e) { const k = String(e.stack).split('\n').slice(0, 3).join(' | '); errs[k] = (errs[k] || 0) + 1; if (Object.keys(errs).length <= 3 && errs[k] === 1) console.log('ERR', dp, da, k); }
}
turns.sort((a, b) => a - b);
console.log(`battles ${N}, nowin ${bad}, long ${long}, med turns ${turns[turns.length >> 1]}, p90 ${turns[Math.floor(turns.length * .9)]}, ${(Date.now() - t0) / 1000}s`);
console.log('errors', Object.keys(errs).length);
const rows = Object.keys(picks).map(id => [id, picks[id], ((wins[id] || 0) / picks[id] * 100).toFixed(0)]).sort((a, b) => b[2] - a[2]);
console.log(rows.map(r => `${r[0]}:${r[2]}%(${r[1]})`).join('  '));
