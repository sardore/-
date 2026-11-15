// Classic progression logic. Receives game explicitly; no DOM dependencies.
import {T,TILE} from '../config.js';
import {generateFloor,refreshVision} from '../world.js';
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
    if(game.tutorial&&tile===T.STAIRS)game.say('노란 출구입니다. Enter를 누르세요.',1.4);
    if(!game.tutorial&&tile===T.STAIRS){
      if(w.boss){if(w.bossDefeated)game.advance(1);else game.say('보스를 먼저 처치해야 합니다.',2);}
      else game.openShop();
    }
  }

export function interact(game){
    if(game.mode!=='playing')return false;
    const p=game.player,w=game.world,t=pt(p.x,p.y);
    const tile=w.tiles[t.y*w.w+t.x];
    if(game.tutorial&&tile===T.STAIRS){game.advance(1);return true;}
    if(tile===T.STAIRS){if(w.boss&&!w.bossDefeated)return false;game.advance(1);return true;}
    if(tile!==T.ELEVATOR&&tile!==T.BROKEN){game.say('엘리베이터 위에서 E를 누르세요.',2);return false;}
    if([9,19].includes(w.floor)){game.say('이 층의 엘리베이터는 작동하지 않습니다.',2);return false;}
    if(p.gems<5){game.say('엘리베이터에는 보석 5개가 필요합니다.',2);return false;}
    p.gems-=5;
    if(tile===T.BROKEN){game.damagePlayer(Math.floor(p.hp/2));if(game.mode!=='playing')return false;}
    game.advance(1);return true;
  }

export function advance(game,n=1){
    const next=game.tutorial?1:game.world.floor+n;
    if(next>20){game.end(true);return;}
    game.tutorial=false;game.world=generateFloor(next,game.seed);
    const w=game.world,p=game.player;const isBoss=next===10||next===20;
    for(const e of w.enemies){
      const originalKind={hound:'wanderer',spider:'wanderer',sentinel:'digger'};
      e.kind=originalKind[e.kind]||e.kind;
      e.moveAcc=game.rng.rand()*.34;e.cd=game.rng.rand()*.35;e.see=0;e.slow=0;
      e.hp=e.maxHp=e.kind.startsWith('boss')?(next===10?72:96):1;
      e.damage=e.kind==='sniper'?1+Math.floor((next-1)/7):1+Math.floor((next-1)/3);
      e.r=e.kind.startsWith('boss')?14:10;
      e.bossPhase='idle';e.bossTimer=0;e.bossSteps=0;e.bossDir={x:0,y:0};e.summon1=false;e.summon2=false;
    }
    w.enemies=w.enemies.filter(e=>isBoss?e.kind.startsWith('boss'):!e.kind.startsWith('boss'));
    if(isBoss){
      const boss=w.enemies.find(e=>e.kind.startsWith('boss'));
      if(boss){const dest=center(Math.floor(w.w/2),5);boss.x=dest.x;boss.y=dest.y;}
    }
    p.x=(w.start.x+.5)*TILE;p.y=(w.start.y+.5)*TILE;
    p.dashUsed=false;p.invuln=.5;p.dash=0;p.dashCd=0;p.attackCd=0;
    p.maxFloor=Math.max(next,p.maxFloor);
    if(next!==1){game.score+=200;game.addXP(10);}
    game.shopFloor=null;game.shopOffers=[];game.shopSold=[];
    game.flow=null;game.flowTimer=0;game.visionTimer=0;game.visionTile='';
    refreshVision(w,p.x,p.y,13);
    game.say(next===10?'10층 · 메가 스파이더':next===20?'20층 · 최종 보스':next+'층에 진입했습니다.',4);
    game.notify('floor',{floor:next});
    game.notify('autosave',{floor:next});
    game.setMode('playing');
  }

export function interactHint(game){
    if(game.mode!=='playing')return '';
    const w=game.world,p=game.player,t=pt(p.x,p.y),tile=status(w,p);
    if(game.tutorial&&tile===T.STAIRS)return '[ENTER] 튜토리얼 완료';
    if(tile===T.ELEVATOR||tile===T.BROKEN)return '[E] 엘리베이터 · 보석 5개';
    if(tile===T.STAIRS)return w.boss&&!w.bossDefeated?'보스를 먼저 처치하세요':'계단 · 다음 층 상점';
    return game.tutorial?'노란 출구로 이동':'';
  }
