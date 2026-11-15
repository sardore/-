// Presentation and modal actions only. Gameplay rules live in ClassicGame.
import {formatTime,clamp} from '../config.js';
import {price} from './rules.js';
export function createUI({game,renderer,store}){
  const $=id=>document.getElementById(id);
  const overlay=$('overlay'),modal=$('modal-content');
  const {read,del,ranks,persist,SAVE}=store;
  const itemLabel={cheap:'싸구려 물약',potion:'회복 물약',amulet:'수호의 부적',ticket:'무기 강화권',
    axe:'도끼',spear:'창',sword:'검',shield:'방패',hammer:'망치'};
  const prices=price;
  let lastWeapons='',lastMode='',dropMode=false;
  function toast(text){
  if(!text)return;
  const el=document.createElement('div');el.className='toast';el.textContent=text;
  $('toasts').prepend(el);while($('toasts').children.length>2)$('toasts').lastElementChild.remove();
  setTimeout(()=>el.remove(),2400);
}
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
function info(){
  return heading('HOW TO PLAY / ORIGINAL','튜토리얼 완료')+
    '<p>당신의 목표는 격자를 따라 이동하며 층마다 출구를 찾는 것입니다.<br>'+
    '<b>WASD / 방향키</b>: 타일 한 칸 이동<br>'+
    '<b>SPACE</b>: 바라보는 방향으로 직선 공격<br>'+
    '<b>1–7</b>: 통합 인벤토리 사용 / 장착<br>'+
    '<b>G</b>: 드롭 모드 · <b>I</b>: 가방 · <b>E</b>: 엘리베이터<br>'+
    '<b>Shift+Space</b>: 창 Lv.3+의 층당 1회 돌진</p>'+
    '<div class="actions"><button class="modal-btn primary" data-action="begin">1층 탐험 시작</button></div>';
}
function midclear(){
  return heading('MID BOSS DEFEATED','10층의 수호자를 쓰러뜨렸습니다')+
    '<p>원본 Pygame 코드는 여기서 엔딩으로 진입합니다.<br>'+
    '이 복원판에서는 원본처럼 기록을 마치거나, 20층까지 계속 진행하도록 선택할 수 있습니다.</p>'+
    '<div class="actions"><button class="modal-btn" data-action="finish-mid">원작대로 여기서 종료</button>'+
    '<button class="modal-btn primary" data-action="continue-mid">11층으로 계속</button></div>';
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
    mode==='paused'?pause():mode==='info'?info():mode==='midclear'?midclear():
    mode==='victory'?finished(true):mode==='dead'?finished(false):pause();
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
  if(action==='begin'){game.confirmTutorial();persist();drawOverlay();}
  if(action==='continue-mid'){game.continueMidBoss();persist();drawOverlay();}
  if(action==='finish-mid'){game.finishMidBoss();drawOverlay();}
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
  const ready=game.activeSlot()?.id==='spear'&&game.activeSlot().level>=3&&!p.dashUsed;
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

  function invalidateWeapons(){lastWeapons='';}
  function resetOverlay(){lastMode='';drawOverlay();}
  function toggleDrop(){dropMode=!dropMode;drawOverlay();}
  function useSlot(index){
    if(game.mode==='inventory'&&dropMode)game.dropSlot(index);
    else game.useSlot(index);
    invalidateWeapons();drawOverlay();persist();
  }
  return {drawOverlay,hud,toast,invalidateWeapons,resetOverlay,toggleDrop,useSlot};
}
