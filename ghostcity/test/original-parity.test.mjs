import test from 'node:test';
import assert from 'node:assert/strict';
import {generateClassicFloor,ORIGINAL_MAP} from '../js/classic/map.js';
import {ClassicGame} from '../js/classic.js';
import {T,TILE} from '../js/config.js';
import {price} from '../js/classic/rules.js';
import {isReachable} from '../js/world.js';

test('original normal maps are 60x30 and boss arenas 45x27',()=>{
  for(const floor of [1,5,9,11,15,19]){
    const w=generateClassicFloor(floor,909);
    assert.equal(w.w,60);assert.equal(w.h,30);
    assert.equal(w.tiles.length,1800);
    assert.ok(isReachable(w,w.start,w.stairs),'stair unreachable floor '+floor);
    assert.equal(w.tiles[w.stairs.y*w.w+w.stairs.x],T.STAIRS);
    assert.ok(w.rooms.length>=5,'should have attached rooms');
  }
  for(const floor of [10,20]){
    const w=generateClassicFloor(floor,909);
    assert.equal(w.w,45);assert.equal(w.h,27);
    assert.equal(w.enemies.filter(e=>e.kind.startsWith('boss')).length,1);
    assert.equal(w.enemies[0].hp,floor===10?72:96);
    assert.equal(w.tiles.some(x=>x===T.STAIRS),false);
  }
});
test('all 20 levels have reachable player spawns for several seeds',()=>{
  for(const seed of [1,13,77,2026])for(let floor=1;floor<=20;floor++){
    const w=generateClassicFloor(floor,seed);
    const cell=w.tiles[w.start.y*w.w+w.start.x];
    assert.notEqual(cell,T.WALL,'spawn in wall floor='+floor+' seed='+seed);
    assert.notEqual(cell,T.RUBBLE,'spawn in furniture floor='+floor+' seed='+seed);
    if(!w.boss)assert.ok(isReachable(w,w.start,w.stairs));
  }
});
test('original monster cap and stage-exclusive witch/digger types are respected',()=>{
  for(const floor of [1,3,9,11,17,19]){
    const w=generateClassicFloor(floor,221);
    assert.ok(w.enemies.length<=Math.min(12,4+Math.floor(floor/2)));
    assert.ok(w.enemies.length>=2);
    if(floor<11)assert.ok(w.enemies.every(e=>e.kind!=='witch'));
    if(floor>=11)assert.ok(w.enemies.every(e=>e.kind!=='digger'));
  }
});
test('dark floors use 6-tile FOV and normal 13',()=>{
  assert.equal(ORIGINAL_MAP.normal.fov,13);assert.equal(ORIGINAL_MAP.dark.fov,6);
  const normal=generateClassicFloor(7,31),dark=generateClassicFloor(12,31);
  assert.ok(normal.visible.reduce((a,b)=>a+b,0)>dark.visible.reduce((a,b)=>a+b,0));
});
test('source shop price schedule matches the original Python dict',()=>{
  assert.deepEqual(price,{potion:4,amulet:18,ticket:20,pet:24,maxhp:9,
    axe:11,spear:11,sword:11,shield:11,hammer:13});
});
test('weapon upgrades improve range each 3 levels but never raw damage',()=>{
  const g=new ClassicGame();g.newRun(22);
  const item=g.player.slots[1],before=g.weaponStats();
  item.level=3;const after=g.weaponStats();
  assert.equal(after.range,before.range+2);
  assert.equal(after.power,before.power);
  assert.ok(after.rate<before.rate);
});
test('full HP preserves regular potion but consumes cheap potion',()=>{
  const g=new ClassicGame();g.newRun(33);
  g.player.slots[2]={type:'potion'};
  assert.equal(g.useSlot(2),false);assert.deepEqual(g.player.slots[2],{type:'potion'});
  g.useSlot(0);assert.equal(g.player.slots[0],null);
});
test('original guardian angel fires only on visible LOS and a 11-tile radius',()=>{
  const g=new ClassicGame();g.newRun(11);g.advance(1);
  g.player.petCount=1;g.player.petCd=0;
  const e={kind:'wanderer',x:g.player.x+TILE,y:g.player.y,r:10,hp:1,maxHp:1,
    damage:1,moveAcc:0,cd:0,hit:0,slow:0};
  g.world.enemies=[e];
  // The test explicitly marks a clear line to avoid assumptions about map walls.
  const here={x:Math.floor(g.player.x/TILE),y:Math.floor(g.player.y/TILE)};
  const dest={x:here.x+1,y:here.y};
  if(dest.x>=g.world.w-1)return;
  g.world.tiles[dest.y*g.world.w+dest.x]=T.FLOOR;
  g.world.visible[dest.y*g.world.w+dest.x]=1;
  g.petTick(.016);
  assert.ok(e.hp<1);
  assert.equal(e.slow,1.6);
});
test('original 280ms laser warning follows the immediate hit',()=>{
  const g=new ClassicGame();g.newRun(71);g.advance(1);
  const p=g.player,w=g.world,here={x:Math.floor(p.x/TILE),y:Math.floor(p.y/TILE)};
  if(here.x+1>=w.w-1)return;
  w.tiles[here.y*w.w+here.x+1]=T.FLOOR;
  w.visible[here.y*w.w+here.x+1]=1;
  const e={kind:'sniper',x:p.x+TILE,y:p.y,r:10,hp:1,maxHp:1,damage:1,cd:0,moveAcc:0,slow:0};
  w.enemies=[e];
  g.player.invuln=0;
  const hp=p.hp;g.shooterTick(e,.02);
  assert.equal(p.hp,hp-1);
  assert.equal(g.sniperWarnings.length,1);
  assert.equal(g.sniperWarnings[0].life,.28);
  assert.equal(e.cd,.9);
});
test('variable-sized boss, normal and tutorial maps can each roundtrip through save',()=>{
  const g=new ClassicGame();g.newRun(51);
  for(const floor of [0,1,10,11,20]){
    if(floor)g.advance(floor===1?1:floor-g.world.floor);
    const json=g.serialize(),restored=new ClassicGame();
    assert.equal(restored.restore(json),true,'restore floor '+floor);
    assert.equal(restored.world.w,g.world.w);
    assert.equal(restored.world.h,g.world.h);
    assert.equal(restored.world.tiles.length,g.world.tiles.length);
    if(floor===0)assert.equal(restored.tutorial,true);
  }
});
test('10F boss clear offers end or 11F continuation without softlock',()=>{
  const g=new ClassicGame();g.newRun(42);
  g.advance(1);g.world.floor=9;g.advance(1);
  const boss=g.world.enemies.find(e=>e.kind==='bossSpider');
  boss.hp=0;g.killEnemy(boss);
  assert.equal(g.mode,'midclear');
  assert.equal(g.continueMidBoss(),true);
  assert.equal(g.world.floor,11);
  assert.equal(g.mode,'playing');
});
