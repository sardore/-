// Classic enemies logic. Receives game explicitly; no DOM dependencies.
import {T,TILE} from '../config.js';
import {lineOfSight} from '../world.js';
import {TIMES,DIRS,D,pt,center,at,safeTile} from './rules.js';

export function enemyStep(game,e){
    const w=game.world,p=game.player,from=pt(e.x,e.y),target=pt(p.x,p.y);
    // Once per discrete monster action, choose the nearest reachable adjacent tile.
    let best=null,bestScore=Infinity;
    for(const [dx,dy] of DIRS){
      const nx=from.x+dx,ny=from.y+dy;
      if(nx===target.x&&ny===target.y){
        game.damagePlayer(e.damage);
        const kb={x:target.x+dx,y:target.y+dy};
        if(safeTile(w,kb.x,kb.y)){const c=center(kb.x,kb.y);p.x=c.x;p.y=c.y;}
        return;
      }
      if(!safeTile(w,nx,ny)){
        if(e.kind==='digger'&&nx>0&&ny>0&&nx<w.w-1&&ny<w.h-1&&w.tiles[ny*w.w+nx]===T.RUBBLE){
          w.tiles[ny*w.w+nx]=T.FLOOR;game.sparks((nx+.5)*TILE,(ny+.5)*TILE,'#ccb79a',12);
        }
        continue;
      }
      const candidate={x:nx,y:ny},sc=D(candidate,target)+game.rng.rand()*.04;
      if(sc<bestScore){bestScore=sc;best=candidate;}
    }
    if(best){const c=center(best.x,best.y);e.x=c.x;e.y=c.y;}
  }

export function shooterTick(game,e,dt){
    const w=game.world,p=game.player;
    const visible=w.visible[Math.floor(e.y/TILE)*w.w+Math.floor(e.x/TILE)]&&
      lineOfSight(w,e.x,e.y,p.x,p.y);
    if(e.kind==='witch'){
      if(visible)e.see=(e.see||0)+dt;
      else e.see=0;
      if(e.see>=4){
        e.see=0;
        for(let i=0;i<2;i++){
          for(let tries=0;tries<30;tries++){
            const pos=pt(e.x,e.y),x=pos.x+game.rng.int(-2,2),y=pos.y+game.rng.int(-2,2);
            if(safeTile(w,x,y)){const c=center(x,y);w.enemies.push({kind:'wanderer',x:c.x,y:c.y,r:10,hp:1,maxHp:1,
              damage:1+Math.floor((w.floor-1)/3),moveAcc:0,cd:0,hit:0,teleport:0});break;}
          }
        }
        game.say('마녀가 망령 2마리를 소환했습니다.',2);
      }
    }
    e.cd-=dt;
    if(visible&&e.cd<=0){
      e.cd=e.kind==='witch'?TIMES.witch:TIMES.sniper;
      game.world.effects.push({x:e.x,y:e.y,life:.28,max:.28,type:'ring',radius:0,
        color:e.kind==='witch'?'#c77dff':'#ff7f9a'});
      game.damagePlayer(e.damage);
      game.sound('enemyShoot');
    }
  }

export function bossTick(game,e,dt){
    const w=game.world,p=game.player;
    e.bossTimer+=dt;const t=pt(e.x,e.y),target=pt(p.x,p.y);
    const bossRange=Math.max(0,1-e.hp/e.maxHp);
    if(e.bossPhase==='idle'){
      if(e.bossTimer>=1.3-.88*Math.pow(bossRange,.85)){
        e.bossPhase='blink';e.bossTimer=0;e.blinkCount=0;
      }
    }else if(e.bossPhase==='blink'){
      if(e.bossTimer>=.09){
        e.blinkCount++;e.bossTimer=0;
        if(e.blinkCount>=5){
          e.bossPhase='dash';e.bossSteps=14;
          e.bossDir=Math.abs(target.x-t.x)>=Math.abs(target.y-t.y)?
            {x:Math.sign(target.x-t.x),y:0}:{x:0,y:Math.sign(target.y-t.y)};
        }
      }
    }else if(e.bossPhase==='dash'){
      while(e.bossTimer>=.026&&e.bossSteps>0){
        e.bossTimer-=.026;e.bossSteps--;
        const q=pt(e.x,e.y),xx=q.x+e.bossDir.x,yy=q.y+e.bossDir.y;
        const blocks=[{x:xx,y:yy},{x:xx-1,y:yy-1},{x:xx+1,y:yy-1},
          {x:xx-1,y:yy+1},{x:xx+1,y:yy+1}];
        if(!blocks.every(a=>a.x>1&&a.y>1&&a.x<w.w-2&&a.y<w.h-2&&w.tiles[a.y*w.w+a.x]!==T.WALL)){
          e.bossSteps=0;break;
        }
        const c=center(xx,yy);e.x=c.x;e.y=c.y;
        for(const b of blocks)if(w.tiles[b.y*w.w+b.x]===T.RUBBLE)w.tiles[b.y*w.w+b.x]=T.FLOOR;
      }
      if(e.bossSteps<=0){e.bossPhase='recover';e.bossTimer=0;}
    }else if(e.bossPhase==='recover'&&e.bossTimer>.3){e.bossPhase='idle';e.bossTimer=0;}
    if(game.bossTiles(e).some(q=>at(q,pt(p.x,p.y))))game.damagePlayer(2);
    if(!e.summon1&&e.hp<=e.maxHp*.66){e.summon1=true;game.spawnMinions(e,4);}
    if(!e.summon2&&e.hp<=e.maxHp*.33){e.summon2=true;game.spawnMinions(e,4);}
  }

export function spawnMinions(game,boss,n){
    const w=game.world,base=pt(boss.x,boss.y);
    for(let i=0;i<n;i++)for(let j=0;j<50;j++){
      const x=base.x+game.rng.int(-6,6),y=base.y+game.rng.int(-6,6);
      if(safeTile(w,x,y)){const c=center(x,y);w.enemies.push({kind:'wanderer',x:c.x,y:c.y,r:10,hp:1,maxHp:1,
        damage:1+Math.floor((w.floor-1)/3),moveAcc:0,cd:0,hit:0,teleport:0});break;}
    }
    game.say('보스가 망령을 소환했습니다.',2);
  }
