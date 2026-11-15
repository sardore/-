import {ClassicGame} from './classic.js';
import {Renderer} from './render.js';
import {formatTime,clamp} from './config.js';
const $=id=>document.getElementById(id);
const cv=$('game-canvas'),overlay=$('overlay'),modal=$('modal-content');
const renderer=new Renderer(cv,$('minimap'));
const SAVE='ghost-city-classic-v1',RANKS='ghost-city-classic-ranks-v1';
let game,ctxAudio=null,muted=false,stamp=0,savedAt=0,mapAt=0,hudAt=0;
let held=new Set(),pressed={attack:false,dash:false,interact:false,potion:false},finger=false,joy={x:0,y:0,id:null},dropMode=false;
let lastWeapons='',lastMode='',lastToast=0;
const itemLabel={cheap:'싸구려 물약',potion:'회복 물약',amulet:'수호의 부적',ticket:'무기 강화권',
  axe:'도끼',spear:'창',sword:'검',shield:'방패',hammer:'망치'};
const prices={potion:6,amulet:16,ticket:22,pet:18,maxhp:12,axe:12,spear:12,sword:12,shield:12,hammer:12};
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function write(key,val){try{localStorage.setItem(key,val);return true;}catch{return false;}}
function del(key){try{localStorage.removeItem(key);}catch{}}
function ranks(){try{const r=JSON.parse(read(RANKS)||'[]');return Array.isArray(r)?r:[];}catch{return [];}}
function persist(){
  if(!game||game.runEnded||['menu','dead','victory'].includes(game.mode))return;
  write(SAVE,game.serialize());
}
function sound(id){
  if(muted)return;
  try{
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A)return;
    if(!ctxAudio)ctxAudio=new A();
    if(ctxAudio.state==='suspended')ctxAudio.resume();
    const notes={swing:[200,105,.12],hit:[140,60,.13],hurt:[230,60,.32],coin:[570,890,.09],
      equip:[420,570,.08],dash:[400,820,.2],level:[510,960,.24],heal:[320,700,.28],
      buy:[530,830,.17],boss:[160,40,.6],dead:[380,50,.6],victory:[390,980,.7],
      enemyShoot:[250,190,.08]};
    const [a,b,d]=notes[id]||[300,360,.09],os=ctxAudio.createOscillator(),g=ctxAudio.createGain();
    os.type=['hurt','boss','dead'].includes(id)?'sawtooth':'triangle';
    const t=ctxAudio.currentTime;os.frequency.setValueAtTime(a,t);
    os.frequency.exponentialRampToValueAtTime(Math.max(40,b),t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.065,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);g.connect(ctxAudio.destination);
    os.start(t);os.stop(t+d+.01);
  }catch{}
}
function toast(text){
  if(!text)return;
  const el=document.createElement('div');el.className='toast';el.textContent=text;
  $('toasts').prepend(el);while($('toasts').children.length>2)$('toasts').lastElementChild.remove();
  setTimeout(()=>el.remove(),2400);
}
function event(type,p){
  if(type==='toast')toast(p.text);
  if(type==='sound')sound(p.name);
  if(type==='start'||type==='floor'){
    renderer.camera.x=clamp(game.player.x-renderer.w/2,0,Math.max(0,game.world.w*32-renderer.w));
    renderer.camera.y=clamp(game.player.y-renderer.h/2,0,Math.max(0,game.world.h*32-renderer.h));
    lastWeapons='';
    if(type==='floor')persist();
  }
  if(type==='end'){
    del(SAVE);
    const score={score:p.score,floor:p.floor,kills:p.kills,time:Math.round(p.time),victory:p.victory};
    const list=[...ranks(),score].sort((a,b)=>b.score-a.score).slice(0,10);
    write(RANKS,JSON.stringify(list));
  }
  if(['mode','end','start','floor'].includes(type))drawOverlay();
}
game=new ClassicGame(event);
const heading=(small,big)=>'<div class="pretitle">'+small+'</div><h2>'+big+'</h2>';
function menu(){
  const best=ranks()[0];
  return '<div class="pretitle">PYGAME ORIGINAL RULES / RESTORED</div>'+
    '<h1>THE GHOST<br><em>CITY</em></h1><span class="subline">C L A S S I C</span>'+
    '<p>2026년 Pygame 원작의 격자 기반 진행을 복원했습니다.<br>'+
    '이동은 90ms에 한 칸, 몬스터는 340ms마다 한 칸씩 움직입니다. 시간은 계속 흐릅니다.</p>'+
    '<div class="feature-row"><div><strong>20</strong><span>FLOORS</span></div>'+
    '<div><strong>5</strong><span>ORIGINAL WEAPONS</span></div><div><strong>7</strong><span>INVENTORY SLOTS</span></div></div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="new">튜토리얼부터 시작</button>'+
    (read(SAVE)?'<button class="modal-btn" data-action="continue">이어서 하기</button>':'')+
    '</div><div class="note">WASD 1칸 이동 · SPACE 직선 공격 · Shift+Space 창 돌진 · I 가방 · E 엘리베이터'+
    (best?'<br>최고 점수 '+best.score.toLocaleString():'')+'</div>';
}
function pause(){
  return heading('PAUSED','일시정지')+
    '<p>메뉴를 열면 적의 이동과 공격도 모두 정지합니다.</p>'+
    '<div class="actions"><button class="modal-btn primary" data-action="resume">전투로 복귀</button>'+
    '<button class="modal-btn" data-action="inventory">7칸 가방</button>'+
    '<button class="modal-btn" data-action="home">저장하고 메뉴로</button></div>';
}
function shop(){
  const gem=game.player.gems;
  return heading('FLOOR EXIT / ORIGINAL SHOP','이번 층의 상점')+
    '<p>원작처럼 계단에 도착하면 고정된 4가지 상품을 제시합니다.<br>현재 보석 <strong>◈ '+gem+'</strong></p>'+
    '<div class="shop-grid">'+game.shopOffers.map((s,i)=>{
      const id=s.type==='weapon'?s.id:s.type,cost=prices[id]??12;
      const name=s.type==='weapon'?itemLabel[id]:s.type==='pet'?'수호 천사':s.type==='maxhp'?'최대 체력 +10%':itemLabel[id];
      const disabled=game.shopSold[i]||gem<cost;
      return '<button class="shop-item" data-buy="'+i+'"'+(disabled?' disabled':'')+'>'+
        '<span class="shop-icon">'+(i+1)+'</span>'+
        '<span class="shop-detail"><strong>'+name+'</strong><small>'+
        (game.shopSold[i]?'판매 완료':s.type==='weapon'?'없으면 구매, 있으면 +1강':s.type==='maxhp'?'매층 고정 상품':'소모품·동행 효과')+
        '</small></span><span class="shop-price">◈'+cost+'</span></button>';
    }).join('')+'</div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="next">다음 층으로 →</button></div>';
}
function inventory(){
  const p=game.player;
  return heading('ORIGINAL 7-SLOT INVENTORY','가방 · 장비 · 소모품')+
    '<p>무기와 물약, 부적, 강화권이 같은 7칸을 공유합니다.<br>'+
    '슬롯을 클릭하거나 1–7로 사용하세요. 드롭 모드는 G입니다.</p>'+
    '<div class="shop-grid">'+p.slots.map((s,i)=>
      '<button class="shop-item" data-slot="'+i+'"'+(!s?' disabled':'')+'>'+
      '<span class="shop-icon">'+(i+1)+'</span>'+
      '<span class="shop-detail"><strong>'+(!s?'빈 슬롯':s.type==='weapon'?itemLabel[s.id]+' Lv.'+s.level:itemLabel[s.type])+'</strong>'+
      '<small>'+(i===p.equippedSlot?'장착 중':dropMode?'버리기':'사용 또는 장착')+'</small></span></button>').join('')+'</div>'+
    '<div class="actions"><button class="modal-btn" data-action="drop">드롭 모드: '+(dropMode?'ON':'OFF')+'</button>'+
    '<button class="modal-btn primary" data-action="resume">닫기</button></div>';
}
function finished(won){
  const s=game.summary();
  return '<div class="pretitle">'+(won?'FINISHED':'GAME OVER')+'</div>'+
    '<h1>'+(won?'CITY <em>LIBERATED</em>':'SIGNAL <em>LOST</em>')+'</h1>'+
    '<p>'+(won?'최종 보스를 물리쳤습니다.':'탐험이 종료되었습니다.')+'</p>'+
    '<div class="result-stats"><div><b>'+s.score.toLocaleString()+'</b><small>SCORE</small></div>'+
    '<div><b>'+s.floor+'F</b><small>FLOOR</small></div>'+
    '<div><b>'+s.kills+'</b><small>KILLS</small></div></div>'+
    '<p>생존 시간 '+s.time+'</p>'+
    '<div class="actions"><button class="modal-btn primary" data-action="new">다시 시작</button>'+
    '<button class="modal-btn" data-action="home">메인으로</button></div>';
}
function drawOverlay(){
  if(!game)return;
  if(game.mode==='playing'){overlay.classList.add('hidden');lastMode='';return;}
  overlay.classList.remove('hidden');
  const mode=game.mode;
  if(mode===lastMode&&!['shop','inventory'].includes(mode))return;
  lastMode=mode;
  modal.innerHTML=mode==='menu'?menu():mode==='shop'?shop():mode==='inventory'?inventory():
    mode==='paused'?pause():mode==='victory'?finished(true):mode==='dead'?finished(false):pause();
}
overlay.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const action=b.dataset.action,buy=b.dataset.buy,slot=b.dataset.slot;
  if(buy!==undefined){game.buy(Number(buy));drawOverlay();persist();return;}
  if(slot!==undefined){
    if(dropMode)game.dropSlot(Number(slot));else game.useSlot(Number(slot));
    drawOverlay();persist();lastWeapons='';return;
  }
  if(action==='new'){del(SAVE);game.newRun();persist();drawOverlay();}
  if(action==='continue'){
    if(!game.restore(read(SAVE))){del(SAVE);game.newRun();}
    renderer.camera.x=clamp(game.player.x-renderer.w/2,0,Math.max(0,game.world.w*32-renderer.w));
    renderer.camera.y=clamp(game.player.y-renderer.h/2,0,Math.max(0,game.world.h*32-renderer.h));
    drawOverlay();
  }
  if(action==='resume'){game.setMode('playing');drawOverlay();}
  if(action==='next'){game.closeShop();drawOverlay();persist();}
  if(action==='inventory'){dropMode=false;game.setMode('inventory');drawOverlay();}
  if(action==='drop'){dropMode=!dropMode;drawOverlay();}
  if(action==='home'){persist();game.setMode('menu');drawOverlay();}
});
function renderSlots(){
  const p=game.player,signature=JSON.stringify(p.slots)+'#'+p.equippedSlot;
  if(signature===lastWeapons)return;lastWeapons=signature;
  $('inventory-count').textContent=p.slots.filter(Boolean).length+' / 7';
  $('weapon-list').innerHTML=p.slots.map((s,i)=>'<button class="weapon-btn'+(i===p.equippedSlot?' active':'')+
    '" data-slot="'+i+'"'+(!s?' disabled':'')+'>'+
    '<span class="weapon-key">'+(i+1)+'</span><span class="weapon-icon">'+(s?.type==='weapon'?'⚔':'◈')+'</span>'+
    '<span class="weapon-info"><strong>'+(!s?'빈 슬롯':s.type==='weapon'?itemLabel[s.id]:itemLabel[s.type])+'</strong>'+
    '<small>'+(i===p.equippedSlot?'EQUIPPED':s?.type||'EMPTY')+'</small></span>'+
    '<span class="weapon-level">'+(s?.type==='weapon'?'Lv.'+s.level:'')+'</span></button>').join('');
}
$('weapon-list').addEventListener('click',e=>{
  const b=e.target.closest('button[data-slot]');
  if(b&&game.mode==='playing'){game.useSlot(Number(b.dataset.slot));lastWeapons='';persist();}
});
function hud(){
  const p=game.player,depth=game.world.floor;
  $('hp-text').textContent=p.hp+' / '+p.maxHp;
  $('hp-bar').style.width=clamp(p.hp/p.maxHp*100,0,100)+'%';
  $('shield-text').textContent='ANGELS ×'+p.petCount;
  $('floor-number').textContent=depth===0?'TUT':String(depth).padStart(2,'0');
  $('gem-number').textContent=p.gems;
  $('score-number').textContent=String(Math.floor(game.score)).padStart(6,'0');
  $('time-number').textContent=formatTime(game.elapsed);
  const ready=p.slots.some(s=>s?.id==='spear'&&s.level>=3)&&!p.dashUsed;
  $('energy-text').textContent=ready?'READY':'LOCKED';
  $('energy-bar').style.width=ready?'100%':'0%';
  $('level-num').textContent=p.level;
  $('xp-text').textContent=(p.xp%25)+' / 25';
  $('xp-bar').style.width=(p.xp%25)*4+'%';
  $('potion-count').textContent='×'+p.potions;
  $('dash-text').textContent=p.dashUsed?'USED':ready?'READY':'SPEAR LV3+';
  $('dash-bar').style.width=ready?'100%':'0%';
  $('zone-name').textContent=depth===0?'TUTORIAL / ORIGINAL CONTROLS':
    String(depth).padStart(2,'0')+'F / '+(depth===10?'MID BOSS':depth===20?'FINAL BOSS':depth>=11?'DARK DISTRICT':'NORMAL DISTRICT');
  $('mode-label').textContent=game.mode==='playing'?'GRID EXPLORATION':game.mode.toUpperCase();
  if(depth===0){
    $('objective-title').textContent='튜토리얼';
    $('objective-text').textContent='격자로 움직여 노란 출구까지 간 뒤 Enter를 누르세요.';
  }else if(depth===10||depth===20){
    $('objective-title').textContent=depth===10?'중간 보스':'최종 보스';
    $('objective-text').textContent='점멸 예고 뒤 격자 단위로 돌진합니다. 원작처럼 공격 방향이 중요합니다.';
  }else{
    $('objective-title').textContent='출구 계단 찾기';
    $('objective-text').textContent='계단에 도착하면 4개의 고정 상품이 있는 상점으로 이동합니다.';
  }
  renderSlots();
}
function togglePause(){
  if(game.mode==='playing')game.setMode('paused');
  else if(['paused','inventory'].includes(game.mode))game.setMode('playing');
  else if(game.mode==='shop')game.closeShop();
  drawOverlay();
}
const codes=new Set([' ','arrowup','arrowdown','arrowleft','arrowright']);
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(codes.has(k))e.preventDefault();
  held.add(k);
  if(e.repeat)return;
  if(k==='escape'){togglePause();return;}
  if(game.mode==='shop'&&k==='enter'){game.closeShop();persist();drawOverlay();return;}
  if(game.mode==='inventory'){
    if(k==='g'){dropMode=!dropMode;drawOverlay();return;}
    if(k>='1'&&k<='7'){
      if(dropMode)game.dropSlot(Number(k)-1);else game.useSlot(Number(k)-1);
      lastWeapons='';drawOverlay();persist();return;
    }
  }
  if(game.mode!=='playing')return;
  if(k===' '){if(e.shiftKey)pressed.dash=true;else pressed.attack=true;}
  else if(k==='e'||(k==='enter'&&game.tutorial))pressed.interact=true;
  else if(k==='h')pressed.potion=true;
  else if(k==='i'){dropMode=false;game.setMode('inventory');drawOverlay();}
  else if(k==='q')game.cycleWeapon();
  else if(k>='1'&&k<='7'){game.useSlot(Number(k)-1);lastWeapons='';}
});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{held.clear();finger=false;joy.x=joy.y=0;if(game.mode==='playing')game.setMode('paused');});
$('pause-toggle').addEventListener('click',togglePause);
$('audio-toggle').addEventListener('click',()=>{muted=!muted;$('audio-toggle').textContent=muted?'♪̸':'♫';});
const stick=$('joystick'),core=$('joystick-core');
function joyMove(e){
  const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
  const d=Math.hypot(x,y)||1,scale=Math.min(d,34)/d;
  joy.x=x/d*Math.min(1,d/20);joy.y=y/d*Math.min(1,d/20);
  core.style.transform='translate(calc(-50% + '+x*scale+'px),calc(-50% + '+y*scale+'px))';
}
stick.addEventListener('pointerdown',e=>{joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);joyMove(e);e.preventDefault();});
stick.addEventListener('pointermove',e=>{if(joy.id===e.pointerId)joyMove(e);});
function endJoy(e){if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;core.style.transform='translate(-50%,-50%)';}
stick.addEventListener('pointerup',endJoy);stick.addEventListener('pointercancel',endJoy);
for(const b of document.querySelectorAll('[data-touch]')){
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();b.setPointerCapture(e.pointerId);
    const a=b.dataset.touch;
    if(a==='attack')finger=true;
    else if(a==='dash')pressed.dash=true;
    else if(a==='interact')pressed.interact=true;
    else if(a==='potion')pressed.potion=true;
    else if(a==='skill'){game.setMode('inventory');drawOverlay();}
  });
  const up=()=>{if(b.dataset.touch==='attack')finger=false;};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
}
cv.addEventListener('contextmenu',e=>e.preventDefault());
renderer.reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderer.resize()).observe(cv);
else window.addEventListener('resize',()=>renderer.resize());
function loop(now){
  const dt=stamp?Math.min(.033,(now-stamp)/1000):0;stamp=now;
  const x=(held.has('d')||held.has('arrowright')?1:0)-(held.has('a')||held.has('arrowleft')?1:0)+joy.x;
  const y=(held.has('s')||held.has('arrowdown')?1:0)-(held.has('w')||held.has('arrowup')?1:0)+joy.y;
  const input={moveX:x,moveY:y,attack:pressed.attack||finger,
    dash:pressed.dash,interact:pressed.interact,potion:pressed.potion};
  pressed={attack:false,dash:false,interact:false,potion:false};
  game.tick(dt,input);
  renderer.render(game,dt);
  if(now-mapAt>220){renderer.drawMinimap(game);mapAt=now;}
  if(now-hudAt>70){hud();hudAt=now;}
  if(game.mode==='playing'&&now-savedAt>14000){persist();savedAt=now;}
  requestAnimationFrame(loop);
}
hud();drawOverlay();requestAnimationFrame(loop);
