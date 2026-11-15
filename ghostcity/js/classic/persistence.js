// Versioned save codec for the original 40×22 tutorial, 60×30 levels
// and 45×27 boss arenas. No dependency on the abandoned fixed-size renderer model.
import {makeRng,TILE} from '../config.js';
import {refreshVision} from '../world.js';
import {tutorialWorld} from './rules.js';

const VERSION=2;
const validNumber=n=>Number.isFinite(n)&&Math.abs(n)<1e10;
function serializeWorld(w){
  return {floor:w.floor,seed:w.seed,w:w.w,h:w.h,
    tiles:Array.from(w.tiles),seen:Array.from(w.seen),
    rooms:w.rooms||[],enemies:w.enemies||[],pickups:w.pickups||[],
    projectiles:w.projectiles||[],start:w.start,stairs:w.stairs,
    boss:w.boss,bossDefeated:w.bossDefeated,decorSeed:w.decorSeed,
    treasure:w.treasure||[]};
}
function reviveWorld(source,seed){
  const w=Number(source.w),h=Number(source.h);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<20||h<20||w>70||h>50||
    !Array.isArray(source.tiles)||source.tiles.length!==w*h)throw Error('bad map');
  const seen=Array.isArray(source.seen)&&source.seen.length===w*h?
    Uint8Array.from(source.seen):new Uint8Array(w*h);
  return {floor:source.floor,seed:source.seed||seed,w,h,
    tiles:Uint8Array.from(source.tiles),seen,visible:new Uint8Array(w*h),
    rooms:source.rooms||[],enemies:source.enemies||[],pickups:source.pickups||[],
    effects:[],projectiles:[],start:source.start||{x:2,y:2},stairs:source.stairs||null,
    boss:!!source.boss,bossDefeated:!!source.bossDefeated,
    decorSeed:source.decorSeed||seed,treasure:source.treasure||[]};
}
export function serialize(game){
  return JSON.stringify({version:VERSION,mode:game.mode,
    seed:game.seed,rngState:game.rng.state,luck:game.luck,playerName:game.playerName||'NONAME',player:game.player,world:serializeWorld(game.world),
    tutorial:game.tutorial,elapsed:game.elapsed,kills:game.kills,
    score:game.score,time:game.time,shopFloor:game.shopFloor,
    shopOffers:game.shopOffers,shopSold:game.shopSold});
}
export function restore(game,raw){
  try{
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!data||![1,2].includes(data.version)||!data.player||!data.world)throw Error('invalid save');
    const p=data.player;
    if(!Array.isArray(p.slots)||p.slots.length!==7||!validNumber(p.x)||!validNumber(p.y)||
      !validNumber(p.hp)||!validNumber(p.maxHp)||p.maxHp<1||p.hp<0||p.hp>p.maxHp)
      throw Error('invalid survivor');
    const w=reviveWorld(data.world,data.seed);
    if(p.x<0||p.y<0||p.x>=w.w*TILE||p.y>=w.h*TILE)throw Error('invalid player position');
    if(!!data.tutorial&&w.floor!==0)throw Error('invalid tutorial');
    if(!data.tutorial&&(!Number.isInteger(w.floor)||w.floor<1||w.floor>20))throw Error('invalid floor');
    game.seed=data.seed>>>0;
    // Continue the random stream instead of restarting enemy/shop randomness on reload.
    game.rng=makeRng(Number.isInteger(data.rngState)?data.rngState:game.seed);
    game.luck=Number.isFinite(data.luck)?data.luck:.16;
    game.playerName=String(data.playerName||'NONAME').replace(/[<>&"']/g,'').slice(0,18)||'NONAME';
    game.world=w;game.player=p;game.tutorial=!!data.tutorial;
    game.elapsed=Number(data.elapsed)||0;game.time=Number(data.time)||0;
    game.kills=Number(data.kills)||0;game.score=Number(data.score)||0;
    game.shopFloor=data.shopFloor??null;
    game.shopOffers=Array.isArray(data.shopOffers)?data.shopOffers:[];
    game.shopSold=Array.isArray(data.shopSold)?data.shopSold:[];
    game.runEnded=false;game.flow=null;game.flowTimer=0;game.moveCd=0;
    game.visionTile=null;game.visionDirty=true;
    game.messages=[];game.sniperWarnings=[];game.shake=0;game.flash=0;
    game.syncInventory();
    const savedMode=['shop','info','midclear'].includes(data.mode)?data.mode:'playing';
    game.mode=savedMode;
    refreshVision(w,p.x,p.y,w.floor>=11?6:13);
    game.notify('mode',{mode:savedMode});
    game.say('저장된 탐험을 불러왔습니다.',3);
    return true;
  }catch{return false;}
}
