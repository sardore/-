// Source-aligned seven-slot inventory, item effects, shop and drop rules.
import {T,TILE} from '../config.js';
import {DIRS,pt,center,spec,keys,makeWeapon,makeItem,price,owned,addSlot} from './rules.js';
const at=(w,x,y)=>y*w.w+x;
const radius=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function activeSlot(game){
  const p=game.player;
  return p.equippedSlot===null?null:(p.slots[p.equippedSlot]||null);
}
export function syncInventory(game){
  const p=game.player;
  const gear=p.slots.filter(s=>s?.type==='weapon');
  p.inventory=gear.map(s=>s.id);
  p.weaponLevels=Object.fromEntries(gear.map(s=>[s.id,s.level]));
  const equipped=game.activeSlot();
  // Renderer compatibility only. Unarmed attacks still use barehandStats.
  p.weapon=equipped?.type==='weapon'?equipped.id:'spear';
  if(!equipped||equipped.type!=='weapon')p.equippedSlot=null;
  p.potions=p.slots.filter(s=>s?.type==='potion'||s?.type==='cheap').length;
}
export function weapon(game){
  const p=game.player,item=game.activeSlot();
  if(item?.type==='weapon')return {...spec[item.id],id:item.id,level:item.level};
  return {name:'맨손',id:null,level:0,base:Math.max(.25,.7-p.maxHp*.02),
    power:.5,range:1,scale:1,breaks:false};
}
export function weaponLevel(game){return game.activeSlot()?.level||0;}
export function weaponStats(game){
  const w=game.weapon();
  return {...w,rate:Math.max(w.id?.42:.25,w.base*Math.pow(w.scale,w.level)),
    range:w.id?w.range+Math.floor(w.level/3):1};
}
export function changeWeapon(game,id){
  const index=game.player.slots.findIndex(s=>s?.type==='weapon'&&s.id===id);
  return index<0?false:game.useSlot(index);
}
export function cycleWeapon(game,dir=1){
  const p=game.player;
  let i=p.equippedSlot??0;
  for(let n=0;n<7;n++){
    i=(i+dir+7)%7;
    if(p.slots[i]?.type==='weapon')return game.useSlot(i);
  }
  return false;
}
export function useSlot(game,index){
  const p=game.player,item=p.slots[index];
  if(!item)return false;
  if(item.type==='weapon'){
    p.equippedSlot=index;game.syncInventory();
    game.say(spec[item.id].name+' Lv.'+item.level+' 장착',1.3);
    game.sound('equip');return true;
  }
  if(item.type==='potion'){
    if(p.hp>=p.maxHp){game.say('체력이 가득 찼습니다.',2);return false;}
    p.hp=Math.min(p.maxHp,p.hp+3);p.slots[index]=null;game.syncInventory();
    game.say('회복 물약 HP +3',2);game.sound('heal');return true;
  }
  if(item.type==='cheap'){
    p.slots[index]=null;game.syncInventory();
    if(p.hp>=p.maxHp){game.say('체력이 가득 찼습니다. 싸구려 물약 소모.',2);return false;}
    const success=game.rng.rand()<.5;
    if(success)p.hp=Math.min(p.maxHp,p.hp+1);
    game.say(success?'싸구려 물약 성공 · HP +1':'싸구려 물약 실패',2);
    game.sound('heal');return success;
  }
  if(item.type==='ticket'){
    p.slots[index]=null;
    const weapons=p.slots.filter(s=>s?.type==='weapon');
    if(!weapons.length){
      p.maxHpBonus+=.1;game.recomputeHp();game.say('강화권: 무기 없음 · 최대 HP +10%',3);
    }else{
      const selected=game.rng.pick(weapons);
      if(selected.level<=3){selected.level=4;game.say(spec[selected.id].name+' 강화권 → Lv.4',2);}
      else game.say('강화권 효과 없음 · 무기 레벨이 이미 높습니다.',2);
    }
    game.syncInventory();game.sound('level');return true;
  }
  if(item.type==='amulet'){
    p.slots[index]=null;game.syncInventory();
    if(game.mode==='inventory')game.setMode('playing');
    game.shake=.52;game.flash=.12;game.sparks(p.x,p.y,'#d9b9ff',60,200);
    const w=game.world,here=pt(p.x,p.y),r=7;
    let mobs=0,walls=0,furniture=0,items=0;
    for(const e of w.enemies){
      if(e.dead||e.kind.startsWith('boss'))continue;
      if(radius(pt(e.x,e.y),here)<=r){e.dead=true;mobs++;game.sparks(e.x,e.y,'#dfb8fb',25,160);}
    }
    if(mobs){game.score+=mobs*50;game.addXP(mobs*5);game.kills+=mobs;}
    for(let y=Math.max(0,here.y-r);y<Math.min(w.h,here.y+r+1);y++)
      for(let x=Math.max(0,here.x-r);x<Math.min(w.w,here.x+r+1);x++){
        if(Math.hypot(x-here.x,y-here.y)>r)continue;
        const id=at(w,x,y),t=w.tiles[id];
        // Preserve stairs, elevators, doors and windows (original explicit exception).
        if(t===T.WALL){w.tiles[id]=T.FLOOR;walls++;game.visionDirty=true;}
        else if(t===T.RUBBLE){w.tiles[id]=T.FLOOR;furniture++;game.visionDirty=true;}
      }
    w.pickups=w.pickups.filter(it=>{
      if(radius(pt(it.x,it.y),here)<=r){items++;return false;}
      return true;
    });
    for(const e of w.enemies){
      if(!e.dead&&e.kind.startsWith('boss')&&radius(pt(e.x,e.y),here)<=r){
        e.hp-=24;e.hit=.15;
        if(e.hp<=0)game.killEnemy(e);
      }
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    game.say('수호 부적: 벽 '+walls+' · 가구 '+furniture+' · 아이템 '+items+' · 적 '+mobs,4);
    game.sound('boss');return true;
  }
  return false;
}
export function dropSlot(game,index){
  if(!['inventory','playing'].includes(game.mode))return false;
  const p=game.player,item=p.slots[index];
  if(!item)return false;
  const here=pt(p.x,p.y),w=game.world;
  const order=[here,{x:here.x,y:here.y+1},{x:here.x,y:here.y-1},
    {x:here.x+1,y:here.y},{x:here.x-1,y:here.y}];
  const ground=order.find(pos=>pos.x>=0&&pos.y>=0&&pos.x<w.w&&pos.y<w.h&&
    w.tiles[at(w,pos.x,pos.y)]===T.FLOOR&&
    !w.pickups.some(o=>Math.floor(o.x/TILE)===pos.x&&Math.floor(o.y/TILE)===pos.y));
  if(!ground){game.say('바닥에 버릴 공간이 없습니다.',2);return false;}
  const drop=item.type==='weapon'?{type:'weapon',weapon:item.id,level:item.level}:
    item.type==='ticket'?{type:'ticket'}:item.type==='amulet'?{type:'amulet'}:{type:'cheap'};
  w.pickups.push({...center(ground.x,ground.y),...drop,value:1});
  p.slots[index]=null;if(p.equippedSlot===index)p.equippedSlot=null;
  game.syncInventory();game.sparks((ground.x+.5)*TILE,(ground.y+.5)*TILE,'#e9e6d4',12);
  game.say('아이템을 바닥에 버렸습니다.',2);return true;
}
export function offerPool(game){
  const p=game.player,pool=[],rng=game.rng,luck=game.luck??.16;
  for(let i=0;i<9;i++)pool.push({type:'potion'});
  if(game.world.floor===4)for(let i=0;i<50;i++)pool.push({type:'ticket'});
  else if(rng.rand()<.01+luck*.01)for(let i=0;i<3;i++)pool.push({type:'ticket'});
  if(rng.rand()<.05+luck*.04)for(let i=0;i<2;i++)pool.push({type:'amulet'});
  for(const id of keys)for(let i=0;i<(owned(p,id)?3:1);i++)pool.push({type:'weapon',id});
  if(p.petCount<4&&rng.rand()<luck*.9)for(let i=0;i<2;i++)pool.push({type:'pet'});
  const offers=[];
  for(let i=0;i<3;i++){
    const j=rng.int(0,pool.length-1);
    offers.push(pool.splice(j,1)[0]);
  }
  return [...offers,{type:'maxhp'}];
}
export function openShop(game){
  if(game.shopFloor!==game.world.floor){
    game.shopFloor=game.world.floor;game.shopOffers=game.offerPool();
    game.shopSold=[false,false,false,false];
  }
  game.setMode('shop');game.say('고정 4개 상품 · 숫자키 구매 · Enter 다음 층',3);
}
export function buy(game,index){
  if(game.mode!=='shop')return false;
  const offer=game.shopOffers[Number(index)],p=game.player;
  if(!offer||game.shopSold[Number(index)])return false;
  const id=offer.type==='weapon'?offer.id:offer.type;
  const cost=price[id];
  if(!Number.isFinite(cost)||p.gems<cost){game.say('보석이 부족합니다.',2);return false;}
  const itemNeedsSlot=['potion','ticket','amulet'].includes(offer.type)||
    offer.type==='weapon'&&!owned(p,id);
  if(itemNeedsSlot&&!p.slots.some(s=>s===null)){game.say('인벤토리가 가득 찼습니다.',2);return false;}
  if(offer.type==='weapon'){
    const ownedItems=p.slots.filter(s=>s?.type==='weapon'&&s.id===id);
    if(ownedItems.length){ownedItems.sort((a,b)=>b.level-a.level)[0].level++;}
    else{
      addSlot(p,makeWeapon(id,1));
      if(p.equippedSlot===null)p.equippedSlot=p.slots.findIndex(s=>s?.id===id);
    }
  }else if(['potion','ticket','amulet'].includes(offer.type)){
    addSlot(p,makeItem(offer.type));
  }else if(offer.type==='pet')p.petCount=Math.min(4,p.petCount+1);
  else if(offer.type==='maxhp'){p.maxHpBonus+=.1;game.recomputeHp();}
  p.gems-=cost;game.shopSold[Number(index)]=true;
  game.syncInventory();game.say('구매 완료: '+id,2);game.sound('buy');
  return true;
}
export function closeShop(game){if(game.mode==='shop')game.advance(1);}
export function usePotion(game){
  const index=game.player.slots.findIndex(s=>s?.type==='potion'||s?.type==='cheap');
  return index>=0?game.useSlot(index):false;
}
