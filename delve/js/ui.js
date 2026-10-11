import { Game, josa, TMNAME } from './game.js';
import { RACES, CLASSES, MONSTERS, KINDS, SPELLS, SHOPS, SLOTS, FLAVORS, MAXDEPTH } from './data.js';
import { T, F, DIRS, walk } from './map.js';

const $ = id => document.getElementById(id), KEY = 'delve_save_v1', HALL = 'delve_hall_v1';
const cv = $('cv'), g2 = cv.getContext('2d'), mini = $('mini'), mg = mini.getContext('2d');
let G = null, cell = 20, camX = 0, camY = 0, anims = [], sheet = null, look = null, lastSpell = 'missile', frameN = 0, zoomAdj = 0;
const FL_COL = ['#7ad0ff', '#ff6a6a', '#7ad67a', '#ffd23f', '#7a7a9a', '#ff8fd0', '#b08050', '#e8e8ff', '#c06bff', '#ff9a3a', '#d8d8e8', '#8fe0c0', '#fff4d8', '#5ad1c0', '#c04a4a', '#aab', '#ffe9a0', '#999'];
const LOGC = { y: '#ffd23f', r: '#ff6a6a', g: '#8fe08f', b: '#8fc7ff', o: '#ffb36b', v: '#d09bff', d: '#8a8fb0', '': '#e6e8f5' };

/* ---------- 저장 ---------- */
function save() { if (!G) return; try { if (G.dead) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(G.toJSON())); } catch (e) {} }
function loadSave() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function hall() { try { return JSON.parse(localStorage.getItem(HALL)) || []; } catch (e) { return []; } }
function record() { const p = G.p, h = hall(); h.push({ n: p.name, r: RACES[p.race].name, c: CLASSES[p.cls].name, lv: p.lv, d: G.maxDepth, t: G.pturn, cause: G.won && !G.dead ? '승리' : G.cause, won: G.won }); h.sort((a, b) => (b.won - a.won) || b.d - a.d || b.lv - a.lv); try { localStorage.setItem(HALL, JSON.stringify(h.slice(0, 10))); } catch (e) {} }
function bind(g) { G = g; G.onSave = save; window.__G = G; anims = []; look = null; snapCam(); resize(); }

/* ---------- 그리기 ---------- */
function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv._d = d; cv._w = w; cv._h = h;
  cell = Math.max(13, Math.min(32, Math.floor(w / 21) + zoomAdj * 3));
}
function snapCam() { if (G) { camX = G.p.x; camY = G.p.y; } }
function itemColor(o) { if (o.gold) return '#ffd23f'; const k = KINDS[o.it.k]; if (o.it.a) return '#ffe14a'; if (FLAVORS[k.tv]) { const i = FLAVORS[k.tv].indexOf(G.flav[k.id]); return FL_COL[(i + k.tv.length * 3) % FL_COL.length]; } return o.it.e ? '#8fd0ff' : k.c; }
function draw(dt) {
  const d = cv._d || 1, W = cv._w, H = cv._h; if (!G || !W) return; const m = G.map, p = G.p, t = m.t, f = m.f, c = cell;
  camX += (p.x - camX) * Math.min(1, dt * 12); camY += (p.y - camY) * Math.min(1, dt * 12);
  const ox = Math.round(W / 2 - (camX + 0.5) * c), oy = Math.round(H / 2 - (camY + 0.5) * c);
  g2.setTransform(d, 0, 0, d, 0, 0); g2.fillStyle = '#07070c'; g2.fillRect(0, 0, W, H);
  const x0 = Math.max(0, Math.floor(-ox / c)), x1 = Math.min(m.w - 1, Math.ceil((W - ox) / c)), y0 = Math.max(0, Math.floor(-oy / c)), y1 = Math.min(m.h - 1, Math.ceil((H - oy) / c));
  g2.textAlign = 'center'; g2.textBaseline = 'middle'; const font = (k, b) => `${b ? 800 : 600} ${Math.round(c * k)}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`;
  g2.font = font(0.8);
  const lr2 = (p.d.light + 0.5) ** 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * m.w + x; if (!(f[k] & F.KNOWN)) continue;
    const tt = t[k], seen = G.seen[k], px = ox + x * c, py = oy + y * c, cx = px + c / 2, cy = py + c / 2;
    const near = seen && (x - p.x) ** 2 + (y - p.y) ** 2 <= lr2 && !m.town;
    g2.globalAlpha = seen ? 1 : 0.42;
    if (tt === T.WALL || tt === T.PERM) { g2.fillStyle = tt === T.PERM ? (m.town ? '#5a4a3a' : '#4d4d72') : near ? '#8a8272' : '#6b6b80'; g2.fillRect(px, py, c, c); g2.fillStyle = 'rgba(255,255,255,.10)'; g2.fillRect(px, py, c, Math.max(1, c * 0.14)); g2.fillStyle = 'rgba(0,0,0,.22)'; g2.fillRect(px, py + c - Math.max(1, c * 0.12), c, Math.max(1, c * 0.12)); }
    else {
      g2.fillStyle = tt === T.GRASS || tt === T.TREE ? '#12200f' : near ? '#2b2619' : seen ? '#222236' : '#14141e'; g2.fillRect(px, py, c, c);
      if (tt === T.FLOOR) { g2.fillStyle = near ? '#7d7052' : seen ? '#56567c' : '#34344a'; g2.fillRect(cx - 1, cy - 1, 2, 2); }
      else if (tt === T.GRASS) { g2.fillStyle = '#2f5a2a'; g2.fillRect(cx - 1 + ((x * 7 + y * 3) % 5) - 2, cy - 1 + ((x * 3 + y * 5) % 5) - 2, 2, 2); }
      else if (tt === T.TREE) { g2.fillStyle = '#4fae4f'; g2.fillText('♣', cx, cy); }
      else if (tt === T.DOOR) { g2.fillStyle = '#8a5a2a'; g2.fillRect(px + 1, py + 1, c - 2, c - 2); g2.fillStyle = '#e8c48a'; g2.fillText('+', cx, cy); }
      else if (tt === T.OPEN) { g2.fillStyle = '#b07a3a'; g2.fillText("'", cx, cy); }
      else if (tt === T.DOWN || tt === T.UP) { g2.fillStyle = tt === T.DOWN ? '#123a4a' : '#1f3a1f'; g2.fillRect(px + 1, py + 1, c - 2, c - 2); g2.strokeStyle = tt === T.DOWN ? '#5ad1ff' : '#8fe08f'; g2.lineWidth = 1.5; g2.strokeRect(px + 1.5, py + 1.5, c - 3, c - 3); g2.fillStyle = tt === T.DOWN ? '#bff0ff' : '#d0ffd0'; g2.font = font(0.85, 1); g2.fillText(tt === T.DOWN ? '>' : '<', cx, cy); g2.font = font(0.8); }
      else if (tt === T.RUBBLE) { g2.fillStyle = '#8a8a8a'; g2.fillText(':', cx, cy); }
      else if (tt === T.TRAP) { g2.fillStyle = '#ff5a5a'; g2.fillText('^', cx, cy); }
      else if (tt >= T.SHOP) { const s = SHOPS[tt - T.SHOP]; g2.fillStyle = '#2a2418'; g2.fillRect(px, py, c, c); g2.fillStyle = s.c; g2.font = font(0.9, 1); g2.fillText(String(tt - T.SHOP + 1), cx, cy); g2.font = font(0.8); }
    }
  }
  g2.globalAlpha = 1;
  if (m.town) { g2.font = `700 ${Math.max(10, Math.round(c * 0.62))}px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`; for (let k = 0; k < t.length; k++) if (t[k] >= T.SHOP) { const s = SHOPS[t[k] - T.SHOP], x = k % m.w, y = (k / m.w) | 0, up = t[k - m.w] === T.PERM; g2.fillStyle = s.c; g2.fillText(s.name, ox + (x + 0.5) * c, oy + (y + (up ? -2 : 3)) * c); } }
  g2.font = font(0.82, 1);
  for (const o of G.items) { if (!o.seen) continue; const k = o.y * m.w + o.x; if (!(f[k] & F.KNOWN)) continue; g2.globalAlpha = G.seen[k] ? 1 : 0.5; g2.fillStyle = itemColor(o); g2.fillText(o.gold ? '$' : KINDS[o.it.k].g, ox + (o.x + 0.5) * c, oy + (o.y + 0.5) * c); }
  g2.globalAlpha = 1;
  for (const mo of G.mons) {
    if (mo.dead || !mo.vis) continue; const r = MONSTERS[mo.r], cx = ox + (mo.x + 0.5) * c, cy = oy + (mo.y + 0.5) * c;
    g2.globalAlpha = mo.direct ? 1 : 0.6; g2.fillStyle = '#0c0c14'; g2.beginPath(); g2.arc(cx, cy, c * 0.48, 0, 7); g2.fill();
    if (r.F.has('unique')) { g2.strokeStyle = '#ffd23f'; g2.lineWidth = 1.5; g2.beginPath(); g2.arc(cx, cy, c * 0.47, 0, 7); g2.stroke(); }
    g2.fillStyle = r.c; g2.fillText(r.g, cx, cy + 0.5);
    if (mo.sleep > 0) { g2.fillStyle = '#9ab'; g2.font = font(0.4, 1); g2.fillText('z', cx + c * 0.36, cy - c * 0.34); g2.font = font(0.82, 1); }
    if (mo.hp < mo.mhp) { g2.fillStyle = '#300'; g2.fillRect(cx - c * 0.4, cy + c * 0.4, c * 0.8, 2.5); g2.fillStyle = mo.hp > mo.mhp * 0.5 ? '#7ad67a' : mo.hp > mo.mhp * 0.25 ? '#ffd23f' : '#ff5a5a'; g2.fillRect(cx - c * 0.4, cy + c * 0.4, c * 0.8 * Math.max(0, mo.hp / mo.mhp), 2.5); }
    if (p.target === mo.id) { g2.strokeStyle = '#ff5a5a'; g2.lineWidth = 2; const a = c * 0.5, b = c * 0.2; g2.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g2.moveTo(cx + sx * a, cy + sy * (a - b)); g2.lineTo(cx + sx * a, cy + sy * a); g2.lineTo(cx + sx * (a - b), cy + sy * a); } g2.stroke(); }
  }
  g2.globalAlpha = 1;
  { const cx = ox + (p.x + 0.5) * c, cy = oy + (p.y + 0.5) * c; g2.fillStyle = '#0c0c14'; g2.beginPath(); g2.arc(cx, cy, c * 0.48, 0, 7); g2.fill(); g2.shadowColor = '#fff'; g2.shadowBlur = 8; g2.fillStyle = G.dead ? '#888' : p.hp < p.d.mhp * 0.3 ? '#ff6a6a' : '#fff'; g2.font = font(0.9, 1); g2.fillText('@', cx, cy + 0.5); g2.shadowBlur = 0; }
  if (look && look.k >= 0) { const x = look.k % m.w, y = (look.k / m.w) | 0; g2.strokeStyle = '#ffd23f'; g2.lineWidth = 1.5; g2.setLineDash([3, 3]); g2.strokeRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2); g2.setLineDash([]); }
  // 효과
  for (const e of G.fx) anims.push({ ...e, a: 0 }); G.fx.length = 0;
  for (let i = anims.length - 1; i >= 0; i--) {
    const e = anims[i]; e.a += dt;
    if (e.t === 'bolt') { const n = e.cells.length, dur = Math.min(0.22, 0.03 * n + 0.06), q = Math.min(n - 1, Math.floor(e.a / dur * n)); g2.fillStyle = e.c; g2.font = font(0.9, 1); for (let j = Math.max(0, q - 2); j <= q; j++) { const [x, y] = e.cells[j] || []; if (x === undefined) continue; g2.globalAlpha = 0.4 + 0.6 * (j - q + 3) / 3; g2.fillText('*', ox + (x + 0.5) * c, oy + (y + 0.5) * c); } g2.globalAlpha = 1; if (e.a >= dur) anims.splice(i, 1); }
    else if (e.t === 'ball') { const dur = 0.32, q = e.a / dur; if (q < 0) continue; g2.globalAlpha = 0.55 * (1 - q); g2.fillStyle = e.c; g2.beginPath(); g2.arc(ox + (e.x + 0.5) * c, oy + (e.y + 0.5) * c, (e.r + 0.5) * c * (0.3 + 0.7 * q), 0, 7); g2.fill(); g2.globalAlpha = 1; if (e.a >= dur) anims.splice(i, 1); }
    else { const dur = 0.7; g2.globalAlpha = Math.min(1, (dur - e.a) * 3); g2.font = `800 ${Math.round(c * 0.62)}px system-ui,sans-serif`; g2.lineWidth = 3; g2.strokeStyle = '#000'; const x = ox + (e.x + 0.5) * c, y = oy + (e.y - 0.1) * c - e.a * c * 1.1; g2.strokeText(e.s, x, y); g2.fillStyle = e.c; g2.fillText(e.s, x, y); g2.globalAlpha = 1; if (e.a >= dur) anims.splice(i, 1); }
  }
  if (anims.length > 60) anims.splice(0, anims.length - 60);
  if (frameN % 12 === 0) drawMini();
}
function drawMini() {
  const m = G.map, s = 2; if (mini.width !== m.w * s) { mini.width = m.w * s; mini.height = m.h * s; }
  mg.fillStyle = '#000'; mg.fillRect(0, 0, mini.width, mini.height);
  for (let k = 0; k < m.t.length; k++) { if (!(m.f[k] & F.KNOWN)) continue; const tt = m.t[k]; mg.fillStyle = tt === T.WALL || tt === T.PERM ? '#3a3a52' : tt === T.DOWN ? '#5ad1ff' : tt === T.UP ? '#8fe08f' : tt === T.DOOR || tt === T.OPEN ? '#b07a3a' : tt >= T.SHOP ? '#ffd23f' : '#77779a'; mg.fillRect((k % m.w) * s, ((k / m.w) | 0) * s, s, s); }
  for (const mo of G.mons) if (mo.vis && !mo.dead) { mg.fillStyle = '#ff5a5a'; mg.fillRect(mo.x * s, mo.y * s, s, s); }
  mg.fillStyle = '#fff'; mg.fillRect(G.p.x * s - 1, G.p.y * s - 1, s + 2, s + 2);
}

/* ---------- HUD ---------- */
let hudC = '', logC = '', barC = '';
function hud() {
  const p = G.p, d = p.d, need = G.need(p.lv), prev = p.lv > 1 ? G.need(p.lv - 1) : 0;
  const tm = Object.keys(p.tm).filter(k => p.tm[k] > 0 && TMNAME[k]).map(k => `<i class="${['fast', 'hero', 'bers', 'bless', 'oppFire', 'oppCold', 'seeInv'].includes(k) ? 'good' : 'bad'}">${TMNAME[k]}</i>`).join('');
  const hungry = p.food < 1000 ? '<i class="bad">굶주림</i>' : p.food < 2000 ? '<i class="warn">배고픔</i>' : '';
  const html = `<div class="l1"><b>${p.name}</b><span>Lv ${p.lv} ${RACES[p.race].name} ${CLASSES[p.cls].name}</span><span class="dp">${G.depth ? '지하 ' + G.depth + '층' : '마을'}</span><span class="gd">$ ${p.gold}</span></div>
  <div class="bars"><div class="bar hp ${p.hp < d.mhp * 0.3 ? 'low' : ''}"><i style="width:${Math.max(0, 100 * p.hp / d.mhp)}%"></i><em>HP ${Math.max(0, p.hp)}/${d.mhp}</em></div>${d.mmp ? `<div class="bar mp"><i style="width:${100 * p.mp / d.mmp}%"></i><em>MP ${p.mp}/${d.mmp}</em></div>` : ''}<div class="bar xp"><i style="width:${Math.min(100, 100 * (p.exp - prev) / Math.max(1, need - prev))}%"></i><em>AC ${d.ac} · 속도 ${d.speed >= 0 ? '+' : ''}${d.speed}</em></div></div>
  <div class="tm">${tm}${hungry}${G.recall ? '<i class="good">귀환 대기</i>' : ''}${G.deep ? '<i class="good">하강 대기</i>' : ''}${G.won ? '<i class="good">승리</i>' : ''}</div>`;
  if (html !== hudC) { hudC = html; $('hud').innerHTML = html; }
  const ls = G.log.slice(-5), lk = G.log.length + ':' + (ls.length ? ls[ls.length - 1].s + (ls[ls.length - 1].n || '') : '');
  if (lk !== logC) { logC = lk; $('log').innerHTML = ls.map((l, i) => `<div style="color:${LOGC[l.c] || LOGC['']};opacity:${0.45 + 0.55 * (i + 1) / ls.length}">${l.s}${l.n > 1 ? ` <small>x${l.n}</small>` : ''}</div>`).join(''); }
  const here = G.map.t[G.I(p.x, p.y)], hasItem = G.items.some(o => o.x === p.x && o.y === p.y), bow = p.eq.bow && p.inv.some(i => KINDS[i.k].tv === 'ammo' && KINDS[i.k].ammo === KINDS[p.eq.bow.k].ammo), flask = p.inv.some(i => KINDS[i.k].id === 'flask');
  const find = ids => { for (const id of ids) { const i = p.inv.findIndex(x => KINDS[x.k].id === id && G.known[id]); if (i >= 0) return [i, p.inv[i]]; } return null; };
  const q1 = find(['p_csw', 'p_clw', 'p_heal']), q2 = find(['s_phase']), q3 = find(['s_recall']);
  const bar = [here === T.DOWN ? 'down' : here === T.UP ? 'up' : hasItem ? 'get' : 'wait', bow ? 'fire' : flask ? 'throw' : '', p.cls === 'mage' ? lastSpell : '', q1 && q1[0] + ':' + q1[1].n, q2 && q2[0] + ':' + q2[1].n, q3 && q3[0] + ':' + q3[1].n, G.dead, G.auto === 'rest'].join('|');
  if (bar !== barC) { barC = bar;
    const sp = SPELLS.find(s => s.id === lastSpell);
    $('quick').innerHTML = (q1 ? `<button data-a="use" data-i="${q1[0]}" class="q heal">! ${KINDS[q1[1].k].name} <small>${q1[1].n}</small></button>` : '') + (q2 ? `<button data-a="use" data-i="${q2[0]}" class="q">? 순간이동 <small>${q2[1].n}</small></button>` : '') + (q3 ? `<button data-a="use" data-i="${q3[0]}" class="q">? 귀환 <small>${q3[1].n}</small></button>` : '');
    $('bar').innerHTML = `<button data-a="explore"><b>⌕</b>탐험</button>
    ${p.cls === 'mage' ? `<button data-a="recast" title="${sp ? sp.name : ''}"><b>✦</b>재시전</button><button data-a="spells"><b>☰</b>주문</button>` : ''}
    ${bow ? '<button data-a="fire"><b>➶</b>사격</button>' : flask ? '<button data-a="throw"><b>◍</b>던지기</button>' : ''}
    <button data-a="ctx" class="${here === T.DOWN || here === T.UP ? 'hot' : ''}"><b>${here === T.DOWN ? '>' : here === T.UP ? '<' : hasItem ? ',' : '·'}</b>${here === T.DOWN ? '내려감' : here === T.UP ? '올라감' : hasItem ? '줍기' : '대기'}</button>
    <button data-a="rest"><b>z</b>휴식</button><button data-a="inv"><b>▤</b>가방</button><button data-a="more"><b>⋯</b>더보기</button>`; }
}

/* ---------- 시트 ---------- */
function openSheet(html, cls) { sheet = cls || 'x'; $('sheet').innerHTML = `<div class="sh ${cls || ''}">${html}</div>`; $('sheet').classList.add('on'); }
function closeSheet() { sheet = null; $('sheet').classList.remove('on'); $('sheet').innerHTML = ''; if (G && G.shop >= 0) G.shop = -1; }
const head = (t, extra = '') => `<div class="shh"><b>${t}</b>${extra}<button data-a="close" class="x">✕</button></div>`;
const verb = tv => ({ potion: '마시기', scroll: '읽기', wand: '겨누기', rod: '사용', food: '먹기', flask: '던지기' })[tv] || '장착';
function itemRow(it, i, mode, open) {
  const k = KINDS[it.k], col = itemColor({ it }), desc = G.describe(it);
  const acts = mode === 'sell' ? `<button data-a="sell" data-i="${i}" class="pri">팔기 $${G.sellPrice(it) * (k.tv === 'ammo' ? it.n : 1)}</button>` : mode === 'eq' ? `<button data-a="takeoff" data-s="${i}" class="pri">벗기</button>` : `${k.tv === 'book' || k.tv === 'ammo' ? '' : `<button data-a="use" data-i="${i}" class="pri">${verb(k.tv)}</button>`}<button data-a="drop" data-i="${i}">버리기</button>`;
  return `<div class="it ${open ? 'open' : ''}" data-a="pick" data-i="${i}" data-m="${mode}"><span class="gl" style="color:${col}">${k.g}</span><span class="nm">${G.name(it)}${mode === 'eq' ? `<small>${SLOTS.find(s => s[0] === i)[1]}</small>` : ''}</span>${open ? `<div class="ds">${desc.map(s => `<p>${s}</p>`).join('') || '<p>특별한 점은 없다.</p>'}<div class="acts">${acts}</div></div>` : ''}</div>`;
}
let invTab = 'inv', invOpen = -1;
function showInv() {
  const p = G.p, shop = G.shop >= 0 && G.depth === 0;
  const tabs = `<div class="tabs"><button data-a="tab" data-t="inv" class="${invTab === 'inv' ? 'on' : ''}">가방 ${p.inv.length}/22</button><button data-a="tab" data-t="eq" class="${invTab === 'eq' ? 'on' : ''}">장비</button></div>`;
  const body = invTab === 'inv' ? (p.inv.map((it, i) => itemRow(it, i, 'inv', invOpen === i)).join('') || '<p class="dim">가방이 비었다.</p>') : SLOTS.map(([s, n]) => p.eq[s] ? itemRow(p.eq[s], s, 'eq', invOpen === s) : `<div class="it empty"><span class="gl">·</span><span class="nm dim">${n} — 없음</span></div>`).join('');
  openSheet(head('소지품') + tabs + `<div class="list">${body}</div>`, 'inv');
}
let shopTab = 'buy';
function showShop() {
  const si = G.shop, s = SHOPS[si], p = G.p, st = G.shops[si];
  const tabs = `<div class="tabs"><button data-a="stab" data-t="buy" class="${shopTab === 'buy' ? 'on' : ''}">사기</button><button data-a="stab" data-t="sell" class="${shopTab === 'sell' ? 'on' : ''}">팔기</button></div>`;
  const body = shopTab === 'buy' ? (st.map((e, i) => { const k = KINDS[e.it.k], pr = G.price(e), q = k.tv === 'ammo' ? Math.min(20, e.it.n) : 1, cost = pr * (k.tv === 'ammo' ? q : 1); const open = invOpen === 'b' + i;
    return `<div class="it ${open ? 'open' : ''}" data-a="bpick" data-i="${i}"><span class="gl" style="color:${itemColor(e)}">${k.g}</span><span class="nm">${G.name(e.it)}</span><button data-a="buy" data-i="${i}" class="pr ${p.gold < cost ? 'no' : ''}">$${cost}${q > 1 ? `<small>${q}개</small>` : ''}</button>${open ? `<div class="ds">${(() => { const kn = G.known[k.id]; G.known[k.id] = 1; const dd = G.describe(e.it); if (!kn) delete G.known[k.id]; return dd.map(x => `<p>${x}</p>`).join('') || '<p>특별한 점은 없다.</p>'; })()}</div>` : ''}</div>`; }).join('') || '<p class="dim">물건이 다 팔렸다.</p>')
    : (p.inv.map((it, i) => itemRow(it, i, 'sell', invOpen === i)).join('') || '<p class="dim">팔 것이 없다.</p>');
  openSheet(head(`${si + 1}. ${s.name}`, `<span class="gd">$ ${p.gold}</span>`) + tabs + `<div class="list">${body}</div>`, 'shop');
}
function showSpells() {
  const p = G.p, ks = G.spellsKnown();
  const rows = SPELLS.map(s => { const has = ks.includes(s), ok = has && p.lv >= s.lv; return `<div class="it sp ${ok ? '' : 'dis'}" ${ok ? `data-a="cast" data-id="${s.id}"` : ''}><span class="gl" style="color:#c9a8ff">✦</span><span class="nm">${s.name}<small>${!has ? '마법서 없음' : p.lv < s.lv ? `Lv ${s.lv} 필요` : `MP ${s.mp} · 실패 ${G.spellFail(s)}%`} · ${s.desc}</small></span></div>`; }).join('');
  openSheet(head('주문', `<span class="gd" style="color:#8fc7ff">MP ${p.mp}/${p.d.mmp}</span>`) + `<div class="list">${rows}</div>`, 'spells');
}
function showChar() {
  const p = G.p, d = p.d, fl = d.fl, need = G.need(p.lv), FLN = { rFire: '화염 저항', rCold: '냉기 저항', rPois: '독 저항', freeAct: '자유 행동', seeInv: '투명 감지', regen: '재생', telepathy: '텔레파시', pConf: '혼란 면역', pBlind: '실명 면역' };
  const bow = p.eq.bow;
  openSheet(head(p.name) + `<div class="list char"><p>${RACES[p.race].name} ${CLASSES[p.cls].name} · 레벨 ${p.lv} · 경험치 ${Math.floor(p.exp)} / ${need}</p>
  <div class="grid4"><span>힘<b>${d.str}</b></span><span>지능<b>${d.int}</b></span><span>민첩<b>${d.dex}</b></span><span>체질<b>${d.con}</b></span></div>
  <div class="grid4"><span>방어<b>${d.ac}</b></span><span>속도<b>${d.speed >= 0 ? '+' : ''}${d.speed}</b></span><span>은밀<b>${d.stealth}</b></span><span>광원<b>${d.light}</b></span></div>
  <p>근접: ${d.blows}회 × ${d.dd}d${d.ds}${d.td + d.wtd >= 0 ? '+' : ''}${d.td + d.wtd} (명중 ${d.th + d.wth >= 0 ? '+' : ''}${d.th + d.wth})${bow ? `<br>사격: 턴당 ${d.shots.toFixed(2)}발, 배율 x${KINDS[bow.k].mult}` : ''}</p>
  <p>저항·능력: ${Object.keys(fl).filter(k => FLN[k]).map(k => FLN[k]).join(', ') || '없음'}</p>
  <p class="dim">최대 도달 ${G.maxDepth}층 · ${G.pturn}턴 · 처치 ${G.kills} · 포만감 ${Math.round(p.food / 150)}%</p></div>`, 'char');
}
function showMore() {
  openSheet(head('더보기') + `<div class="list menu"><button data-a="char">캐릭터 정보</button><button data-a="logs">기록 보기</button><button data-a="tostairs">가까운 내려가는 계단으로 이동</button><button data-a="zoom" data-d="1">지도 확대</button><button data-a="zoom" data-d="-1">지도 축소</button><button data-a="help">도움말</button><button data-a="title">저장하고 처음 화면으로</button></div>`, 'more');
}
function showLogs() { openSheet(head('기록') + `<div class="list logs">${G.log.slice().reverse().map(l => `<p style="color:${LOGC[l.c] || LOGC['']}">${l.s}${l.n > 1 ? ` x${l.n}` : ''}</p>`).join('')}</div>`, 'logs'); }
function showHelp() {
  openSheet(head('도움말') + `<div class="list help"><p><b>목표</b> 마을에서 준비하고 구덩이를 내려가 ${MAXDEPTH}층의 어둠의 군주를 쓰러뜨린다. 20층의 부관을 먼저 잡아야 그 아래로 갈 수 있다. 죽으면 끝이다.</p>
  <p><b>이동</b> 지도에서 옆 칸을 누르면 한 칸 이동(적이면 공격), 먼 칸을 누르면 그곳까지 이동, 화면을 밀면 그 방향으로 한 걸음. 키보드는 방향키·숫자패드·hjklyubn.</p>
  <p><b>살펴보기</b> 괴물을 누르면 정보가 뜨고 대상으로 지정된다. 사격·주문·마법봉은 지정한 대상(없으면 가장 가까운 적)에게 나간다.</p>
  <p><b>탐험</b> 버튼은 안 가본 곳과 떨어진 물건을 알아서 찾아간다. 괴물이 보이면 멈춘다.</p>
  <p><b>층은 매번 새로 생긴다.</b> 계단을 타면 이전 층으로 돌아갈 수 없다. 내려온 계단 위에서 시작하므로 위험하면 바로 다시 계단을 탈 수 있다.</p>
  <p><b>미감정</b> 물약·두루마리·마법봉·반지는 써 봐야 정체를 안다. 상점 물건은 사는 순간 알게 된다.</p>
  <p><b>귀환의 두루마리</b> 읽고 조금 기다리면 던전에선 마을로, 마을에선 가장 깊이 갔던 층으로 간다. 하나는 꼭 들고 다닐 것.</p>
  <p><b>속도</b> +10이면 남들이 한 번 움직일 때 두 번 움직인다. 깊은 곳에선 속도와 원소 저항(화염·냉기·독)이 생존을 가른다. 용의 숨결은 저항 없이는 한 방이다.</p>
  <p><b>키</b> x 탐험 · f 사격 · m 주문 · i 가방 · g 줍기 · &lt; &gt; 계단 · R 휴식 · . 대기 · Tab 대상 바꾸기 · c 캐릭터 · _ 계단으로</p></div>`, 'help');
}
function showLook(k) {
  const m = G.map, x = k % m.w, y = (k / m.w) | 0, mo = G.monAt(x, y), out = [];
  if (mo && mo.vis) { out.push(...G.describeMon(mo)); if (mo.direct) G.p.target = mo.id; }
  for (const o of G.items) if (o.x === x && o.y === y && o.seen) out.push(o.gold ? `금화 ${o.gold}닢` : G.name(o.it));
  if (!out.length) { const tt = m.t[k]; out.push(tt === T.DOWN ? '내려가는 계단' : tt === T.UP ? '올라가는 계단' : tt === T.TRAP ? '함정' : tt === T.DOOR ? '닫힌 문' : tt >= T.SHOP ? SHOPS[tt - T.SHOP].name : ''); }
  look = out.filter(Boolean).length ? { k, html: out.filter(Boolean).map((s, i) => `<p class="${i ? '' : 'h'}">${s}</p>`).join('') } : null;
  $('look').innerHTML = look ? look.html : ''; $('look').classList.toggle('on', !!look);
}
function hideLook() { look = null; $('look').classList.remove('on'); }

/* ---------- 타이틀 / 생성 / 사망 ---------- */
let pick = { race: 'human', cls: 'warrior' };
function title() {
  const sv = loadSave(), h = hall(); G = null; $('game').classList.remove('on'); closeSheet();
  $('title').innerHTML = `<div class="tw"><h1>구덩이</h1><p class="sub">D E L V E</p><p class="tag">마을에서 채비하고, 서른 층 아래 어둠의 군주에게.</p>
  ${sv ? `<button class="big pri" data-a="resume">이어하기<small>${sv.p.name} · Lv ${sv.p.lv} ${RACES[sv.p.race].name} ${CLASSES[sv.p.cls].name} · ${sv.depth ? '지하 ' + sv.depth + '층' : '마을'}</small></button>` : ''}
  <button class="big ${sv ? '' : 'pri'}" data-a="new">새 모험</button>
  ${h.length ? `<div class="hall"><b>명예의 전당</b>${h.map(e => `<p>${e.won ? '👑 ' : ''}${e.n} — Lv ${e.lv} ${e.r} ${e.c}, ${e.d}층<small>${e.cause}</small></p>`).join('')}</div>` : ''}</div>`;
  $('title').classList.add('on');
}
function creator() {
  const rc = RACES[pick.race], cl = CLASSES[pick.cls], st = s => 12 + rc[s] + cl[s];
  $('title').innerHTML = `<div class="tw cr"><h2>새 모험</h2><input id="nm" maxlength="12" placeholder="이름" value="${pick.name || ''}">
  <h4>종족</h4><div class="opts">${Object.entries(RACES).map(([k, r]) => `<button data-a="race" data-k="${k}" class="${pick.race === k ? 'on' : ''}">${r.name}</button>`).join('')}</div><p class="dim">${rc.desc} (경험치 ${rc.expf}%)</p>
  <h4>직업</h4><div class="opts">${Object.entries(CLASSES).map(([k, c]) => `<button data-a="cls" data-k="${k}" class="${pick.cls === k ? 'on' : ''}">${c.name}</button>`).join('')}</div><p class="dim">${cl.desc}</p>
  <div class="grid4"><span>힘<b>${st('str')}</b></span><span>지능<b>${st('int')}</b></span><span>민첩<b>${st('dex')}</b></span><span>체질<b>${st('con')}</b></span></div>
  <button class="big pri" data-a="begin">내려가기</button><button class="big" data-a="back">뒤로</button></div>`;
}
function startGame(g) { bind(g); $('title').classList.remove('on'); $('game').classList.add('on'); hudC = logC = barC = ''; requestAnimationFrame(() => { resize(); snapCam(); }); save(); }
function showDeath() {
  const p = G.p; record(); save();
  openSheet(`<div class="death"><div class="tomb">R.I.P.</div><h2>${p.name}</h2><p>Lv ${p.lv} ${RACES[p.race].name} ${CLASSES[p.cls].name}</p><p class="cause">${G.depth ? '지하 ' + G.depth + '층' : '마을'}에서 ${josa(G.cause, '으로/로')} 쓰러졌다</p><p class="dim">최대 ${G.maxDepth}층 · ${G.pturn}턴 · 처치 ${G.kills}</p><button class="big pri" data-a="title2">처음으로</button><button class="big" data-a="logs2">마지막 기록 보기</button></div>`, 'dead');
}

/* ---------- 행동 ---------- */
function after() { if (!G || G.dead) return; if (G.shop >= 0 && sheet !== 'shop' && !G.dead) { shopTab = 'buy'; invOpen = -1; showShop(); } if (G.won && !G.wonShown) { G.wonShown = 1; record(); } }
function act(fn) { if (!G || G.dead) return; hideLook(); G.auto = null; fn(); after(); }
const ACT = {
  explore() { act(() => { const n = G.log.length; G.start('explore'); if (!G.auto && G.log.slice(n).some(l => l.s.includes('더 탐험할'))) { const k = G.nearest(T.DOWN); if (k >= 0 && k !== G.I(G.p.x, G.p.y)) G.start('travel', k); } }); },
  rest() { act(() => G.start('rest')); }, fire() { act(() => G.fire()); },
  throw() { act(() => { const i = G.p.inv.findIndex(x => KINDS[x.k].id === 'flask'); if (i >= 0) G.use(i); }); },
  recast() { act(() => G.cast(lastSpell)); }, spells() { showSpells(); },
  cast(d) { lastSpell = d.id; closeSheet(); act(() => G.cast(d.id)); },
  ctx() { act(() => { const p = G.p, here = G.map.t[G.I(p.x, p.y)]; if (here === T.DOWN || here === T.UP) { G.stairs(); snapCam(); } else if (G.items.some(o => o.x === p.x && o.y === p.y)) G.pickup(); else G.wait(); }); },
  inv() { invTab = 'inv'; invOpen = -1; showInv(); }, tab(d) { invTab = d.t; invOpen = -1; showInv(); },
  pick(d) { const i = d.m === 'eq' ? d.i : +d.i; invOpen = invOpen === i ? -1 : i; d.m === 'sell' ? showShop() : showInv(); },
  use(d) { const i = +d.i; closeSheetKeepShop(); act(() => G.use(i)); },
  drop(d) { const i = +d.i; closeSheet(); act(() => G.drop(i)); }, takeoff(d) { closeSheet(); act(() => G.takeoff(d.s)); },
  stab(d) { shopTab = d.t; invOpen = -1; showShop(); }, bpick(d) { invOpen = invOpen === 'b' + d.i ? -1 : 'b' + d.i; showShop(); },
  buy(d) { G.buy(G.shop, +d.i); invOpen = -1; showShop(); }, sell(d) { G.sell(+d.i); invOpen = -1; showShop(); },
  more() { showMore(); }, char() { showChar(); }, logs() { showLogs(); }, help() { showHelp(); },
  tostairs() { closeSheet(); act(() => { const k = G.nearest(T.DOWN); if (k >= 0) G.start('travel', k); else G.msg('아는 내려가는 계단이 없다.'); }); },
  zoom(d) { zoomAdj = Math.max(-3, Math.min(4, zoomAdj + +d.d)); resize(); },
  close() { closeSheet(); }, title() { save(); title(); }, title2() { title(); }, logs2() { showLogs(); sheet = 'dead'; },
  resume() { const sv = loadSave(); if (sv) startGame(new Game({ load: sv })); }, new() { creator(); }, back() { title(); },
  race(d) { pick.name = $('nm').value; pick.race = d.k; creator(); }, cls(d) { pick.name = $('nm').value; pick.cls = d.k; creator(); },
  begin() { const name = ($('nm').value || '').trim() || ['아린', '도윤', '세라', '카엘', '루오', '하람'][Math.floor(Math.random() * 6)]; try { localStorage.removeItem(KEY); } catch (e) {} lastSpell = 'missile'; startGame(new Game({ name, race: pick.race, cls: pick.cls })); },
};
function closeSheetKeepShop() { sheet = null; $('sheet').classList.remove('on'); $('sheet').innerHTML = ''; if (G) G.shop = -1; }
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) { if (e.target === $('sheet') && sheet !== 'dead') closeSheet(); return; } e.stopPropagation(); const f = ACT[el.dataset.a]; if (f) f(el.dataset); });

function cellAt(cx, cy) { const r = cv.getBoundingClientRect(), W = cv._w, H = cv._h, ox = W / 2 - (camX + 0.5) * cell, oy = H / 2 - (camY + 0.5) * cell, x = Math.floor((cx - r.left - ox) / cell), y = Math.floor((cy - r.top - oy) / cell); return x < 0 || y < 0 || x >= G.map.w || y >= G.map.h ? -1 : y * G.map.w + x; }
function tapCell(k) {
  if (k < 0 || !G || G.dead) return; const m = G.map, p = G.p, x = k % m.w, y = (k / m.w) | 0, dx = x - p.x, dy = y - p.y, mo = G.monAt(x, y);
  if (G.auto) { G.auto = null; return; }
  if (dx === 0 && dy === 0) return ACT.ctx();
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return act(() => G.move(dx, dy));
  if (mo && mo.vis) return showLook(k);
  if (!(m.f[k] & F.KNOWN)) return;
  if (!walk(m.t[k]) && m.t[k] !== T.DOOR) return showLook(k);
  const hasInfo = G.items.some(o => o.x === x && o.y === y && o.seen);
  act(() => G.start('travel', k)); if (hasInfo) showLook(k);
}
let ps = null;
cv.addEventListener('pointerdown', e => { ps = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
cv.addEventListener('pointerup', e => {
  if (!ps || ps.id !== e.pointerId || !G) return; const dx = e.clientX - ps.x, dy = e.clientY - ps.y, dist = Math.hypot(dx, dy), long = performance.now() - ps.t > 450; const s = ps; ps = null;
  if (dist > 28) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(a + 8) % 8]; return act(() => G.move(D[0], D[1])); }
  const k = cellAt(s.x, s.y); if (long) { if (k >= 0 && (G.map.f[k] & F.KNOWN)) showLook(k); } else tapCell(k);
});
cv.addEventListener('contextmenu', e => { e.preventDefault(); const k = cellAt(e.clientX, e.clientY); if (G && k >= 0 && (G.map.f[k] & F.KNOWN)) showLook(k); });
mini.addEventListener('click', () => mini.classList.toggle('big'));
const KM = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1], Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1], Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1] };
window.addEventListener('keydown', e => {
  if (!G || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Escape') { if (sheet && sheet !== 'dead') closeSheet(); hideLook(); if (G) G.auto = null; return; }
  if (sheet) return;
  const mv = KM[e.code] || KM[e.key]; if (mv) { e.preventDefault(); return act(() => G.move(mv[0], mv[1])); }
  const K = { x: 'explore', z: 'explore', f: 'fire', v: 'throw', m: 'spells', i: 'inv', g: 'ctx', ',': 'ctx', '>': 'ctx', '<': 'ctx', Enter: 'ctx', R: 'rest', r: 'rest', c: 'char', '?': 'help', _: 'tostairs', a: 'recast' }[e.key];
  if (K) { e.preventDefault(); if (K === 'recast' && G.p.cls !== 'mage') return; return ACT[K]({}); }
  if (e.key === '.' || e.key === '5' || e.code === 'Numpad5' || e.key === 's' || e.key === ' ') { e.preventDefault(); return act(() => G.wait()); }
  if (e.key === 'Tab') { e.preventDefault(); const vs = G.mons.filter(o => o.direct && !o.dead); if (vs.length) { const i = vs.findIndex(o => o.id === G.p.target), n = vs[(i + 1) % vs.length]; showLook(G.I(n.x, n.y)); } }
});
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); }); window.addEventListener('pagehide', save);

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; frameN++;
  if (G && $('game').classList.contains('on')) {
    if (G.dead && !G._ds) { G._ds = 1; const g = G; setTimeout(() => { if (G === g) showDeath(); }, 650); }
    if (G.auto && !sheet) { for (let i = 0; i < (G.auto === 'rest' ? 4 : 2) && G.auto; i++) G.continue(); after(); }
    if (!cv._w || cv.clientWidth !== cv._w || cv.clientHeight !== cv._h) resize();
    draw(dt); hud();
  }
  requestAnimationFrame(frame);
}
title(); requestAnimationFrame(frame);
