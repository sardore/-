import { Game } from './game.js';
import { Renderer } from './render.js';
import { SKILLS, MAXLV } from './data.js';
import { CH } from './gen.js';

const $ = id => document.getElementById(id);
const cv = $('cv'), ov = $('ov'), R = new Renderer(cv);
let game, mode = 'title', best = 0;
try { best = +localStorage.getItem('glitchslide_best') || 0; } catch (e) {}

/* ---- 소리 ---- */
let AC = null, lastDot = 0;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (AC.state === 'suspended') AC.resume(); }
function beep(f, d, type, vol, slide) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), ga = AC.createGain(), t = AC.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    ga.gain.setValueAtTime(vol || 0.05, t); ga.gain.exponentialRampToValueAtTime(0.001, t + d + 0.05);
    o.connect(ga); ga.connect(AC.destination); o.start(t); o.stop(t + d + 0.08);
  } catch (e) {}
}
const SFX = {
  go: () => beep(240, 0.05, 'triangle', 0.05, 420), stop: () => beep(110, 0.05, 'triangle', 0.09), bump: () => beep(80, 0.06, 'sawtooth', 0.05),
  dot: n => { const t = performance.now(); if (t - lastDot < 40) return; lastDot = t; beep(520 + (n % 12) * 45, 0.035, 'square', 0.035); },
  power: () => { beep(330, 0.25, 'sawtooth', 0.07, 990); }, hurt: () => beep(300, 0.3, 'sawtooth', 0.1, 60), kill: () => beep(200, 0.2, 'square', 0.08, 1400),
  place: () => { beep(660, 0.1, 'triangle', 0.09); setTimeout(() => beep(990, 0.16, 'triangle', 0.09), 90); }, pick: () => beep(880, 0.16, 'triangle', 0.1, 1320),
  phase: () => beep(900, 0.14, 'sine', 0.09, 200), brake: () => beep(150, 0.08, 'square', 0.08), die: () => beep(400, 0.8, 'sawtooth', 0.12, 30),
  chain: () => beep(1200, 0.12, 'triangle', 0.07, 1800), aim: () => beep(980, 0.09, 'square', 0.04),
};

/* ---- 화면 ---- */
function show(html) { ov.innerHTML = html; ov.classList.add('on'); }
function hide() { ov.classList.remove('on'); ov.innerHTML = ''; }
function start() {
  game = new Game((Date.now() ^ (Math.random() * 1e9)) >>> 0, { sfx: (n, v) => SFX[n] && SFX[n](v), menu: showMenu, dead: () => setTimeout(showDead, 900) });
  window.__g = game; mode = 'play'; hide(); hud('');
}
function title() {
  mode = 'title';
  show(`<div class="panel"><div class="logo">GLITCH<br>SLIDE</div><div class="sub">글리치 슬라이드</div>
  <ul class="how"><li><b>밀기</b>벽에 닿을 때까지 미끄러진다</li><li><b>글리치</b>아래에서 올라온다. 닿으면 끝</li><li><b>연쇄</b>비트를 끊기지 않게 먹으면 점수가 불어난다</li><li><b>장소</b>돌아가야 닿는 곳에 스킬이 있다</li></ul>
  <button class="btn" id="go">시작</button>${best ? `<div class="dim">최고 기록 ${best}</div>` : ''}<div class="dim">스와이프 · 방향키 / 탭 · 스페이스 = 브레이크</div></div>`);
  $('go').onclick = () => { audio(); start(); };
}
function skillCard(s, lv, extra, cls) {
  return `<button class="card ${cls || ''}" style="--c:${s.c}"><span class="ic">${s.icon}</span><span class="tx"><b>${s.n} <i>Lv ${lv} → ${lv + 1}</i></b><span>${s.d[lv]}</span></span>${extra || ''}</button>`;
}
function showMenu(m) {
  if (m.type === 'pick') {
    show(`<div class="panel"><div class="ttl" style="color:#c4a8ff">✦ 제단</div><div class="dim">스킬 하나를 고른다</div>${m.cards.map(s => skillCard(s, game.sk[s.id] || 0)).join('')}</div>`);
    ov.querySelectorAll('.card').forEach((b, i) => b.onclick = () => { game.choose(i); hide(); });
  } else {
    const render = () => {
      show(`<div class="panel"><div class="ttl" style="color:#7dffb0">$ 상점</div><div class="dim">보유 비트 <b style="color:#ffd23f">${game.bits}</b></div>${m.offers.map(o => {
        const cls = o.sold ? 'off' : game.bits < o.price ? 'poor' : '', tag = `<span class="pr">${o.sold ? '구매함' : o.price}</span>`;
        return o.heal ? `<button class="card ${cls}" style="--c:#ff8fa8"><span class="ic">♥</span><span class="tx"><b>수리</b><span>체력 1 회복</span></span>${tag}</button>` : skillCard(o.skill, game.sk[o.skill.id] - (o.sold ? 1 : 0) || 0, tag, cls);
      }).join('')}<button class="btn ghost" id="lv">떠나기</button></div>`);
      ov.querySelectorAll('.card').forEach((b, i) => b.onclick = () => { if (game.buy(i)) render(); else SFX.bump(); });
      $('lv').onclick = () => { game.leave(); hide(); };
    };
    render();
  }
}
function showDead() {
  mode = 'dead';
  const nb = game.score > best; if (nb) { best = game.score; try { localStorage.setItem('glitchslide_best', String(best)); } catch (e) {} }
  const sk = SKILLS.filter(s => game.sk[s.id]).map(s => `<span style="color:${s.c}">${s.icon}${game.sk[s.id]}</span>`).join(' ') || '없음';
  show(`<div class="panel"><div class="ttl">연결 종료</div><div class="dim" style="color:#ff8f8f">${game.why}</div><div class="big">${game.score}</div>
  <div class="dim">${nb ? '<b style="color:#ffd23f">★ 신기록 ★</b>' : '최고 ' + best}</div>
  <div class="stat"><span>구역<b>${game.zone + 1}</b></span><span>높이<b>${game.maxRow}</b></span><span>최대 연쇄<b>${game.bestChain}</b></span><span>격파<b>${game.kills}</b></span></div>
  <div class="dim">스킬 ${sk}</div><button class="btn" id="go">다시</button></div>`);
  $('go').onclick = () => { audio(); start(); };
}
let hudCache = '';
function hud() {
  if (!game) return;
  if (mode === 'title') { if (hudCache) { hudCache = ''; $('hud').innerHTML = ''; } return; }
  const p = game.p, gap = Math.max(0, p.y - game.glitch);
  const hearts = '♥'.repeat(Math.max(0, game.hp)) + '<i>' + '♥'.repeat(Math.max(0, game.maxHp - game.hp)) + '</i>';
  const sk = SKILLS.filter(s => game.sk[s.id]).map(s => {
    const cd = game.cd[s.id], ready = cd === undefined || cd <= 0;
    return `<span class="sk ${ready ? '' : 'cd'}" style="--c:${s.c}">${s.icon}<i>${game.sk[s.id]}</i>${ready ? '' : `<u>${Math.ceil(cd)}</u>`}</span>`;
  }).join('');
  const html = `<div class="row"><span class="hp">${hearts}</span><span class="sc">${game.score}</span><span class="bt">◆ ${game.bits}</span></div>
  <div class="row s"><span>구역 ${game.zone + 1} · ${Math.floor(p.r / CH) % 4 + 1}/4</span><span class="ch">${game.chain > 1 ? '연쇄 ' + game.chain : ''}</span><span class="${gap < 5 ? 'warn' : ''}">글리치 ${gap.toFixed(0)}칸</span></div><div class="sks">${sk}</div>`;
  if (html !== hudCache) { hudCache = html; $('hud').innerHTML = html; }
}

/* ---- 입력 ---- */
let sx = 0, sy = 0, sid = null, moved = false;
cv.addEventListener('pointerdown', e => { audio(); sx = e.clientX; sy = e.clientY; sid = e.pointerId; moved = false; });
cv.addEventListener('pointermove', e => {
  if (sid !== e.pointerId || mode !== 'play') return;
  const dx = e.clientX - sx, dy = e.clientY - sy, th = Math.max(16, R.T * 0.6);
  if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
  game.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy < 0 ? 0 : 2));
  sx = e.clientX; sy = e.clientY; moved = true;
});
const up = e => { if (sid === e.pointerId) { if (!moved && mode === 'play') game.tap(); sid = null; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  audio();
  if (mode !== 'play') { if ((e.code === 'Enter' || e.code === 'Space') && $('go')) { e.preventDefault(); start(); } return; }
  if (game.menu) { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code), b = ov.querySelectorAll('.card')[i]; if (b) b.click(); else if (e.code === 'Escape' && $('lv')) $('lv').click(); return; }
  if (e.code in KEYS) { e.preventDefault(); game.swipe(KEYS[e.code]); } else if (e.code === 'Space') { e.preventDefault(); game.tap(); }
});
window.addEventListener('resize', () => R.resize());

/* ---- 루프 ---- */
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  if (mode === 'play') for (let i = 0; i < 3; i++) game.update(dt / 3);
  R.draw(game, dt); hud();
  requestAnimationFrame(frame);
}
game = new Game(1, {}); window.__g = game;
title();
requestAnimationFrame(frame);
