// 보스 패턴, 마을 대화, 엔딩 — Game.prototype에 덧붙인다.
import { T, P, BLOCK, ZONES, MONSTERS, RELICS, RIDX, LORE, GHOSTS, BOSSTALK, ENDINGS, UPGRADES, FLOORS_PER_ZONE, floorName } from './data.js';
import { W, H, passT } from './gen.js';
import { traitOf } from './game.js';
const I = (x, y) => y * W + x;
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const split = s => { const i = s.indexOf(': '); return i > 0 && i < 12 ? { w: s.slice(0, i), t: s.slice(i + 2) } : { w: null, t: s }; };

export function install(G) {
  const P_ = G.prototype;
  P_.arenaTiles = function () { const f = this.f, a = f.arena, out = []; for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) { const k = I(x, y); if (f.t[k] === T.FLOOR && !BLOCK.has(f.p[k])) out.push([x, y]); } return out; };
  P_.randNear = function (n, r) { const pl = this.pl, c = this.arenaTiles().filter(([x, y]) => Math.abs(x - pl.x) + Math.abs(y - pl.y) <= r); this.R.shuffle(c); return c.slice(0, n); };
  P_.startBoss = function () {
    const f = this.f, Z = ZONES[f.zone], id = Z.boss; f.bossState = 'intro';
    const pages = BOSSTALK[id].pre.map(split);
    this.openDialog(pages, { after: () => {
      const a = f.arena, m = this.addMon(id, a.cx, a.y + 3, true); m.maxhp = m.hp = MONSTERS[id].hp; f.bossState = 'fight'; this.ev('boss', { id: m.id }); this.ev('shake', { p: 6 }); this.ev('sfx', { n: 'boss' });
      for (const d of a.doors) f.t[I(d.x, d.y)] = T.LOCKED;
      { const tl = this.arenaTiles().filter(([x, y]) => !this.monAt(x, y) && Math.abs(x - this.pl.x) + Math.abs(y - this.pl.y) > 3); this.R.shuffle(tl); tl.slice(0, 4).forEach(([x, y], i) => this.items.push({ id: ++this.uid, kind: i === 0 ? 'herb' : 'ember', x, y, v: 14 })); }
      this.relight(); this.say(`${MONSTERS[id].name}이(가) 눈을 떴다!`, 'bad'); this.updateView();
    } });
  };
  P_.bossAct = function (m) {
    const def = MONSTERS[m.type], pl = this.pl, f = this.f, d = man(m, pl); m.tick++; if (pl.x !== m.x) m.face = Math.sign(pl.x - m.x); if (f.bossState !== 'fight') return;
    const ratio = m.hp / m.maxhp, aligned = m.x === pl.x || m.y === pl.y, dir = [Math.sign(pl.x - m.x), Math.sign(pl.y - m.y)];
    const wind = (n = 1) => { m.winding = n; this.ev('wind', { id: m.id, dx: dir[0], dy: dir[1] }); };
    const blink = () => { const c = this.arenaTiles().filter(([x, y]) => Math.abs(x - pl.x) + Math.abs(y - pl.y) >= 5 && !this.monAt(x, y)); if (!c.length) return false; const [x, y] = this.R.pick(c); this.ev('blink', { id: m.id, from: [m.x, m.y], to: [x, y] }); m.x = x; m.y = y; return true; };
    const summon = (type, n) => { for (let i = 0; i < n; i++) { const c = this.nearFree(m.x, m.y, 3, new Set()); if (c) this.addHaz([[c.x, c.y]], 2, 0, 'summon', m.id, { summon: type }); } };
    const alignStep = () => { const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: m.x + dx, y: m.y + dy })).filter(q => this.canStand(m, q.x, q.y)); opts.sort((a, b) => Math.min(Math.abs(a.x - pl.x), Math.abs(a.y - pl.y)) - Math.min(Math.abs(b.x - pl.x), Math.abs(b.y - pl.y))); if (opts[0]) this.moveMon(m, opts[0].x, opts[0].y); };
    switch (m.type) {
      case 'otol':
        if (ratio < 0.5 && !m.s1) { m.s1 = 1; summon('rat', 2); this.say('오톨: 꺼라… 꺼라…!', 'bad'); }
        if (ratio < 0.3 && !m.ph2) { m.ph2 = 1; this.say('오톨이 분노로 몸을 떤다!', 'bad'); }
        if (m.tick % 5 === 0) { this.addHaz([...this.randNear(4, 3), [pl.x, pl.y]], 2, 3, 'rock', m.id); this.say('천장이 무너진다!', 'bad'); wind(1); return; }
        if (d <= 2 && (aligned || d === 1)) { this.addHaz(this.area(m.x, m.y, 1), 1, 4, 'slam', m.id); wind(1); return; }
        this.stepToward(m, pl.x, pl.y); return;
      case 'marga':
        if (ratio < 0.5 && m.tick % 10 === 0) { summon('drowned', 1); }
        if (m.tick % 7 === 0 && blink()) return;
        if (d < 3 && this.stepToward(m, pl.x, pl.y, true)) return;
        if (aligned && d >= 2 && d <= 9 && this.los(m.x, m.y, pl.x, pl.y)) { this.addHaz(this.lineTiles(m.x, m.y, dir[0], dir[1], 10), 1, 3, 'line', m.id); wind(1); return; }
        if (m.tick % 4 === 0) { this.addHaz(this.area(pl.x, pl.y, 1), 2, 2, 'water', m.id); wind(1); return; }
        alignStep(); return;
      case 'isil': {
        if (ratio < 0.5 && !m.ph2) { m.ph2 = 1; this.say('이실: 기록은… 틀리지 않아!', 'bad'); }
        const cyc = m.tick % 5, arena = this.arenaTiles();
        if (d < 2 && blink()) return;
        if (cyc === 0 || (m.ph2 && cyc === 2)) { this.addHaz(arena.filter(([x, y]) => y === pl.y), 2, 3, 'sweep', m.id); this.addHaz(arena.filter(([x, y]) => m.ph2 && x === pl.x), 2, 3, 'sweep', m.id); wind(1); return; }
        if (cyc === 1) { this.addHaz(arena.filter(([x]) => x === pl.x), 2, 3, 'sweep', m.id); wind(1); return; }
        if (cyc === 2) { this.addHaz(this.randNear(7, 5), 2, 3, 'sweep', m.id); this.say('쪽지가 흩날린다!', 'bad'); wind(1); return; }
        if (cyc === 3) { if (this.mons.filter(q => q.type === 'wraith' || q.type === 'scribe' || q.type === 'worm').length < 4) summon(this.R.chance(0.5) ? 'wraith' : 'worm', 2); wind(1); return; }
        blink(); return; }
      case 'borkai': {
        if (ratio < 0.5 && !m.s1) { m.s1 = 1; summon('imp', 2); this.say('보르카이: 불씨들아, 일어나라!', 'bad'); }
        const cyc = m.tick % 6;
        if (cyc === 0 || cyc === 3) {
          if (aligned) { const tiles = this.lineTiles(m.x, m.y, dir[0], dir[1], 16); this.addHaz(tiles, 2, 5, 'charge', m.id, { dir, stunEnd: true }); wind(2); this.say('보르카이가 몸을 낮춘다. 돌진이다!', 'bad'); } else alignStep();
          return; }
        if (cyc === 1) { this.addHaz(this.area(pl.x, pl.y, 1), 1, 4, 'slam', m.id); wind(1); return; }
        if (cyc === 2) { this.addHaz(this.randNear(6, 4), 2, 3, 'fire', m.id); wind(1); return; }
        if (d === 1) { this.addHaz(this.area(m.x, m.y, 1), 1, 4, 'slam', m.id); wind(1); return; }
        this.stepToward(m, pl.x, pl.y); return; }
      case 'hollow': {
        const arena = this.arenaTiles();
        if (ratio < 0.66 && !m.s1) { m.s1 = 1; this.say('첫 등불지기: 아프지 않니, 나의 아이?', 'bad'); }
        if (ratio < 0.33 && !m.s2) { m.s2 = 1; m.ph2 = 1; f.darkness = true; this.say('빛이 가라앉는다. 어둠이 아이처럼 웃는다.', 'bad'); this.ev('shake', { p: 7 }); }
        const cyc = m.tick % 4;
        if (ratio >= 0.66) {
          if (cyc === 0) { if (aligned && d >= 2 && this.los(m.x, m.y, pl.x, pl.y)) { this.addHaz(this.lineTiles(m.x, m.y, dir[0], dir[1], 12, true), 1, 3, 'pull', m.id); wind(1); } else alignStep(); return; }
          if (cyc === 1) { this.addHaz(this.area(pl.x, pl.y, 1), 1, 4, 'slam', m.id); wind(1); return; }
          if (cyc === 2) { this.stepToward(m, pl.x, pl.y); return; }
          this.addHaz(this.randNear(4, 5), 2, 3, 'void', m.id); wind(1); return;
        }
        if (ratio >= 0.33) {
          if (cyc === 0) { this.addHaz(this.randNear(8, 6), 2, 3, 'void', m.id); wind(1); return; }
          if (cyc === 1 && this.mons.filter(q => q.type === 'shade').length < 2) { summon('shade', 1); wind(1); return; }
          if (cyc === 2) { blink(); return; }
          if (aligned && d >= 2) { this.addHaz(this.lineTiles(m.x, m.y, dir[0], dir[1], 12, true), 1, 3, 'pull', m.id); wind(1); } else this.stepToward(m, pl.x, pl.y); return;
        }
        if (cyc === 0) { this.addHaz(arena.filter(([x, y]) => x === m.x || y === m.y), 2, 4, 'sweep', m.id); wind(1); return; }
        if (cyc === 1) { this.addHaz(arena.filter(([x, y]) => x === pl.x || y === pl.y), 2, 4, 'sweep', m.id); wind(1); return; }
        if (cyc === 2) { this.addHaz(this.randNear(6, 5), 2, 3, 'void', m.id); wind(1); return; }
        blink(); return; }
    }
  };
  P_.bossDown = function (m) {
    const f = this.f, z = f.zone, a = f.arena; f.bossState = 'dead'; f.darkness = false;
    for (const q of this.mons.slice()) { this.mons.splice(this.mons.indexOf(q), 1); this.ev('kill', { id: q.id, x: q.x, y: q.y, type: q.type }); } this.haz = [];
    for (const d of a.doors) f.t[I(d.x, d.y)] = T.DOOROPEN; f.t[I(f.exit.x, f.exit.y)] = T.WELL; f.p[I(f.exit.x, f.exit.y)] = 0; this.relight();
    this.meta.cleared = Math.max(this.meta.cleared, z + 1); this.saveMeta(); this.pl.hp = Math.min(this.pl.maxhp, this.pl.hp + Math.ceil(this.pl.maxhp * 0.5)); this.pl.flame = this.pl.maxflame;
    this.ev('shake', { p: 10 }); this.ev('bossdown', { x: m.x, y: m.y });
    const pages = BOSSTALK[m.type].post.map(split); const id = m.type;
    if (z === 4) { this.openDialog(pages.concat([{ w: null, t: '사슬의 끝이 눈앞에서 흔들린다. 불은 당신의 선택을 기다린다.' }]), { choices: [
      { t: '다시 사슬을 잇는다 — 마을이 따뜻해진다', fn: () => this.finishRun('chain') }, { t: '사슬을 끊는다 — 불이 자유로워진다', fn: () => this.finishRun('dawn') }, { t: '내가 불이 된다 — 등불지기의 마지막', fn: () => this.finishRun('ember') }] }); return; }
    const pool = RELICS.filter(r => !this.run.relics.includes(r.id)); this.R.shuffle(pool); const opts = pool.slice(0, 3);
    this.openDialog(pages.concat(opts.length ? [{ w: null, t: '쓰러진 자의 곁에 세 개의 유물이 놓여 있다. 하나를 가져갈 수 있다.' }] : []), { choices: opts.length ? opts.map(r => ({ t: `${r.name} — ${r.desc}`, fn: () => this.gainRelic(r.id) })) : null,
      after: () => { if (!opts.length) return; this.say('길이 열렸다. 우물이 솟아올랐다.', 'good'); } });
    this.say('길이 열렸다. 우물이 솟아올랐다.', 'good');
  };
  P_.finishRun = function (id) {
    const meta = this.meta, run = this.run; meta.ending = id; meta.endings[id] = 1; meta.ash += run.ash; meta.cleared = 5; this.saveMeta(); this.clearRun();
    this.mode = 'ending'; this.endingId = id; this.ev('ending', { id }); this.ev('sfx', { n: 'ending' });
  };
  P_.afterEnding = function () { this.run = null; this.meta.heirs = this.meta.heirs; this.mode = 'play'; this.meta.gen += 0; this.enterVillage(); };

  /* ---------- 마을 ---------- */
  P_.pitDialog = function () {
    const he = this.meta.heirs[this.meta.heirSel], tr = traitOf(he.trait), opts = [];
    for (let z = 0; z <= Math.min(4, this.meta.cleared); z++) opts.push({ t: `${ZONES[z].name}${z === 0 ? ' — 처음부터' : ' — 지름길'}`, fn: () => this.startRun(z * FLOORS_PER_ZONE) });
    opts.push({ t: '아직 아니야' });
    this.openDialog([{ w: null, t: '구덩이 아래에서 희미한 열기가 올라온다. 먼 곳에서 무언가 숨을 쉬는 소리.' }, { w: null, t: `등불을 받은 이: ${he.name} (${tr.name}) — ${tr.desc}` }], { choices: opts });
  };
  P_.buyDialog = function (npc, key) {
    const U = UPGRADES[key], lv = this.meta.up[key], me = this.meta, name = npc.name.split(' ').pop();
    if (lv >= U.max) { this.openDialog([{ w: npc.name, t: '이제 더 손볼 곳이 없네. 나머지는 자네 몫이지.' }]); return; }
    const cost = U.cost[lv], can = me.ash >= cost;
    this.openDialog([{ w: npc.name, t: `${U.name}. ${U.desc[lv]} — 재 ${cost}이(가) 든다. (보유 ${me.ash})` }, ...(can ? [] : [{ w: npc.name, t: '재가 모자라네. 구덩이에서 더 모아 오게.' }])],
      { choices: can ? [{ t: `강화한다 (재 ${cost})`, fn: () => { me.ash -= cost; me.up[key]++; this.saveMeta(); this.ev('sfx', { n: 'level' }); this.say(`${U.name}: ${U.desc[lv]}`, 'good'); this.openDialog([{ w: npc.name, t: '됐네. 몸조심하게.' }]); } }, { t: '다음에' }] : null });
  };
  P_.talk = function (n, auto) {
    if (!n) return; const me = this.meta, name = n.name, W_ = t => ({ w: name, t }), dead = me.dead, last = dead[dead.length - 1];
    switch (n.role) {
      case 'elder': {
        const c = me.cleared, pages = [];
        if (me.ending) pages.push(W_(`${ENDINGS[me.ending].tag}… 그래, 네가 이 겨울을 끝냈구나. 이제 천천히 쉬렴.`), W_('원한다면 다시 내려가도 좋다. 구덩이는 언제나 열려 있으니.'));
        else if (me.gen === 1 && !me.flags.met) { me.flags.met = 1; this.saveMeta(); pages.push(W_('왔구나, 벨렌의 아이야. 집안에서 등불을 들 수 있는 건 이제 너희 셋뿐이다.'), W_('저기 앞마당에 선 아이들 가운데 한 명을 고르렴. 부딪쳐 보면 된다.'), W_('그리고 동쪽 구덩이로 걸어 들어가거라. 발걸음이 곧 말이란다. 부딪치면 때리고, 말 걸고, 문을 연다.')); }
        else {
          if (last && me.flags.lastTold !== dead.length) { me.flags.lastTold = dead.length; this.saveMeta(); pages.push(W_(`${last.name}이(가) ${last.depthName}에서 쓰러졌다고…`), W_('그 아이의 등불은 아직 거기 남아 있을 게다. 다가가면 마지막 말을 들려줄 거야.')); }
          const hints = [
            ['폐광은 어둡다. 검은 쇠그릇(화로)에 부딪치면 불이 옮겨 붙고, 그 곁에는 그림자가 다가오지 못해.', '달려가서 부딪치면 두 배로 세게 때릴 수 있단다. 적이 밀려나서 잠깐 멍해지지.'],
            ['오톨 대장… 정말 쓰러뜨렸니. 그다음은 수몰 예배당이야. 물은 불꽃을 갉아먹는단다. 다리를 찾아라.'],
            ['도서관의 책들은 건립자들의 기록이란다. 읽는다고 달라질 건 없지만… 알아야 하는 것도 있지.'],
            ['대장간… 보르카이는 내 증조부의 오랜 벗이었다. 사슬에 대해 알고 있겠지, 이제는.'],
            ['첫 등불지기께서 기다리신다. 네가 어떤 선택을 하든, 나는 네 편이란다.']];
          for (const h of hints[Math.min(c, 4)]) pages.push(W_(h));
        }
        this.openDialog(pages); return; }
      case 'kid': {
        const tips = ['화살표(또는 화면을 밀기)로 한 칸씩 걸으면 돼요! 부딪치면 때리고, 말 걸고, 문도 열려요.', '적 발밑이 붉게 빛나면 곧 공격이 온다는 뜻이에요. 비켜서면 헛손질한대요!', '한 방향으로 쭉 달리다가 부딪치면 "돌진"이라 두 배로 세요! 적도 밀려나요!', '불꽃이 줄면 어두워져요. 화로에 부딪치면 불이 붙고, 그 곁엔 그림자들이 못 와요.', '정신 잃으면 다음 사람이 이어받는대요. 죽은 자리의 유해에 닿으면 유품을 받아요.', '제단에는 유물이 세 개 있대요. 하나만 고를 수 있으니까 신중히!', '거미줄은 한 번 걸리면 한 걸음 낭비해요. 가시도 조심!', '물가에선 불꽃이 새요. 이슬 방울이 있으면 괜찮대요.'];
        this.openDialog([W_(tips[me.tip % tips.length])]); me.tip++; this.saveMeta(); return; }
      case 'smith': return this.buyDialog(n, 'atk');
      case 'nun': return this.buyDialog(n, 'hp');
      case 'lamp': return this.buyDialog(n, 'flame');
      case 'herb': return this.buyDialog(n, 'herb');
      case 'archive': {
        if (!me.lore.length) { this.openDialog([W_('아직 읽을 기록이 없군. 구덩이 아래에서 찾은 쪽지를 가져오면 정리해 두지.')]); return; }
        const pages = [W_(`지금까지 모인 기록은 ${me.lore.length}장 / ${LORE.length}장이야.`)]; for (const i of me.lore.slice().sort((a, b) => a - b)) pages.push({ w: LORE[i].t, t: LORE[i].x, note: true });
        this.openDialog(pages); return; }
      case 'miner': {
        const l = ['폐광이라… 레일 위의 광차를 밀어 봐. 부딪친 놈은 뼈도 못 추려.', '예배당 아래는 물이 많아. 불꽃을 아끼려면 마른 길을 골라.', '도서관엔 책벌레와 필경사가 있지. 필경사부터 쓰러뜨려.', '대장간 바닥의 구멍에서 증기가 뿜어. 빨갛게 번쩍이면 비켜서.', '마지막 층은… 나도 가 본 적 없어. 내려가는 게 아니라 안쪽으로 들어가는 느낌이라더군.'];
        this.openDialog([W_(l[Math.min(me.cleared, 4)])]); return; }
      case 'heir': {
        const he = me.heirs[n.idx], tr = traitOf(he.trait), sel = me.heirSel === n.idx;
        this.openDialog([{ w: he.name, t: sel ? `나는 ${he.name}. ${tr.name} 성격이래. (${tr.desc}) — 내가 갈게요.` : `나는 ${he.name}. ${tr.name} 성격이래요. (${tr.desc})` }], { choices: [{ t: `${he.name}에게 등불을 맡긴다`, fn: () => { me.heirSel = n.idx; this.saveMeta(); this.ev('sfx', { n: 'level' }); this.say(`${he.name}이(가) 등불을 받았다. 구덩이로 가자.`, 'good'); this.ev('heir'); } }, { t: '다른 아이를 본다' }] }); return; }
      case 'ghost': {
        const g = GHOSTS.find(q => q.z === n.z), run = this.run;
        if (n.used) { this.openDialog([{ w: g.name, t: '…고마워. 이제 쉴 수 있겠어.' }]); return; }
        this.openDialog(g.lines.map(t => ({ w: g.name, t })), { choices: g.choice.map(c => ({ t: c.t, fn: () => { n.used = true; this.applyBoon(c.e); this.ev('sfx', { n: 'rare' }); this.ev('vanish', { x: n.x, y: n.y, id: n.id }); this.npcs = this.npcs.filter(q => q !== n); this.say(`${g.name}의 모습이 불빛 속으로 스며든다.`); } })) }); return; }
    }
  };
  P_.applyBoon = function (e) {
    const pl = this.pl, f = this.f;
    if (e.atk) { this.run.bonusAtk = (this.run.bonusAtk || 0) + e.atk; this.run.relics.push('dagger'); this.recalc(); this.say('손에 새 힘이 깃든다. 공격력 +1', 'good'); }
    if (e.hp) { this.run.relics.push('coat'); this.recalc(); pl.hp = Math.min(pl.maxhp, pl.hp + 4); this.say('몸이 단단해진다. 최대 체력 +4', 'good'); }
    if (e.heal) { pl.hp = Math.min(pl.maxhp, pl.hp + e.heal); this.say('상처가 아문다.', 'good'); }
    if (e.flame) { pl.flame = Math.min(pl.maxflame, pl.flame + e.flame); this.say('불꽃이 되살아난다.', 'good'); }
    if (e.maxflame) { this.run.relics.push('wick'); this.recalc(); pl.flame = Math.min(pl.maxflame, pl.flame + 25); this.say('등불 심지가 굵어졌다. 최대 불꽃 +25', 'good'); }
    if (e.reveal) { for (let k = 0; k < W * H; k++) if (f.t[k] !== T.WALL || f.t[k - W] !== T.WALL) f.explored[k] = 1; this.say('이 층의 지도가 머릿속에 그려진다.', 'good'); }
    this.updateView();
  };
}
