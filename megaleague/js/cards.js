// 캐릭터 데이터 + 기술 구현. 수치/규칙은 원본 스펙을 그대로 따르고, 구현은 새 엔진(engine.js) 위에서 다시 썼다.
import * as E from './engine.js';
const { register, setHooks, def, other, rnd, rint, pick, fieldUnits, teamUnits, slotOf, unitAt, status, traitOn, log, ev, notice,
  eTotal, eCount, eWhole, maxE, gain, removeE, removeEntry, clearE, recolor, addStatus, heal, addShield, addBarrier, hit, hpPct, fixed, bestReplace, gatherColors } = E;

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
    default: u.sched = null;
  }
}

/* 전투 전체에 걸린 규칙 */
const HOOKS = {
  suppressed: () => false,
  downPressure: () => false,
  healAdjust: (g, u, base) => base,
  defAdjust: () => 0,
  finalAdjust(g, src, tgt, n) {
    if (n <= 0) return n;
    const d = def(tgt); if (d.fullHalf && traitOn(g, tgt) && tgt.hp >= tgt.maxHp) n = Math.floor(n / 2);
    return n;
  },
  sweetProt(g, src, tgt) { const sw = fieldUnits(g, tgt.team).some(x => def(x).sweetna && traitOn(g, x)); return sw ? 10 * status(src, 'poison') : 0; },
  switchLocked: (g, team) => fieldUnits(g, other(team)).some(x => def(x).switchLock && traitOn(g, x)),
  onSkill(g, u, sk, X) { // 피어나는생명 대기 중 코스트를 낸 적 → 해당 적은 절반 피해
    const total = X.plan ? X.plan.R + X.plan.W + X.plan.B : 0; if (!total) return;
    for (const x of fieldUnits(g, other(u.team))) if (x.sched && x.sched.kind === 'bloom') { x.sched.evaded ??= {}; x.sched.evaded[u.uid] = true; }
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
];

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
