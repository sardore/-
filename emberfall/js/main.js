// 화면 구성: 타이틀 / HUD / 대화창 / 입력 / 이벤트 파이프라인
import { Game, memStore } from './game.js';
import { Renderer } from './render.js';
import * as sfx from './sfx.js';
import { personSprite } from './sprites.js';
import { ZONES, RELICS, RIDX, MONSTERS, ENDINGS, TRAITS } from './data.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let store; try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); store = localStorage; } catch (e) { store = memStore(); }
const qs = new URLSearchParams(location.search);

const G = new Game(store);
window.__G = G;
const cv = $('cv'), R = new Renderer(cv, G); window.__R = R;
R.mini = $('mini');
const resize = () => R.resize();
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

/* ---------- 이벤트 파이프라인 ---------- */
const logEl = $('log');
function addLog(text, cls) {
  const p = document.createElement('p'); p.className = cls || ''; p.textContent = text; logEl.appendChild(p);
  while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
  setTimeout(() => p.remove(), 5200);
}
let whereTxt = '';
function pump() {
  const evs = G.drain(); if (!evs.length) return;
  R.onEvents(evs);
  for (const e of evs) {
    switch (e.type) {
      case 'log': addLog(e.text, e.cls); break;
      case 'sfx': sfx.play(e.n); break;
      case 'move': if (!G.f.village || true) sfx.play('step'); break;
      case 'floor': {
        const z = Math.max(0, G.f.zone | 0); sfx.droneZone(z);
        whereTxt = e.village ? `<span>애쉬폴</span><small>재의 마을</small>` : `<span>${esc(ZONES[G.f.zone].name)}</span><small>${esc(e.name.replace(ZONES[G.f.zone].name + ' ', ''))}</small>`;
        $('where').innerHTML = whereTxt; $('mini').style.display = e.village ? 'none' : ''; break;
      }
      case 'death': showDeath(e); break;
      case 'ending': showEnding(e); break;
      case 'bump': break;
    }
  }
}

/* ---------- HUD ---------- */
const hud = { hp: $('hud').querySelector('.bar.hp'), fl: $('hud').querySelector('.bar.fl'), meta: $('hud').querySelector('.meta') };
const cache = {};
function setIf(k, v, fn) { if (cache[k] !== v) { cache[k] = v; fn(v); } }
function updateHud() {
  const pl = G.pl, run = G.run; if (!pl) return;
  const hp = Math.max(0, Math.ceil(pl.hp)), fl = Math.max(0, Math.ceil(pl.flame));
  setIf('hp', hp + '/' + pl.maxhp, () => { hud.hp.querySelector('i').style.width = (100 * Math.max(0, pl.hp) / pl.maxhp) + '%'; hud.hp.querySelector('em').textContent = `체력 ${hp}/${pl.maxhp}`; hud.hp.classList.toggle('low', pl.hp <= pl.maxhp * 0.34); });
  setIf('fl', fl + '/' + pl.maxflame, () => { hud.fl.querySelector('i').style.width = (100 * Math.max(0, pl.flame) / pl.maxflame) + '%'; hud.fl.querySelector('em').textContent = `불꽃 ${fl}/${pl.maxflame}`; hud.fl.classList.toggle('low', pl.flame <= pl.maxflame * 0.2); });
  const meta = run ? `<span>재 <b>${run.ash}</b></span>${run.keys ? `<span>열쇠 <b>${run.keys}</b></span>` : ''}<span>${esc(run.heir.name)}</span>` : `<span>재 <b>${G.meta.ash}</b></span><span>${G.meta.gen}대째</span>`;
  setIf('meta', meta, v => { hud.meta.innerHTML = v; });
  setIf('herb', run ? `약초 ×${run.herbs}/${G.herbCap()}` : '', v => { $('herb').textContent = v; });
  const rl = run ? run.relics.join(',') : ''; setIf('relics', rl, () => {
    const box = $('relics'); box.innerHTML = '';
    if (run) for (const id of run.relics) { const r = RELICS[RIDX[id]]; const s = document.createElement('span'); s.title = `${r.name} — ${r.desc}`; s.innerHTML = `<i style="background:${r.c};color:${r.c}"></i>`; box.appendChild(s); }
  });
  // 보스 바
  let b = null; if (run) for (const m of G.mons) { if (MONSTERS[m.type].boss && (m.awake || G.seen[m.y * 52 + m.x])) { b = m; break; } }
  setIf('boss', b ? b.type + ':' + b.hp : '', () => {
    const el = $('boss'); el.classList.toggle('on', !!b);
    if (b) { el.querySelector('b').textContent = MONSTERS[b.type].name; el.querySelector('i').style.width = (100 * Math.max(0, b.hp) / b.maxhp) + '%'; }
  });
}

/* ---------- 대화창 ---------- */
const dlgEl = $('dlg'), cardEl = $('card');
let dShown = null, dIdx = -1, typed = 0, typeT = 0, curText = '', cardOn = false, cardLock = 0;
function lookFor(w) {
  if (!w) return null;
  const n = G.npcs.find(q => q.name === w); if (n) return n.look;
  const i = G.meta.heirs.findIndex(h => h.name === w); if (G.run && G.run.heir.name === w) return 'player';
  if (i >= 0) return 'heir' + i;
  if (/유령|그림자|망령/.test(w)) return 'ghost0';
  return null;
}
function portrait(look) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  try { g.drawImage(personSprite(look, 0), 0, 0); } catch (e) {} return c;
}
function syncDialog() {
  const d = G.dialog;
  if (!d) { if (dShown) { dShown = null; dIdx = -1; dlgEl.classList.remove('on'); dlgEl.innerHTML = ''; cardEl.classList.remove('on'); cardOn = false; } return; }
  if (d === dShown && d.i === dIdx) { // 타자기 진행
    if (!cardOn && typed < curText.length) { typeT += 1; typed = Math.min(curText.length, typed + 1); const say = dlgEl.querySelector('.say'); if (say) say.textContent = curText.slice(0, typed); if (typed >= curText.length) finishTyping(); }
    return;
  }
  dShown = d; dIdx = d.i;
  if (d.card) { // 구역 진입 카드
    cardOn = true; cardLock = performance.now() + 500; dlgEl.classList.remove('on');
    cardEl.innerHTML = `<div class="en">${esc(d.pages[0].t)}</div><h2>${esc(d.card)}</h2>${d.pages.slice(1).map(p => `<p>${esc(p.t)}</p>`).join('')}<div class="tap">터치해서 계속</div>`;
    cardEl.classList.add('on'); sfx.play('boss'); return;
  }
  cardOn = false; cardEl.classList.remove('on');
  const pg = d.pages[d.i], last = d.i >= d.pages.length - 1;
  curText = pg.t; typed = 0;
  dlgEl.innerHTML = `<div class="box"><div class="pt"></div><div class="tx"><div class="who"></div><div class="say${pg.w ? '' : ' note'}"></div><div class="ch"></div><div class="more"></div></div></div>`;
  const look = lookFor(pg.w); const pt = dlgEl.querySelector('.pt'); if (look) pt.appendChild(portrait(look)); else pt.style.display = 'none';
  dlgEl.querySelector('.who').textContent = pg.w || '';
  dlgEl.classList.add('on'); sfx.play('ui');
  if (curText.length > 90) typed = 0;
}
function finishTyping() {
  const d = G.dialog; if (!d) return; typed = curText.length; const say = dlgEl.querySelector('.say'); if (say) say.textContent = curText;
  const last = d.i >= d.pages.length - 1, more = dlgEl.querySelector('.more'), ch = dlgEl.querySelector('.ch');
  if (last && d.choices) {
    ch.innerHTML = ''; d.choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c.t; if (i === d.sel) b.className = 'sel'; b.onclick = ev => { ev.stopPropagation(); chooseDlg(i); }; ch.appendChild(b); });
    more.textContent = '';
  } else more.textContent = last ? '▼ 닫기' : '▼';
}
function chooseDlg(i) { sfx.play('ui'); G.dlgChoose(i); pump(); }
function advanceDialog() {
  const d = G.dialog; if (!d) return;
  if (cardOn) { if (performance.now() < cardLock) return; G.closeDialog(); pump(); return; }
  if (typed < curText.length) { finishTyping(); return; }
  if (d.i >= d.pages.length - 1 && d.choices) { chooseDlg(d.sel); return; }
  sfx.play('ui'); G.dlgNext(); pump();
}
function moveSel(dv) {
  const d = G.dialog; if (!d || !d.choices || typed < curText.length || d.i < d.pages.length - 1) return;
  d.sel = (d.sel + dv + d.choices.length) % d.choices.length; sfx.play('ui');
  dlgEl.querySelectorAll('.ch button').forEach((b, i) => b.className = i === d.sel ? 'sel' : '');
}
dlgEl.addEventListener('pointerdown', e => { if (e.target.closest('.ch button')) return; e.preventDefault(); sfx.unlock(); advanceDialog(); });
cardEl.addEventListener('pointerdown', e => { e.preventDefault(); sfx.unlock(); advanceDialog(); });

/* ---------- 죽음 / 엔딩 ---------- */
function showDeath(e) {
  const t = TRAITS.find(x => x.id === (G.meta.dead[G.meta.dead.length - 1] || {}).trait);
  setTimeout(() => {
    $('over').innerHTML = `<div class="tomb">✝</div><h2>${esc(e.name)}</h2><p class="c">${esc(G.meta.dead[G.meta.dead.length - 1]?.cause || '')}</p><p>${esc(G.meta.dead[G.meta.dead.length - 1]?.depthName || '')} · 처치 ${e.kills} · 재 ${e.ash}</p><p class="w">"${esc(e.words)}"</p><p>그 자리에 유해가 남는다.<br>다음 세대가 그 등불을 이을 수 있다.</p><button class="big" id="homeBtn">마을로</button>`;
    $('over').classList.add('on'); $('homeBtn').onclick = () => { sfx.play('ui'); $('over').classList.remove('on'); G.enterVillage(); pump(); };
  }, 900);
}
let endLines = null, endI = 0;
function showEnding(e) {
  const E = ENDINGS[e.id]; endLines = [...E.lines, null]; endI = 0; endTitle = E.title; stepEnding();
}
let endTitle = '';
function stepEnding() {
  if (!endLines) return;
  const el = cardEl; el.classList.add('on'); cardOn = false; el.dataset.ending = '1';
  const line = endLines[endI];
  if (line === null) { el.innerHTML = `<div class="en">ENDING</div><h2>${esc(endTitle)}</h2><p>이야기는 계속된다. 마을에는 새로운 세대가 기다린다.</p><div class="tap">터치해서 마을로</div>`; }
  else el.innerHTML = `<p style="font-size:17px">${esc(line)}</p><div class="tap">터치</div>`;
}
cardEl.addEventListener('pointerdown', () => {
  if (!endLines || cardEl.dataset.ending !== '1') return;
  endI++; if (endI >= endLines.length) { endLines = null; cardEl.dataset.ending = ''; cardEl.classList.remove('on'); G.afterEnding(); pump(); } else stepEnding();
});

/* ---------- 메뉴 ---------- */
const sheet = $('sheet'); let resetArm = 0;
function openSheet() {
  const run = G.run, m = G.meta;
  const relics = run && run.relics.length ? run.relics.map(id => { const r = RELICS[RIDX[id]]; return `<div class="rr"><i style="background:${r.c};color:${r.c}"></i><div><b>${esc(r.name)}</b><span>${esc(r.desc)}</span></div></div>`; }).join('') : '<p>가진 유물이 없다.</p>';
  sheet.innerHTML = `<div class="sh"><h3>메뉴</h3>
  <button class="i" data-a="snd">소리: ${sfx.isMuted() ? '꺼짐' : '켜짐'}</button>
  <p><b>조작</b> — 방향키/WASD, 또는 화면을 누르고 있으면 그쪽으로 걷는다. 부딪치면 공격·대화·문·상자. 제자리를 누르거나 Space는 숨 고르기.<br>불꽃이 꺼지면 어둠이 살을 파고든다. 화로와 불씨를 찾아라. 연속으로 걸어서 부딪치면 일격이 강해진다.</p>
  <p><b>기록</b> — ${m.gen}대째 · 최고 ${m.best + 1}층 · 엔딩 ${Object.keys(m.endings).length}/3</p>
  ${run ? `<h3 style="margin-top:12px">유물</h3>${relics}` : ''}
  ${run ? '<button class="i" data-a="giveup" style="color:#ff9a8a">포기한다 (쓰러진 것으로 친다)</button>' : '<button class="i" data-a="reset" style="color:#ff9a8a">모든 기록 지우기</button>'}
  <button class="i" data-a="close">닫기</button></div>`;
  sheet.classList.add('on'); resetArm = 0;
}
sheet.addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b) { if (!e.target.closest('.sh')) sheet.classList.remove('on'); return; }
  const a = b.dataset.a; sfx.unlock(); sfx.play('ui');
  if (a === 'close') sheet.classList.remove('on');
  else if (a === 'snd') { const mu = sfx.toggle(); if (!mu) sfx.startDrone(Math.max(0, G.f?.zone | 0)); b.textContent = `소리: ${mu ? '꺼짐' : '켜짐'}`; }
  else if (a === 'giveup') { sheet.classList.remove('on'); G.die('포기'); pump(); }
  else if (a === 'reset') { if (!resetArm) { resetArm = 1; b.textContent = '정말 지울까? 한 번 더 누르면 삭제'; } else { try { store.removeItem('emberfall_meta_v1'); store.removeItem('emberfall_run_v1'); } catch (e2) {} location.reload(); } }
});
$('menu').addEventListener('pointerdown', e => { e.stopPropagation(); sfx.unlock(); openSheet(); });

/* ---------- 입력 ---------- */
const DIRK = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
const held = []; let hd = null; // hd: {dir, t0, last, rep}
let ptr = null;
const playable = () => G.mode === 'play' && !dShown && !sheet.classList.contains('on') && !$('title').classList.contains('on') && !$('over').classList.contains('on') && !endLines;
function act(dir) { if (!G.f) return; G.move(dir[0], dir[1]); pump(); }
function doWait() { if (G.wait()) { sfx.play('step'); pump(); } }
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return; sfx.unlock();
  if ($('title').classList.contains('on')) { if (e.key === 'Enter' || e.key === ' ') { $('title').querySelector('.tb.pri')?.click(); e.preventDefault(); } return; }
  if ($('over').classList.contains('on')) { if (e.key === 'Enter' || e.key === ' ') { $('homeBtn')?.click(); e.preventDefault(); } return; }
  if (endLines) { if (e.key === 'Enter' || e.key === ' ') { cardEl.dispatchEvent(new Event('pointerdown')); e.preventDefault(); } return; }
  if (e.key === 'Escape') { sheet.classList.contains('on') ? sheet.classList.remove('on') : openSheet(); return; }
  if (sheet.classList.contains('on')) return;
  if (G.dialog) {
    if (e.key === 'ArrowUp' || e.key === 'w') moveSel(-1); else if (e.key === 'ArrowDown' || e.key === 's') moveSel(1);
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'z') advanceDialog();
    e.preventDefault(); return;
  }
  const d = DIRK[e.key];
  if (d) { e.preventDefault(); if (e.repeat) return; const i = held.findIndex(h => h.k === e.key); if (i >= 0) held.splice(i, 1); held.push({ k: e.key, dir: d }); hd = { dir: d, last: -1e9, rep: false }; return; }
  if (e.key === ' ' || e.key === '.' || e.key === 'z' || e.key === '5') { e.preventDefault(); if (!e.repeat && playable()) doWait(); }
});
addEventListener('keyup', e => {
  const i = held.findIndex(h => h.k === e.key); if (i < 0) return; held.splice(i, 1);
  if (held.length) hd = { dir: held[held.length - 1].dir, last: performance.now(), rep: true }; else hd = null;
});
addEventListener('blur', () => { held.length = 0; hd = null; ptr = null; });

function pointerDir(e) {
  const pe = R.ents.get('pl'); if (!pe) return null;
  const rect = cv.getBoundingClientRect(), k = R.dpr; // 화면 위치 → 캔버스 픽셀
  const px = (e.clientX - rect.left) * k, py = (e.clientY - rect.top) * k;
  const cx = R.sx(pe.cx ?? pe.x) + R.tp / 2, cy = R.sy(pe.cy ?? pe.y) + R.tp / 2;
  const dx = px - cx, dy = py - cy, ad = Math.max(Math.abs(dx), Math.abs(dy));
  if (ad < R.tp * 0.55) return [0, 0];
  return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}
cv.addEventListener('pointerdown', e => {
  sfx.unlock(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (!playable()) return;
  const d = pointerDir(e); if (!d) return; ptr = { id: e.pointerId, dir: d, t0: performance.now() };
  if (d[0] === 0 && d[1] === 0) { doWait(); ptr.wait = true; hd = null; return; }
  hd = { dir: d, last: -1e9, rep: false, ptr: true };
});
cv.addEventListener('pointermove', e => {
  if (!ptr || e.pointerId !== ptr.id || ptr.wait) return; const d = pointerDir(e); if (!d || (d[0] === 0 && d[1] === 0)) return;
  if (hd && hd.ptr && (d[0] !== hd.dir[0] || d[1] !== hd.dir[1])) hd = { dir: d, last: performance.now(), rep: true, ptr: true };
});
const endPtr = e => { if (ptr && e.pointerId === ptr.id) { ptr = null; if (hd && hd.ptr) hd = null; } };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());

function inputTick(now) {
  if (!hd || !playable()) return;
  const gap = hd.rep ? 118 : 0; if (now - hd.last < gap) return;
  const first = !hd.rep; hd.last = now; hd.rep = true; if (first) hd.last = now + 120; // 첫 입력 뒤 약간 더 기다림
  act(hd.dir);
}

/* ---------- 타이틀 ---------- */
function startTitle() {
  const t = $('title'); t.classList.add('on'); const has = G.hasSavedRun(), m = G.meta, tb = $('tbtn');
  const rec = m.gen > 1 || m.best > 0 ? `<div class="tg" style="margin:0 0 10px">${m.gen}대째 · 최고 ${m.best + 1}층</div>` : '';
  tb.innerHTML = rec + (has ? `<button class="tb pri" id="bCont">이어서 내려간다<small>저장된 탐험을 계속한다</small></button><button class="tb" id="bNew">마을로 돌아가기<small>진행 중인 탐험은 사라진다</small></button>` : `<button class="tb pri" id="bNew">${m.gen > 1 || m.flags.prologue ? '마을로' : '이야기 시작'}</button>`);
  const go = fn => () => { sfx.unlock(); sfx.startDrone(0); t.classList.remove('on'); fn(); pump(); };
  if (has) $('bCont').onclick = go(() => { if (!G.loadRun()) G.enterVillage(); });
  $('bNew').onclick = go(() => G.enterVillage());
  emberLoop();
}
let emberRAF = 0;
function emberLoop() {
  const c = $('tc'), g = c.getContext('2d'); const ps = [];
  const sz = () => { c.width = c.clientWidth; c.height = c.clientHeight; }; sz(); addEventListener('resize', sz);
  const tick = () => {
    if (!$('title').classList.contains('on')) { cancelAnimationFrame(emberRAF); return; }
    g.clearRect(0, 0, c.width, c.height);
    if (ps.length < 90 && Math.random() < 0.8) ps.push({ x: Math.random() * c.width, y: c.height + 6, vx: (Math.random() - 0.5) * 0.4, vy: -(0.4 + Math.random() * 1.1), r: 1 + Math.random() * 2.2, life: 0, max: 200 + Math.random() * 300, ph: Math.random() * 6 });
    for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.life++; p.x += p.vx + Math.sin(p.life * 0.03 + p.ph) * 0.35; p.y += p.vy; const a = Math.max(0, 1 - p.life / p.max); if (a <= 0 || p.y < -10) { ps.splice(i, 1); continue; }
      g.globalAlpha = a; g.fillStyle = p.r > 2 ? '#ffd070' : '#ff9a3a'; g.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.r), Math.ceil(p.r)); }
    g.globalAlpha = 1; emberRAF = requestAnimationFrame(tick);
  };
  tick();
}

/* ---------- 메인 루프 ---------- */
let first = true;
function loop(ts) {
  inputTick(ts); pump(); syncDialog();
  if (G.f) { try { R.frame(ts); } catch (e) { if (first) console.error(e); } updateHud(); if (first) { first = false; window.done = true; } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- 자동 저장 ---------- */
const save = () => { try { if (G.run && G.mode !== 'dead') G.saveRun(); G.saveMeta(); } catch (e) {} };
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

/* ---------- 시작 ---------- */
if (qs.has('v')) { G.meta.flags.prologue = 1; G.enterVillage(); pump(); }
else if (qs.has('d')) { G.meta.flags.prologue = 1; G.startRun(+qs.get('d') || 0); pump(); }
else startTitle();
