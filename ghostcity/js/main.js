import {Game,SAVE_KEY,RANK_KEY} from './game.js';
import {Renderer} from './render.js';
import {WEAPONS,SHOP,formatTime,clamp} from './config.js';

const $=id=>document.getElementById(id);
const cv=$('game-canvas'),minimap=$('minimap'),overlay=$('overlay'),modal=$('modal-content');
const renderer=new Renderer(cv,minimap);
let game;
let muted=false,audioCtx=null,lastFrame=0,lastSave=0,lastMini=0,lastHud=0,lastWeaponSig='',lastOverlay='',aim=null,mouseDown=false,touchAttack=false,joy={x:0,y:0,id:null};
const keys=new Set();
const pressed={dash:false,interact:false,potion:false,skill:false};
const ui={
  hp:$('hp-text'),hpBar:$('hp-bar'),shield:$('shield-text'),floor:$('floor-number'),
  gems:$('gem-number'),score:$('score-number'),time:$('time-number'),zone:$('zone-name'),
  energy:$('energy-text'),energyBar:$('energy-bar'),level:$('level-num'),xp:$('xp-text'),xpBar:$('xp-bar'),
  dash:$('dash-text'),dashBar:$('dash-bar'),potion:$('potion-count'),weaponList:$('weapon-list'),
  inventory:$('inventory-count'),objective:$('objective-title'),objectiveText:$('objective-text'),
  mode:$('mode-label'),toasts:$('toasts')
};
function getStore(key){try{return localStorage.getItem(key);}catch{return null;}}
function putStore(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function removeStore(key){try{localStorage.removeItem(key);}catch{}}
function safeRanks(){try{const v=JSON.parse(getStore(RANK_KEY)||'[]');return Array.isArray(v)?v.slice(0,15):[];}catch{return [];}}
function addRank(payload){
  const scores=safeRanks();scores.push({score:payload.score,floor:payload.floor,kills:payload.kills,time:Math.round(payload.time),victory:payload.victory});
  scores.sort((a,b)=>b.score-a.score);putStore(RANK_KEY,JSON.stringify(scores.slice(0,10)));
}
function save(){
  if(!game||game.runEnded||game.mode==='menu'||game.mode==='dead'||game.mode==='victory'||game.mode==='perk')return;
  putStore(SAVE_KEY,game.serialize());
}
function sfx(name){
  if(muted)return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    if(!audioCtx)audioCtx=new C();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
    const now=audioCtx.currentTime;
    const lookup={
      coin:[650,880,.09,'sine',.11],swing:[165,70,.11,'triangle',.095],
      hit:[125,65,.12,'sawtooth',.10],shoot:[390,180,.10,'square',.055],
      hurt:[170,56,.26,'sawtooth',.14],dash:[430,780,.14,'sine',.09],
      level:[430,840,.38,'sine',.13],equip:[410,510,.1,'sine',.07],
      heal:[510,870,.3,'sine',.10],buy:[580,850,.16,'triangle',.07],
      burst:[65,370,.43,'sawtooth',.15],boss:[150,530,.6,'sawtooth',.16],
      dead:[340,70,.75,'triangle',.16],victory:[460,990,.9,'sine',.15],
      enemyShoot:[220,135,.08,'triangle',.035],enemyHit:[90,55,.08,'square',.05],
      menu:[290,490,.12,'sine',.065]
    };
    const [a,b,d,type,volume]=lookup[name]||lookup.menu;
    const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(a,now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,b),now+d);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+d);
    oscillator.connect(gain);gain.connect(audioCtx.destination);
    oscillator.start(now);oscillator.stop(now+d+.01);
  }catch{}
}
function toast(msg){
  if(!msg)return;
  const n=document.createElement('div');n.className='toast';n.textContent=msg;
  ui.toasts.prepend(n);
  while(ui.toasts.children.length>2)ui.toasts.lastElementChild.remove();
  setTimeout(()=>n.remove(),2300);
}
function onEvent(type,payload){
  if(type==='sound')sfx(payload.name);
  if(type==='toast')toast(payload.text);
  if(type==='mode'||type==='perk')drawOverlay();
  if(type==='floor'){
    sfx('level');save();lastWeaponSig='';
    renderer.camera.x=clamp(game.player.x-renderer.w/2,0,Math.max(0,game.world.w*32-renderer.w));
    renderer.camera.y=clamp(game.player.y-renderer.h/2,0,Math.max(0,game.world.h*32-renderer.h));
  }
  if(type==='autosave')save();
  if(type==='end'){removeStore(SAVE_KEY);addRank(payload);lastOverlay='';drawOverlay();}
  if(type==='start'){
    ui.toasts.innerHTML='';lastWeaponSig='';
    renderer.camera.x=clamp(game.player.x-renderer.w/2,0,Math.max(0,game.world.w*32-renderer.w));
    renderer.camera.y=clamp(game.player.y-renderer.h/2,0,Math.max(0,game.world.h*32-renderer.h));
  }
}
game=new Game(onEvent);
function panelTitle(title,subtitle){
  return '<div class="pretitle">'+subtitle+'</div><h2>'+title+'</h2>';
}
function menuMarkup(){
  const canContinue=!!getStore(SAVE_KEY);
  const best=safeRanks()[0];
  return '<div class="pretitle">THE ORIGINAL RETURNS · EDITION 2026</div>'+
    '<h1>THE GHOST<br><em>CITY</em></h1><span class="subline">R E B O R N</span>'+
    '<p>죽은 도시의 하층부에 남은 마지막 신호.<br>20개의 층을 돌파하고 두 수호자를 쓰러뜨려 도시의 진실을 밝히세요.</p>'+
    '<div class="feature-row"><div><strong>20</strong><span>FLOORS</span></div><div><strong>5</strong><span>WEAPONS</span></div><div><strong>2</strong><span>BOSSES</span></div></div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="new">새 탐험 시작</button>'+
    (canContinue?'<button class="modal-btn" data-action="continue">이어서 하기</button>':'')+
    '</div><div class="note">WASD 이동 · 마우스 공격 · SPACE 대시 · E 상호작용 · 자동 저장'+
    (best?'<br>최고 기록 · '+Number(best.score||0).toLocaleString()+'점':'')+'</div>';
}
function shopMarkup(){
  const gem=game.player.gems;
  return panelTitle('잊힌 자의 거래소','GHOST MERCHANT / EXCHANGE')+
    '<p>죽은 도시의 상인은 보석을 대가로 살아 있는 자에게 힘을 팝니다.<br>현재 소지: <strong style="color:#8de5d3">◈ '+gem+'개</strong></p>'+
    '<div class="shop-grid">'+SHOP.map(s=>'<button class="shop-item" data-buy="'+s.id+'"'+(s.cost>gem?' disabled':'')+'>'+
      '<span class="shop-icon">'+s.icon+'</span><span class="shop-detail"><strong>'+s.name+'</strong><small>'+s.desc+'</small></span>'+
      '<span class="shop-price">◈'+s.cost+'</span></button>').join('')+'</div>'+
    '<div class="actions"><button class="modal-btn" data-action="close">상점 나가기</button></div>';
}
function perkMarkup(){
  return panelTitle('영혼의 진화','LEVEL UP / CHOOSE YOUR PATH')+
    '<p>레벨 '+game.player.level+' 달성. 다음 세 가지 힘 중 하나를 선택하세요.<br>획득한 특성은 이번 탐험에 영구 적용됩니다.</p>'+
    '<div class="selection">'+game.perkOptions.map(p=>'<button class="choice" data-perk="'+p.id+'">'+
      '<span class="choice-icon">✧</span><strong>'+p.name+'</strong><small>'+p.desc+'</small></button>').join('')+'</div>';
}
function pauseMarkup(){
  const s=game.summary();
  return panelTitle('탐험 일시정지','SYSTEM / PAUSED')+
    '<p>유령도시가 잠시 고요해졌습니다.<br>현재 '+s.floor+'층 · '+s.score.toLocaleString()+'점 · '+s.time+'</p>'+
    '<div class="actions"><button class="modal-btn primary" data-action="resume">계속 플레이</button>'+
    '<button class="modal-btn" data-action="inventory">가방 · 능력치</button>'+
    '<button class="modal-btn danger" data-action="home">저장 후 메인으로</button></div>';
}
function inventoryMarkup(){
  const p=game.player;
  return panelTitle('생존자 기록','FIELD INVENTORY / CHARACTER')+
    '<div class="result-stats"><div><b>Lv.'+p.level+'</b><small>LEVEL</small></div>'+
    '<div><b>'+p.maxHp+'</b><small>MAX HP</small></div><div><b>'+p.kills+'</b><small>KILLS</small></div></div>'+
    '<p>무기: '+p.inventory.map(id=>WEAPONS[id].name+' Lv.'+p.weaponLevels[id]).join(' / ')+'</p>'+
    '<p>특성: '+(p.perks.length?p.perks.map(id=>({'blood':'피의 서약','steel':'강화된 영혼','rush':'재빠른 발','fortune':'보석의 축복','guard':'보호의 룬','vamp':'생명의 잔향','fury':'검술의 달인','hunter':'사냥꾼의 직감'})[id]||id).join(' · '):'아직 획득한 특성이 없습니다.')+'</p>'+
    '<div class="actions"><button class="modal-btn primary" data-action="resume">전투 복귀</button></div>';
}
function endMarkup(victory){
  const p=game.player,s=game.summary();
  const name=victory?'도시의 새벽':'신호 두절';
  const ranks=safeRanks();
  return '<div class="pretitle">'+(victory?'MISSION CLEAR':'EXPEDITION FAILED')+'</div>'+
    '<h1>'+(victory?'DAWN <em>BREAKS</em>':'SIGNAL <em>LOST</em>')+'</h1>'+
    '<h2>'+name+'</h2>'+
    '<p>'+(victory?'고스트 킹이 쓰러지고 도시의 어둠이 걷혔습니다.':'차가운 거리가 마지막 발자국을 삼켰습니다.')+
    '<br>그럼에도 당신의 기록은 남습니다.</p>'+
    '<div class="result-stats"><div><b>'+s.score.toLocaleString()+'</b><small>SCORE</small></div>'+
    '<div><b>'+String(s.floor).padStart(2,'0')+'F</b><small>DEPTH</small></div>'+
    '<div><b>'+s.kills+'</b><small>KILLS</small></div></div>'+
    '<div class="rankline">생존 시간 '+s.time+' · 최고 기록 '+Number(ranks[0]?.score||0).toLocaleString()+'점</div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="new">다시 도전</button>'+
    '<button class="modal-btn" data-action="home">메인 화면</button></div>';
}
function drawOverlay(){
  if(!game)return;
  const mode=game.mode;
  if(mode==='playing'){overlay.classList.add('hidden');lastOverlay='';return;}
  overlay.classList.remove('hidden');
  // A shop needs rerendering after a purchase, while other states only change on transitions.
  if(lastOverlay===mode&&mode!=='shop'&&mode!=='perk')return;
  lastOverlay=mode;
  if(mode==='menu')modal.innerHTML=menuMarkup();
  if(mode==='paused')modal.innerHTML=pauseMarkup();
  if(mode==='shop')modal.innerHTML=shopMarkup();
  if(mode==='perk')modal.innerHTML=perkMarkup();
  if(mode==='inventory')modal.innerHTML=inventoryMarkup();
  if(mode==='dead'||mode==='victory')modal.innerHTML=endMarkup(mode==='victory');
  if(mode==='playing')overlay.classList.add('hidden');
}
overlay.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  const action=button.dataset.action,perk=button.dataset.perk,buy=button.dataset.buy;
  if(perk){game.choosePerk(perk);save();drawOverlay();return;}
  if(buy){game.buy(buy);lastOverlay='';drawOverlay();save();return;}
  if(action==='new'){removeStore(SAVE_KEY);game.newRun();save();drawOverlay();}
  if(action==='continue'){
    const raw=getStore(SAVE_KEY);
    if(!game.restore(raw)){removeStore(SAVE_KEY);game.newRun();}
    renderer.camera.x=clamp(game.player.x-renderer.w/2,0,Math.max(0,game.world.w*32-renderer.w));
    renderer.camera.y=clamp(game.player.y-renderer.h/2,0,Math.max(0,game.world.h*32-renderer.h));
    lastWeaponSig='';drawOverlay();
  }
  if(action==='resume'||action==='close'){game.setMode('playing');drawOverlay();}
  if(action==='inventory'){game.setMode('inventory');drawOverlay();}
  if(action==='home'){
    save();game.setMode('menu');drawOverlay();lastWeaponSig='';
  }
});
function updateWeapons(){
  const p=game.player,signature=p.inventory.map(id=>id+':'+p.weaponLevels[id]).join('|')+'@'+p.weapon;
  if(signature===lastWeaponSig)return;
  lastWeaponSig=signature;
  ui.inventory.textContent=p.inventory.length+' / 7';
  ui.weaponList.innerHTML=p.inventory.map((id,i)=>{
    const w=WEAPONS[id],selected=id===p.weapon;
    return '<button class="weapon-btn'+(selected?' active':'')+'" data-weapon="'+id+'" title="'+w.description+'">'+
      '<span class="weapon-key">'+(i+1)+'</span><span class="weapon-icon">'+w.icon+'</span>'+
      '<span class="weapon-info"><strong>'+w.name+'</strong><small>'+w.eng+'</small></span>'+
      '<span class="weapon-level">Lv.'+(p.weaponLevels[id]||1)+'</span></button>';
  }).join('');
}
ui.weaponList.addEventListener('click',e=>{
  const button=e.target.closest('button[data-weapon]');
  if(button){game.changeWeapon(button.dataset.weapon);updateWeapons();}
});
function updateHud(){
  const p=game.player,w=game.world,depth=w.floor;
  ui.hp.textContent=p.hp+' / '+p.maxHp;
  ui.hpBar.style.width=clamp(p.hp/p.maxHp*100,0,100)+'%';
  ui.shield.textContent='+'+p.shield+' SHIELD';
  ui.floor.textContent=String(depth).padStart(2,'0');
  ui.gems.textContent=p.gems;
  ui.score.textContent=String(Math.floor(game.score)).padStart(6,'0');
  ui.time.textContent=formatTime(game.elapsed);
  ui.energy.textContent=Math.floor(p.energy)+' / 100';
  ui.energyBar.style.width=clamp(p.energy,0,100)+'%';
  ui.level.textContent=p.level;
  ui.xp.textContent=Math.floor(p.xp)+' / '+p.xpNext;
  ui.xpBar.style.width=clamp(p.xp/p.xpNext*100,0,100)+'%';
  ui.potion.textContent='×'+p.potions;
  ui.dash.textContent=p.dashCd>0?p.dashCd.toFixed(1)+'S':'READY';
  ui.dashBar.style.width=clamp((1-p.dashCd/(2.5*p.dashMult))*100,0,100)+'%';
  ui.mode.textContent=game.mode==='playing'?'EXPLORATION':game.mode.toUpperCase();
  const isBoss=depth===10||depth===20;
  ui.zone.textContent=String(depth).padStart(2,'0')+'F / '+(depth===10?'THE NEST':depth===20?'PHANTOM THRONE':depth>=11?'THE DROWNED DISTRICT':'THE SILENT DISTRICT');
  if(depth===10){ui.objective.textContent='메가 스파이더';ui.objectiveText.textContent='압도적인 거대 거미를 격파하고 봉쇄된 계단을 열어라.';}
  else if(depth===20){ui.objective.textContent='고스트 킹';ui.objectiveText.textContent='도시를 잠식한 마지막 왕을 처치하면 결말에 도달합니다.';}
  else{ui.objective.textContent='도시의 심장으로';ui.objectiveText.textContent='적을 쓰러뜨리고 보석을 모아 다음 층으로. 상점에서는 무기를 강화할 수 있습니다.';}
  updateWeapons();
}
let joystickCenter={x:0,y:0};
function updateJoystick(e){
  const rect=$('joystick').getBoundingClientRect();
  joystickCenter={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  const dx=e.clientX-joystickCenter.x,dy=e.clientY-joystickCenter.y;
  const d=Math.hypot(dx,dy),s=Math.min(d,34)/(d||1);
  joy.x=dx/(d||1)*Math.min(1,d/32);joy.y=dy/(d||1)*Math.min(1,d/32);
  $('joystick-core').style.transform='translate(calc(-50% + '+(dx*s)+'px),calc(-50% + '+(dy*s)+'px))';
}
$('joystick').addEventListener('pointerdown',e=>{
  joy.id=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);updateJoystick(e);e.preventDefault();
});
$('joystick').addEventListener('pointermove',e=>{if(joy.id===e.pointerId){updateJoystick(e);e.preventDefault();}});
function endJoy(e){if(joy.id!==e.pointerId)return;joy.x=joy.y=0;joy.id=null;$('joystick-core').style.transform='translate(-50%,-50%)';}
$('joystick').addEventListener('pointerup',endJoy);
$('joystick').addEventListener('pointercancel',endJoy);
const touchButtons=document.querySelectorAll('[data-touch]');
for(const b of touchButtons){
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();b.setPointerCapture(e.pointerId);
    const type=b.dataset.touch;
    if(type==='attack')touchAttack=true;
    else if(type==='dash')pressed.dash=true;
    else if(type==='potion')pressed.potion=true;
    else if(type==='skill')pressed.skill=true;
    else if(type==='interact')pressed.interact=true;
  });
  const end=e=>{if(b.dataset.touch==='attack')touchAttack=false;};
  b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);
}
cv.addEventListener('pointerdown',e=>{
  if(game.mode!=='playing')return;
  const rect=cv.getBoundingClientRect();
  aim={x:e.clientX-rect.left,y:e.clientY-rect.top};
  renderer.setPointer(aim.x,aim.y);mouseDown=true;
  if(e.pointerType==='touch')cv.setPointerCapture(e.pointerId);
  e.preventDefault();
});
cv.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse'&&!mouseDown)return;
  const rect=cv.getBoundingClientRect();
  aim={x:e.clientX-rect.left,y:e.clientY-rect.top};
  renderer.setPointer(aim.x,aim.y);
});
function releaseMouse(){mouseDown=false;}
cv.addEventListener('pointerup',releaseMouse);cv.addEventListener('pointercancel',releaseMouse);
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')releaseMouse();});
cv.addEventListener('contextmenu',e=>e.preventDefault());
function escape(){
  if(game.mode==='playing')game.setMode('paused');
  else if(['paused','inventory','shop'].includes(game.mode))game.setMode('playing');
  drawOverlay();
}
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  const key=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)&&game.mode==='playing')e.preventDefault();
  keys.add(key);
  if(e.repeat)return;
  if(key==='escape'){escape();return;}
  if(game.mode!=='playing')return;
  if(key===' '||key==='shift')pressed.dash=true;
  else if(key==='e')pressed.interact=true;
  else if(key==='h'||key==='f')pressed.potion=true;
  else if(key==='r')pressed.skill=true;
  else if(key==='q')game.cycleWeapon(1);
  else if(key==='i'){game.setMode('inventory');drawOverlay();}
  else if(key>='1'&&key<='7'){
    const id=game.player.inventory[Number(key)-1];if(id)game.changeWeapon(id);
  }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{
  keys.clear();mouseDown=false;touchAttack=false;joy.x=joy.y=0;
  if(game.mode==='playing')game.setMode('paused');
});
$('pause-toggle').addEventListener('click',escape);
$('audio-toggle').addEventListener('click',()=>{
  muted=!muted;$('audio-toggle').textContent=muted?'♪̸':'♫';
  $('audio-toggle').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');
  if(!muted)sfx('menu');
});
renderer.reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderer.resize()).observe(cv);
else window.addEventListener('resize',()=>renderer.resize());
function frame(now){
  const dt=lastFrame?Math.min(.033,(now-lastFrame)/1000):0;lastFrame=now;
  const moveX=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;
  const moveY=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joy.y;
  const aimWorld=aim?renderer.screenToWorld(aim.x,aim.y):null;
  const input={moveX,moveY,aimX:aimWorld?.x,aimY:aimWorld?.y,
    attack:mouseDown||touchAttack||keys.has('j')||keys.has('k'),
    dash:pressed.dash,interact:pressed.interact,potion:pressed.potion,skill:pressed.skill};
  for(const k of Object.keys(pressed))pressed[k]=false;
  game.tick(dt,input);
  renderer.render(game,dt);
  if(now-lastMini>230){renderer.drawMinimap(game);lastMini=now;}
  if(now-lastHud>70){updateHud();lastHud=now;}
  if(game.mode==='playing'&&now-lastSave>17000){save();lastSave=now;}
  requestAnimationFrame(frame);
}
updateHud();drawOverlay();requestAnimationFrame(frame);
