// Classic progression logic. Receives game explicitly; no DOM dependencies.
import {T,TILE} from '../config.js';
import {refreshVision} from '../world.js';
import {generateClassicFloor} from './map.js';
import {pt,center,at,spec,makeWeapon,makeItem,status,addSlot} from './rules.js';

export function addXP(game,amount){
    const p=game.player;const before=p.baseMaxHp;p.xp+=Math.max(0,amount);
    p.baseMaxHp=Math.min(18,6+Math.floor(p.xp/25));
    game.recomputeHp();
    p.level=1+Math.floor(p.xp/25);p.xpNext=25;
    if(p.baseMaxHp>before)game.say('최대 HP '+before+' → '+p.baseMaxHp,2);
  }

export function recomputeHp(game){
    const p=game.player,next=Math.max(1,Math.ceil(p.baseMaxHp*(1+p.maxHpBonus)));
    if(next>p.maxHp)p.hp+=next-p.maxHp;
    p.maxHp=next;p.hp=Math.min(p.hp,p.maxHp);
  }

export function onStep(game){
    const p=game.player,w=game.world,t=pt(p.x,p.y);
    for(let i=w.pickups.length-1;i>=0;i--){
      const item=w.pickups[i],it=pt(item.x,item.y);
      if(!at(t,it))continue;
      if(item.type==='gem'){w.pickups.splice(i,1);p.gems+=1;game.score+=10;game.addXP(1);game.sound('coin');continue;}
      const payload=item.type==='weapon'?makeWeapon(item.weapon||'sword',item.level||1):makeItem(item.type==='shield'?'amulet':item.type);
      if(addSlot(p,payload)){w.pickups.splice(i,1);game.syncInventory();game.say('아이템 획득: '+(payload.type==='weapon'?spec[payload.id]?.name:payload.type),2);game.sound('coin');}
      else game.say('가방이 가득 찼습니다.',1);
    }
    const tile=w.tiles[t.y*w.w+t.x];
    if(game.tutorial&&tile===T.TUTOR_EXIT)game.say('노란 출구입니다. Enter를 눌러 안내 화면으로 이동하세요.',1.4);
    if(!game.tutorial&&tile===T.STAIRS){
      if(w.boss){if(w.bossDefeated)game.advance(1);else game.say('보스를 먼저 처치해야 합니다.',2);}
      else game.openShop();
    }
  }

export function interact(game){
    if(game.mode!=='playing')return false;
    const p=game.player,w=game.world,t=pt(p.x,p.y);
    const tile=w.tiles[t.y*w.w+t.x];
    if(game.tutorial&&tile===T.TUTOR_EXIT){game.setMode('info');game.say('튜토리얼 완료 · Enter로 게임 시작',4);return true;}
    if(tile===T.STAIRS){
      if(w.boss){if(!w.bossDefeated)return false;game.advance(1);}
      else game.openShop();
      return true;
    }
    if(tile!==T.ELEVATOR&&tile!==T.BROKEN){game.say('엘리베이터 위에서 E를 누르세요.',2);return false;}
    if([9,19].includes(w.floor)){game.say('이 층의 엘리베이터는 작동하지 않습니다.',2);return false;}
    if(p.gems<5){game.say('엘리베이터에는 보석 5개가 필요합니다.',2);return false;}
    p.gems-=5;
    if(tile===T.BROKEN){game.damagePlayer(Math.floor(p.hp/2));if(game.mode!=='playing')return false;}
    game.advance(1);return true;
  }

export function confirmTutorial(game){
  if(game.mode!=='info')return false;
  game.advance(1);
  return true;
}

export function advance(game,n=1){
  const next=game.tutorial?1:game.world.floor+n;
  if(next>20){game.end(true);return;}
  game.tutorial=false;
  const w=generateClassicFloor(next,game.seed,game.luck??.16);
  game.world=w;
  const p=game.player;
  p.x=(w.start.x+.5)*TILE;p.y=(w.start.y+.5)*TILE;
  p.dashUsed=false;p.invuln=0;p.dash=0;p.dashCd=0;p.attackCd=0;
  p.maxFloor=Math.max(next,p.maxFloor);
  // Original score applies when advancing beyond first floor.
  if(next!==1){game.score+=200;game.addXP(10);}
  game.shopFloor=null;game.shopOffers=[];game.shopSold=[];
  game.flow=null;game.flowTimer=0;game.visionTimer=0;game.visionTile=next+':'+w.start.x+':'+w.start.y;
  game.visionDirty=false;
  game.sniperWarnings=[];
  refreshVision(w,p.x,p.y,next>=11?6:13);
  game.say(next===10?'10층 · 메가 스파이더':next===20?'20층 · 최종 보스':next+'층에 진입했습니다.',4);
  // A checkpoint must serialize the NEW floor in playing mode, never the old shop/info overlay.
  game.setMode('playing');
  game.notify('floor',{floor:next});
  game.notify('autosave',{floor:next});
}

export function interactHint(game){
    if(game.mode!=='playing')return '';
    const w=game.world,p=game.player,t=pt(p.x,p.y),tile=status(w,p);
    if(game.tutorial&&tile===T.STAIRS)return '[ENTER] 튜토리얼 완료';
    if(tile===T.ELEVATOR||tile===T.BROKEN)return '[E] 엘리베이터 · 보석 5개';
    if(tile===T.STAIRS)return w.boss&&!w.bossDefeated?'보스를 먼저 처치하세요':'계단 · 다음 층 상점';
    return game.tutorial?'노란 출구로 이동':'';
  }
