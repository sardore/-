// Guardian Angel logic, matching the original's range, cooldown and 0.1 damage.
import {TILE} from '../config.js';
import {lineOfSight} from '../world.js';
import {D,pt} from './rules.js';

function eligible(game,e){
  const w=game.world,p=game.player,x=Math.floor(e.x/TILE),y=Math.floor(e.y/TILE);
  const index=y*w.w+x;
  if(x<0||y<0||x>=w.w||y>=w.h||!w.visible[index])return false;
  return D(pt(p.x,p.y),{x,y})<=11&&lineOfSight(w,p.x,p.y,e.x,e.y);
}
export function petTick(game,dt){
  const p=game.player,w=game.world;
  p.petLaserTime=Math.max(0,(p.petLaserTime||0)-dt);
  if(!p.petCount)return;
  p.petCd=Math.max(0,(p.petCd||0)-dt);
  if(p.petCd>0)return;
  const minions=w.enemies.filter(e=>!e.dead&&!e.kind.startsWith('boss')&&eligible(game,e));
  const boss=w.enemies.find(e=>!e.dead&&e.kind.startsWith('boss')&&eligible(game,e));
  if(!minions.length&&!boss)return;
  const chooseBoss=!!boss&&(!minions.length||game.rng.rand()<.35);
  const chosen=chooseBoss?boss:minions.sort((a,b)=>D(pt(p.x,p.y),pt(a.x,a.y))-D(pt(p.x,p.y),pt(b.x,b.y)))[0];
  if(!chosen)return;
  p.petLaserTime=.14;p.petLaserFrom={x:p.x,y:p.y};
  p.petLaserTo={x:chosen.x,y:chosen.y};
  chosen.hp-=.1;
  game.sparks(chosen.x,chosen.y,'#ffe9a9',18+8*Math.min(4,p.petCount));
  if(chooseBoss)game.score+=3;
  else chosen.slow=Math.max(chosen.slow||0,1.6);
  if(chosen.hp<=0){
    // Original Angel kill awards 40 points instead of the normal 50.
    if(chooseBoss)game.killEnemy(chosen);
    else{
      chosen.dead=true;
      game.score+=40;game.kills++;p.kills++;game.addXP(5);
      game.sparks(chosen.x,chosen.y,'#fff0c9',28);
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
  }
  p.petCd=p.petCount>=2?.65:.9;
  game.sound('hit');
}
