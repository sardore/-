// 메가리그 — 화면/조작/연출. 규칙은 engine.js, 캐릭터는 cards.js, 그림은 art/*.js
import * as E from './engine.js';
import { ROSTER } from './cards.js';
import { renderArt } from './art/lib.js';
import './art/art1.js';
import './art/art2.js';
import './art/art3.js';
import { chooseAction } from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SP = new URLSearchParams(location.search).has('fast') ? 0.04 : 1;
const T = ms => Math.max(1, ms * SP);
const sleep = ms => new Promise(r => setTimeout(r, ms * SP));
const def = E.def;
const rr = (a, b) => a + Math.random() * (b - a);
const S = { deck: [], filter: 'all', selSlot: null, ai: 2, g: null, view: null, cur: null, sel: null, resolve: null, battle: 0, mute: false, fxColor: '#ffd23a', busy: false, dexMode: false };
try { S.deck = JSON.parse(localStorage.getItem('ml_deck') || '[]').filter(id => ROSTER.includes(id)).slice(0, 4); S.mute = localStorage.getItem('ml_mute') === '1'; S.ai = +(localStorage.getItem('ml_ai') || 2); } catch (e) { /* 저장소 없음 */ }
const save = () => { try { localStorage.setItem('ml_deck', JSON.stringify(S.deck)); localStorage.setItem('ml_mute', S.mute ? '1' : '0'); localStorage.setItem('ml_ai', String(S.ai)); } catch (e) { /* 무시 */ } };

/* ───────── 소리 (WebAudio 합성) ───────── */
let AC = null;
function tone(f, d = 0.12, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  if (S.mute) return; try {
    AC ??= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) { /* 오디오 불가 */ }
}
const SFX = {
  tap: () => tone(520, .06, 'triangle', .05), pick: () => { tone(660, .08, 'triangle', .06); tone(880, .1, 'triangle', .05, 0, .06); },
  hit: () => { tone(180, .14, 'sawtooth', .07, -120); tone(90, .16, 'square', .05, -40); }, crit: () => { tone(260, .18, 'sawtooth', .08, -180); tone(120, .24, 'square', .07, -60); tone(1200, .1, 'triangle', .05, 0, .02); },
  shield: () => tone(700, .16, 'triangle', .05, 200), heal: () => { tone(520, .1, 'sine', .06); tone(780, .14, 'sine', .06, 0, .08); tone(1040, .16, 'sine', .05, 0, .16); },
  gather: () => { tone(400, .08, 'triangle', .05); tone(600, .1, 'triangle', .05, 0, .07); }, status: () => tone(220, .22, 'sawtooth', .05, 120), death: () => { tone(300, .4, 'sawtooth', .07, -250); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .22, 'triangle', .07, 0, i * .12)), lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, .26, 'triangle', .06, 0, i * .14)), skill: () => tone(300, .18, 'triangle', .05, 300),
};
const sfx = k => SFX[k]?.();

/* ───────── 표시 도우미 ───────── */
const SHORT = { poison: '독', slow: '감속', paralyze: '마비', burn: '화상', freeze: '냉동', traitSeal: '특봉', skillSeal: '기봉', healSeal: '회봉' };
const COL = { R: '#ff6b6b', W: '#fff6d8', B: '#9a82ff' };
const pip = (t, cls = '') => `<span class="pip ${t === '*' ? 'any' : t} ${cls}"></span>`;
const costHtml = (tokens, plus) => (tokens.length ? tokens.map(t => pip(t)).join('') : '<span class="free">무료</span>') + (plus ? '<span class="plus">＋</span>' : '');
const starTxt = c => `★${c.star}`;
const dummyU = { fx: {}, last: null, lastSkill: null };
const rawCost = sk => (typeof sk.cost === 'function' ? sk.cost({}, dummyU) : sk.cost);
const esc = s => String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const artEl = (id, cls = '') => `<div class="${cls}">${renderArt(id, {})}</div>`;
function skillColor(u, skId) { const sk = def(u).skills.find(s => s.id === skId); const raw = sk ? rawCost(sk) : ''; const t = E.tokensOf(raw).find(x => COL[x]); return t ? COL[t] : '#ffd23a'; }

/* ───────── 화면 전환 ───────── */
function show(id) { $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); }
function ask(html, { cancel = true, cls = '' } = {}) {
  return new Promise(res => {
    const mask = document.createElement('div'); mask.className = 'mask'; mask.innerHTML = `<div class="sheet ${cls}">${html}</div>`; $('#modal-root').append(mask);
    const close = v => { mask.remove(); res(v); };
    mask.addEventListener('click', ev => { if (ev.target === mask && cancel) close(undefined); const b = ev.target.closest('[data-v]'); if (b) { sfx('tap'); let v = b.dataset.v; try { v = JSON.parse(v); } catch (e) { /* 문자열 */ } close(v); } });
    mask._close = close;
  });
}

/* ───────── 타이틀 ───────── */
function initTitle() {
  const ids = ['ruby', 'wayli', 'foxious', 'iruma', 'shuvi', 'genocider', 'mantis', 'aquamarine'].sort(() => Math.random() - .5).slice(0, 3);
  $('#title-art').innerHTML = ids.map(id => `<div class="ta">${renderArt(id)}</div>`).join('');
}
$('#t-play').onclick = () => { sfx('pick'); S.dexMode = false; openDeck(); };
$('#t-dex').onclick = () => { sfx('pick'); S.dexMode = true; openDeck(); };
$('#t-rules').onclick = () => { sfx('tap'); rulesModal(); };

function rulesModal() {
  return ask(`<div class="rules"><h3>게임 방법</h3>
  <h4>기본</h4><ul><li>덱은 <b>4장</b>. 앞 2장이 필드에, 뒤 2장이 후열에서 시작해. 2 vs 2로 싸우고, 상대 4명을 모두 쓰러뜨리면 승리!</li>
  <li>행동 순서는 [내 1번 → 상대 1번 → 내 2번 → 상대 2번]. 필드 캐릭터가 한 번에 하나씩 행동해.</li></ul>
  <h4>한 번의 행동</h4><ul><li><b>에너지 모으기</b>: R·W·B 중 무작위 1개를 그 캐릭터가 얻어. (최대치는 보통 4)</li>
  <li><b>기술 사용</b>: 코스트(색 에너지)를 내고 공격·회복·방해를 해. <b>★</b>는 아무 색이나 OK.</li>
  <li><b>교체</b>: 후열과 자리를 바꿔. 필드 캐릭터의 에너지 ★ 1개 이상이 필요하고, 한 판에 팀당 3번까지!</li>
  <li>필드 캐릭터가 쓰러지면 그 슬롯의 차례에 후열이 출전해.</li></ul>
  <h4>피해</h4><ul><li>피해는 66~100%로 흔들리고, 방어만큼 줄어들어. 실드 → HP 순서로 깎여.</li><li>치명타는 ×1.5에 방어 무시.</li></ul>
  <h4>상태이상</h4><ul><li><b>독</b> 모든 기술 코스트 ★+1 · <b>감속</b> 모으면 ½개 · <b>마비</b> 모으기 불가 · <b>화상</b> 기술을 안 쓴 차례 끝에 30 · <b>냉동</b> 모으기만 가능 · <b>특성/기술/회복 봉인</b></li>
  <li>상태이상은 그 캐릭터의 차례가 끝날 때마다 1씩 줄어. 걸려 있으면 교체 비용도 올라가.</li></ul>
  <h4>속도(Speed)</h4><ul><li>+면 교체 비용이 줄고, −면 출전 뒤 그만큼 차례를 쉬어.</li></ul></div>
  <div class="row2"><button class="btn gold grow" data-v="1">알겠어</button></div>`);
}

/* ───────── 덱 구성 / 도감 ───────── */
function openDeck() {
  show('s-deck'); $('#d-title').textContent = S.dexMode ? '캐릭터 도감' : '덱 구성 (4장)';
  $('#deckrow').classList.toggle('hidden', S.dexMode); $('#d-foot').classList.toggle('hidden', S.dexMode); $('#d-ai').value = String(S.ai);
  renderFilters(); renderDeck(); renderGrid();
}
$('#d-back').onclick = () => { sfx('tap'); show('s-title'); };
$('#d-ai').onchange = e => { S.ai = +e.target.value; save(); };
const FILTERS = [['all', '전체'], ['2', '★2'], ['3', '★3'], ['4', '★4+'], ['in', '내 덱']];
function renderFilters() { $('#filters').innerHTML = FILTERS.filter(f => !(S.dexMode && f[0] === 'in')).map(([k, t]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join(''); }
$('#filters').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; S.filter = b.dataset.f; sfx('tap'); renderFilters(); renderGrid(); };
function visibleIds() {
  const f = S.filter; return ROSTER.filter(id => { const c = def(id); if (f === 'all') return true; if (f === 'in') return S.deck.includes(id); const s = parseFloat(c.star); if (f === '2') return s < 3; if (f === '3') return s >= 3 && s < 4; return s >= 4; });
}
function renderGrid() {
  $('#grid').innerHTML = visibleIds().map(id => { const c = def(id), inn = S.deck.includes(id);
    return `<div class="rc ${inn ? 'in' : ''}" data-id="${id}"><span class="st">${starTxt(c)}</span><span class="hpc">♥${c.hp}</span>${artEl(id, 'ra')}<div class="rn">${c.name}</div><div class="rm">${c.role}</div>${S.dexMode ? '' : `<button class="add" data-add="${id}">${inn ? '−' : '+'}</button>`}</div>`; }).join('');
}
$('#grid').onclick = e => { const a = e.target.closest('[data-add]'); if (a) { e.stopPropagation(); sfx('tap'); toggleDeck(a.dataset.add); return; } const c = e.target.closest('.rc'); if (c) { sfx('tap'); detail(c.dataset.id); } };
function toggleDeck(id) { const i = S.deck.indexOf(id); if (i >= 0) S.deck.splice(i, 1); else if (S.deck.length < 4) S.deck.push(id); else { flashDeck(); return; } S.selSlot = null; save(); renderDeck(); renderGrid(); }
function flashDeck() { $('#deckrow').animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 250 }); }
const SLOT_TAGS = ['출전 1', '출전 2', '후열 1', '후열 2'];
function renderDeck() {
  const cells = []; for (let i = 0; i < 4; i++) { const id = S.deck[i], c = id && def(id);
    cells.push(`<div class="dslot ${id ? 'filled' : ''} ${S.selSlot === i ? 'sel' : ''}" data-i="${i}"><span class="tag">${SLOT_TAGS[i]}</span>${id ? `<span class="x" data-x="${i}">✕</span>${artEl(id, 'da')}<div class="nm">${c.name}</div>` : '<div class="nm" style="color:#8a7fc0;margin-bottom:18px">비어 있음</div>'}</div>`); if (i === 1) cells.push('<div class="divider"></div>'); }
  $('#deckrow').innerHTML = cells.join(''); $('#d-go').disabled = S.deck.length < 4;
}
$('#deckrow').onclick = e => {
  const x = e.target.closest('[data-x]'); if (x) { sfx('tap'); S.deck.splice(+x.dataset.x, 1); S.selSlot = null; save(); renderDeck(); renderGrid(); return; }
  const d = e.target.closest('.dslot'); if (!d) return; const i = +d.dataset.i; sfx('tap');
  if (S.selSlot == null) { if (S.deck[i]) S.selSlot = i; } else if (S.selSlot === i) S.selSlot = null; else { const a = S.selSlot; const arr = [...S.deck]; while (arr.length < 4) arr.push(null); [arr[a], arr[i]] = [arr[i], arr[a]]; S.deck = arr.filter(Boolean); if (i >= S.deck.length) { /* 빈칸으로 이동: 뒤로 당겨짐 */ } S.selSlot = null; save(); }
  renderDeck();
};
$('#d-rand').onclick = () => { sfx('pick'); const a = [...ROSTER]; S.deck = []; while (S.deck.length < 4) S.deck.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); S.selSlot = null; save(); renderDeck(); renderGrid(); };
$('#d-go').onclick = () => { sfx('pick'); startBattle(); };

function statChips(c) {
  const t = [`<span class="tag2">♥ HP ${c.hp}</span>`]; if (c.shield) t.push(`<span class="tag2">🛡 실드 ${c.shield}</span>`); if (c.def) t.push(`<span class="tag2">방어 ${c.def > 0 ? '+' : ''}${c.def}</span>`);
  t.push(`<span class="tag2">에너지 최대 ${c.maxE || 4}</span>`); if (c.speed) t.push(`<span class="tag2 ${c.speed > 0 ? 'gold' : ''}">속도 ${c.speed > 0 ? '+' : ''}${c.speed}</span>`); return t.join('');
}
async function detail(id, unit = null) {
  const c = def(id), inn = S.deck.includes(id);
  const sks = c.skills.map(sk => { const tk = E.tokensOf(rawCost(sk)); return `<div class="dsk"><div class="h"><span>${sk.name}</span><span class="costs">${costHtml(tk, sk.plus)}</span></div><div class="t">${sk.desc}</div></div>`; }).join('');
  let live = ''; if (unit) { const stl = Object.entries(unit.st).map(([s, d]) => `${E.STATUS_NAME[s]} ${d}턴`); if (unit.atkMod) stl.push(`공격 ${unit.atkMod > 0 ? '+' : ''}${unit.atkMod}`); if (unit.defMod) stl.push(`방어 ${unit.defMod > 0 ? '+' : ''}${unit.defMod}`);
    live = `<div class="box"><b class="k">지금 상태</b> HP ${unit.hp}/${unit.maxHp}${unit.shield ? ` · 실드 ${unit.shield}` : ''}<br>에너지 ${unit.e.length ? unit.e.map(e => `<span class="pip sm ${e.c}${e.a === .5 ? ' half' : ''}"></span>`).join('') : '없음'}${stl.length ? `<br>${stl.join(' · ')}` : ''}</div>`; }
  const btn = (!S.dexMode && !unit) ? `<button class="btn ${inn ? '' : 'gold'} grow" data-v="toggle">${inn ? '덱에서 빼기' : (S.deck.length >= 4 ? '덱이 가득 찼어' : '덱에 넣기')}</button>` : '';
  const v = await ask(`<div class="detail">${artEl(id, 'big')}<h3>${c.name}</h3><div class="meta"><span class="tag2 gold">${starTxt(c)}</span><span class="tag2">${c.role}</span>${(c.tags || []).includes('dragon') ? '<span class="tag2">드래곤</span>' : ''}</div><div class="meta">${statChips(c)}</div>${live}
    <div class="box"><b class="k">특성</b><br>${c.trait}</div><div class="box">${sks}</div><div class="row2">${btn}<button class="btn grow" data-v="close">닫기</button></div></div>`);
  if (v === 'toggle' && S.deck.length < 4 + (inn ? 1 : 0)) { toggleDeck(id); }
}

/* ───────── 전투 시작 ───────── */
function startBattle() {
  const pool = ROSTER.filter(id => !S.deck.includes(id)); const ai = []; while (ai.length < 4) ai.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  S.aiDeck = ai; S.battle++; const g = E.newGame([...S.deck], ai, { seed: Math.random() + '' }); S.g = g; S.view = E.clone(g); S.sel = null; S.resolve = null; S.cur = null; S.sm = {};
  show('s-battle'); $('#logdrawer').classList.add('hidden'); $('#fxlayer').innerHTML = ''; renderAll(); runBattle(S.battle);
}
async function runBattle(id) {
  setBanner('전투 시작!'); await sleep(500); await play(E.begin(S.g));
  while (!S.g.winner && S.battle === id) {
    const i = E.info(S.g); if (i.kind === 'over') break; S.cur = i; S.sel = null; renderAll();
    let action;
    if (i.team === 'P') { setBanner(i.kind === 'deploy' ? '출전할 캐릭터를 골라줘' : `내 차례 · ${S.g.u[i.uid].name}`); action = await playerTurn(i); }
    else { const nm = i.uid ? S.g.u[i.uid].name : '상대'; setBanner(`상대 차례 · ${i.kind === 'deploy' ? '출전 선택' : nm}`); await sleep(750 / 1); await new Promise(r => setTimeout(r, 30)); action = chooseAction(S.g, 'A', { samples: S.ai }); }
    if (S.battle !== id) return; if (!action) break; S.cur = null; S.sel = null; renderPanel(); await perform(action);
  }
  if (S.battle === id && S.g.winner) await showResult();
}
async function perform(action) { S.busy = true; const evs = E.act(S.g, action); await play(evs); S.busy = false; }

/* ───────── 렌더: 전장 ───────── */
function setBanner(t) { $('#banner').textContent = t; }
function energyHtml(u) {
  const ents = [...u.e].sort((a, b) => 'RWB'.indexOf(a.c) - 'RWB'.indexOf(b.c)), mx = E.maxE(u); let used = 0;
  const out = ents.map(e => { used += e.a; return `<span class="pip sm ${e.c}${e.a === .5 ? ' half' : ''}"></span>`; }); const empty = Math.max(0, Math.ceil(mx - used - 0.01)); for (let i = 0; i < empty; i++) out.push('<span class="pip sm empty"></span>'); return out.join('');
}
function chipsHtml(u) {
  const c = []; for (const [s, d] of Object.entries(u.st)) c.push(`<span class="sc ${s}">${SHORT[s]}${d}</span>`);
  if (u.atkMod) c.push(`<span class="sc ${u.atkMod > 0 ? 'buff' : 'debuff'}">공${u.atkMod > 0 ? '+' : ''}${u.atkMod}</span>`); if (u.defMod) c.push(`<span class="sc ${u.defMod > 0 ? 'buff' : 'debuff'}">방${u.defMod > 0 ? '+' : ''}${u.defMod}</span>`);
  const bar = u.bar.reduce((n, b) => n + b.n, 0); if (bar) c.push(`<span class="sc shield">보호막${bar}</span>`); if (u.hide) c.push(`<span class="sc shield">숨기×${u.hide}</span>`); if (u.invul) c.push('<span class="sc shield">무적</span>'); if (u.noAtk) c.push('<span class="sc shield">방벽</span>');
  if (u.sched) c.push('<span class="sc buff">예약</span>'); if (u.delay > 0) c.push(`<span class="sc">대기${u.delay}</span>`); return c.join('');
}
function barsUpdate(el, u) {
  S.sm ??= {}; S.sm[u.uid] = Math.max(S.sm[u.uid] || 0, u.shield); const den = Math.max(1, u.maxHp + S.sm[u.uid]); const bar = u.bar.reduce((n, b) => n + b.n, 0);
  const hpP = Math.max(0, u.hp) / den * 100, shP = u.shield / den * 100, bP = bar / den * 100, ratio = u.hp / u.maxHp;
  $('.sh', el).style.width = shP + '%'; const h = $('.hp', el); h.style.width = hpP + '%'; h.className = 'hp' + (ratio <= .25 ? ' crit' : ratio <= .5 ? ' low' : ''); $('.bar2', el).style.width = bP + '%';
  $('.hpbar b', el).textContent = `${Math.max(0, Math.round(u.hp))}${u.shield ? ` +${u.shield}` : ''}`;
}
function ensureUnit(slot, u) {
  let el = slot.firstElementChild; if (el && el.dataset.uid === u.uid) return el; const c = def(u);
  slot.classList.remove('empty'); slot.innerHTML = `<div class="unit" data-uid="${u.uid}"><div class="uname"><span class="st">${starTxt(c)}</span>${c.name}</div><div class="artwrap" data-art>${renderArt(u.id)}</div><div class="bars"><div class="hpbar"><i class="sh"></i><i class="hp"></i><i class="bar2"></i><b></b></div></div><div class="pips"></div><div class="chips"></div></div>`; return slot.firstElementChild;
}
function updateUnit(el, u) {
  barsUpdate(el, u); const p = $('.pips', el), ph = energyHtml(u); if (p._h !== ph) { p.innerHTML = ph; p._h = ph; } const c = $('.chips', el), ch = chipsHtml(u); if (c._h !== ch) { c.innerHTML = ch; c._h = ch; }
  el.classList.toggle('invul', !!u.invul); el.classList.toggle('sched', !!u.sched); el.classList.toggle('delay', u.delay > 0);
}
function renderField() {
  const v = S.view; for (const team of ['P', 'A']) for (const slot of [0, 1]) {
    const se = $(`.slot[data-team="${team}"][data-slot="${slot}"]`), uid = v.t[team].field[slot], u = uid && v.u[uid];
    if (u && !u.dead) { const el = ensureUnit(se, u); updateUnit(el, u); se.classList.remove('empty'); } else if (!se.classList.contains('empty')) { se.innerHTML = '빈 슬롯'; se.classList.add('empty'); }
    const tr = v.t[team].trap[slot]; let tm = $('.trapmark', se); if (tr && !tm) { tm = document.createElement('span'); tm.className = 'trapmark'; tm.textContent = '⚡'; se.append(tm); } else if (!tr && tm) tm.remove();
    se.classList.toggle('cur', !!(S.cur && !S.busy && S.cur.team === team && S.cur.slot === slot && S.cur.kind !== 'over'));
  }
  for (const team of ['P', 'A']) { const t = v.t[team], bench = $(`.bench[data-team="${team}"]`);
    const list = Object.values(v.u).filter(u => u.team === team && !t.field.includes(u.uid)).sort((a, b) => a.idx - b.idx);
    bench.innerHTML = `<span class="lbl">후열</span>` + list.map(u => `<div class="bch ${u.dead ? 'dead' : ''}" data-b="${u.uid}">${renderArt(u.id, { noShadow: true }).replace('class="art', 'class="art ba')}<div class="bh"><i style="width:${Math.max(0, u.hp) / u.maxHp * 100}%"></i></div></div>`).join('') + `<span class="swc">교체 ${t.sw}/3</span>`; }
  const f = v.field, fc = $('#fieldchip'); if (f && f.kind === 'grand') { fc.classList.remove('hidden'); fc.textContent = '그랜드필드 · ' + (f.team === 'P' ? '내 진영' : '상대 진영'); fc.className = 'fieldchip ' + (f.team === 'P' ? 'mine' : 'theirs'); } else fc.classList.add('hidden');
}
function renderOrder() {
  const g = S.g, v = S.view; let h = ''; for (let k = 0; k < 4; k++) { const [team, slot] = g.order[(g.turn + k) % 4], uid = v.t[team].field[slot], u = uid && v.u[uid];
    h += u && !u.dead ? `<div class="oc ${team} ${k === 0 && !g.winner ? 'cur' : ''}">${renderArt(u.id, { noShadow: true }).replace('class="art', 'class="art oa')}<span class="on">${def(u).name.slice(0, 4)}</span></div>` : `<div class="oc ${team} empty ${k === 0 ? 'cur' : ''}">출전</div>`; }
  $('#order').innerHTML = h;
}
function renderAll() { if (!S.view) return; renderField(); renderOrder(); renderPanel(); markTargets(); }

/* ───────── 하단 패널 ───────── */
function switchWhy(g, u) {
  const t = g.t[u.team]; if (E.status(u, 'freeze')) return '냉동'; if (t.sw >= 3) return '교체 3회 소진'; if (E.HK?.switchLocked?.(g, u.team)) return '교체 봉쇄'; if (!E.benchUnits(g, u.team).length) return '후열 없음'; return '에너지 부족';
}
function renderPanel() {
  const p = $('#panel'), i = S.cur, g = S.g; if (!g) return;
  if (g.winner) { p.innerHTML = `<div class="wait">전투 종료</div>`; return; }
  if (!i || S.busy || i.team !== 'P' || !S.resolve) { const u = i && i.uid ? g.u[i.uid] : null; p.innerHTML = `<div class="wait"><span class="dots"><i></i><i></i><i></i></span>${S.busy ? '진행 중…' : (i && i.team === 'A' ? `상대 차례${u ? ' · ' + u.name : ''}` : '…')}</div>`; return; }
  if (i.kind === 'deploy') { p.innerHTML = `<div class="wait">후열에서 출전할 캐릭터를 골라줘</div>`; return; }
  const u = g.u[i.uid], c = def(u);
  let h = `<div class="ph"><span class="who">▶ ${u.name}</span><span class="hint">${S.sel ? '' : '행동을 골라줘'}</span><span class="stock">${energyHtml(u)}</span></div>`;
  const sel = S.sel && i.skills.find(x => x.id === S.sel);
  h += '<div class="acts">';
  i.skills.forEach(e => { const sk = e.sk; const cls = ['sk', e.ok ? '' : 'off', S.sel === e.id ? 'sel' : '', sk.kind || ''].join(' ');
    h += `<button class="${cls}" data-sk="${e.id}"><span class="n"><span>${sk.name}</span><span class="costs">${costHtml(e.tokens, sk.plus)}</span></span><span class="d">${sk.desc}</span>${e.ok ? '' : `<span class="why">${e.why}</span>`}</button>`; });
  const canSw = i.switches.length > 0; const cost = E.switchCost(u);
  h += `<button class="sk util ${i.gather ? '' : 'off'}" data-act="gather"><span class="n"><span>에너지 모으기</span><span class="costs">${pip('R', 'sm')}${pip('W', 'sm')}${pip('B', 'sm')}</span></span><span class="d">${E.status(u, 'slow') ? '감속: ½개만 얻어' : '무작위 1개 획득'}</span>${i.gather ? '' : '<span class="why">마비</span>'}</button>`;
  h += `<button class="sk util ${canSw ? '' : 'off'}" data-act="switch"><span class="n"><span>교체</span><span class="costs">${costHtml(Array(cost).fill('*'))}</span></span><span class="d">후열과 자리 바꾸기 (${g.t[u.team].sw}/3)</span>${canSw ? '' : `<span class="why">${switchWhy(g, u)}</span>`}</button>`;
  if (i.pass) h += `<button class="sk util span2" data-act="pass"><span class="n">차례 넘기기</span><span class="d">할 수 있는 행동이 없어</span></button>`;
  h += '</div>';
  if (sel) { const virtual = sel.targets.every(t => t.virtual) || sel.targets.length === 1 && !sel.targets[0].slotOnly;
    h += `<div class="sdesc"><b>${sel.sk.name}</b> — ${sel.sk.desc}</div><div class="confirm">${virtual ? '<button class="btn gold grow" data-act="use">사용</button>' : '<span class="hint grow" style="color:var(--gold);font-weight:800;align-self:center">대상을 눌러서 선택해줘</span>'}<button class="btn" data-act="cancel">취소</button></div>`; }
  p.innerHTML = h;
}
function markTargets() {
  $$('.slot').forEach(s => s.classList.remove('tgt', 'foe', 'fr')); const i = S.cur; if (!i || !S.sel || i.team !== 'P' || !S.resolve) return; const e = i.skills.find(x => x.id === S.sel); if (!e) return;
  for (const t of e.targets) { if (t.virtual) continue; const se = $(`.slot[data-team="${t.team}"][data-slot="${t.slot}"]`); if (se) se.classList.add('tgt', t.team === 'P' ? 'fr' : 'foe'); }
}
$('#panel').onclick = async ev => {
  const i = S.cur; if (!i || !S.resolve || S.busy) return; const g = S.g, u = g.u[i.uid];
  const sb = ev.target.closest('[data-sk]'); if (sb) { const e = i.skills.find(x => x.id === sb.dataset.sk); if (!e.ok) { sfx('tap'); return; } sfx('tap'); S.sel = S.sel === e.id ? null : e.id; renderPanel(); markTargets(); return; }
  const ab = ev.target.closest('[data-act]'); if (!ab) return; const a = ab.dataset.act; sfx('tap');
  if (a === 'cancel') { S.sel = null; renderPanel(); markTargets(); return; }
  if (a === 'use') { const e = i.skills.find(x => x.id === S.sel); await finishSkill(e, e.targets[0]); return; }
  if (a === 'pass') { resolveAction({ type: 'pass' }); return; }
  if (a === 'gather') { if (!i.gather) return; await doGatherUI(u); return; }
  if (a === 'switch') { if (!i.switches.length) return; await doSwitchUI(i, u); return; }
};
$('#arena').onclick = async ev => {
  const i = S.cur; if (!i || !S.resolve || S.busy) return; const se = ev.target.closest('.slot'), bch = ev.target.closest('.bch');
  if (bch) { const u = S.g.u[bch.dataset.b]; if (u) detail(u.id, u); return; }
  if (!se) return;
  if (S.sel && se.classList.contains('tgt')) { const e = i.skills.find(x => x.id === S.sel); const t = e.targets.find(t => !t.virtual && t.team === se.dataset.team && t.slot === +se.dataset.slot); if (t) { await finishSkill(e, t); return; } }
  const un = $('.unit', se); if (un) { const u = S.g.u[un.dataset.uid]; detail(u.id, u); }
};
$('#arena').addEventListener('click', ev => { if (S.resolve) return; const bch = ev.target.closest('.bch'); const se = ev.target.closest('.slot'); if (bch) { const u = S.g.u[bch.dataset.b]; if (u) detail(u.id, u); } else if (se) { const un = $('.unit', se); if (un) { const u = S.g.u[un.dataset.uid]; detail(u.id, u); } } });

function playerTurn(i) {
  return new Promise(async res => {
    S.resolve = res; S.cur = i;
    if (i.kind === 'deploy') {
      if (i.options.length === 1) { await sleep(300); resolveAction({ type: 'deploy', uid: i.options[0] }); return; }
      const opts = i.options.map(uid => { const u = S.g.u[uid], c = def(u); return `<button class="opt" data-v='${JSON.stringify(uid)}'><span class="oa2">${renderArt(u.id, { noShadow: true })}</span><span>${u.name}</span><span class="sub">♥${u.hp}/${u.maxHp}${u.shield ? ' 🛡' + u.shield : ''}</span></button>`; }).join('');
      const v = await ask(`<h3>출전</h3><p class="lead">빈 슬롯에 내보낼 후열 캐릭터를 골라줘.</p><div class="opts">${opts}</div>`, { cancel: false }); resolveAction({ type: 'deploy', uid: v }); return;
    }
    renderAll();
  });
}
function resolveAction(a) { const r = S.resolve; S.resolve = null; if (r) r(a); }

async function finishSkill(entry, tref) {
  const g = S.g, i = S.cur, u = g.u[i.uid], sk = entry.sk, tu = tref && tref.uid ? g.u[tref.uid] : null; const extra = {};
  if (sk.choices) for (const ch of sk.choices(g, u, tu)) { const v = await askChoice(ch); if (v === undefined) return; extra[ch.key] = v; }
  let plus = null; if (sk.plus) { plus = await askPlus(u, entry); if (!plus) return; }
  let plans = entry.plans; if (plus) plans = plans.filter(p => E.plusFits(u, p, plus)); let pay;
  if (plans.length > 1) { pay = await askPay(u, plans, entry.tokens, `${sk.name} — 어떤 에너지를 낼까?`); if (!pay) return; } else pay = plans[0];
  resolveAction({ type: 'skill', skill: sk.id, target: tref, pay, plus, extra });
}
async function askChoice(ch) {
  const opts = ch.options.map(o => `<button class="opt" data-v='${JSON.stringify(o.v)}'>${esc(o.label)}</button>`).join('');
  return ask(`<h3>${esc(ch.label)}</h3><div class="opts">${opts}</div><div class="row2"><button class="btn grow" data-v="">취소</button></div>`).then(v => (v === '' ? undefined : v));
}
async function askPay(u, plans, tokens, title) {
  const best = E.autoPlan(S.g, u, tokens), key = p => E.planText(p);
  const opts = plans.slice(0, 9).map(p => { const pips = ['R', 'W', 'B'].flatMap(c => Array(p[c]).fill(c)).map(c => pip(c)).join(''); return `<button class="opt ${key(p) === key(best) ? 'rec' : ''}" data-v='${JSON.stringify(p)}'><span class="costs">${pips || '무료'}</span><span class="sub">${key(p) === key(best) ? '추천' : ''}</span></button>`; }).join('');
  const v = await ask(`<h3>${title}</h3><p class="lead">내야 하는 에너지를 골라줘. 남기는 색이 다음 기술을 결정해.</p><div class="opts">${opts}</div><div class="row2"><button class="btn grow" data-v="">취소</button></div>`); return v === '' ? undefined : v;
}
async function askPlus(u, entry) {
  const sk = entry.sk, cols = sk.plus.colors, cur = { R: 0, W: 0, B: 0 };
  return new Promise(res => {
    const mask = document.createElement('div'); mask.className = 'mask'; $('#modal-root').append(mask); const done = v => { mask.remove(); res(v); };
    const ok = pl => entry.plans.some(p => E.plusFits(u, p, pl)); const tot = () => cur.R + cur.W + cur.B;
    const draw = () => { mask.innerHTML = `<div class="sheet"><h3>${sk.name} · 추가 에너지</h3><p class="lead">${sk.plus.hint || '추가로 낼수록 강해져.'} (최대 ${sk.plus.max}개)</p>${cols.map(c => `<div class="stepper"><span class="costs">${pip(c)} ${c}</span><span class="sb"><button data-d="${c}:-1" ${cur[c] <= 0 ? 'disabled' : ''}>−</button><b style="min-width:18px;text-align:center">${cur[c]}</b><button data-d="${c}:1" ${tot() >= sk.plus.max || !ok({ ...cur, [c]: cur[c] + 1 }) ? 'disabled' : ''}>＋</button></span></div>`).join('')}<div class="row2"><button class="btn" data-x="no">취소</button><button class="btn gold grow" data-x="ok">사용</button></div></div>`; };
    draw(); mask.onclick = ev => { const d = ev.target.closest('[data-d]'); if (d) { sfx('tap'); const [c, n] = d.dataset.d.split(':'); cur[c] += +n; draw(); return; } const x = ev.target.closest('[data-x]'); if (x) { sfx('tap'); done(x.dataset.x === 'ok' ? { ...cur } : null); } else if (ev.target === mask) done(null); };
  });
}
async function doGatherUI(u) {
  const pk = E.peekGather(S.g, u), over = E.eTotal(u) + pk.a - E.maxE(u);
  if (over <= 0.001) { resolveAction({ type: 'gather' }); return; }
  const idxs = u.e.map((e, k) => k).filter(k => u.e[k].a + 0.001 >= over); const opts = [];
  idxs.forEach(k => opts.push(`<button class="opt" data-v='${JSON.stringify([k])}'><span class="costs">${pip(u.e[k].c, u.e[k].a === .5 ? 'half' : '')}</span> ${u.e[k].c}${u.e[k].a === .5 ? '½' : ''} 버리고 받기</button>`));
  if (!idxs.length) { const hs = u.e.map((e, k) => k).filter(k => u.e[k].a === .5); if (hs.length >= 2) opts.push(`<button class="opt" data-v='${JSON.stringify(hs.slice(0, 2))}'>½ 두 개 버리고 받기</button>`); }
  const v = await ask(`<h3>에너지가 가득 찼어</h3><p class="lead">이번에 나온 색은 <b>${pip(pk.c)} ${pk.c}${pk.a === .5 ? '½' : ''}</b>. 하나를 버리고 받을래?</p><div class="opts">${opts.join('')}<button class="opt" data-v='"skip"'>받지 않고 포기</button></div><div class="row2"><button class="btn grow" data-v="">취소</button></div>`);
  if (v === undefined || v === '') return; resolveAction({ type: 'gather', replace: v === 'skip' ? [] : v });
}
async function doSwitchUI(i, u) {
  const cost = E.switchCost(u), tk = Array(cost).fill('*');
  const opts = i.switches.map(s => { const b = S.g.u[s.uid]; return `<button class="opt" data-v='${s.bench}'><span class="oa2">${renderArt(b.id, { noShadow: true })}</span><span>${b.name}</span><span class="sub">♥${b.hp}/${b.maxHp}</span></button>`; }).join('');
  const v = await ask(`<h3>교체</h3><p class="lead">${u.name}가 후열로 물러나고 출전해. 비용 ${costHtml(tk)} · 이번 판 ${S.g.t[u.team].sw}/3회 사용</p><div class="opts">${opts}</div><div class="row2"><button class="btn grow" data-v="">취소</button></div>`);
  if (v === undefined || v === '') return; const plans = E.planPays(u, tk); let pay = plans[0]; if (plans.length > 1) { pay = await askPay(u, plans, tk, '교체 비용'); if (!pay) return; }
  resolveAction({ type: 'switch', bench: +v, pay });
}

/* ───────── 연출 ───────── */
const arenaRect = () => $('#arena').getBoundingClientRect();
function center(uid) { const el = $(`.unit[data-uid="${uid}"] [data-art]`) || $(`.unit[data-uid="${uid}"]`); if (!el) return null; const r = el.getBoundingClientRect(), a = arenaRect(); return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height }; }
function floatText(uid, text, cls = 'note') { const c = center(uid); if (!c) return; const d = document.createElement('div'); d.className = 'fl ' + cls; d.textContent = text; d.style.left = c.x + rr(-22, 22) + 'px'; d.style.top = c.y - c.h * .15 + rr(-10, 10) + 'px'; $('#fxlayer').append(d); setTimeout(() => d.remove(), 1100); }
function burst(uid, color, big = false) { const c = center(uid); if (!c) return; const b = document.createElement('div'); b.className = 'burst'; b.style.cssText = `left:${c.x}px;top:${c.y}px;--c:${color}`; let h = '<i class="ring"></i>'; const n = big ? 14 : 9; for (let k = 0; k < n; k++) { const a = Math.PI * 2 * k / n + rr(-.2, .2), d = rr(34, big ? 80 : 60); h += `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px"></i>`; } b.innerHTML = h; $('#fxlayer').append(b); setTimeout(() => b.remove(), 600); }
function skillBanner(uid, name, color) { const c = center(uid); if (!c) return; const d = document.createElement('div'); d.className = 'skillname'; d.style.cssText = `left:${c.x}px;top:${c.y - c.h * .45}px;--c:${color}`; d.textContent = name; $('#fxlayer').append(d); setTimeout(() => d.remove(), 1000); }
function animOf(uid) { return $(`.unit[data-uid="${uid}"] [data-art]`); }
async function lunge(src, tgt, color) {
  const a = center(src), b = center(tgt), el = animOf(src); if (!a || !b || !el) return; const dx = b.x - a.x, dy = b.y - a.y;
  const orb = document.createElement('div'); orb.className = 'orb'; orb.style.cssText = `left:${a.x}px;top:${a.y}px;--c:${color}`; $('#fxlayer').append(orb);
  el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${-dx * .06}px,${-dy * .06}px) scale(.92)`, offset: .2 }, { transform: `translate(${dx * .32}px,${dy * .32}px) scale(1.14)`, offset: .45 }, { transform: 'translate(0,0) scale(1)' }], { duration: T(520), easing: 'ease-in-out' });
  await sleep(130); const an = orb.animate([{ transform: 'translate(0,0) scale(.6)', opacity: .9 }, { transform: `translate(${dx}px,${dy}px) scale(1.2)`, opacity: 1 }], { duration: T(260), easing: 'ease-in', fill: 'forwards' }); await an.finished.catch(() => 0); orb.remove();
}
function shakeUnit(uid, crit) { const el = animOf(uid); if (!el) return; el.classList.remove('shake', 'flash'); void el.offsetWidth; el.classList.add('shake', 'flash'); setTimeout(() => el.classList.remove('shake', 'flash'), 420); if (crit) { const a = $('#arena'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); setTimeout(() => a.classList.remove('shake'), 400); } }
function popUnit(uid) { const el = animOf(uid); if (el) el.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' }); }
const NOTE_CLS = { immune: 'immune', buff: 'buff', debuff: 'debuff', shield: 'shield', cure: 'cure', status: 'status', dodge: 'dodge' };

async function play(evs) {
  const g = S.g, v = S.view; S.busy = true;
  const refresh = uid => { const u = v.u[uid]; if (!u) return; const se = $(`.unit[data-uid="${uid}"]`); if (se) updateUnit(se, u); };
  for (const e of evs) {
    switch (e.type) {
      case 'skill': { const u = g.u[e.uid], col = skillColor(u, e.skill); S.fxColor = col; skillBanner(e.uid, e.name, col); sfx('skill'); setBanner(`${u.name} · ${e.name}`);
        if (e.target && e.target !== e.uid && e.kind === 'attack') await lunge(e.uid, e.target, col); else { const el = animOf(e.uid); el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: .4 }, { transform: 'scale(1)' }], { duration: 420 }); await sleep(380); } break; }
      case 'hitfx': { burst(e.tgt, S.fxColor, !!e.crit); shakeUnit(e.tgt, e.crit); sfx(e.crit ? 'crit' : 'hit'); await sleep(e.crit ? 260 : 170); break; }
      case 'dmg': { const u = v.u[e.uid]; if (!u) break; if (e.n > 0) { floatText(e.uid, `-${e.n}`, e.crit ? 'crit' : e.shield ? 'sdmg' : 'dmg'); if (e.shield) u.shield = Math.max(0, u.shield - e.n); else u.hp = Math.max(0, u.hp - e.n); refresh(e.uid); await sleep(70); } break; }
      case 'heal': { const u = v.u[e.uid]; if (!u) break; floatText(e.uid, `+${e.n}`, 'heal'); u.hp = Math.min(u.maxHp, u.hp + e.n); refresh(e.uid); sfx('heal'); await sleep(110); break; }
      case 'shield': { const u = v.u[e.uid]; if (!u) break; if (!e.bar) u.shield += e.n; refresh(e.uid); sfx('shield'); break; }
      case 'notice': { floatText(e.uid, e.text, NOTE_CLS[e.cls] || 'note'); if (e.cls === 'status' || e.cls === 'debuff') sfx('status'); await sleep(50); break; }
      case 'status': { const u = v.u[e.uid]; if (u) { u.st[e.s] = Math.max(u.st[e.s] || 0, e.turns); refresh(e.uid); } break; }
      case 'stat': { const u = v.u[e.uid]; if (u) { u[e.key] += e.d; refresh(e.uid); } break; }
      case 'cure': { const u = v.u[e.uid], r = g.u[e.uid]; if (u) { u.st = E.clone(r.st); refresh(e.uid); } break; }
      case 'energy': { const u = v.u[e.uid], r = g.u[e.uid]; if (u) { u.e = E.clone(r.e); refresh(e.uid); if (e.kind === 'gain') sfx('gather'); } break; }
      case 'dodge': { const el = animOf(e.uid); el?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-26px) rotate(-8deg)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 380 }); await sleep(250); break; }
      case 'death': { const el = animOf(e.uid); sfx('death'); burst(e.uid, '#ffffff', true); if (el) await el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4) translateY(30px)' }], { duration: T(650), fill: 'forwards' }).finished.catch(() => 0); const u = v.u[e.uid]; if (u) { u.dead = true; u.hp = 0; } const t = v.t[e.team]; const k = t.field.indexOf(e.uid); if (k >= 0) t.field[k] = null; renderField(); break; }
      case 'deploy': case 'switch': { const team = e.team; v.t[team].field = [...g.t[team].field]; v.t[team].bench = [...g.t[team].bench]; v.t[team].sw = g.t[team].sw; const ins = e.in || e.uid; for (const k of ['out', 'in', 'uid']) if (e[k] && v.u[e[k]]) { v.u[e[k]].e = E.clone(g.u[e[k]].e); v.u[e[k]].st = E.clone(g.u[e[k]].st); } renderField(); popUnit(ins); sfx('pick'); await sleep(420); break; }
      case 'trap': { v.t[e.team].trap = E.clone(g.t[e.team].trap); renderField(); break; }
      case 'field': { v.field = E.clone(g.field); renderField(); sfx('shield'); await sleep(350); break; }
      case 'turn': { if (e.auto === 'delay') { const u = g.u[e.uid]; setBanner(`${u.name} · 출전 준비 중…`); await sleep(350); } else if (e.auto === 'sched') { await sleep(150); } break; }
      case 'log': { const ld = $('#loglist'); if (!$('#logdrawer').classList.contains('hidden')) appendLog(e.text, e.cls); break; }
      default: break;
    }
  }
  S.view = E.clone(g); S.busy = false; renderAll(); renderLog();
}
function appendLog(text, cls) { const d = document.createElement('div'); d.className = cls || ''; d.textContent = text; const l = $('#loglist'); l.append(d); l.scrollTop = l.scrollHeight; }
function renderLog() { const dr = $('#logdrawer'); if (dr.classList.contains('hidden')) return; $('#loglist').innerHTML = S.g.logs.slice(-120).map(l => `<div class="${l.cls}">${esc(l.text)}</div>`).join(''); $('#loglist').scrollTop = 1e9; }
$('#b-log').onclick = () => { sfx('tap'); const d = $('#logdrawer'); d.classList.toggle('hidden'); renderLog(); };
$('#log-close').onclick = () => $('#logdrawer').classList.add('hidden');

/* ───────── 메뉴 / 결과 ───────── */
$('#b-menu').onclick = async () => {
  sfx('tap'); const v = await ask(`<h3>메뉴</h3><div class="opts"><button class="opt" data-v="rules">게임 방법</button><button class="opt" data-v="mute">소리 ${S.mute ? '켜기' : '끄기'}</button><button class="opt" data-v="giveup">항복하기</button><button class="opt" data-v="title">타이틀로 나가기</button></div><div class="row2"><button class="btn grow" data-v="">계속하기</button></div>`);
  if (v === 'rules') rulesModal(); else if (v === 'mute') { S.mute = !S.mute; save(); } else if (v === 'title') { S.battle++; S.resolve = null; show('s-title'); } else if (v === 'giveup') { if (S.g && !S.g.winner) { S.g.winner = 'A'; E.log(S.g, '항복했다.', 'win'); S.cur = null; S.busy = false; const r = S.resolve; S.resolve = null; if (r) r(null); S.battle++; showResult(); } }
};
async function showResult() {
  const g = S.g, win = g.winner === 'P'; sfx(win ? 'win' : 'lose'); setBanner(win ? '승리!' : '패배…'); renderAll();
  const rows = ['P', 'A'].flatMap(t => Object.values(g.u).filter(u => u.team === t).map(u => `<tr><td>${t === 'P' ? '🔵' : '🔴'} ${u.name}${u.dead ? ' ✝' : ''}</td><td>${u.stat.dealt}</td><td>${u.stat.taken}</td><td>${u.stat.healed}</td><td>${u.stat.skills}</td></tr>`)).join('');
  const v = await ask(`<div class="result ${win ? 'win' : 'lose'}"><div class="big">${win ? '🏆 승리!' : '💥 패배…'}</div><p class="lead">${g.stats.turns}번의 행동 끝에 결판이 났어.</p><table class="rt"><tr><th></th><th>준 피해</th><th>받은 피해</th><th>회복</th><th>기술</th></tr>${rows}</table><div class="row2"><button class="btn" data-v="deck">덱 변경</button><button class="btn gold grow" data-v="again">한 판 더!</button></div></div>`, { cancel: false });
  if (v === 'again') startBattle(); else openDeck();
}

/* ───────── 시작 ───────── */
initTitle(); window.__ML = { S, E, startBattle, play, perform, refresh: () => { S.cur = E.info(S.g); renderAll(); } };
document.addEventListener('pointerdown', () => { try { AC ??= new (window.AudioContext || window.webkitAudioContext)(); AC.resume?.(); } catch (e) { /* 무시 */ } }, { once: true });
