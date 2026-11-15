// Presentation and modal actions only. Gameplay rules live in ClassicGame.
import {formatTime,clamp,TILE} from '../config.js';
import {price} from './rules.js';
export function createUI({game,renderer,store}){
  const $=id=>document.getElementById(id);
  const overlay=$('overlay'),modal=$('modal-content');
  const {read,del,ranks,persist,SAVE}=store;
  const itemLabel={cheap:'싸구려 물약',potion:'회복 물약',amulet:'수호의 부적',ticket:'무기 강화권',
    axe:'도끼',spear:'창',sword:'검',shield:'방패',hammer:'망치'};
  const prices=price;
  let lastWeapons='',lastMode='',dropMode=false,helpReturnMode='playing';
  function toast(text){
  if(!text)return;
  const el=document.createElement('div');el.className='toast';el.textContent=text;
  $('toasts').prepend(el);while($('toasts').children.length>2)$('toasts').lastElementChild.remove();
  setTimeout(()=>el.remove(),2400);
}
const heading=(small,big)=>'<div class="pretitle">'+small+'</div><h2>'+big+'</h2>';
function escapeHTML(value){
  return String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function normalizeName(value){
  const cleaned=String(value||'').replace(/[<>&"']/g,'').trim().slice(0,18);
  return cleaned||'NONAME';
}
function menu(){
  const top=ranks().slice(0,10);
  const rows=top.map((entry,i)=>
    '<div class="rank-row"><span>'+String(i+1).padStart(2,'0')+'. '+
    escapeHTML(String(entry.name||'NONAME').slice(0,18))+'</span>'+
    '<strong>'+Math.max(0,Number(entry.score)||0).toLocaleString()+'</strong></div>'
  ).join('');
  return '<h1 class="menu-title">THE GHOST CITY</h1>'+
    '<div class="ranking-panel"><h2>RANKING (TOP 10)</h2>'+
    (rows||'<p>No records yet.</p>')+
    rows+'</div>'+
    '<div class="name-panel">'+
    '<label for="player-name">Enter your name, then press ENTER:</label>'+
    '<input id="player-name" name="player-name" maxlength="18" spellcheck="false"'+
    ' autocomplete="off" placeholder="NONAME" value="'+escapeHTML(game.playerName||'')+'">'+
    '</div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="new">ENTER / START</button>'+
    (read(SAVE)?'<button class="modal-btn" data-action="continue">CONTINUE</button>':'')+
    '</div>'+
    '<div class="note">WASD / ARROWS · SPACE ATTACK · I INVENTORY · ESC MENU</div>';
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
function help(){
  return heading('SURVIVOR GUIDE / CLASSIC','조작법 · 게임 안내')+
    '<p>원작의 타일 이동·방향 공격·실시간 적 행동을 유지합니다. '+
    '메뉴가 열려 있을 때는 게임 시간이 정지합니다.</p>'+
    '<div class="manual-grid">'+
    '<div><kbd>W A S D</kbd><span>타일 한 칸 이동 · 바라보는 방향 결정</span></div>'+
    '<div><kbd>SPACE</kbd><span>바라보는 방향으로 직선 공격</span></div>'+
    '<div><kbd>SHIFT + SPACE</kbd><span>창 3레벨 이상이면 층당 1회 돌진</span></div>'+
    '<div><kbd>1 – 7</kbd><span>7칸 통합 인벤토리 사용·장착</span></div>'+
    '<div><kbd>I / G</kbd><span>가방 열기 / 드롭 모드</span></div>'+
    '<div><kbd>H / E</kbd><span>물약 사용 / 엘리베이터·출구 상호작용</span></div>'+
    '<div><kbd>ENTER</kbd><span>튜토리얼 완료·상점 다음 층 이동</span></div>'+
    '<div><kbd>ESC</kbd><span>일시정지 또는 메뉴 닫기</span></div>'+
    '</div>'+
    '<div class="actions"><button class="modal-btn primary" data-action="help-close">게임으로 돌아가기</button></div>';
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
    mode==='paused'?pause():mode==='help'?help():mode==='info'?info():mode==='midclear'?midclear():
    mode==='victory'?finished(true):mode==='dead'?finished(false):pause();
}
// Enter starts a run from the original name-entry screen.
overlay.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='player-name'){
    e.preventDefault();
    modal.querySelector('[data-action="new"]')?.click();
  }
});
overlay.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const action=b.dataset.action,buy=b.dataset.buy,slot=b.dataset.slot;
  if(buy!==undefined){game.buy(Number(buy));drawOverlay();persist();return;}
  if(slot!==undefined){
    if(dropMode)game.dropSlot(Number(slot));else game.useSlot(Number(slot));
    drawOverlay();persist();lastWeapons='';return;
  }
  if(action==='new'){
    game.playerName=normalizeName(modal.querySelector('#player-name')?.value);
    del(SAVE);game.newRun();persist();drawOverlay();
  }
  if(action==='begin'){game.confirmTutorial();persist();drawOverlay();}
  if(action==='continue-mid'){game.continueMidBoss();persist();drawOverlay();}
  if(action==='finish-mid'){game.finishMidBoss();drawOverlay();}
  if(action==='continue'){
    if(!game.restore(read(SAVE))){del(SAVE);game.newRun();}
    renderer.track(game);
    drawOverlay();
  }
  if(action==='resume'){game.setMode('playing');drawOverlay();}
  if(action==='help-close'){hideHelp();}
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
  const w=game.world,attack=game.weaponStats();
  $('weapon-title').textContent=(attack.id?attack.name:'맨손')+' · '+attack.power+' DMG';
  $('attack-text').textContent=p.attackCd>0?p.attackCd.toFixed(2)+'s':'READY';
  $('attack-bar').style.width=clamp((1-p.attackCd/Math.max(.01,attack.rate))*100,0,100)+'%';
  let explored=0;
  for(let i=0;i<w.seen.length;i++)explored+=w.seen[i]>0?1:0;
  $('explored-text').textContent='탐색 '+Math.round(explored/w.seen.length*100)+'%';
  let threats=0;
  for(const e of w.enemies){
    if(e.dead)continue;
    const x=Math.floor(e.x/TILE),y=Math.floor(e.y/TILE);
    if(x>=0&&y>=0&&x<w.w&&y<w.h&&w.visible[y*w.w+x])threats++;
  }
  $('threat-text').textContent='시야 내 적 '+threats;
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
  function showHelp(){
    if(game.mode==='help')return;
    helpReturnMode=game.mode;
    game.setMode('help');
    drawOverlay();
  }
  function hideHelp(){
    if(game.mode!=='help')return;
    game.setMode(helpReturnMode);
    drawOverlay();
  }
  function markSaved(ok){
    const status=$('save-status');
    if(!status)return;
    status.textContent=ok?'✓ 저장됨':'저장 실패';
    status.classList.toggle('saved',!!ok);
    status.classList.toggle('failed',!ok);
  }
  return {drawOverlay,hud,toast,invalidateWeapons,resetOverlay,toggleDrop,useSlot,
    showHelp,hideHelp,markSaved};
}
