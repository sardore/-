import { UNITS, HEROES, START, STAGES, CHAPTERS, ROLE, POS, MAXLV, lvCost, stageGold } from './data.js';
import { Battle, lvMul } from './sim.js';
import { Arena, portrait } from './render.js';

const $ = id => document.getElementById(id), app = $('app'), KEY = 'quartet_save_v1';
const fresh = () => ({ gold: 0, owned: START.slice(), lv: Object.fromEntries(START.map(i => [i, 1])), stars: {}, team: START.slice(),
  dbg: { A: ['knight', 'mage', 'archer', 'priest'], B: ['lancer', 'rogue', 'bomber', 'bard'], la: 5, lb: 5, sel: 'A0' } });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.owned && s.dbg) return s; } catch (e) {} return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const cleared = () => STAGES.filter((_, i) => S.stars[i]).length;

/* ---- 소리 ---- */
let AC = null, lastHit = 0;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (AC.state === 'suspended') AC.resume(); }
function beep(f, d, type, vol, to) {
  if (!AC) return;
  try { const o = AC.createOscillator(), ga = AC.createGain(), t = AC.currentTime; o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    ga.gain.setValueAtTime(vol || 0.05, t); ga.gain.exponentialRampToValueAtTime(0.001, t + d + 0.05); o.connect(ga); ga.connect(AC.destination); o.start(t); o.stop(t + d + 0.08); } catch (e) {}
}
function sfx(evs) {
  for (const e of evs) {
    if (e.t === 'cast') beep(e.u.team ? 300 : 520, 0.18, 'triangle', 0.08, e.u.team ? 600 : 1040);
    else if (e.t === 'die') beep(200, 0.25, 'sawtooth', 0.07, 50);
    else if (e.t === 'num' && e.kind !== 'heal' && e.kind !== 'miss') { const n = performance.now(); if (n - lastHit > 70) { lastHit = n; beep(e.kind === 'crit' ? 260 : 160, 0.03, 'square', 0.025); } }
  }
}

/* ---- 공통 조각 ---- */
const face = (id, cls = '') => id ? `<span class="face ${cls}" style="background-image:url(${portrait(id)})"></span>` : `<span class="face empty ${cls}">+</span>`;
const tag = id => `${ROLE[UNITS[id].role]} · ${POS[UNITS[id].pos]}`;
function infoHtml(id, lv) {
  if (!id) return '<div class="info dim">캐릭터를 누르면 정보가 여기에 나온다.</div>';
  const d = UNITS[id], m = lvMul(lv || 1);
  return `<div class="info">${face(id)}<div><b>${d.name}</b> <i>${d.title === ROLE[d.role] ? '' : d.title + ' · '}${tag(id)} · Lv ${lv || 1}</i>
  <div class="st">체력 ${Math.round(d.hp * m)} · 공격 ${Math.round(d.atk * m)} · 방어 ${d.def} · 사거리 ${d.range} · 공속 ${d.as}s</div>
  ${d.skill ? `<div class="sk"><b>${d.skill.name}</b> (${d.skill.cd}초) ${d.skill.desc}</div>` : '<div class="sk dim">스킬 없음</div>'}</div></div>`;
}
function statsHtml(b) {
  const max = Math.max(1, ...b.units.map(u => Math.max(u.stats.dmg, u.stats.taken, u.stats.heal)));
  const row = u => `<tr class="${u.alive ? '' : 'dead'} t${u.team}"><td>${face(u.id, 'xs')}${u.d.name}</td>${['dmg', 'taken', 'heal'].map(k => `<td><span class="barv ${k}" style="width:${Math.round(34 * u.stats[k] / max)}px"></span>${Math.round(u.stats[k])}</td>`).join('')}<td>${u.stats.kills}</td></tr>`;
  return `<table class="stats"><tr><th></th><th>준 피해</th><th>받은 피해</th><th>회복</th><th>처치</th></tr>${b.units.map(row).join('')}</table>`;
}

/* ---- 화면: 홈 / 맵 ---- */
let view = 'home', info = null, stageIdx = 0;
function home() {
  view = 'home'; stop();
  app.innerHTML = `<div class="home"><h1>QUARTET<br>ARENA</h1><p class="tagline">쿼텟 아레나 · 4 대 4 자동 전투</p>
  <div class="lineup">${S.team.map(id => face(id, 'lg')).join('')}</div>
  <button class="btn pri" data-a="map">스토리 모드<small>${cleared()} / ${STAGES.length} 클리어 · ◆ ${S.gold}</small></button>
  <button class="btn" data-a="debug">디버그 모드<small>아무나 4명씩 골라서 싸움 붙이기</small></button>
  <button class="link" data-a="reset">진행 초기화</button></div>`;
}
function map() {
  view = 'map'; stop();
  const n = cleared();
  app.innerHTML = `<div class="page"><div class="top"><button class="ic" data-a="home">←</button><b>스토리</b><span class="gold">◆ ${S.gold}</span></div>
  ${n >= STAGES.length ? '<div class="note">흑룡은 쓰러졌고, 대륙에 새벽이 왔다. 새벽 길드의 이름은 오래 남을 것이다.</div>' : ''}
  ${CHAPTERS.map((c, ci) => `<h3>${c.name}</h3><div class="stages">${STAGES.map((s, i) => s.ch !== ci ? '' : `<button class="stage ${i > n ? 'lock' : ''} ${s.boss ? 'boss' : ''}" data-a="prep" data-i="${i}">
    <span class="no">${i + 1}</span><span class="nm">${s.name}${s.boss ? ' <em>BOSS</em>' : ''}<small>${s.foes.map(f => UNITS[f.id].name).join(' · ')}</small></span>
    <span class="stars">${i > n ? '🔒' : '★'.repeat(S.stars[i] || 0) + '<i>' + '★'.repeat(3 - (S.stars[i] || 0)) + '</i>'}</span></button>`).join('')}</div>`).join('')}</div>`;
}
function prep(i) {
  view = 'prep'; stageIdx = i; stop();
  const s = STAGES[i];
  S.team = S.team.filter(id => S.owned.includes(id));
  app.innerHTML = `<div class="page"><div class="top"><button class="ic" data-a="map">←</button><b>${i + 1}. ${s.name}</b><span class="gold">◆ ${S.gold}</span></div>
  <div class="talk">${s.talk.map(([w, t]) => `<p><b>${w}</b>${t}</p>`).join('')}</div>
  <h3>적 편성</h3><div class="row4">${s.foes.map(f => `<button class="slot foe" data-a="info" data-id="${f.id}" data-lv="${f.lv}">${face(f.id)}<small>${UNITS[f.id].name}<br>Lv ${f.lv}</small></button>`).join('')}</div>
  <h3>내 편성 <small>${S.team.length}/4 · 아래에서 눌러 넣고 빼기</small></h3>
  <div class="row4">${[0, 1, 2, 3].map(k => { const id = S.team[k]; return `<button class="slot" ${id ? `data-a="tog" data-id="${id}"` : ''}>${face(id)}<small>${id ? UNITS[id].name + '<br>Lv ' + S.lv[id] : '빈 칸'}</small></button>`; }).join('')}</div>
  <div class="grid">${S.owned.map(id => { const lv = S.lv[id], c = lvCost(lv), max = lv >= MAXLV;
    return `<div class="hc ${S.team.includes(id) ? 'on' : ''}" data-a="tog" data-id="${id}">${face(id)}<div class="hn"><b>${UNITS[id].name}</b><small>${tag(id)}</small></div>
    <button class="up ${max || S.gold < c ? 'no' : ''}" data-a="up" data-id="${id}">Lv ${lv}${max ? '<small>MAX</small>' : `<small>▲ ◆${c}</small>`}</button></div>`; }).join('')}</div>
  ${infoHtml(info && info.id, info && info.lv)}
  <button class="btn pri sticky" data-a="fight" ${S.team.length ? '' : 'disabled'}>전투 시작</button></div>`;
}

/* ---- 화면: 디버그 편성 ---- */
function debug(simHtml) {
  view = 'debug'; stop();
  const D = S.dbg, grp = (t, f) => `<h4>${t}</h4><div class="pal">${Object.keys(UNITS).filter(f).map(id => `<button class="pk" data-a="dpick" data-id="${id}">${face(id)}<small>${UNITS[id].name}</small></button>`).join('')}</div>`;
  const team = (k, name, lvk) => `<div class="dteam t${k === 'A' ? 0 : 1}"><div class="dh"><b>${name}</b><span class="lvs"><button data-a="dlv" data-k="${lvk}" data-d="-1">−</button>Lv ${D[lvk]}<button data-a="dlv" data-k="${lvk}" data-d="1">＋</button></span></div>
  <div class="row4">${[0, 1, 2, 3].map(i => `<button class="slot ${D.sel === k + i ? 'sel' : ''}" data-a="dslot" data-s="${k + i}">${face(D[k][i])}<small>${D[k][i] ? UNITS[D[k][i]].name : '빈 칸'}</small></button>`).join('')}</div></div>`;
  app.innerHTML = `<div class="page"><div class="top"><button class="ic" data-a="home">←</button><b>디버그 모드</b><span></span></div>
  <p class="dim">칸을 고른 뒤 아래 목록에서 캐릭터를 누른다. 고른 칸을 다시 누르면 비운다.</p>
  ${team('A', 'A팀 (왼쪽)', 'la')}${team('B', 'B팀 (오른쪽)', 'lb')}
  <div class="btns"><button class="btn pri" data-a="dfight">전투 보기</button><button class="btn" data-a="dsim">200회 시뮬</button><button class="btn" data-a="drand">무작위</button><button class="btn" data-a="dswap">좌우 교체</button></div>
  <div id="sim">${simHtml || ''}</div>
  ${grp('영웅', id => HEROES.includes(id))}${grp('졸개', id => UNITS[id].role === 'mob')}${grp('보스', id => UNITS[id].role === 'boss')}
  ${infoHtml(info && info.id, info && info.lv)}</div>`;
}
const dTeams = () => [S.dbg.A.map(id => id ? { id, lv: S.dbg.la } : null), S.dbg.B.map(id => id ? { id, lv: S.dbg.lb } : null)];
function runSim() {
  const [A, B] = dTeams(), N = 200; if (!A.some(Boolean) || !B.some(Boolean)) return;
  let wa = 0, to = 0, tt = 0; const agg = {};
  for (let i = 0; i < N; i++) {
    const b = new Battle(A, B, 1000 + i * 7919).run(); if (b.winner === 0) wa++; if (b.timeout) to++; tt += b.t;
    for (const u of b.units) { const a = agg[u.uid] = agg[u.uid] || { id: u.id, team: u.team, dmg: 0, taken: 0, heal: 0, alive: 0 }; a.dmg += u.stats.dmg; a.taken += u.stats.taken; a.heal += u.stats.heal; if (u.alive) a.alive++; }
  }
  const pa = Math.round(100 * wa / N);
  debug(`<div class="simres"><div class="wr"><span class="a" style="width:${pa}%">A ${pa}%</span><span class="b" style="width:${100 - pa}%">B ${100 - pa}%</span></div>
  <div class="dim">${N}판 · 평균 ${(tt / N).toFixed(1)}초 · 시간 초과 ${Math.round(100 * to / N)}%</div>
  <table class="stats"><tr><th></th><th>평균 피해</th><th>평균 받은 피해</th><th>평균 회복</th><th>생존율</th></tr>${Object.values(agg).map(a => `<tr class="t${a.team}"><td>${face(a.id, 'xs')}${UNITS[a.id].name}</td><td>${Math.round(a.dmg / N)}</td><td>${Math.round(a.taken / N)}</td><td>${Math.round(a.heal / N)}</td><td>${Math.round(100 * a.alive / N)}%</td></tr>`).join('')}</table></div>`);
}

/* ---- 전투 ---- */
let B = null, raf = 0;
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; B = null; }
function fight(cfg) {
  stop(); view = 'battle';
  const dbg = cfg.mode === 'debug';
  const b = new Battle(cfg.A, cfg.B, (Math.random() * 1e9) | 0, { manualA: !dbg && !cfg.auto });
  const chip = u => `<div class="chip t${u.team}" id="u${u.uid}">${face(u.id, 'sm')}<div class="cb"><span>${u.d.name}</span><div class="hp"><i></i></div><em></em></div></div>`;
  const skb = (u, k) => `<button class="skb" id="u${u.uid}" data-a="cast" data-u="${u.uid}">${face(u.id)}<span class="cdm"></span><div class="hp"><i></i></div><b>${u.d.skill ? u.d.skill.name : '—'}</b><kbd>${k + 1}</kbd></button>`;
  const mine = b.units.filter(u => u.team === 0), foes = b.units.filter(u => u.team === 1);
  app.innerHTML = `<div class="battle"><div class="bar"><button class="ic" data-a="quit">✕</button><b class="tt">${cfg.title}</b><span id="tm">90</span>
  <button class="tg" data-a="pause" id="pz">Ⅱ</button><button class="tg" data-a="spd" id="spd">x1</button>${dbg ? '' : `<button class="tg ${cfg.auto ? 'on' : ''}" data-a="auto" id="auto">AUTO</button>`}</div>
  <canvas id="cv"></canvas>
  ${dbg ? `<div class="chips">${mine.map(chip).join('')}</div>` : ''}<div class="chips">${foes.map(chip).join('')}</div>
  ${dbg ? '' : `<div class="skills">${mine.map(skb).join('')}</div><p class="dim hint">${cfg.auto ? '' : '스킬이 차오르면 눌러서 발동. AUTO를 켜면 알아서 쓴다.'}</p>`}
  <div id="res"></div></div>`;
  const R = new Arena($('cv'));
  B = { b, cfg, R, speed: 1, paused: false, done: false, endT: 0, els: b.units.map(u => { const el = $('u' + u.uid); return { u, el, hp: el.querySelector('.hp i'), cd: el.querySelector('.cdm'), em: el.querySelector('em') }; }) };
  let last = performance.now();
  const frame = now => {
    if (!B || B.b !== b) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!B.paused && !B.done) for (let i = 0; i < B.speed; i++) { b.step(); R.take(b.ev); sfx(b.ev); b.ev.length = 0; }
    if (b.over) for (const u of b.units) if (!u.alive && u.anim.dead < 1) u.anim.dead = Math.min(1, u.anim.dead + dt * 2);
    R.draw(b, B.paused ? 0 : dt, cfg.bg, dbg);
    $('tm').textContent = Math.max(0, Math.ceil(b.limit - b.t));
    for (const e of B.els) {
      const u = e.u; e.hp.style.width = (100 * u.hp / u.maxHp) + '%'; e.el.classList.toggle('dead', !u.alive);
      if (e.cd) { const p = u.d.skill ? Math.max(0, u.cd) / u.d.skill.cd : 1; e.cd.style.setProperty('--p', p); e.el.classList.toggle('rdy', b.ready(u)); e.el.classList.toggle('want', u.want); }
      if (e.em) e.em.textContent = Math.round(u.stats.dmg);
    }
    if (b.over && !B.done && (B.endT += dt) > 0.9) { B.done = true; finish(); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function finish() {
  const { b, cfg } = B, win = b.winner === 0; let head, extra = '', btns;
  audio(); if (win) { beep(523, 0.12, 'triangle', 0.09); setTimeout(() => beep(784, 0.25, 'triangle', 0.09), 130); } else beep(220, 0.5, 'sawtooth', 0.07, 80);
  if (cfg.mode === 'debug') {
    head = `<h2 class="${win ? 'w' : 'l'}">${b.winner < 0 ? '무승부' : (win ? 'A팀' : 'B팀') + ' 승리'}</h2><div class="dim">${b.t.toFixed(1)}초${b.timeout ? ' · 시간 초과(남은 체력 비율로 판정)' : ''}</div>`;
    btns = `<button class="btn pri" data-a="dfight">다시 붙이기</button><button class="btn" data-a="debug">편성으로</button>`;
  } else {
    const i = cfg.stage, s = STAGES[i];
    if (win) {
      const alive = b.team(0).length, stars = alive >= 4 ? 3 : alive >= 2 ? 2 : 1, first = !S.stars[i], gold = stageGold(i) * (first ? 2 : 1);
      S.gold += gold; S.stars[i] = Math.max(S.stars[i] || 0, stars);
      if (first && s.unlock && !S.owned.includes(s.unlock)) { S.owned.push(s.unlock); S.lv[s.unlock] = 1; extra = `<div class="unlock">${face(s.unlock, 'lg')}<div><b>${UNITS[s.unlock].name}</b> 합류!<small>${UNITS[s.unlock].title} · ${tag(s.unlock)}</small></div></div>`; }
      save();
      head = `<h2 class="w">승리</h2><div class="bigstars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></div><div class="gold">◆ +${gold}${first ? ' (첫 클리어 2배)' : ''}</div>`;
      btns = (i + 1 < STAGES.length ? `<button class="btn pri" data-a="prep" data-i="${i + 1}">다음 스테이지</button>` : `<button class="btn pri" data-a="map">엔딩 보기</button>`) + `<button class="btn" data-a="prep" data-i="${i}">다시</button><button class="btn" data-a="map">맵</button>`;
    } else {
      head = `<h2 class="l">패배</h2><div class="dim">${b.timeout ? '시간 초과. ' : ''}레벨을 올리거나 편성을 바꿔보자.</div>`;
      btns = `<button class="btn pri" data-a="prep" data-i="${i}">편성으로</button><button class="btn" data-a="map">맵</button>`;
    }
  }
  $('res').innerHTML = `<div class="result">${head}${extra}${statsHtml(b)}<div class="btns">${btns}</div></div>`;
}

/* ---- 입력 ---- */
const ACT = {
  home, map, debug: () => debug(),
  reset() { if (confirm('스토리 진행과 레벨을 모두 지울까?')) { S = fresh(); save(); home(); } },
  prep(d) { const i = +d.i; if (i > cleared()) return; info = null; prep(i); },
  info(d) { info = { id: d.id, lv: +d.lv || 1 }; if (view === 'prep') prep(stageIdx); },
  tog(d) { const id = d.id, k = S.team.indexOf(id); if (k >= 0) S.team.splice(k, 1); else if (S.team.length < 4) S.team.push(id); info = { id, lv: S.lv[id] }; save(); prep(stageIdx); },
  up(d) { const id = d.id, lv = S.lv[id], c = lvCost(lv); if (lv >= MAXLV || S.gold < c) return; S.gold -= c; S.lv[id]++; info = { id, lv: S.lv[id] }; save(); beep(880, 0.1, 'triangle', 0.08, 1320); prep(stageIdx); },
  fight() { const s = STAGES[stageIdx]; fight({ mode: 'story', stage: stageIdx, title: `${stageIdx + 1}. ${s.name}`, bg: s.ch, auto: !!S.auto, A: S.team.map(id => ({ id, lv: S.lv[id] })), B: s.foes }); },
  dslot(d) { const D = S.dbg, k = d.s[0], i = +d.s[1]; if (D.sel === d.s && D[k][i]) D[k][i] = null; D.sel = d.s; save(); debug(); },
  dpick(d) { const D = S.dbg, k = D.sel[0], i = +D.sel[1]; D[k][i] = d.id; info = { id: d.id, lv: k === 'A' ? D.la : D.lb };
    const order = ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'], nx = order.find(s => !D[s[0]][+s[1]]); if (nx) D.sel = nx; save(); debug(); },
  dlv(d) { S.dbg[d.k] = Math.max(1, Math.min(30, S.dbg[d.k] + +d.d)); save(); debug(); },
  drand() { const ids = Object.keys(UNITS).filter(id => UNITS[id].role !== 'boss'), r = () => { const p = ids.slice(), o = []; while (o.length < 4) o.push(p.splice((Math.random() * p.length) | 0, 1)[0]); return o; }; S.dbg.A = r(); S.dbg.B = r(); save(); debug(); },
  dswap() { const D = S.dbg;[D.A, D.B] = [D.B, D.A];[D.la, D.lb] = [D.lb, D.la]; save(); debug(); },
  dsim: runSim,
  dfight() { const [A, Bt] = dTeams(); if (!A.some(Boolean) || !Bt.some(Boolean)) return; fight({ mode: 'debug', title: '디버그 전투', bg: 3, A, B: Bt }); },
  quit() { const c = B && B.cfg; if (c && c.mode === 'debug') debug(); else prep(stageIdx); },
  spd() { if (!B) return; const o = B.cfg.mode === 'debug' ? [1, 2, 4, 8] : [1, 2, 3]; B.speed = o[(o.indexOf(B.speed) + 1) % o.length]; $('spd').textContent = 'x' + B.speed; },
  pause() { if (!B) return; B.paused = !B.paused; $('pz').classList.toggle('on', B.paused); },
  auto() { if (!B) return; S.auto = !S.auto; save(); B.b.manual[0] = !S.auto; $('auto').classList.toggle('on', S.auto); },
  cast(d) { if (B && !B.done) B.b.cast(B.b.units[+d.u]); },
};
app.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; audio(); const f = ACT[el.dataset.a]; if (f) f(el.dataset); });
window.addEventListener('keydown', e => {
  if (view !== 'battle' || !B) return;
  const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (i >= 0 && B.cfg.mode !== 'debug') { const u = B.b.units.filter(x => x.team === 0)[i]; if (u) B.b.cast(u); }
  else if (e.code === 'Space') { e.preventDefault(); ACT.pause(); }
});
window.addEventListener('resize', () => { if (B) B.R.resize(); });
window.__q = { get B() { return B; }, get S() { return S; }, ACT };
home();
