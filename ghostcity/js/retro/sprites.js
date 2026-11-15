import {T,TILE} from '../config.js';
import {ORIGINAL_COLOR as C,ORIGINAL_THEME} from './palette.js';

const fill=(ctx,color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
function border(ctx,color,x,y,w,h,size=2){
  ctx.strokeStyle=color;ctx.lineWidth=size;
  ctx.strokeRect(x+size/2,y+size/2,w-size,h-size);
}
function circle(ctx,color,x,y,r,outline=null){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  if(outline){ctx.strokeStyle=outline;ctx.lineWidth=2;ctx.stroke();}
}
function inner(ctx,color,x,y,inset){fill(ctx,color,x+inset,y+inset,TILE-2*inset,TILE-2*inset);}

export function drawGround(ctx,x,y,t,visible,theme,isTreasure=false){
  // In the original, unexplored rooms are pure black. Previously seen cells
  // render only base floor/wall in deliberately flat, dim source colors.
  const pal=ORIGINAL_THEME[theme];
  fill(ctx,t===T.WALL?(visible?pal.wall:pal.wallDim):
    visible?(isTreasure?pal.treasure:pal.floor):pal.floorDim,x,y,TILE,TILE);
  if(visible){
    if(t===T.DOOR)inner(ctx,C.door,x,y,4);
    else if(t===T.RUBBLE)inner(ctx,C.furniture,x,y,3);
    else if(t===T.GLASS)inner(ctx,C.window,x,y,5);
    else if(t===T.STAIRS)inner(ctx,C.stairs,x,y,3);
    else if(t===T.ELEVATOR)inner(ctx,C.elevator,x,y,3);
    else if(t===T.BROKEN)inner(ctx,C.broken,x,y,3);
    else if(t===T.TUTOR_EXIT){
      inner(ctx,C.tutorial,x,y,4);
      border(ctx,C.tutorialBorder,x+4,y+4,TILE-8,TILE-8,2);
    }
  }
  border(ctx,C.grid,x,y,TILE,TILE,1);
}
export function drawPickup(ctx,it,x,y){
  // Corresponds to original draw_world: ground symbols are flat and static.
  const mid=x+TILE/2,r=TILE/4,cy=y+TILE/2;
  switch(it.type){
    case 'gem': circle(ctx,C.gem,mid,cy,r);break;
    case 'cheap':
    case 'potion':circle(ctx,C.potion,mid,cy,r,C.potionBorder);break;
    case 'amulet':circle(ctx,C.amulet,mid,cy,r,C.amuletBorder);break;
    case 'ticket':
      circle(ctx,C.ticket,mid,cy,r,C.ticketBorder);
      ctx.beginPath();ctx.arc(mid,cy,TILE/5,0,Math.PI*2);
      ctx.strokeStyle=C.ticketInner;ctx.lineWidth=2;ctx.stroke();break;
    case 'weapon':
      ctx.beginPath();ctx.moveTo(mid,y+6);ctx.lineTo(x+6,y+TILE-6);
      ctx.lineTo(x+TILE-6,y+TILE-6);ctx.closePath();
      ctx.fillStyle=C.weapon;ctx.fill();ctx.strokeStyle=C.weaponBorder;
      ctx.lineWidth=2;ctx.stroke();break;
    default:circle(ctx,C.gem,mid,cy,r);
  }
}
export function drawEnemy(ctx,e,x,y,now=0){
  // One rectangle per enemy, matching the original kind-based visual language.
  const c=e.kind==='sniper'?[C.sniper,C.sniperBorder]:
    e.kind==='witch'?[e.blink>0?C.witchFlash:C.witch,C.witchBorder]:
    e.kind==='digger'?[C.digger,C.diggerBorder]:[C.melee,C.meleeBorder];
  inner(ctx,c[0],x,y,3);
  border(ctx,c[1],x+3,y+3,TILE-6,TILE-6,2);
  if(e.slow>0)border(ctx,C.slow,x+2,y+2,TILE-4,TILE-4,2);
}
export function drawBossCell(ctx,e,x,y,isLeg,now=0){
  const bright=e.bossPhase==='blink'&&Math.floor(now/.09)%2===0;
  const legFlip=Math.floor(now/.16)%2===0;
  inner(ctx,bright?C.bossFlash:C.boss,x,y,2);
  border(ctx,C.bossBorder,x+2,y+2,TILE-4,TILE-4,2);
  if(isLeg)border(ctx,legFlip?C.bossLegAlt:C.bossLeg,x+1,y+1,TILE-2,TILE-2,2);
}
export function drawPlayer(ctx,x,y){
  inner(ctx,C.player,x,y,3);
  border(ctx,C.playerBorder,x+3,y+3,TILE-6,TILE-6,2);
}
export function drawAngel(ctx,x,y){
  circle(ctx,C.angel,x,y,Math.max(5,Math.floor(TILE/4)),C.angelBorder);
}
