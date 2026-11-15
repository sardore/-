// Classic combat logic. Receives game explicitly; no DOM dependencies.
import {T,TILE} from '../config.js';
import {TIMES,DIRS,pt,center} from './rules.js';

export function attack(game){
    if(game.mode!=='playing'||game.player.attackCd>0)return false;
    const p=game.player,w=game.world,st=game.weaponStats();
    p.attackCd=st.rate;game.attackFlash=.16;game.atkTiles=[];p.attackPulse=.16;
    const face=DIRS[Math.round(p.facing/(Math.PI/2))&3]||DIRS[0],start=pt(p.x,p.y);
    for(let k=1;k<=st.range;k++){
      const x=start.x+face[0]*k,y=start.y+face[1]*k;
      if(x<0||y<0||x>=w.w||y>=w.h)break;
      game.atkTiles.push({x,y});
      if(st.breaks&&w.tiles[y*w.w+x]===T.RUBBLE){
        w.tiles[y*w.w+x]=T.FLOOR;game.visionDirty=true;
        game.sparks((x+.5)*TILE,(y+.5)*TILE,'#cbb99e',16);
      }
      for(const e of w.enemies){
        if(e.dead)continue;
        const t=pt(e.x,e.y),onBoss=(e.kind==='bossSpider'||e.kind==='bossKing');
        if(onBoss?game.bossTiles(e).some(t=>t.x===x&&t.y===y):t.x===x&&t.y===y){
          // Each enemy is hit once per attack, even if a multi-tile boss spans several cells.
          if(e.lastHit===game.time)continue;
          e.lastHit=game.time;e.hp-=st.power;e.hit=.16;
          w.effects.push({type:'text',x:e.x,y:e.y-e.r-8,life:.62,max:.62,vy:-26,
            color:onBoss?'#ffe4a2':'#b9f6ff',text:'−'+st.power});
          game.sparks(e.x,e.y,'#a9deff',12);
          if(onBoss)game.score+=3;
          if(e.hp<=0)game.killEnemy(e);
        }
      }
      if(w.tiles[y*w.w+x]===T.WALL)break;
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    game.sound('swing');return true;
  }

export function bossTiles(game,e){
    const t=pt(e.x,e.y);
    return [t,{x:t.x-1,y:t.y-1},{x:t.x+1,y:t.y-1},{x:t.x-1,y:t.y+1},{x:t.x+1,y:t.y+1}];
  }

export function killEnemy(game,e){
    if(e.dead)return;
    e.dead=true;game.sparks(e.x,e.y,'#acbdeb',23);
    const isBoss=e.kind==='bossSpider'||e.kind==='bossKing';
    if(isBoss){
      game.score+=1200;
      game.world.bossDefeated=true;
      // Original Python enters STATE_END on both boss floors; retain that
      // outcome but offer an explicit 11F continuation to make 20F accessible.
      if(game.world.floor===20)game.end(true);
      else {game.setMode('midclear');game.say('10층 보스 격파 · 게임 종료 또는 11층 계속 진행',5);}
    }else{
      game.score+=50;game.addXP(5);game.kills++;game.player.kills++;
    }
    game.sound(isBoss?'boss':'hit');
  }

export function damagePlayer(game,amount){
    const p=game.player;
    if(game.mode!=='playing'||p.invuln>0||p.dash>0)return false;
    let value=amount;
    if(p.equippedSlot!==null&&game.activeSlot()?.id==='shield'){
      const lvl=game.activeSlot().level;
      if(game.rng.rand()<Math.min(.18,.04+.015*lvl))value=0;
      else if(game.rng.rand()<Math.min(.45,.18+.025*lvl))value=Math.max(0,value-1);
    }
    if(value<=0){game.say('방패로 공격을 막았습니다!',1.2);return false;}
    if(p.hp-value<=0&&p.petCount>0){p.petCount--;p.hp=1;game.say('수호 천사가 희생했습니다! 남은 '+p.petCount,4);}
    else p.hp=Math.max(0,p.hp-value);
    game.world.effects.push({type:'text',x:p.x,y:p.y-20,life:.7,max:.7,vy:-25,
      color:'#ff9bad',text:'−'+value});
    p.invuln=TIMES.iframe;game.flash=.14;game.shake=.17;game.sparks(p.x,p.y,'#ff9aab',12);
    game.sound('hurt');if(p.hp<=0)game.end(false);
    return true;
  }

export function dash(game){
    const p=game.player,s=game.activeSlot();
    if(game.mode!=='playing'||!s||s.type!=='weapon'||s.id!=='spear'||s.level<3||p.dashUsed)return false;
    p.dashUsed=true;p.dash=.52;p.invuln=.52;const face=DIRS[Math.round(p.facing/(Math.PI/2))&3]||DIRS[0],w=game.world;
    let t=pt(p.x,p.y);
    for(let n=0;n<Math.max(1,s.level*2);n++){
      const x=t.x+face[0],y=t.y+face[1];
      if(x<1||y<1||x>=w.w-1||y>=w.h-1)break;
      const ix=y*w.w+x;if([T.WALL,T.RUBBLE].includes(w.tiles[ix])){
        w.tiles[ix]=T.FLOOR;game.visionDirty=true;
      }
      for(const e of w.enemies){
        if(e.dead)continue;
        if(game.bossTiles(e).some(a=>a.x===x&&a.y===y)&&e.kind.startsWith('boss')){
          e.hp-=game.weaponStats().power*10;if(e.hp<=0)game.killEnemy(e);
        }else if(Math.floor(e.x/TILE)===x&&Math.floor(e.y/TILE)===y)game.killEnemy(e);
      }
      t={x,y};game.sparks((x+.5)*TILE,(y+.5)*TILE,'#7cf6f2',5);
    }
    const end=center(t.x,t.y);p.x=end.x;p.y=end.y;w.enemies=w.enemies.filter(e=>!e.dead);
    game.say('창 돌진! 이번 층 사용 완료',2);game.sound('dash');return true;
  }

export function burst(game){return false;}
