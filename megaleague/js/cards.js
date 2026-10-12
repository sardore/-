// 캐릭터 데이터 + 기술 구현. 수치/규칙은 원본 스펙을 그대로 따르고, 구현은 새 엔진(engine.js) 위에서 다시 썼다.
import * as E from './engine.js';
const { register, setHooks, def, other, rnd, rint, pick, fieldUnits, teamUnits, slotOf, unitAt, status, traitOn, log, ev, notice,
  eTotal, eCount, eWhole, maxE, gain, removeE, removeEntry, clearE, recolor, addStatus, heal, addShield, addBarrier, hit, hpPct, fixed, bestReplace, gatherColors,
  benchUnits, hasTag, tgtKind, transform, normE, checkDeath, remapIdx } = E;

/* ───────── 공용 도우미 ───────── */
const S = (id, name, cost, target, desc, exec, o = {}) => ({ id, name, cost, target, desc, exec, ...o });
const atk = (amount, o = {}) => (g, u, T, X, sk) => hit(g, u, T, { amount, ...o }, sk);
const eopts = T => (T && T.e.length ? T.e.map((e, i) => ({ v: i, label: e.c + (e.a === 0.5 ? '½' : '') })) : [{ v: -1, label: '없음' }]);
const STAT_NAME = { atkMod: '공격', defMod: '방어' };

function modStat(g, src, t, key, d) { // 능력치 증감 (감소 무효 특성 존중)
  if (!t || t.dead) return false;
  if (d < 0 && def(t).statDownImmune && traitOn(g, t)) { log(g, `${t.name}: 능력치 감소 무효.`); notice(g, t, '감소 무효', 'immune'); return false; }
  t[key] += d; log(g, `${t.name} ${STAT_NAME[key]} ${d > 0 ? '+' : ''}${d} (현재 ${t[key] > 0 ? '+' : ''}${t[key]}).`);
  ev(g, 'stat', { uid: t.uid, key, d }); notice(g, t, `${STAT_NAME[key]} ${d > 0 ? '+' : ''}${d}`, d > 0 ? 'buff' : 'debuff'); return true;
}
function steal(g, u, T, idx) { // 선택한 에너지 하나 강탈
  if (idx == null || idx < 0 || !T || !T.e[idx]) return false;
  const e = T.e[idx], c = e.c, a = e.a; if (!removeEntry(g, T, idx, u)) return false;
  const full = eTotal(u) + a > maxE(u) + 0.001; const ok = gain(g, u, c, a, full ? bestReplace(g, u, c, a) : null);
  log(g, ok ? `${u.name}: ${T.name}의 ${c}${a === 0.5 ? '½' : ''} 에너지 강탈!` : `${u.name}: ${T.name}의 ${c} 에너지를 빼앗았지만 담을 곳이 없다.`); return true;
}
function bestRecolor(g, T, to) { // 대상의 위협 기술을 가장 늦추는 에너지 하나를 골라 to 색으로
  const cand = T.e.map((e, i) => i).filter(i => T.e[i].c !== to); if (!cand.length) return null;
  let best = cand[0], bs = 1e9;
  for (const i of cand) {
    const t2 = { ...T, e: T.e.map((e, k) => (k === i ? { ...e, c: to } : { ...e })) }; let s = 0;
    for (const sk of def(T).skills) { const tk = E.effCost(g, T, sk); if (E.canPay(t2, tk)) s += 10 + tk.length; }
    s += T.e[i].a * 0.1; if (s < bs) { bs = s; best = i; }
  }
  return best;
}
const randomStatuses = ['burn', 'paralyze', 'freeze', 'poison', 'slow', 'traitSeal'];
const skillOf = (u, id) => def(u).skills.find(s => s.id === id) || def(u).skills[0];
function chainWith(g, u, n) { g.chain = { uid: u.uid, left: n }; }
const tgtOf = (g, X, u) => (X.target && X.target.uid ? g.u[X.target.uid] : u);
const starVal = u => Number(def(u).star);
function give(g, t, c, a = 1, ext = false) { // 에너지 부여 (가득 차면 가장 덜 쓸모 있는 것을 대체, 적에게는 빈 칸이 있을 때만)
  if (ext) return gain(g, t, c, a, 'ext'); const full = eTotal(t) + a > maxE(t) + 0.001; return gain(g, t, c, a, full ? bestReplace(g, t, c, a) : null);
}
const dragonSrc = (g, u) => (g.t ? benchUnits(g, u.team).find(b => !b.deployed && hasTag(b, 'dragon')) || null : null);
const onFieldNow = (g, u) => g.t[u.team].field.includes(u.uid);
const clockAligned = u => { const d = (((u.fx.hour - u.fx.min) % 180) + 180) % 180; return d === 0; };
const allField = g => [...fieldUnits(g, 'P'), ...fieldUnits(g, 'A')];

/* 예약 행동 (자기 차례를 자동으로 소비하는 기술들) */
function runSched(g, u, s) {
  const sk = skillOf(u, s.skillId);
  const occ = s.slot != null ? unitAt(g, s.team, s.slot) : null;
  switch (s.kind) {
    case 'dive': {
      u.sched = null; log(g, `${u.name}: ${sk.name} 강하!`, 'skill'); ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, target: occ?.uid || null, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      if (occ && !occ.dead) hit(g, u, occ, { amount: s.dmg }, sk); else log(g, `${u.name}: 노린 슬롯이 비어 있어 불발.`); break;
    }
    case 'sweet': {
      ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, target: occ?.uid || null, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      if (!occ || occ.dead) { log(g, `${u.name}: 노린 슬롯이 비어 있어 후속 공격 불발.`); u.sched = null; break; }
      log(g, `${u.name} · 슈가스웜프 후속 (${s.left}회 남음)`, 'skill');
      hit(g, u, occ, { amount: 30 }, sk); if (!occ.dead) addStatus(g, u, occ, 'poison', 3);
      s.left--; if (s.left <= 0) u.sched = null; break;
    }
    case 'ruby': {
      u.sched = null; ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, target: occ?.uid || null, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      if (!occ || occ.dead) { log(g, `${u.name}: 노린 슬롯이 비어 있어 불발.`); break; }
      log(g, `${u.name} · 파이어스톰 후속`, 'skill'); hit(g, u, occ, { amount: 80 }, sk); if (!occ.dead) addStatus(g, u, occ, 'traitSeal', 2); break;
    }
    case 'bloom': {
      u.sched = null; ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      const en = fieldUnits(g, other(u.team)); log(g, `${u.name} · 피어나는생명 개화!`, 'skill'); let total = 0;
      for (const x of en) { const half = s.evaded && s.evaded[x.uid]; total += hit(g, u, x, { amount: (320 / en.length) * (half ? 0.5 : 1) }, sk); }
      const pool = Math.max(0, Math.round((total * 0.5) / 10) * 10); const inj = fieldUnits(g, u.team).filter(x => x.hp < x.maxHp);
      log(g, `피어나는생명: 실질 피해 ${total}, 회복 자원 ${pool}.`, 'heal');
      if (inj.length && pool > 0) { let left = pool; const order = [...inj].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        for (let i = 0; i < order.length; i++) { const share = i === order.length - 1 ? left : Math.floor(pool / order.length / 10) * 10; const got = heal(g, u, order[i], share, 'bloom'); left -= got; }
        if (left > 0) for (const x of order) { if (left <= 0) break; left -= heal(g, u, x, left, 'bloom'); } }
      break;
    }
    case 'zigzag': {
      u.sched = null; ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      const en = fieldUnits(g, other(u.team)); if (!en.length) { log(g, `${u.name}: 굴착할 상대가 없다.`); break; }
      log(g, `${u.name} · 지그재그굴착!`, 'skill'); const cnt = {};
      for (let i = 0; i < 5; i++) { const w = en.map(x => Math.max(1, 5 - Math.floor(eTotal(x) + 1e-6))); let r = rnd(g) * w.reduce((a, b) => a + b, 0), k = 0; while (k < en.length - 1 && r >= w[k]) { r -= w[k]; k++; } cnt[en[k].uid] = (cnt[en[k].uid] || 0) + 1; }
      for (const x of en) if (cnt[x.uid] && !x.dead) { log(g, `${x.name}에게 ${cnt[x.uid]}번 명중!`); hit(g, u, x, { amount: 40 * cnt[x.uid] }, sk); }
      break;
    }
    case 'hurricane': {
      s.wait--; if (s.wait > 0) { log(g, `${u.name}: 회오리를 모으는 중… (${s.wait}차례 남음)`); notice(g, u, '충전 중', 'buff'); ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, team: u.team, slot: slotOf(g, u), kind: 'buff', auto: true }); break; }
      u.sched = null; ev(g, 'skill', { uid: u.uid, skill: sk.id, name: sk.name, target: occ?.uid || null, team: u.team, slot: slotOf(g, u), kind: 'attack', auto: true });
      if (occ && !occ.dead) { log(g, `${u.name} · 허리케인 다이브 강하!`, 'skill'); hit(g, u, occ, { amount: s.dmg }, sk); } else log(g, `${u.name}: 노린 슬롯이 비어 있어 불발.`); break;
    }
    default: u.sched = null;
  }
}

/* 전투 전체에 걸린 규칙 */
const HOOKS = {
  suppressed(g, u) { // 타임오러의 운명의 시계: 정렬된 쪽이 (자신을 뺀) 필드의 모든 특성을 정지시킨다. 양쪽이 동시에 정렬되면 상쇄
    if (!g.t || !u || !g.t[u.team]) return false; const on = { P: [], A: [] };
    for (const t of ['P', 'A']) for (const x of fieldUnits(g, t)) if (def(x).fateClock && !x.st.traitSeal && clockAligned(x)) on[t].push(x);
    if (!on.P.length && !on.A.length) return false; if (on.P.length && on.A.length) return false;
    const owners = on.P.length ? on.P : on.A; return !owners.includes(u) && onFieldNow(g, u);
  },
  downPressure: (g, team) => fieldUnits(g, other(team)).some(x => def(x).downPressure && traitOn(g, x)),
  healAdjust(g, u, base) { const f = g.field; if (f && f.kind === 'aroma' && base > 0) base = Math.max(0, base + (u.team === f.team ? 10 : -10)); return base; },
  defAdjust(g, tgt) { let v = 0; const f = g.field; if (f && f.kind === 'aroma' && tgt.team !== f.team) v -= 10;
    const d = def(tgt); if (d.fragment && traitOn(g, tgt)) v += 10 * Math.floor(eCount(tgt, 'R') + eCount(tgt, 'B') + 1e-6);
    if (fieldUnits(g, tgt.team).some(x => def(x).timeProtect && traitOn(g, x))) v += 20; return v; },
  guardSnap(g, team) { // 호리진탈의 수평선: 한 번의 피해 배치 동안은 시작 시점의 HP 상태를 쓴다
    if (!g.gs || g.gs.n !== g.serial) g.gs = { n: g.serial };
    if (g.gs[team] == null) g.gs[team] = fieldUnits(g, team).some(x => def(x).teamGuard && traitOn(g, x) && x.hp >= x.maxHp);
    return g.gs[team];
  },
  finalAdjust(g, src, tgt, n, eff) {
    if (n <= 0) return n;
    const d = def(tgt); if (d.fullHalf && traitOn(g, tgt) && tgt.hp >= tgt.maxHp) n = Math.floor(n / 2);
    if (d.eclipse && traitOn(g, tgt) && !tgt.fx.left && eff && eff.kind !== 'effect' && Math.abs(eTotal(tgt) - tgt.turns) < 0.01) { log(g, `${tgt.name} 특성 · 이클립스: 공격 무효!`); notice(g, tgt, '이클립스', 'shield'); return 0; }
    if (HOOKS.guardSnap(g, tgt.team)) { n = Math.floor(n / 2); }
    return n;
  },
  sweetProt(g, src, tgt) { const sw = fieldUnits(g, tgt.team).some(x => def(x).sweetna && traitOn(g, x)); return sw ? 10 * status(src, 'poison') : 0; },
  switchLocked: (g, team) => fieldUnits(g, other(team)).some(x => def(x).switchLock && traitOn(g, x)),
  turnStart(g, u) {
    (u.fx.hist ??= []).push({ hp: u.hp, st: { ...u.st } }); if (u.fx.hist.length > 4) u.fx.hist.shift();
    if (def(u).fragment) u.fx.noExternalE = traitOn(g, u);
    if (u.fx.q && u.fx.q.length) { for (const q of u.fx.q) { heal(g, null, u, q.amt, 'candle'); q.left--; } u.fx.q = u.fx.q.filter(q => q.left > 0); }
    if (u.fx.res) { log(g, `${u.name}: 엘릭시안의 잔향으로 HP 회복.`, 'heal'); heal(g, null, u, 10, 'resonance'); }
  },
  onDeploy(g, u) {
    const r = g.t[u.team].res, sl = slotOf(g, u); if (r && r[sl]) { delete r[sl]; u.fx.res = true; log(g, `${u.name}: 엘릭시안의 잔향이 깃들었다 (차례마다 HP 10 회복).`, 'heal'); notice(g, u, '잔향', 'buff'); }
  },
  onSkill(g, u, sk, X) {
    for (const x of fieldUnits(g, u.team)) if (x !== u && def(x).onAllySkill) def(x).onAllySkill(g, x, u, X);
    const total = X.plan ? X.plan.R + X.plan.W + X.plan.B : 0;
    if (total) for (const x of fieldUnits(g, other(u.team))) if (x.sched && x.sched.kind === 'bloom') { x.sched.evaded ??= {}; x.sched.evaded[u.uid] = true; } // 피어나는생명 대기 중 코스트를 낸 적 → 절반 피해
    if (sk.kind && sk.kind !== 'attack') for (const ab of fieldUnits(g, u.team)) if (def(ab).deepMind && traitOn(g, ab)) { // 딥마인드
      const t = tgtOf(g, X, u); log(g, `${ab.name} 특성 · 딥마인드!`, 'skill'); if (t && !t.dead) heal(g, ab, t, 10, 'deepmind');
      const es = fieldUnits(g, other(u.team)).filter(x => x.e.length && !x.fx.noExternalE);
      if (es.length) { const tg = es.find(x => x.e.some(e => e.a === 0.5)) || [...es].sort((a, b) => eTotal(b) - eTotal(a))[0]; removeE(g, tg, 0.5, ab); }
    }
  },
};
setHooks(HOOKS);

/* ───────── 카드 ───────── */
const CARDS = [
  /* ── 2☆ 기본 ── */
  { id: 'hermit', name: '큰뿔소라게', star: '2', hp: 60, shield: 60, role: '특수 탱커', trait: '공격받을 때마다 공격자에게 고정 반사 피해 30.', reflect: 30,
    skills: [
      S('sandstorm', '모래폭풍', 'W**', 'enemy', '40D. 피해 후 대상의 모든 에너지를 W로 바꾼다.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); if (!T.dead) recolor(g, T, 'W', true, u); }),
      S('sandhide', '모래숨기', 'W', 'self', '다음 두 번의 공격 타격 피해를 각각 30 줄인다.', (g, u) => { u.hide = 2; log(g, `${u.name}: 모래 속에 숨었다 (2회).`); notice(g, u, '숨기 ×2', 'shield'); }, { kind: 'buff' }),
    ] },
  { id: 'stareel', name: '별장어', star: '2', hp: 140, role: '슬롯 통제', trait: '마비 면역. 공격 시 33% 치명타. 공격력 감소를 무시한다.', immune: ['paralyze'], crit: 0.33, dmgBonus: (g, u) => -Math.min(0, u.atkMod),
    skills: [
      S('tackle', '전기태클', 'W', 'enemySlot', '적 슬롯에 1회용 함정. 다음 출전자는 마비 4턴.', (g, u, T) => { g.t[T.team].trap[T.slot] = { status: 'paralyze', turns: 4 }; log(g, `${u.name}: 적 ${T.slot + 1}번 슬롯에 전기 함정 설치.`); ev(g, 'trap', { team: T.team, slot: T.slot }); }, { kind: 'field' }),
      S('whip', '전기채찍', 'W*', 'enemy', '70D. 33% 확률로 마비 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 70 }, sk); if (!T.dead && rnd(g) < 0.33) addStatus(g, u, T, 'paralyze', 2); }),
    ] },
  { id: 'mole', name: '화살두더지', star: '2', hp: 125, role: '안정 딜러', trait: '없음.',
    skills: [S('arrow', '흙화살', 'R', 'enemy', '35D.', atk(35)), S('pierce', '관통화살', 'R*', 'enemy', '70D. 대상의 방어는 최대 5만 적용.', atk(70, { defCap: 5 }))] },
  { id: 'boar', name: '바위멧돼지', star: '2', hp: 150, role: '안정 딜러', trait: '없음.',
    skills: [S('rush', '바위돌진', 'B', 'enemy', '40D.', atk(40)), S('slam', '지면강타', 'BB*', 'enemy', '105D.', atk(105))] },
  { id: 'mantis', name: '쌍날사마귀', star: '2', hp: 115, role: '안정 딜러', trait: '없음.',
    skills: [S('twin', '쌍날베기', 'R*', 'enemy', '35D씩 2회.', atk(35, { hits: 2 }))] },
  { id: 'fang', name: '유리송곳니', star: '2', hp: 85, role: '저HP 고화력', trait: '실드가 없으면 공격 피해 +10.', dmgBonus: (g, u) => (u.shield > 0 ? 0 : 10),
    skills: [S('glass', '유리이빨', 'R', 'enemy', '45D.', atk(45)), S('crush', '파쇄돌진', 'RR*', 'enemy', '120D.', atk(120))] },
  { id: 'frog', name: '폭탄개구리', star: '2', hp: 90, role: '저HP 고화력', trait: '없음.',
    skills: [
      S('fuse', '도화선', 'R', 'enemy', '40D. 자신에게 고정 피해 5.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); fixed(g, u, 5, '도화선 반동'); }),
      S('boom', '폭발도약', 'R**', 'enemy', '115D. 자신에게 고정 피해 15.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 115 }, sk); fixed(g, u, 15, '폭발 반동'); }),
    ] },
  { id: 'turtle', name: '철갑거북', star: '2', hp: 160, def: 10, role: '방어 탱커', trait: '기본 방어 10.',
    skills: [
      S('shell', '등껍질치기', 'B', 'enemy', '45D.', atk(45)),
      S('endure', '버티기', 'W', 'enemy', '35D. 공격 후 자신의 방어 +5 (총 방어 최대 20).', (g, u, T, X, sk) => { hit(g, u, T, { amount: 35 }, sk); if (!u.dead) { const room = 20 - u.baseDef - u.defMod; if (room > 0) modStat(g, u, u, 'defMod', Math.min(5, room)); } }),
    ] },
  { id: 'mushroom', name: '방패버섯', star: '2', hp: 120, shield: 20, role: '실드 탱커', trait: '시작 실드 20.',
    skills: [S('bash', '방패밀기', 'B', 'enemy', '25D.', atk(25)), S('spore', '보호포자', 'W*', 'ally', '아군 하나에게 실드 +20 (실드 최대 50).', (g, u, T) => { addShield(g, T, 20, 50); }, { kind: 'buff' })] },
  { id: 'bee', name: '꿀벌의사', star: '2', hp: 110, role: '회복 지원', trait: '없음.',
    skills: [S('sting', '침찌르기', 'R', 'enemy', '25D.', atk(25)), S('honey', '응급꿀', 'W*', 'ally', '아군 하나의 HP 40 회복.', (g, u, T) => { heal(g, u, T, 40, 'honey'); }, { kind: 'heal' })] },
  { id: 'tail', name: '흰꼬리새', star: '2', hp: 120, role: '에너지 지원', trait: '없음.',
    skills: [
      S('beak', '흰부리', 'W', 'enemy', '30D.', atk(30)),
      S('wing', '날개전달', '*', 'allyOther', '자신의 에너지 1개를 내고, 다른 필드 아군에게 같은 색 에너지 1개를 전달.', (g, u, T, X) => {
        const c = ['R', 'W', 'B'].find(k => X.plan[k] > 0); const full = eTotal(T) + 1 > maxE(T) + 0.001; const ok = gain(g, T, c, 1, full ? bestReplace(g, T, c, 1) : null);
        log(g, ok ? `${u.name} → ${T.name}: ${c} 에너지 전달.` : `${T.name}: 에너지가 가득 차 전달 실패.`);
      }, { kind: 'buff', req: (g, u) => fieldUnits(g, u.team).some(a => a !== u && eTotal(a) + 1 <= maxE(a) + 0.001), reqText: '아군 에너지 가득' }),
    ] },
  { id: 'ember', name: '잿불여우', star: '2', hp: 115, role: '상태이상 템포', trait: '없음.',
    skills: [S('bite', '불씨물기', 'R*', 'enemy', '50D. 화상 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 50 }, sk); if (!T.dead) addStatus(g, u, T, 'burn', 2); })] },
  { id: 'snail', name: '늪달팽이', star: '2', hp: 145, role: '상태이상 템포', trait: '상대가 직전에 에너지를 모았다면 진흙탄 피해 +15.', dmgBonus: (g, u, t) => (t.last === 'gather' ? 15 : 0),
    skills: [S('mud', '진흙탄', 'B*', 'enemy', '45D. 감속 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 45 }, sk); if (!T.dead) addStatus(g, u, T, 'slow', 2); })] },
  { id: 'chameleon', name: '색도마뱀', star: '2', hp: 120, role: '에너지 색 조작', trait: '없음.',
    skills: [
      S('paint', '색칠혀', 'W', 'enemy', '20D. 대상 에너지 하나를 R로 바꾼다.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 20 }, sk); if (!T.dead) { const i = bestRecolor(g, T, 'R'); if (i != null) recolor(g, T, 'R', false, u, i); } }),
      S('wash', '색씻기', 'B*', 'enemy', '60D. 대상 에너지 하나를 W로 바꾼다.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 60 }, sk); if (!T.dead) { const i = bestRecolor(g, T, 'W'); if (i != null) recolor(g, T, 'W', false, u, i); } }),
    ] },
  { id: 'cloud', name: '먹구름', star: '2', hp: 130, role: '에너지 개수 조작', trait: '기술 사용 후 에너지가 0이면 그 공격 피해 +15.', dmgBonus: (g, u) => (eTotal(u) < 0.01 ? 15 : 0),
    skills: [
      S('ink', '먹비', 'B', 'enemy', '30D.', atk(30)),
      S('storm', '검은소나기', 'B**', 'enemy', '80D. 대상의 에너지 1개 제거 (반에너지 우선).', (g, u, T, X, sk) => { hit(g, u, T, { amount: 80 }, sk); if (!T.dead) removeE(g, T, 1, u); }),
    ] },
  { id: 'hawk', name: '추적매', star: '2', hp: 105, role: '연속 표적', trait: '직전 공격과 같은 대상이면 피해 +20. 교체하면 표식이 사라진다.', dmgBonus: (g, u, t) => (u.lastTarget === t.uid ? 20 : 0),
    skills: [S('claw', '추적발톱', 'R', 'enemy', '35D.', atk(35)), S('dive', '급강하', 'R*', 'enemy', '65D.', atk(65))] },

  /* ── 메가리그 ── */
  { id: 'wayli', name: '웨이리', star: '4', hp: 240, role: '무코스트 지속 딜러', trait: '공방무시: 공격/피격 시 양측의 공격력·방어력 증감을 모두 무시.', ignoreMods: true,
    skills: [S('splash', '물총세례', '', 'enemy', '30D. 코스트 없음.', atk(30))] },
  { id: 'bkeno', name: '브케노', star: '4', hp: 170, role: '폭발 딜러', trait: '없음.',
    skills: [
      S('quake', '지진', 'RW*', 'enemy', '160D. 판정 후 양쪽 필드의 모든 에너지를 제거.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 160 }, sk); for (const t of ['P', 'A']) for (const x of fieldUnits(g, t)) clearE(g, x, u); log(g, '지진: 모든 필드 에너지 소멸.'); }),
      S('erupt', '분화', 'RR**', 'enemy', '67%: 210D, 33%: 230D. 실드를 뚫고 HP까지 관통.', (g, u, T, X, sk) => { hit(g, u, T, { amount: rnd(g) < 0.33 ? 230 : 210, shieldMelt: true }, sk); }),
    ] },
  { id: 'huve', name: '휴브', star: '4.5', hp: 340, maxE: 5, speed: -1, role: '변동 자원 화산 딜러', trait: '최대 에너지 5. 느리게 출전한다 (Speed −1).',
    skills: [
      S('mystic', '미스틱버스트', 'WB*', 'enemy', '100D. 추가 지불: R당 +30D, W당 자신 HP 50 회복, B당 무작위 상태이상 2턴.', (g, u, T, X, sk) => {
        const p = X.plus || { R: 0, W: 0, B: 0 }; hit(g, u, T, { amount: 100 + 30 * p.R }, sk);
        if (p.W) heal(g, u, u, 50 * p.W, 'mystic');
        for (let i = 0; i < p.B; i++) if (!T.dead) addStatus(g, u, T, pick(g, randomStatuses), 2);
      }, { plus: { colors: ['R', 'W', 'B'], max: 2, hint: 'R:+30D · W:회복 50 · B:무작위 상태이상' } }),
      S('hquake', '지진', 'WR**', 'enemy', '160D 후 필드 전원의 에너지를 전부 제거.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 160 }, sk); for (const t of ['P', 'A']) for (const x of fieldUnits(g, t)) clearE(g, x, u); }),
      S('smack', '스맥다운', '***', 'enemy', '80D. 대상 에너지를 원하는 만큼 제거, 제거량×30의 피해를 대상과 자신이 함께 받는다.', (g, u, T, X, sk) => {
        hit(g, u, T, { amount: 80 }, sk); const want = X.extra.amt || 0; if (T.dead || want <= 0) return; let left = want, got = 0;
        while (left > 0.01) { const x = removeE(g, T, Math.min(1, left), u); if (!x) break; left -= x; got += x; }
        if (got > 0) { log(g, `스맥다운: 에너지 ${got} 제거 → 쌍방 ${got * 30}D.`); fixed(g, u, got * 30, '스맥다운 반동'); if (!T.dead) fixed(g, T, got * 30, '스맥다운'); }
      }, { choices: (g, u, T) => { const n = T ? eTotal(T) : 0; const opts = []; for (let a = 0; a <= n + 0.01 && opts.length < 9; a += 0.5) opts.push({ v: a, label: a === 0 ? '제거 안 함' : `${a} 제거 (${a * 30}D)` }); return [{ key: 'amt', label: '제거할 에너지', options: opts }]; } }),
    ] },
  { id: 'master', name: '마스터', star: '3', hp: 140, speed: 1, role: '순풍 다단 딜러', trait: '빠르게 출전·교체한다 (Speed 1).',
    skills: [
      S('tailwind', '순풍', 'W', 'self', '무작위 에너지 3개를 순서대로 획득.', (g, u) => { for (let i = 0; i < 3; i++) { const c = pick(g, gatherColors(g, u)); const full = eTotal(u) + 1 > maxE(u) + 0.001; gain(g, u, c, 1, full ? bestReplace(g, u, c, 1) : null); } }, { kind: 'buff' }),
      S('leaf', '잎날수리검', '**', 'enemy', '30D씩 무작위 1~3회.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 30, hits: rint(g, 1, 3) }, sk); }),
    ] },
  { id: 'sweetna', name: '스위트나', star: '3.5', hp: 170, role: '독 연속 딜러', sweetna: true, trait: '독에 걸린 적에게 독 턴당 +10D. 독에 걸린 적이 아군을 공격하면 독 턴당 −10D.',
    dmgBonus: (g, u, t) => 10 * status(t, 'poison'), runSched,
    skills: [S('swamp', '슈가스웜프', 'R**', 'enemy', '즉시 30D + 독 3. 이후 자기 차례 두 번을 써서 같은 슬롯을 자동 반복 공격(30D + 독 3).', (g, u, T, X, sk) => {
      hit(g, u, T, { amount: 30 }, sk); if (!T.dead) addStatus(g, u, T, 'poison', 3);
      u.sched = { kind: 'sweet', skillId: sk.id, team: T.team, slot: g.t[T.team].field.indexOf(T.uid) >= 0 ? g.t[T.team].field.indexOf(T.uid) : slotOf(g, T), left: 2 };
    })] },
  { id: 'iruma', name: '이루마', star: '4', hp: 150, role: '피해 이전 지원', trait: '모든 피해 −40. 아군에게 새 상태이상이 걸리면 즉시 치료(+HP 20). 이루마가 회복시키면 필드 아군 전체가 잃은 HP의 1/3 추가 회복.',
    reduce: 40, cleanse: true, healSplash: 1 / 3,
    skills: [
      S('shift', '시프트', '**', 'allyOther', '다른 필드 아군이 잃은 HP(최대 150)를 되돌리고, 같은 양을 이루마가 받는다.', (g, u, T) => {
        const n = Math.min(150, T.maxHp - T.hp), got = heal(g, u, T, n, 'shift'); if (got > 0) fixed(g, u, got, '시프트 이전');
      }, { kind: 'heal', req: (g, u) => fieldUnits(g, u.team).some(a => a !== u && a.hp < a.maxHp), reqText: '다친 아군 없음' }),
      S('rain', '라이프레인', 'W*', 'enemyField', '적 필드 전체: 0D, 방어 −10, 감속 2. 이루마 현재 HP의 1/3을 회복 자원으로 만들어 필드 아군에게 나눠 준다.', (g, u, T, X, sk) => {
        for (const x of [...T]) { hit(g, u, x, { amount: 0 }, sk); modStat(g, u, x, 'defMod', -10); addStatus(g, u, x, 'slow', 2); }
        const pool = Math.max(0, Math.round(u.hp / 3)); const al = fieldUnits(g, u.team); if (!al.length || pool <= 0) return;
        if (al.length === 1) { heal(g, u, al[0], pool, 'rain'); return; }
        const ally = al.find(a => a !== u), give = Math.round(pool * (X.extra.ratio ?? 0.5)), got = heal(g, u, ally, give, 'rain');
        heal(g, u, u, pool - give + (give - got), 'rain');
      }, { kind: 'heal', choices: () => [{ key: 'ratio', label: '회복 분배 (아군에게 보낼 비율)', options: [{ v: 0, label: '이루마 100%' }, { v: 0.25, label: '아군 25%' }, { v: 0.5, label: '반반' }, { v: 0.75, label: '아군 75%' }, { v: 1, label: '아군 100%' }] }] }),
    ] },
  { id: 'awakenedIruma', name: '각성이루마', star: '4.5', hp: 170, role: '예약 광역 딜러', trait: '없음.', runSched,
    skills: [S('bloom', '피어나는생명', 'W*', 'field', '다음 자기 차례에 적 필드 전체에 총 320D를 나눠 준다. 대기 중 상태이상 면역. 실질 피해의 50% 회복. (그 사이 코스트를 쓴 적은 절반 피해)', (g, u, T, X, sk) => {
      u.sched = { kind: 'bloom', skillId: sk.id, noStatus: true, evaded: {} }; log(g, `${u.name}: 피어나는생명 준비! 다음 차례에 개화.`); notice(g, u, '개화 준비', 'buff');
    }, { kind: 'field' })] },
  { id: 'dragonfish', name: '드래곤피시', star: '4', hp: 240, def: -20, baseDefTrait: true, role: '상태이상 딜러', tags: ['dragon'], nullify: true, immune: ['poison', 'slow'],
    trait: '심해 내성: 기본 방어 −20. 독과 감속에 면역. (특성 무효 계열)',
    skills: [S('tornado', '심해의토네이도', '*', 'enemy', '60D.', atk(60)), S('gnaw', '물어뜯기', 'BB', 'enemy', '120D. 독 2턴 + 감속 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 120 }, sk); if (!T.dead) { addStatus(g, u, T, 'poison', 2); addStatus(g, u, T, 'slow', 2); } })] },
  { id: 'kingprawn', name: '왕새우', star: '3.5', hp: 220, role: '대무효 딜러', trait: '없음.',
    skills: [S('charge', '돌진', 'WBR', 'enemy', '120D. 무효 계열 특성을 가진 대상에게는 160D.', (g, u, T, X, sk) => { hit(g, u, T, { amount: def(T).nullify ? 160 : 120 }, sk); })] },
  { id: 'ruby', name: '루비', star: '3.5', hp: 150, role: '예약 공격 딜러', trait: '없음.', runSched,
    skills: [
      S('wing', '화염날개', 'R', 'enemy', '40D. 다음 자기 차례 전까지 상대 공격기술 피해를 무효화.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); if (!u.dead) { u.noAtk = true; u.noAtkUntil = u.turns + 1; notice(g, u, '화염 방벽', 'shield'); } }),
      S('storm', '파이어스톰', 'R*', 'enemy', 'HP 90 이하일 때만. 즉시 80D + 특성봉인 2턴. 다음 자기 차례에 같은 슬롯을 다시 80D + 특성봉인 2턴.', (g, u, T, X, sk) => {
        hit(g, u, T, { amount: 80 }, sk); if (!T.dead) addStatus(g, u, T, 'traitSeal', 2); u.sched = { kind: 'ruby', skillId: sk.id, team: T.team, slot: slotOf(g, T) };
      }, { req: (g, u) => u.hp <= 90, reqText: 'HP 90 이하 필요' }),
    ] },
  { id: 'jetski', name: '제트스키', star: '2', hp: 140, speed: 1, role: '고속 예약 딜러', trait: '빠르게 출전·교체한다 (Speed 1).', runSched,
    skills: [
      S('boost', '가속', '**', 'enemy', '40D. 다음 자기 차례의 모든 기술 코스트 −1.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); u.nextCostCut = 1; notice(g, u, '다음 코스트 −1', 'buff'); }),
      S('bite', '물어뜯기', 'BB', 'enemy', '80D.', atk(80)),
      S('dive', '다이브', 'B', 'enemy', '다음 자기 차례까지 무적. 그때 70D.', (g, u, T, X, sk) => { u.invul = true; u.sched = { kind: 'dive', skillId: sk.id, team: T.team, slot: slotOf(g, T), dmg: 70 }; log(g, `${u.name}: 잠수! 무적.`); notice(g, u, '무적', 'shield'); }, { kind: 'field' }),
    ] },
  { id: 'aquamarine', name: '아쿠아마린', star: '3.5', hp: 180, fullHalf: true, role: '수류 제어 딜러', trait: 'HP가 가득 차 있으면 받는 피해가 절반.',
    skills: [
      S('splash', '물벼락', '*', 'enemy', '30D.', atk(30)),
      S('whirl', '회오리', 'B', 'enemy', '30D. 추가로 낸 에너지 1개당 자신 HP 30 회복.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 30 }, sk); const n = (X.plus ? X.plus.R + X.plus.W + X.plus.B : 0); if (n && !u.dead) heal(g, u, u, 30 * n, 'whirl'); }, { plus: { colors: ['R', 'W', 'B'], max: 3, hint: '1개당 HP 30 회복' } }),
      S('wave', '파도타기', 'WB', 'enemy', '80D.', atk(80)),
      S('twister', '토네이도', 'BB**', 'enemy', '90D (대상의 방어 증감 2배 적용). 피해 후 대상의 공격·방어 −10.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 90, defModMult: 2 }, sk); if (!T.dead) { modStat(g, u, T, 'atkMod', -10); modStat(g, u, T, 'defMod', -10); } }),
      S('tower', '타워링 스플래시', 'WW**', 'enemy', '60D. 적 에너지 1개 제거, 자신의 방어 +20.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 60 }, sk); if (!T.dead) removeE(g, T, 1, u); if (!u.dead) modStat(g, u, u, 'defMod', 20); }),
    ] },
  { id: 'galewing', name: '질풍날개', star: '2', hp: 110, speed: 1, role: '고속 처형 딜러', trait: '빠르게 출전·교체한다 (Speed 1).', runSched,
    skills: [
      S('slash', '일발가르기', '', 'enemy', '30D. 반동 30. 대상 HP가 1/4 이하면 치명타. 코스트 없음.', (g, u, T, X, sk) => { const low = T.hp <= T.maxHp / 4; hit(g, u, T, { amount: 30, forceCrit: low }, sk); if (!u.dead) fixed(g, u, 30, '일발가르기 반동'); }),
      S('glide', '활공', '**', 'enemy', '다음 자기 차례까지 무적. 그때 60D.', (g, u, T, X, sk) => { u.invul = true; u.sched = { kind: 'dive', skillId: sk.id, team: T.team, slot: slotOf(g, T), dmg: 60 }; notice(g, u, '무적', 'shield'); }, { kind: 'field' }),
    ] },
  { id: 'axshrimp', name: '도끼새우', star: '3', hp: 140, speed: 1, flexW: true, role: '변환 결제 처형 딜러', trait: '기술 사용 시 W 에너지를 R 또는 B 대신 지불할 수 있다.',
    skills: [
      S('venom', '포이즌테일', 'B*', 'enemy', '60D. 50% 확률로 독 1턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 60 }, sk); if (!T.dead && rnd(g) < 0.5) addStatus(g, u, T, 'poison', 1); }),
      S('axe', '도끼질', 'RRR', 'enemy', '110D, 50% 치명타. 적이 버티면 기술이 실패한다.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 110, crit: 0.5, failUnlessKill: true }, sk); }),
    ] },
  { id: 'heroncaptain', name: '백로선장', star: '3', hp: 190, role: '빙결 연계 딜러', trait: '없음.',
    skills: [
      S('wave', '파도타기', 'WB', 'enemy', '80D.', atk(80)),
      S('iwing', '얼음날개', 'W', 'enemy', '30D. 다음 자기 차례 시작 전까지 무적.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 30 }, sk); if (!u.dead) { u.invul = true; notice(g, u, '무적', 'shield'); } }),
      S('beam', '냉동빔', (g, u) => (u.last === 'skill' && u.lastSkill === 'beam' ? '*' : 'W'), 'enemy', '30D. 직전 차례에도 냉동빔을 썼다면 코스트가 *이 되고 명중 후 대상 냉동 1턴.', (g, u, T, X, sk) => {
        const rep = u.last === 'skill' && u.lastSkill === 'beam'; hit(g, u, T, { amount: 30 }, sk); if (rep && !T.dead) addStatus(g, u, T, 'freeze', 1);
      }),
    ] },
  { id: 'shuvi', name: '슈비', star: '3', hp: 110, speed: 3, evade: 1 / 3, statDownImmune: true, role: '초고속 교란 지원', trait: '공격을 1/3 확률로 회피. 능력치 감소 무효. 거의 즉시 출전·교체 (Speed 3).', runSched,
    skills: [
      S('drain', '흡혈', '**', 'enemy', '대상에게 독 1·마비 1턴. 자신의 공격 +10, HP 30 회복.', (g, u, T) => { addStatus(g, u, T, 'poison', 1); addStatus(g, u, T, 'paralyze', 1); modStat(g, u, u, 'atkMod', 10); heal(g, u, u, 30, 'drain'); }, { kind: 'status' }),
      S('glide', '활공', '**', 'enemy', '다음 자기 차례까지 무적. 그때 80D.', (g, u, T, X, sk) => { u.invul = true; u.sched = { kind: 'dive', skillId: sk.id, team: T.team, slot: slotOf(g, T), dmg: 80 }; notice(g, u, '무적', 'shield'); }, { kind: 'field' }),
    ] },
  { id: 'phantomMuner', name: '괴도무너', star: '3', hp: 170, role: '상태 면역·약탈 딜러', trait: '모든 상태이상 무효.', immune: ['poison', 'slow', 'paralyze', 'burn', 'freeze', 'traitSeal', 'skillSeal', 'healSeal'],
    skills: [
      S('cutter', '윙커터', '**', 'enemy', '50D.', atk(50)),
      S('raid', '약탈기습', 'BBR', 'enemy', '100D. 대상의 에너지 하나를 골라 강탈.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 100 }, sk); if (!T.dead) steal(g, u, T, X.extra.e); }, { choices: (g, u, T) => [{ key: 'e', label: '강탈할 에너지', options: eopts(T) }] }),
      S('iceshot', '아이스샷', 'BR', 'enemy', '30D씩 무작위 2~4회.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 30, hits: rint(g, 2, 4) }, sk); }),
    ] },
  { id: 'magSnail', name: '마그달팽', star: '3', hp: 120, shield: 100, speed: -1, role: '필드 전개 포격', trait: '느리게 출전한다 (Speed −1).',
    skills: [
      S('catapult', '투석기', 'B', 'enemy', '20D.', atk(20)),
      S('steam', '스팀히터', 'WR', 'enemy', '80D. 그랜드필드가 없으면 피해 대신 그랜드필드를 전개한다 (내 W·B 코스트가 *가 되고, 적의 * 코스트는 W/B 한정).', (g, u, T, X, sk) => {
        if (!g.field || g.field.kind !== 'grand') { g.field = { kind: 'grand', team: u.team }; log(g, `${u.name}: 그랜드필드 전개!`, 'turn'); ev(g, 'field', { kind: 'grand', team: u.team }); }
        else hit(g, u, T, { amount: 80 }, sk);
      }),
    ] },
  { id: 'thornJellyfish', name: '가시해파리', star: '2', hp: 100, shield: 30, role: '상태이상 견제', trait: '없음.',
    skills: [
      S('volt', '볼트웹', 'WR', 'enemy', '50D. 마비 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 50 }, sk); if (!T.dead) addStatus(g, u, T, 'paralyze', 2); }),
      S('bubble', '버블빔', '**', 'enemy', '30D. 감속 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 30 }, sk); if (!T.dead) addStatus(g, u, T, 'slow', 2); }),
    ] },
  { id: 'megaWing', name: '메가윙', star: '2', hp: 60, shield: 60, speed: 3, role: '초고속 약탈 딜러', trait: '거의 즉시 출전·교체 (Speed 3).',
    skills: [
      S('glide', '메가글라이드', 'WW', 'enemy', '실드가 있을 때만. 80D + 대상의 에너지 하나를 골라 강탈.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 80 }, sk); if (!T.dead) steal(g, u, T, X.extra.e); },
        { req: (g, u) => u.shield > 0, reqText: '실드 필요', choices: (g, u, T) => [{ key: 'e', label: '강탈할 에너지', options: eopts(T) }] }),
      S('body', '몸통박치기', '**', 'enemy', '30D.', atk(30)),
    ] },
  { id: 'foxious', name: '폭시어스', star: '4', hp: 60, shield: 180, speed: 1, role: '순환형 실드 딜러', trait: '스트라이크를 쓸 때마다 단일 요구색이 W→B→R→W 로 순환한다. 요구색 2개로 쓰면 140D.',
    skills: [
      S('strike1', '스트라이크 · 단일', (g, u) => u.fx.cyc || '*', 'enemy', '80D. 현재 요구색(처음엔 아무 색) 1개. 쓰면 요구색이 W→B→R→W 로 넘어간다.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 80 }, sk); foxAdvance(u, X); }),
      S('strike2', '스트라이크 · 강타', '**', 'enemy', '80D. 지금 요구색을 2개 내면 140D. 요구색이 순환한다.', (g, u, T, X, sk) => { const cur = u.fx.cyc; const enh = cur && X.plan[cur] >= 2; hit(g, u, T, { amount: enh ? 140 : 80 }, sk); foxAdvance(u, X); }),
    ] },
  { id: 'genocider', name: '제노사이더', star: '4', hp: 240, immune: ['slow'], role: 'B 축적·소모형', trait: '감속 무효. 어둠 포식: 보유 B 1개당 최대 HP +60, 늘어난 B 1개당 HP 30 회복.',
    init: (g, u) => { u.fx.obsB = 0; }, onEnergy(g, u) { geno(g, u); }, turnStart(g, u) { geno(g, u); },
    skills: [
      S('claw', '슬래시클로', '*', 'enemy', '20D씩 2회. 코스트를 내기 직전 보유한 B 1개당 타격 피해 +10.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 20 + 10 * (X.paidBefore.B || 0), hits: 2 }, sk); }),
      S('displode', '디스플로전', 'B', 'enemy', 'HP 60 회복 후, 추가로 낸 B 1개당 80D.', (g, u, T, X, sk) => { heal(g, u, u, 60, 'displode'); const n = X.plus ? X.plus.B : 0; if (n > 0) hit(g, u, T, { amount: 80 * n }, sk); },
        { plus: { colors: ['B'], max: 3, hint: 'B 1개당 80D' } }),
    ] },
  { id: 'yggdrasil', name: '이그드라실', star: '4', hp: 210, role: '비례 피해·에너지 지원', trait: '생명의 문턱: HP가 140 아래로 내려가면 아군 필드의 에너지 1개를 제거하고 W를 채운다(전투당 2회). 치유의 빛: 모으기 후 에너지가 정확히 1개나 3개면 아군 30 회복.',
    init: (g, u) => { u.fx.thr = 0; },
    onHp(g, u, old) { if (old > 140 && u.hp <= 140 && u.hp > 0 && u.fx.thr < 2 && traitOn(g, u)) { u.fx.thr++; log(g, `${u.name} 특성 · 생명의 문턱!`, 'heal'); for (const x of fieldUnits(g, u.team)) { if (x.e.length) removeE(g, x, 1); for (let i = 0; i < 4; i++) { const idx = x.e.findIndex(e => e.c !== 'W'); const full = eTotal(x) + 1 > maxE(x) + 0.001; if (full && idx < 0) break; gain(g, x, 'W', 1, full ? [idx] : null); } } } },
    afterGather(g, u) { if (!traitOn(g, u)) return; const n = Math.round(eTotal(u) * 2) / 2; if (n === 1 || n === 3) { const al = fieldUnits(g, u.team).filter(a => a.hp < a.maxHp); log(g, `${u.name} 특성 · 치유의 빛!`, 'heal'); if (al.length) for (const a of al) heal(g, u, a, 30, 'light'); else for (const e of fieldUnits(g, other(u.team))) fixed(g, e, 30, '치유의 빛'); } },
    skills: [
      S('lifeburst', '라이프버스트', '***', 'enemy', '대상 현재 HP의 33% 피해. 방어·난수 무시.', (g, u, T) => { hpPct(g, u, T, T.hp * 0.33, 'cur', '라이프버스트'); }),
      S('firstburst', '퍼스트버스트', 'WWWW', 'enemy', '대상 최대 HP의 33% 피해(방어·난수 무시). 실질 피해의 절반씩 자신과 필드 아군을 회복.', (g, u, T) => { const d = hpPct(g, u, T, T.maxHp * 0.33, 'max', '퍼스트버스트'); for (const a of fieldUnits(g, u.team)) heal(g, u, a, Math.round(d / 2), 'firstburst'); }),
    ] },
  { id: 'flameflower', name: '화락나리', star: '3.5', hp: 190, role: '에너지 보정 지원', trait: '검정 에너지 차단: 필드에 있는 동안 아군의 무작위 수급에서 B가 제외된다.',
    gatherFilter: (g, x, c) => (c.length >= 2 ? c.filter(k => k !== 'B') : c),
    skills: [S('grace', '성은의불꽃', 'RW*', 'enemy', '100 − 대상 에너지×20 의 피해. 줄어든 만큼 자신 또는 필드 아군을 회복.', (g, u, T, X, sk) => {
      const red = Math.min(100, Math.round(eTotal(T) * 20)); hit(g, u, T, { amount: Math.max(0, 100 - red) }, sk);
      const tg = g.u[X.extra.who] && !g.u[X.extra.who].dead ? g.u[X.extra.who] : u; if (red > 0) heal(g, u, tg, red, 'grace');
    }, { choices: (g, u) => [{ key: 'who', label: '회복할 대상', options: fieldUnits(g, u.team).map(a => ({ v: a.uid, label: a === u ? '자신' : a.name })) }] })] },
  { id: 'lunari', name: '루나리', star: '3.5', hp: 190, role: '무작위 에너지·광역 약화', trait: '붉은 에너지 차단: 필드에 있는 동안 아군의 무작위 수급에서 R이 제외된다.',
    gatherFilter: (g, x, c) => (c.length >= 2 ? c.filter(k => k !== 'R') : c),
    skills: [S('shard', '루나샤드', '***', 'enemyField', '적 필드 전체에 80 − 에너지×20 의 피해. 이후 적 진영의 공격력 −10.', (g, u, T, X, sk) => {
      const list = [...T]; const amts = list.map(x => Math.max(0, 80 - Math.round(eTotal(x) * 20)));
      list.forEach((x, i) => hit(g, u, x, { amount: amts[i] }, sk)); for (const x of list) if (!x.dead) modStat(g, u, x, 'atkMod', -10);
    })] },
  /* ── 메가리그 2차 ── */
  { id: 'silvrae', name: '실브래', star: '4', hp: 220, maxE: 6, role: '실드 보호 드래곤', tags: ['dragon'], nullify: true, protector: true, immune: ['poison', 'slow', 'burn', 'traitSeal', 'skillSeal', 'healSeal'],
    trait: '냉동·마비 외 상태이상 면역. 실드가 있으면 아군이 받는 공격 피해의 절반을 실드로 대신 받는다. 기술을 쓸 때마다 HP 10 회복. 최대 에너지 6.',
    onSkill: (g, u) => { if (traitOn(g, u)) heal(g, u, u, 10, 'silvrae'); },
    skills: [
      S('fguard', '퍼스트가드', '', 'enemy', '전투 중 1회. 40D 후 자신에게 실드 120.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); if (!u.dead) addShield(g, u, 120); }, { once: true }),
      S('smash', '실버스매시', (g, u, t) => { if (!g.t) return '******'; const n = t ? eTotal(t) : Math.max(0, ...fieldUnits(g, other(u.team)).map(eTotal)); return '*'.repeat(Math.max(0, 6 - Math.floor(n + 1e-6))); }, 'enemy', '70D. 코스트는 ★6개에서 시작해 대상이 가진 에너지 수만큼 줄어든다.', atk(70), { dynCost: true }),
      S('dmem', '드래곤메모리', (g, u, t) => { const b = dragonSrc(g, u); if (!b) return ''; const s = def(b).skills[0]; return typeof s.cost === 'function' ? s.cost(g, u, t) : s.cost; },
        (g, u) => { const b = dragonSrc(g, u); return b ? tgtKind(g, u, def(b).skills[0]) : 'self'; }, '전투 중 1회. 아직 출전하지 않은 후열 드래곤의 첫 번째 기술을 같은 코스트·대상·효과로 복사해 쓴다.',
        (g, u, T, X, sk) => { const b = dragonSrc(g, u); if (!b) return; const s = def(b).skills[0]; log(g, `${u.name}: ${b.name}의 ${s.name}을(를) 복사!`, 'skill'); s.exec(g, u, T, X, s); },
        { once: true, dynCost: true, kind: 'field', req: (g, u) => { const b = dragonSrc(g, u); if (!b) return false; const s = def(b).skills[0]; return !s.req || s.req(g, u); }, reqText: '복사할 후열 드래곤 없음',
          choices: (g, u, T, ex) => { const b = dragonSrc(g, u); const s = b && def(b).skills[0]; return s && s.choices ? s.choices(g, u, T, ex) : []; } }),
    ] },
  { id: 'horizintal', name: '호리진탈', star: '4', hp: 250, role: '수평선 보호·형태 순환', teamGuard: true,
    trait: '끝없는 수평선: HP가 가득 찬 상태면 같은 진영이 받는 최종 피해가 절반 (중첩 없음). 시간의 흐름: 자기 차례 끝에 HP가 절반 이하이고 W와 B 수가 다르면, W가 많을 땐 화락나리로 B가 많을 땐 루나리로 퇴화한다.',
    turnEnd(g, u) { if (!traitOn(g, u) || u.hp > u.maxHp / 2) return; const w = eCount(u, 'W'), b = eCount(u, 'B'); if (Math.abs(w - b) < 0.01) return; transform(g, u, w > b ? 'flameflower' : 'lunari'); },
    skills: [
      S('sun', '호리진썬', 'WR*', 'enemy', '40D 후 100D. 두 타격 뒤 화상 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); hit(g, u, T, { amount: 100 }, sk); if (!T.dead) addStatus(g, u, T, 'burn', 2); }),
      S('moon', '호리진문', 'WB*', 'enemy', '40D 후 100D. 두 타격 뒤 냉동 2턴.', (g, u, T, X, sk) => { hit(g, u, T, { amount: 40 }, sk); hit(g, u, T, { amount: 100 }, sk); if (!T.dead) addStatus(g, u, T, 'freeze', 2); }),
    ] },
  { id: 'angel', name: '천사', star: '3.5', hp: 180, eclipse: true, role: '봉인·지속 회복',
    trait: '이클립스: 첫 출전 그대로(교체로 빠진 적 없이) 보유 에너지 수와 지금까지 보낸 자기 차례 수가 같으면 상대 공격 피해를 무효화한다.',
    onLeave: (g, u) => { u.fx.left = true; },
    skills: [
      S('candle', '빛의촛대', '***', 'anyCharacter', '적: 100D 후 낸 W 수에 따라 W1 특성봉인 5 · W2 회복봉인 5 추가 · W3 고른 기술봉인 5 추가. 아군: 낸 W 수에 따라 총 120 지속 회복 (W0: 30×4회, W1: 40×3회, W2: 60×2회, W3: 120).', (g, u, T, X, sk) => {
        const w = X.plan.W || 0;
        if (T.team !== u.team) {
          hit(g, u, T, { amount: 100 }, sk); if (T.dead) return;
          if (w >= 1) addStatus(g, u, T, 'traitSeal', 5); if (w >= 2) addStatus(g, u, T, 'healSeal', 5);
          if (w >= 3) { const id = X.extra.sk && def(T).skills.some(s => s.id === X.extra.sk) ? X.extra.sk : def(T).skills[0].id; T.seal[id] = 5; log(g, `${T.name}: ${def(T).skills.find(s => s.id === id).name} 기술봉인 5턴.`); notice(g, T, '기술봉인 5', 'status'); }
        } else {
          const amt = [30, 40, 60, 120][Math.min(3, w)], ticks = [4, 3, 2, 1][Math.min(3, w)]; log(g, `${T.name}: 빛의 촛불 — ${amt}씩 ${ticks}번 회복.`, 'heal');
          T.fx.q ??= []; heal(g, u, T, amt, 'candle'); if (ticks > 1) T.fx.q.push({ amt, left: ticks - 1 });
        }
      }, { choices: (g, u, T) => (T && T.team !== u.team && eWhole(u, 'W') >= 3 ? [{ key: 'sk', label: 'W 3개를 냈다면 봉인할 기술', options: def(T).skills.map(s => ({ v: s.id, label: s.name })) }] : []) }),
    ] },
  { id: 'grange', name: '그랜지', star: '4', hp: 240, role: '필드·예약 딜러', runSched,
    trait: '없음.',
    skills: [
      S('gfield', '그랜드필드', 'WorB WorB', 'lowestEnergyEnemy', '에너지가 가장 적은 적에게 40D 후 그랜드필드 전개. 자신과 필드 아군에게 HP 보호막 120.', (g, u, T, X, sk) => {
        hit(g, u, T, { amount: 40 }, sk); g.field = { kind: 'grand', team: u.team }; log(g, `${u.name}: 그랜드필드 전개!`, 'turn'); ev(g, 'field', { kind: 'grand', team: u.team });
        for (const a of fieldUnits(g, u.team)) addBarrier(g, a, 120);
      }),
      S('zigzag', '지그재그굴착', 'WBWB', 'self', '다음 자기 차례까지 무적. 그때 에너지가 적은 적일수록 잘 뽑히는 가중 추첨을 5번 하고, 대상별 뽑힌 횟수×40D를 한 번에 입힌다.', (g, u) => {
        u.invul = true; u.sched = { kind: 'zigzag', skillId: 'zigzag' }; log(g, `${u.name}: 땅속으로!`); notice(g, u, '무적', 'shield');
      }, { kind: 'field' }),
    ] },
  { id: 'flappis', name: '플래피스', star: '4', hp: 270, role: '선택형 에너지·예약 딜러', immune: ['slow'], runSched,
    trait: '에너지 직조: 피격 시 W1, 아군 피격 시 W½, 기술 사용 후 R1 을 자동으로 얻는다 (빈 칸이 있을 때만). 유연한 몸: 감속 면역.',
    onHit: (g, u, src, fin) => { if (fin > 0 && u.hp > 0 && eTotal(u) + 1 <= maxE(u) + 0.001) { gain(g, u, 'W', 1); log(g, `${u.name} 특성 · 직조: W 획득.`); } },
    onAllyHit: (g, u) => { if (eTotal(u) + 0.5 <= maxE(u) + 0.001) { gain(g, u, 'W', 0.5); log(g, `${u.name} 특성 · 직조: W½ 획득.`); } },
    onSkill: (g, u) => { if (traitOn(g, u) && !u.dead && eTotal(u) + 1 <= maxE(u) + 0.001) { gain(g, u, 'R', 1); log(g, `${u.name} 특성 · 직조: R 획득.`); } },
    skills: [
      S('hurri', '허리케인 다이브', 'W*', 'enemy', '추가로 W를 낸 만큼 강해진다. 0개: 즉시 30D · 1개: 다음 자기 차례에 100D · 2개: 두 번째 자기 차례에 170D (그 슬롯을 따라간다).', (g, u, T, X, sk) => {
        const n = X.plus ? X.plus.W : 0; if (n === 0) { hit(g, u, T, { amount: 30 }, sk); return; }
        u.sched = { kind: 'hurricane', skillId: sk.id, team: T.team, slot: slotOf(g, T), wait: n, dmg: n === 1 ? 100 : 170 }; log(g, `${u.name}: 회오리를 휘감는다 (${n}차례 뒤 ${n === 1 ? 100 : 170}D).`);
      }, { plus: { colors: ['W'], max: 2, hint: 'W 0개: 즉시 30D · 1개: 100D · 2개: 170D (예약)' } }),
      S('cotton', '코튼힐', 'R*', 'enemy', '대상에게 감속 2턴. 자신 HP 30 회복.', (g, u, T) => { addStatus(g, u, T, 'slow', 2); heal(g, u, u, 30, 'cotton'); }, { kind: 'status' }),
    ] },
  { id: 'eterna', name: '이터너', star: '4', hp: 230, role: '교체 봉쇄·R 연계', switchLock: true,
    trait: '필드에 있는 동안 상대는 자발적으로 교체할 수 없다 (쓰러진 슬롯 출전은 가능).',
    skills: [
      S('pad', '흡착 발판', '', 'anyCharacter', '필드 캐릭터 하나에게 R 1을 준다. 자신이나 아군이 대상이면 비공격 피해 20D도 받는다.', (g, u, T) => {
        const mine = T.team === u.team; const ok = give(g, T, 'R', 1, !mine); log(g, ok ? `${T.name}: R 에너지 획득.` : `${T.name}: 에너지가 가득 차 받지 못했다.`);
        if (mine) fixed(g, T, 20, '흡착 발판');
      }, { kind: 'buff' }),
      S('heal', '이터너힐', 'R*', 'enemy', '대상이 가진 R 수×60D. 피해 후 대상의 R을 전부 제거하고, 실질 피해의 절반을 필드 아군에게 나눠 회복. 자신 또는 아군 한 명에게 R 1을 준다.', (g, u, T, X, sk) => {
        const nR = eCount(T, 'R'); const dealt = hit(g, u, T, { amount: 60 * nR }, sk);
        for (let i = T.e.length - 1; i >= 0; i--) if (T.e[i].c === 'R') removeEntry(g, T, i, u);
        const al = fieldUnits(g, u.team); if (dealt > 0 && al.length) for (const a of al) heal(g, u, a, Math.round(dealt / 2 / al.length), 'eternaheal');
        const who = g.u[X.extra.who]; const tg = who && !who.dead && who.team === u.team ? who : u; if (!u.dead) { give(g, tg, 'R', 1); }
      }, { choices: (g, u) => [{ key: 'who', label: 'R 1을 줄 대상', options: fieldUnits(g, u.team).map(a => ({ v: a.uid, label: a === u ? '자신' : a.name })) }] }),
    ] },
  { id: 'toxious', name: '톡시어스', star: '4', hp: 170, shield: 50, role: '실드 전환·광역 폭발', tags: ['dragon'],
    trait: '없음.',
    skills: [
      S('unseal', '봉인 해제', '', 'self', '실드가 있을 때만. 실드를 전부 깨고 비공격 자기 피해 20D, R 3개를 차례로 얻는다.', (g, u) => {
        const old = u.shield; u.shield = 0; ev(g, 'shield', { uid: u.uid, n: -old }); log(g, `${u.name}: 실드 ${old}를 스스로 깨뜨렸다.`); fixed(g, u, 20, '봉인 해제 반동');
        if (!u.dead) for (let i = 0; i < 3; i++) give(g, u, 'R', 1);
      }, { kind: 'buff', req: (g, u) => u.shield > 0, reqText: '실드 필요' }),
      S('gzero', '그라운드제로', 'RRR', 'enemy', '주 대상 140D. 다른 적 필드 캐릭터가 있으면 70D 후 화상 4턴.', (g, u, T, X, sk) => {
        hit(g, u, T, { amount: 140 }, sk); for (const x of fieldUnits(g, T.team)) if (x !== T) { hit(g, u, x, { amount: 70 }, sk); if (!x.dead) addStatus(g, u, x, 'burn', 4); }
      }),
      S('dust', '더스트웨이브', 'BBR', 'enemy', '100D.', atk(100)),
    ] },
  { id: 'abigate', name: '아비게이트', star: '4', hp: 260, role: '가변 저주·에너지 교환', downPressure: true, deepMind: true,
    trait: '다운 프레셔: 독에 걸린 상대의 추가 코스트 ★가 B 로 고정된다. 딥마인드: 자신이나 아군이 비공격 기술을 쓰면 그 기술의 대상을 HP 10 회복시키고 상대 필드 에너지 ½을 제거한다.',
    skills: [
      S('cannon', '초저주포', '', 'enemy', '에너지를 0~4개 골라 낸다. 4/3/2/1/0개 → 100/60/20/0/0D. 낸 색에 R·W·B가 모두 있으면 독 3턴.', (g, u, T, X, sk) => {
        const p = X.plus || { R: 0, W: 0, B: 0 }, n = p.R + p.W + p.B, dmg = [0, 0, 20, 60, 100][n]; if (dmg > 0) hit(g, u, T, { amount: dmg }, sk); else log(g, `${u.name}: 에너지가 부족해 위력이 없다.`);
        if (!T.dead && p.R > 0 && p.W > 0 && p.B > 0) addStatus(g, u, T, 'poison', 3);
      }, { plus: { colors: ['R', 'W', 'B'], max: 4, hint: '낸 개수 4/3/2/1 → 100/60/20/0D · R·W·B 모두 포함하면 독' } }),
      S('vortex', '심해의소용돌이', 'B', 'self', '서로 다른 필드 캐릭터 둘의 에너지 한 칸씩을 골라 색을 서로 맞바꾼다. 양과 주인은 그대로.', (g, u, T, X) => {
        const A = g.u[X.extra.a], B = g.u[X.extra.b]; const ea = A === u ? remapIdx(u, X.eSnap, X.extra.ea) : X.extra.ea, eb = B === u ? remapIdx(u, X.eSnap, X.extra.eb) : X.extra.eb;
        if (!A || !B || A === B || !A.e[ea] || !B.e[eb]) { log(g, '소용돌이: 바꿀 에너지가 없다.'); return; }
        if ((A.team !== u.team && A.fx.noExternalE) || (B.team !== u.team && B.fx.noExternalE)) { log(g, '소용돌이: 외부 에너지 조작이 차단됐다.'); return; }
        const ca = A.e[ea].c; A.e[ea].c = B.e[eb].c; B.e[eb].c = ca; normE(A); normE(B); log(g, `소용돌이! ${A.name}의 ${ca} ↔ ${B.name}의 ${B.e[eb] ? B.e[eb].c : ''} 맞교환.`);
        for (const x of [A, B]) { ev(g, 'energy', { uid: x.uid, c: x.e[0]?.c || 'R', a: 0, kind: 'recolor' }); def(x).onEnergy?.(g, x); }
      }, { kind: 'field', req: (g, u) => allField(g).filter(x => x.e.length).length >= 2, reqText: '에너지를 가진 캐릭터 2명 필요',
        choices: (g, u, T, ex) => {
          const nm = x => (x.team === u.team ? '' : '적 ') + x.name, withE = allField(g).filter(x => x.e.length);
          if (!('a' in ex)) return [{ key: 'a', label: '첫 번째 캐릭터', options: withE.map(x => ({ v: x.uid, label: nm(x) })) }];
          const A = g.u[ex.a]; if (!('b' in ex)) return [{ key: 'b', label: '두 번째 캐릭터', options: withE.filter(x => x !== A).map(x => ({ v: x.uid, label: nm(x) })) }];
          const B = g.u[ex.b]; if (!('ea' in ex)) return [{ key: 'ea', label: `${nm(A)}의 바꿀 에너지`, options: eopts(A) }];
          if (!('eb' in ex)) return [{ key: 'eb', label: `${nm(B)}의 바꿀 에너지`, options: eopts(B) }]; return [];
        } }),
    ] },
  { id: 'elixian', name: '엘릭시안', star: '4', hp: 200, shield: 10, role: '회복·필드 지원',
    trait: '잔향: 쓰러지면 같은 슬롯에 다음으로 나오는 아군이 자기 차례마다 HP 10을 영구 회복한다.',
    onDeath: (g, u, killer, si) => { if (!u.st.traitSeal && si >= 0) { (g.t[u.team].res ??= {})[si] = true; log(g, `${u.name}의 잔향이 슬롯 ${si + 1}에 남았다.`, 'heal'); } },
    skills: [
      S('wind', '샤이닝윈드', 'RorB', 'self', '아군 전체 HP 20 회복 (넘치는 회복은 대상별 최대 80의 HP 보호막으로). 자신은 W½을 얻는다.', (g, u) => {
        for (const a of fieldUnits(g, u.team)) heal(g, u, a, 20, 'shining', { overflowShield: 80 }); if (!u.dead) give(g, u, 'W', 0.5);
      }, { kind: 'heal' }),
      S('aroma', '아로마필드', '*', 'self', '아군 진영의 공격·방어 증감을 0으로 되돌리고 아로마필드 전개: 아군 회복 +10, 상대 회복 −10, 상대 방어 −10 (다른 필드는 대체).', (g, u) => {
        for (const x of teamUnits(g, u.team)) for (const k of ['atkMod', 'defMod']) if (x[k]) { ev(g, 'stat', { uid: x.uid, key: k, d: -x[k] }); x[k] = 0; }
        g.field = { kind: 'aroma', team: u.team }; log(g, `${u.name}: 아로마필드 전개!`, 'turn'); ev(g, 'field', { kind: 'aroma', team: u.team });
      }, { kind: 'field' }),
      S('arrow', '멀티애로', 'W', 'enemy', '20D. 대상 등급이 자신보다 높으면 2회, 같거나 낮으면 3회 (각 타격 별도 판정).', (g, u, T, X, sk) => { hit(g, u, T, { amount: 20, hits: starVal(T) > starVal(u) ? 2 : 3 }, sk); }),
      S('gift', '라스트기프트', '**', 'allyOther', '적 전체에게 냉동 1턴·마비 1턴. 남은 HP 전부를 고른 아군에게 최대 HP까지 옮기고 쓰러진다 (잔향을 남긴다).', (g, u, T) => {
        for (const x of fieldUnits(g, other(u.team))) { addStatus(g, u, x, 'freeze', 1); addStatus(g, u, x, 'paralyze', 1); }
        const n = u.hp; heal(g, u, T, n, 'gift'); log(g, `${u.name}: 남은 HP ${n}을(를) ${T.name}에게 전했다…`, 'heal'); u.hp = 0; checkDeath(g, u);
      }, { kind: 'heal', req: (g, u) => fieldUnits(g, u.team).some(a => a !== u), reqText: '다른 아군 없음' }),
    ] },  { id: 'iceknight', name: '빙마기수', star: '4', hp: 230, maxE: 6, speed: 1, role: '복합 제어 딜러',
    trait: '냉동 흡수: 냉동이 걸리는 대신 HP 20을 얻는다 (최대 HP를 넘을 수 있다). 기수와 야수가 하나의 에너지 저장소를 쓴다 (최대 6).',
    statusFilter(g, u, s) { if (s !== 'freeze' || !traitOn(g, u)) return true; u.hp += 20; log(g, `${u.name} 특성 · 냉동 흡수: HP 20 획득!`, 'heal'); ev(g, 'heal', { uid: u.uid, n: 20 }); notice(g, u, '냉동 흡수', 'immune'); return false; },
    skills: [
      S('roar', '빙천포효', 'WB', 'field', '자신을 뺀 필드 전원에게 냉동 2턴. 자신은 냉동 흡수가 발동해 HP 20을 얻는다.', (g, u, T, X, sk) => {
        for (const x of allField(g)) if (x !== u) addStatus(g, u, x, 'freeze', 2); addStatus(g, u, u, 'freeze', 2);
      }, { kind: 'status' }),
      S('rampage', '날뛰기', '*', 'enemy', '기본 에너지 1개와 추가로 낸 에너지를 합쳐 낸 개수×10D.', (g, u, T, X, sk) => { const n = 1 + (X.plus ? X.plus.R + X.plus.W + X.plus.B : 0); hit(g, u, T, { amount: 10 * n }, sk); },
        { plus: { colors: ['R', 'W', 'B'], max: 5, hint: '낸 에너지 총량(기본 1 포함)×10D' } }),
      S('lance', '파쇄창', 'WR*', 'enemy', '70D + 대상의 냉동 남은 턴×30D. 피해 후 냉동을 제거한다.', (g, u, T, X, sk) => { const f = status(T, 'freeze'); hit(g, u, T, { amount: 70 + 30 * f }, sk); if (!T.dead && f) { delete T.st.freeze; ev(g, 'cure', { uid: T.uid }); log(g, `${T.name}: 냉동이 깨졌다.`); } }),
    ] },
  { id: 'circuit', name: '서킷', star: '4', hp: 170, speed: 2, role: '연속 행동·전류 방어', immune: ['paralyze'], fragment: true,
    trait: '프레그먼트: R+B 보유량×10만큼 방어가 오르고, 상대의 에너지 조작(제거·강탈·변환)을 받지 않는다. 전류가속: 기본 차례를 시작할 때 완성 W 개수만큼 추가 차례. 교류충전: 모으기가 W → (R 또는 B) → W 로 번갈아 나온다. 마비 면역.',
    init: (g, u) => { u.fx.noExternalE = true; u.fx.lastG = null; },
    gatherColors: (g, u) => (u.fx.lastG === 'W' ? ['R', 'B'] : ['W']), afterGather(g, u, c) { u.fx.lastG = c; },
    turnStart(g, u) { if (!traitOn(g, u)) return; if (g.chain && g.chain.uid === u.uid) return; const n = eWhole(u, 'W'); if (n > 0) { chainWith(g, u, n); log(g, `${u.name} 특성 · 전류가속: 추가 차례 ${n}번!`, 'turn'); notice(g, u, `추가 차례 ×${n}`, 'buff'); } },
    skills: [
      S('kick', '돌려차기', '**', 'enemyField', '적 필드 전체에 각각 30D.', (g, u, T, X, sk) => { for (const x of [...T]) hit(g, u, x, { amount: 30 }, sk); }),
      S('blade', '암즈블레이드', 'WW', 'enemy', '대상 최대 HP의 25% 피해 (방어·난수 무시). 살아 있으면 마비 1턴. 이후 B와 R을 1개씩 얻는다.', (g, u, T, X, sk) => {
        hpPct(g, u, T, T.maxHp * 0.25, 'max', '암즈블레이드'); if (!T.dead) addStatus(g, u, T, 'paralyze', 1); give(g, u, 'B', 1); give(g, u, 'R', 1);
      }),
      S('burst', '볼티지버스트', '', 'enemy', '완성 W가 1개 이상일 때만. W를 전부 소모해 (W 수)²×15D, 소모한 W 수만큼 B를 얻는다.', (g, u, T, X, sk) => {
        const m = eWhole(u, 'W'); for (let i = u.e.length - 1; i >= 0; i--) if (u.e[i].c === 'W') removeEntry(g, u, i); log(g, `${u.name}: W ${m}개를 방전!`);
        hit(g, u, T, { amount: m * m * 15 }, sk); for (let i = 0; i < m; i++) give(g, u, 'B', 1);
      }, { req: (g, u) => eWhole(u, 'W') >= 1, reqText: '완성 W 필요' }),
    ] },
  { id: 'timeora', name: '타임오러', star: '4.5', hp: 280, role: '시간 제어·특성 정지 드래곤', tags: ['dragon'], nullify: true, fateClock: true, timeProtect: true,
    trait: '시간 가속: 모으기 때 같은 색 ½을 더 얻는다 (총 1.5). 타임프로텍트: 필드에 있는 동안 아군 방어 +20. 운명의 시계: 아군이 기술을 쓰면 시침이 낸 에너지×30° 돌고, 타임오러가 쓰면 분침이 90° 돈다. 두 바늘이 겹치거나 정반대인 동안 타임오러 외 필드 모든 캐릭터의 특성이 정지 (양 진영이 동시에 정렬되면 서로 상쇄).',
    init: (g, u) => { u.fx.hour = 0; u.fx.min = 90; },
    afterGather(g, u, c) { if (traitOn(g, u) && eTotal(u) + 0.5 <= maxE(u) + 0.001) { gain(g, u, c, 0.5); log(g, `${u.name} 특성 · 시간 가속: ${c}½ 추가.`); } },
    onSkill(g, u, sk, X) { if (!u.dead && !u.st.traitSeal) { u.fx.min = (u.fx.min + 90) % 360; u.fx.hour = (u.fx.hour + 30 * Math.ceil(((X.plan.R + X.plan.W + X.plan.B) + (X.plus ? X.plus.R + X.plus.W + X.plus.B : 0)) - 0.001)) % 360; clockLog(g, u); } },
    onAllySkill(g, u, who, X) { if (!u.st.traitSeal && who !== u) { u.fx.hour = (u.fx.hour + 30 * Math.ceil(X.plan.R + X.plan.W + X.plan.B - 0.001)) % 360; clockLog(g, u); } },
    skills: [
      S('recall', '타임리콜', '**', 'anyCharacter', '대상 하나의 HP와 상태이상을 그 대상의 지난 자기 차례 시작(2턴 전) 상태로 되돌린다. 실드·에너지·최대 HP·시계는 그대로.', (g, u, T) => {
        const h = T.fx.hist || []; const snap = h.length >= 2 ? h[h.length - 2] : h[0]; if (!snap) { log(g, '되감을 기록이 없다.'); return; }
        const d = snap.hp - T.hp; T.hp = Math.max(1, Math.min(T.maxHp, snap.hp)); if (d > 0) ev(g, 'heal', { uid: T.uid, n: d }); else if (d < 0) ev(g, 'dmg', { uid: T.uid, n: -d });
        T.st = { ...snap.st }; ev(g, 'cure', { uid: T.uid }); log(g, `${T.name}: 시간이 되감겨 HP ${T.hp}, 상태이상 되돌림.`, 'heal'); notice(g, T, '시간 되감기', 'cure');
      }, { kind: 'heal' }),
      S('hyper', '하이퍼클락', (g, u) => (u.st && u.st.traitSeal ? '***' : 'WWorB*'), 'enemy', '100D. 특성봉인 상태이거나 시침·분침이 겹치거나 정반대면 160D (특성봉인일 때 코스트는 ★3).', (g, u, T, X, sk) => {
        hit(g, u, T, { amount: u.st.traitSeal || clockAligned(u) ? 160 : 100 }, sk);
      }),
    ] },
  { id: 'jungles', name: '정글즈', star: '4', hp: 270, speed: 1, role: '소환·에너지 강탈', regen: true, gatherColors: () => ['B'],
    trait: '재생력: 자기 차례가 끝날 때 상태이상 지속시간이 2 줄어든다. 정글진흙: 직접 모으면 B만 얻는다. 소환수(최대 2)는 정글즈가 맞을 피해를 먼저 대신 받고, 정글즈의 차례가 끝날 때마다 한 번씩 움직인다. 정글즈가 물러나면 사라진다.',
    onLeave: (g, u) => { u.fx.sum = []; },
    absorb(g, u, n, eff) {
      const sum = u.fx.sum || []; while (sum.length && n > 0) { const s = sum[0], x = Math.min(s.hp, n); s.hp -= x; n -= x; log(g, `${s.name}이(가) 정글즈 대신 ${x} 피해.`); notice(g, u, `${s.name} −${x}`, 'shield'); if (s.hp <= 0) { log(g, `${s.name}이(가) 쓰러졌다.`); sum.shift(); } }
      return n;
    },
    turnEnd(g, u) {
      const sum = u.fx.sum || []; for (const s of [...sum]) {
        if (u.dead || g.winner) break; if (s.fresh) { s.fresh = false; continue; } const en = fieldUnits(g, other(u.team)), al = fieldUnits(g, u.team), pk = { id: 'sum_' + s.k, name: s.name };
        ev(g, 'notice', { uid: u.uid, text: s.name, cls: 'buff' });
        if (s.k === 'toucan') { const hurt = al.filter(a => a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (hurt) heal(g, u, hurt, 25, 'toucan'); else if (en.length) hit(g, u, pick(g, en), { amount: 30 }, { id: 'peck', name: '쪼아먹기' }); }
        else if (s.k === 'anaconda' && en.length) { const t = pick(g, en); hit(g, u, t, { amount: 70 }, { id: 'squeeze', name: '조이기' }); if (!t.dead && t.e.length) removeE(g, t, 0.5, u); }
        else if (s.k === 'jaguar' && en.length) { const dead = Math.min(3, g.t[u.team].dead.length); hit(g, u, pick(g, en), { amount: 60 + 20 * dead }, { id: 'claw', name: '분노발톱' }); }
      }
    },
    skills: [
      S('whip', '덩굴휩', '*', 'enemy', '20D. 이후 W½ 획득. 전투 중 첫 사용이거나 자신이 상태이상일 때는 대상의 가장 최근 에너지를 강탈한다.', (g, u, T, X, sk) => {
        const first = !u.fx.whip || Object.keys(u.st).length > 0; u.fx.whip = true; hit(g, u, T, { amount: 20 }, sk); give(g, u, 'W', 0.5);
        if (first && !T.dead && T.e.length) steal(g, u, T, T.e.length - 1);
      }),
      S('toucan', '왕부리새', 'W*', 'self', '왕부리새 소환 (HP 60). 정글즈의 차례가 끝날 때 아군을 25 치유하거나, 다친 아군이 없으면 적에게 30D.', (g, u) => summon(g, u, 'toucan', '왕부리새', 60), { kind: 'buff', req: (g, u) => (u.fx.sum || []).length < 2, reqText: '소환수 가득' }),
      S('anaconda', '아나콘다', 'WW*', 'self', '아나콘다 소환 (HP 120). 차례가 끝날 때 무작위 적에게 70D 후 에너지 ½ 제거.', (g, u) => summon(g, u, 'anaconda', '아나콘다', 120), { kind: 'buff', req: (g, u) => (u.fx.sum || []).length < 2, reqText: '소환수 가득' }),
      S('jaguar', '재규어', 'RW**', 'self', '재규어 소환 (HP 160). 차례가 끝날 때 무작위 적에게 60D + 쓰러진 아군 수(최대 3)×20D.', (g, u) => summon(g, u, 'jaguar', '재규어', 160), { kind: 'buff', req: (g, u) => (u.fx.sum || []).length < 2, reqText: '소환수 가득' }),
    ] },
];

function summon(g, u, k, name, hp) { (u.fx.sum ??= []).push({ k, name, hp, max: hp, fresh: true }); log(g, `${u.name}: ${name} 소환! (HP ${hp})`, 'turn'); notice(g, u, `${name} 소환`, 'buff'); }
function clockLog(g, u) { log(g, `${u.name}의 시계: 시침 ${u.fx.hour}° / 분침 ${u.fx.min}°${clockAligned(u) ? ' — 정렬!' : ''}`); notice(g, u, clockAligned(u) ? '시계 정렬!' : `시계 ${u.fx.hour}°/${u.fx.min}°`, clockAligned(u) ? 'buff' : ''); }
function foxAdvance(u, X) {
  const cyc = { W: 'B', B: 'R', R: 'W' }; const basis = u.fx.cyc || ['R', 'W', 'B'].map(c => [c, X.plan[c] || 0]).sort((a, b) => b[1] - a[1])[0][0];
  u.fx.cyc = cyc[basis];
}
function geno(g, u) {
  if (!traitOn(g, u) || u.dead) return; const nb = Math.floor(eCount(u, 'B') + 1e-6); const want = 240 + 60 * nb;
  if (want > u.maxHp) { u.maxHp = want; if (nb > u.fx.obsB) heal(g, u, u, 30 * (nb - u.fx.obsB), 'dark'); }
  else if (want < u.maxHp) { u.maxHp = want; u.hp = Math.min(u.hp, u.maxHp); }
  u.fx.obsB = nb;
}

for (const c of CARDS) { c.runSched ??= runSched; c.skills.forEach((s, i) => { s.idx = i; }); }
register(CARDS);
export const ROSTER = CARDS.map(c => c.id);
export const STARS = { '2': 2, '3': 3, '3.5': 3.5, '4': 4, '4.5': 4.5 };
