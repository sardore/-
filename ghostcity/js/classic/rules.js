// Original timing, equipment and tile utilities. Shared by isolated classic systems.
import {T,TILE} from '../config.js';
export const TIMES={player:.09,monster:.340,iframe:.40,pet:.9,sniper:.9,witch:2.7};
export const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
export const D=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const pt=(x,y)=>({x:Math.floor(x/TILE),y:Math.floor(y/TILE)});
export const center=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
export const at=(a,b)=>a.x===b.x&&a.y===b.y;
export const spec=Object.freeze({
  axe:{name:'도끼',range:2,base:1.7,power:3,scale:.94,breaks:false},
  spear:{name:'창',range:4,base:1.5,power:2,scale:.95,breaks:false},
  sword:{name:'검',range:3,base:1.2,power:2,scale:.93,breaks:false},
  shield:{name:'방패',range:2,base:1.8,power:1,scale:.97,breaks:false},
  hammer:{name:'망치',range:3,base:1.65,power:3,scale:.94,breaks:true}
});
export const keys=Object.keys(spec);
export const makeWeapon=(id,level=1)=>({type:'weapon',id,level});
export const makeItem=(type)=>({type});
export function status(w,p){
  const t=pt(p.x,p.y);
  if(t.x<0||t.y<0||t.x>=w.w||t.y>=w.h)return T.WALL;
  return w.tiles[t.y*w.w+t.x];
}
export function safeTile(w,x,y,ignore=null){
  if(x<1||y<1||x>=w.w-1||y>=w.h-1)return false;
  const t=w.tiles[y*w.w+x];
  if(t===T.WALL||t===T.RUBBLE)return false;
  if(ignore!==true&&w.enemies.some(e=>!e.dead&&Math.floor(e.x/TILE)===x&&Math.floor(e.y/TILE)===y))return false;
  return true;
}
export function tutorialWorld(seed){
  const w=40,h=22,tiles=new Uint8Array(w*h);tiles.fill(T.WALL);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)tiles[y*w+x]=T.FLOOR;
  for(let x=10;x<16;x++)tiles[8*w+x]=T.WALL;
  for(let y=12;y<15;y++)tiles[y*w+22]=T.WALL;
  tiles[14*w+23]=T.RUBBLE;tiles[14*w+24]=T.RUBBLE;
  const stair={x:w-3,y:h-3};
  tiles[stair.y*w+stair.x]=T.TUTOR_EXIT;
  tiles[4*w+4]=T.STAIRS;
  return {floor:0,w,h,tiles,visible:new Uint8Array(w*h),seen:new Uint8Array(w*h),
    start:{x:2,y:2},stairs:stair,rooms:[],enemies:[],pickups:[
      {...center(30,6),type:'gem',value:1},
      {...center(30,7),type:'cheap',value:1}
    ],effects:[],projectiles:[],boss:false,bossDefeated:false,seed,decorSeed:seed};
}
export const price=Object.freeze({potion:4,amulet:18,ticket:20,pet:24,maxhp:9,axe:11,spear:11,sword:11,shield:11,hammer:13});
export function owned(p,id){return p.slots.some(s=>s?.type==='weapon'&&s.id===id);}
export function addSlot(p,item){const index=p.slots.findIndex(s=>!s);if(index<0)return false;p.slots[index]=item;return true;}
export function kindFor(e){return e.kind==='sniper'?'sniper':e.kind==='witch'?'witch':e.kind==='digger'?'digger':e.kind==='spider'?'spider':e.kind==='hound'?'hound':'wanderer';}
