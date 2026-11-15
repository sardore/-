// Classic persistence logic. Receives game explicitly; no DOM dependencies.
import {makeRng} from '../config.js';
import {refreshVision,serializeWorld,restoreWorld} from '../world.js';
import {tutorialWorld} from './rules.js';

export function serialize(game){
    return JSON.stringify({version:1,seed:game.seed,player:game.player,world:serializeWorld(game.world),
      tutorial:game.tutorial,elapsed:game.elapsed,kills:game.kills,score:game.score,time:game.time,
      shopFloor:game.shopFloor,shopOffers:game.shopOffers,shopSold:game.shopSold});
  }

export function restore(game,raw){
    try{
      const data=JSON.parse(raw);
      if(data.version!==1||!data.player?.slots||!data.world)throw Error('Invalid save');
      game.seed=data.seed>>>0;game.rng=makeRng(game.seed);
      if(data.tutorial){
        const w=tutorialWorld(game.seed);
        w.tiles=Uint8Array.from(data.world.tiles||[]);
        w.pickups=data.world.pickups||[];
        w.seen=Uint8Array.from(data.world.seen||[]);
        if(w.tiles.length!==w.w*w.h)throw Error('bad tutorial tiles');
        if(w.seen.length!==w.w*w.h)w.seen=new Uint8Array(w.w*w.h);
        game.world=w;
      }else game.world=restoreWorld(data.world);
      game.player=data.player;
      game.tutorial=!!data.tutorial;game.elapsed=data.elapsed||0;
      game.kills=data.kills||0;game.score=data.score||0;game.time=data.time||0;
      game.shopFloor=data.shopFloor;game.shopOffers=data.shopOffers||[];
      game.shopSold=data.shopSold||[];game.runEnded=false;game.mode='playing';
      game.flow=null;game.flowTimer=0;game.moveCd=0;game.messages=[];
      game.syncInventory();refreshVision(game.world,game.player.x,game.player.y,13);
      game.notify('mode',{mode:'playing'});return true;
    }catch{return false;}
  }
