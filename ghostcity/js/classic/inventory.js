// Classic inventory logic. Receives game explicitly; no DOM dependencies.
import {T} from '../config.js';
import {DIRS,D,pt,center,spec,keys,makeWeapon,makeItem,price,owned,addSlot} from './rules.js';

export function activeSlot(game){return game.player.slots?.[game.player.equippedSlot]||null;}

export function syncInventory(game){
    const p=game.player;const weapons=p.slots.filter(s=>s?.type==='weapon');
    p.inventory=weapons.map(s=>s.id);p.weaponLevels=Object.fromEntries(weapons.map(s=>[s.id,s.level]));
    const e=game.activeSlot();p.weapon=e?.type==='weapon'?e.id:'spear';
    if(!e||e.type!=='weapon')p.equippedSlot=null;
    p.potions=p.slots.filter(s=>s?.type==='potion'||s?.type==='cheap').length;
  }

export function weapon(game){
    const item=game.activeSlot();
    if(item?.type==='weapon')return {...spec[item.id],id:item.id,level:item.level};
    return {name:'맨손',id:null,level:0,base:.7,power:.5,range:1,scale:1,breaks:false};
  }

export function weaponLevel(game){return game.activeSlot()?.level||0;}

export function weaponStats(game){
    const w=game.weapon();
    return {...w,rate:Math.max(w.id?.42:.25,w.base*Math.pow(w.scale,w.level))};
  }

export function changeWeapon(game,id){
    const idx=game.player.slots.findIndex(s=>s?.type==='weapon'&&s.id===id);
    return idx<0?false:game.useSlot(idx);
  }

export function cycleWeapon(game,dir=1){
    const p=game.player;let index=p.equippedSlot??0;
    for(let i=0;i<7;i++){
      index=(index+dir+7)%7;
      if(p.slots[index]?.type==='weapon')return game.useSlot(index);
    }
    return false;
  }

export function useSlot(game,index){
    const p=game.player,item=p.slots[index];if(!item)return false;
    if(item.type==='weapon'){
      p.equippedSlot=index;game.syncInventory();game.say(spec[item.id].name+' Lv.'+item.level+' 장착',1.4);game.sound('equip');return true;
    }
    if(item.type==='potion'||item.type==='cheap'){
      p.slots[index]=null;game.syncInventory();
      if(p.hp>=p.maxHp){game.say('이미 체력이 가득합니다.',2);return true;}
      if(item.type==='potion'){p.hp=Math.min(p.maxHp,p.hp+3);game.say('회복 물약 +3 HP',2);}
      else if(game.rng.rand()<.5){p.hp=Math.min(p.maxHp,p.hp+1);game.say('싸구려 물약 성공 +1 HP',2);}
      else game.say('싸구려 물약 실패',2);
      game.sound('heal');return true;
    }
    if(item.type==='ticket'){
      p.slots[index]=null;
      const weapons=p.slots.filter(s=>s?.type==='weapon');
      if(weapons.length){const w=game.rng.pick(weapons);if(w.level<=3){w.level=4;game.say('강화권: '+spec[w.id].name+' Lv.4',2);}}
      else{p.maxHpBonus+=.1;game.recomputeHp();game.say('무기가 없어 최대 HP +10%',2);}
      game.syncInventory();return true;
    }
    if(item.type==='amulet'){
      p.slots[index]=null;game.syncInventory();
      const cp=pt(p.x,p.y);
      for(const e of game.world.enemies){
        if(D(cp,pt(e.x,e.y))<=7){e.dead=true;game.score+=50;game.addXP(5);}
      }
      game.world.enemies=game.world.enemies.filter(e=>!e.dead);
      for(let y=Math.max(1,cp.y-7);y<Math.min(game.world.h-1,cp.y+8);y++)
        for(let x=Math.max(1,cp.x-7);x<Math.min(game.world.w-1,cp.x+8);x++)
          if(Math.hypot(x-cp.x,y-cp.y)<=7&&[T.WALL,T.RUBBLE].includes(game.world.tiles[y*game.world.w+x]))
            game.world.tiles[y*game.world.w+x]=T.FLOOR;
      game.sparks(p.x,p.y,'#cbafff',75,210);game.shake=.5;game.say('수호 부적 폭발!',3);
      return true;
    }
    return false;
  }

export function dropSlot(game,index){
    if(game.mode!=='inventory'&&game.mode!=='playing')return false;
    const p=game.player,item=p.slots[index];if(!item)return false;
    const here=pt(p.x,p.y);const around=[here,...DIRS.map(d=>({x:here.x+d[0],y:here.y+d[1]}))];
    const place=around.find(q=>q.x>0&&q.y>0&&q.x<game.world.w-1&&q.y<game.world.h-1&&game.world.tiles[q.y*game.world.w+q.x]===T.FLOOR);
    if(!place){game.say('버릴 공간이 없습니다.',2);return false;}
    game.world.pickups.push({...center(place.x,place.y),type:item.type==='weapon'?'weapon':item.type,weapon:item.id,level:item.level,value:1});
    p.slots[index]=null;if(p.equippedSlot===index)p.equippedSlot=null;
    game.syncInventory();game.say('아이템을 버렸습니다.',2);return true;
  }

export function offerPool(game){
    const p=game.player,pool=[];
    for(let i=0;i<9;i++)pool.push({type:'potion'});
    if(game.world.floor===4){for(let i=0;i<50;i++)pool.push({type:'ticket'});}
    else if(game.rng.rand()<.01)pool.push({type:'ticket'});
    if(game.rng.rand()<.05)pool.push({type:'amulet'});
    for(const id of keys){
      const count=owned(p,id)?3:1;
      for(let i=0;i<count;i++)pool.push({type:'weapon',id});
    }
    if(p.petCount<4&&game.rng.rand()<.15)pool.push({type:'pet'});
    const offers=[];
    while(offers.length<3&&pool.length){
      const i=game.rng.int(0,pool.length-1);
      offers.push(pool.splice(i,1)[0]);
    }
    return [...offers,{type:'maxhp'}];
  }

export function openShop(game){
    if(game.shopFloor!==game.world.floor){
      game.shopFloor=game.world.floor;game.shopOffers=game.offerPool();game.shopSold=[false,false,false,false];
    }
    game.setMode('shop');game.say('층 출구 상점 · 물건을 구매하거나 다음 층으로',3);
  }

export function buy(game,index){
    if(game.mode!=='shop')return false;
    const n=Number(index),offer=game.shopOffers[n],p=game.player;
    if(!offer||game.shopSold[n])return false;
    const id=offer.type==='weapon'?offer.id:offer.type;
    const cost=price[id]??12;
    if(p.gems<cost){game.say('보석이 부족합니다.',2);return false;}
    if(offer.type==='weapon'){
      const old=p.slots.find(x=>x?.type==='weapon'&&x.id===offer.id);
      if(!old&&!addSlot(p,makeWeapon(offer.id,1))){game.say('가방이 가득 찼습니다.',2);return false;}
      if(old)old.level++;
    }else if(['potion','ticket','amulet'].includes(offer.type)){
      if(!addSlot(p,makeItem(offer.type))){game.say('가방이 가득 찼습니다.',2);return false;}
    }else if(offer.type==='pet'){p.petCount=Math.min(4,p.petCount+1);}
    else if(offer.type==='maxhp'){p.maxHpBonus+=.1;game.recomputeHp();}
    p.gems-=cost;game.shopSold[n]=true;game.syncInventory();
    game.say('구매 완료',2);game.sound('buy');return true;
  }

export function closeShop(game){
    if(game.mode==='shop')game.advance(1);
  }

export function usePotion(game){
    const index=game.player.slots.findIndex(i=>i?.type==='potion'||i?.type==='cheap');
    return index<0?false:game.useSlot(index);
  }
