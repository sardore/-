// Faithful original Monster/Boss behaviours. All motion stays tile-aligned.
// Main-loop timers are in seconds; the Pygame source expresses them as milliseconds.
import {T,TILE} from '../config.js';
import {lineOfSight} from '../world.js';
import {TIMES,DIRS,D,pt,center,at,safeTile} from './rules.js';

const inRange=(w,x,y)=>x>0&&y>0&&x<w.w-1&&y<w.h-1;
const key=(w,x,y)=>y*w.w+x;
const visibleAndLOS=(w,e,p)=>{
  const q=pt(e.x,e.y),t=pt(p.x,p.y);
  return q.x>=0&&q.y>=0&&q.x<w.w&&q.y<w.h&&w.visible[key(w,q.x,q.y)]&&
    lineOfSight(w,e.x,e.y,p.x,p.y);
};
function preferred(from,to){
  const dx=to.x-from.x,dy=to.y-from.y;
  const choices=Math.abs(dx)>=Math.abs(dy)?
    [[Math.sign(dx),0],[0,Math.sign(dy)]]:
    [[0,Math.sign(dy)],[Math.sign(dx),0]];
  return [...choices,...DIRS].filter(([x,y],i,a)=>(x||y)&&a.findIndex(([xx,yy])=>xx===x&&yy===y)===i);
}
function pushKnockback(game,e){
  const p=game.player,from=pt(e.x,e.y),target=pt(p.x,p.y);
  const delta={x:target.x-from.x,y:target.y-from.y};
  const off=Math.abs(delta.x)>=Math.abs(delta.y)?
    {x:Math.sign(delta.x),y:0}:{x:0,y:Math.sign(delta.y)};
  const x=target.x+off.x,y=target.y+off.y;
  if(safeTile(game.world,x,y)){const c=center(x,y);p.x=c.x;p.y=c.y;}
}
function pathStep(w,e,start,target){
  const n=w.w*w.h;
  const parent=new Int32Array(n);parent.fill(-1);
  const visited=new Uint8Array(n),queue=new Int32Array(n);
  let head=0,tail=0;
  const first=key(w,start.x,start.y),dest=key(w,target.x,target.y);
  queue[tail++]=first;visited[first]=1;
  while(head<tail&&!visited[dest]){
    const u=queue[head++],x=u%w.w,y=Math.floor(u/w.w);
    for(const [dx,dy] of DIRS){
      const nx=x+dx,ny=y+dy;
      if(!inRange(w,nx,ny))continue;
      const v=key(w,nx,ny);
      if(visited[v])continue;
      if(nx!==target.x||ny!==target.y){
        // Monsters are blocking each other, as in the original 'blocked/newpos' sets.
        if(!safeTile(w,nx,ny))continue;
      }
      visited[v]=1;parent[v]=u;queue[tail++]=v;
    }
  }
  if(!visited[dest])return null;
  let cur=dest;
  while(parent[cur]>=0&&parent[cur]!==first)cur=parent[cur];
  if(parent[cur]!==first)return null;
  return {x:cur%w.w,y:Math.floor(cur/w.w)};
}
export function enemyStep(game,e){
  const w=game.world,p=game.player;
  const start=pt(e.x,e.y),target=pt(p.x,p.y);
  if(e.kind==='digger'){
    for(const [dx,dy] of preferred(start,target)){
      const x=start.x+dx,y=start.y+dy;
      if(!inRange(w,x,y))continue;
      const id=key(w,x,y),t=w.tiles[id];
      if(t===T.RUBBLE)continue; // diggers do not destroy furniture in the original.
      if(t===T.WALL){
        if(e.digCd>0)continue;
        w.tiles[id]=T.FLOOR;e.digCd=.220;
        game.sparks((x+.5)*TILE,(y+.5)*TILE,'#c7b1a1',28);
      }
      if(x===target.x&&y===target.y){
        game.damagePlayer(e.damage);
        if(game.mode==='playing')pushKnockback(game,e);
        return;
      }
      if(safeTile(w,x,y)){const next=center(x,y);e.x=next.x;e.y=next.y;return;}
    }
    return;
  }
  const step=pathStep(w,e,start,target);
  if(!step)return;
  if(at(step,target)){
    game.damagePlayer(e.damage);
    if(game.mode==='playing')pushKnockback(game,e);
  }else if(safeTile(w,step.x,step.y)){
    const next=center(step.x,step.y);e.x=next.x;e.y=next.y;
  }
}
export function shooterTick(game,e,dt){
  const w=game.world,p=game.player,q=pt(e.x,e.y),target=pt(p.x,p.y);
  const seeing=visibleAndLOS(w,e,p),distance=D(q,target);
  if(e.kind==='witch'){
    e.see=seeing?(e.see||0)+dt:0;
    if(e.see>=4){
      e.see=0;e.blink=.45;
      let created=0;
      for(let tries=0;tries<80&&created<2;tries++){
        const x=q.x+game.rng.int(-2,2),y=q.y+game.rng.int(-2,2);
        if(!inRange(w,x,y)||w.tiles[key(w,x,y)]!==T.FLOOR||
            at({x,y},target)||!safeTile(w,x,y))continue;
        const pos=center(x,y);
        w.enemies.push({kind:'wanderer',x:pos.x,y:pos.y,r:10,hp:1,maxHp:1,
          damage:1+Math.floor((w.floor-1)/3),moveAcc:0,cd:0,hit:0,slow:0,see:0,digCd:0});
        game.sparks(pos.x,pos.y,'#d591e9',16);created++;
      }
      if(created)game.say('마녀가 망령 '+created+'마리를 소환했습니다.',2);
    }
    e.blink=Math.max(0,(e.blink||0)-dt);
  }
  e.cd=Math.max(0,(e.cd||0)-dt*(e.slow>0?.7:1));
  if(!seeing||distance>9||e.cd>0)return;
  e.cd=e.kind==='witch'?2.7:.9;
  game.sniperWarnings.push({x:e.x,y:e.y,tx:p.x,ty:p.y,life:.28,max:.28,
    color:e.kind==='witch'?'#c779ef':'#fda0a9'});
  game.damagePlayer(e.damage);
  game.sound('enemyShoot');
}
function bossBlocks(w,x,y){
  return [{x,y},{x:x-1,y:y-1},{x:x+1,y:y-1},{x:x-1,y:y+1},{x:x+1,y:y+1}];
}
export function bossTick(game,e,dt){
  const w=game.world,p=game.player,q=pt(e.x,e.y),t=pt(p.x,p.y);
  e.bossTimer=(e.bossTimer||0)+dt;
  const missing=Math.max(0,1-e.hp/e.maxHp),cadence=1.3-.88*Math.pow(missing,.85);
  switch(e.bossPhase){
    case 'idle':
      if(e.bossTimer>=cadence){
        e.bossPhase='blink';e.bossTimer=0;e.blinkCount=0;
      }
      break;
    case 'blink':
      if(e.bossTimer>=.090){
        e.bossTimer=0;e.blinkCount++;
        if(e.blinkCount>=5){
          e.bossPhase='dash';e.bossTimer=0;e.bossSteps=14;
          e.bossDir=Math.abs(t.x-q.x)>=Math.abs(t.y-q.y)?
            {x:Math.sign(t.x-q.x),y:0}:{x:0,y:Math.sign(t.y-q.y)};
        }
      }
      break;
    case 'dash':
      while(e.bossTimer>=.026&&e.bossSteps>0){
        e.bossTimer-=.026;e.bossSteps--;
        const here=pt(e.x,e.y),nx=here.x+e.bossDir.x,ny=here.y+e.bossDir.y;
        const blocks=bossBlocks(w,nx,ny);
        if(!blocks.every(b=>inRange(w,b.x,b.y)&&w.tiles[key(w,b.x,b.y)]!==T.WALL)){
          e.bossSteps=0;break;
        }
        const next=center(nx,ny);e.x=next.x;e.y=next.y;
        const ids=new Set(blocks.map(b=>key(w,b.x,b.y)));
        for(const id of ids){
          if(w.tiles[id]===T.RUBBLE)w.tiles[id]=T.FLOOR;
          else if(w.tiles[id]===T.WALL)w.tiles[id]=T.FLOOR;
        }
        w.pickups=w.pickups.filter(item=>!ids.has(key(w,Math.floor(item.x/TILE),Math.floor(item.y/TILE))));
      }
      if(e.bossSteps<=0){e.bossPhase='recover';e.bossTimer=0;}
      break;
    case 'recover':
      if(e.bossTimer>=.520){e.bossPhase='idle';e.bossTimer=0;}
      break;
  }
  if(game.bossTiles(e).some(block=>at(block,pt(p.x,p.y))))game.damagePlayer(2);
  if(!e.summon1&&e.hp<=Math.floor(e.maxHp*.66)){e.summon1=true;game.spawnMinions(e,4);}
  if(!e.summon2&&e.hp<=Math.floor(e.maxHp*.33)){e.summon2=true;game.spawnMinions(e,4);}
}
export function spawnMinions(game,boss,n){
  const w=game.world,base=pt(boss.x,boss.y);
  for(let i=0;i<n;i++)for(let j=0;j<80;j++){
    const x=base.x+game.rng.int(-6,6),y=base.y+game.rng.int(-6,6);
    if(!inRange(w,x,y)||w.tiles[key(w,x,y)]!==T.FLOOR||
        game.bossTiles(boss).some(q=>q.x===x&&q.y===y)||!safeTile(w,x,y))continue;
    const c=center(x,y);
    w.enemies.push({kind:'wanderer',x:c.x,y:c.y,r:10,hp:1,maxHp:1,damage:1+Math.floor((w.floor-1)/3),
      moveAcc:0,cd:0,hit:0,slow:0,see:0,digCd:0});
    game.sparks(c.x,c.y,'#d3b4ec',20);break;
  }
  game.say('보스가 망령을 소환했습니다.',2);
}
