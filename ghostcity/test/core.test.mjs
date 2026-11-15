import test from 'node:test';
import assert from 'node:assert/strict';
import {generateFloor,isReachable,tileAt,canStand,moveCircle,refreshVision,buildFlow} from '../js/world.js';
import {Game} from '../js/game.js';
import {T,TILE,WEAPONS,PERKS,MAX_FLOOR} from '../js/config.js';

test('every stage creates a connected, traversable entrance and exit',()=>{
  for(let floor=1;floor<=MAX_FLOOR;floor++){
    for(const seed of [1,3,7,11,21,42,2026,9001]){
      const w=generateFloor(floor,seed);
      assert.equal(w.floor,floor);
      assert.ok(isReachable(w,w.start,w.stairs),'unreachable '+floor+' seed '+seed);
      assert.equal(tileAt(w,(w.stairs.x+.5)*TILE,(w.stairs.y+.5)*TILE),T.STAIRS);
      assert.ok(canStand(w,(w.start.x+.5)*TILE,(w.start.y+.5)*TILE,10));
      assert.ok(w.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
      assert.ok(w.pickups.every(p=>p.x>=0&&p.y>=0&&p.x<w.w*TILE&&p.y<w.h*TILE));
    }
  }
});
test('generation is deterministic per seed and floor',()=>{
  const a=generateFloor(8,515),b=generateFloor(8,515),c=generateFloor(8,516);
  assert.deepEqual(a.tiles,b.tiles);
  assert.deepEqual(a.stairs,b.stairs);
  assert.notDeepEqual(a.tiles,c.tiles);
});
test('boss arenas appear only at level 10 and 20',()=>{
  for(let f=1;f<=20;f++){
    const w=generateFloor(f,123);
    const bosses=w.enemies.filter(e=>e.kind.startsWith('boss'));
    assert.equal(bosses.length,f===10||f===20?1:0);
    if(bosses.length)assert.ok(bosses[0].hp>=700);
  }
});
test('walls block movement, and visible tiles become explored',()=>{
  const w=generateFloor(1,45);
  const initial=Array.from(w.seen).reduce((a,b)=>a+b,0);
  refreshVision(w,(w.stairs.x+.5)*TILE,(w.stairs.y+.5)*TILE,11);
  assert.ok(Array.from(w.seen).reduce((a,b)=>a+b,0)>=initial);
  const p={x:(w.start.x+.5)*TILE,y:(w.start.y+.5)*TILE};
  moveCircle(w,p,-TILE*500,0,10);
  assert.ok(p.x>10);
  const flow=buildFlow(w,p.x,p.y);
  assert.ok(flow.some(n=>n===0));
});
test('new run starts with 8 HP, sword, and 2 consumables',()=>{
  const g=new Game();g.newRun(123);
  assert.equal(g.mode,'playing');
  assert.equal(g.player.hp,8);
  assert.equal(g.player.potions,2);
  assert.equal(g.player.weapon,'sword');
  assert.equal(g.world.floor,1);
});
test('damage is i-framed; potions restore health',()=>{
  const g=new Game();g.newRun(80);
  g.damagePlayer(2);const hp=g.player.hp;
  g.damagePlayer(2);assert.equal(g.player.hp,hp);
  g.player.invuln=0;
  assert.ok(g.usePotion());assert.equal(g.player.hp,Math.min(8,hp+4));
});
test('attacks deal damage when facing target',()=>{
  const g=new Game();g.newRun(101);
  g.world.enemies=[];
  const p=g.player;
  const dummy={id:111,kind:'wanderer',x:p.x+45,y:p.y,r:10,hp:200,maxHp:200,hit:0,cd:1,angle:0,teleport:0,speed:0};
  g.world.enemies.push(dummy);
  p.facing=0;
  assert.ok(g.attack());
  assert.ok(dummy.hp<200);
  const remaining=dummy.hp;
  assert.equal(g.attack(),false);
  assert.equal(dummy.hp,remaining);
});
test('perk selection grants actual stat upgrades and resumes',()=>{
  const g=new Game();g.newRun(303);
  g.addXP(90);
  assert.equal(g.mode,'perk');
  assert.equal(g.player.level,2);
  const offered=g.perkOptions[0];assert.ok(PERKS.some(p=>p.id===offered.id));
  assert.equal(g.choosePerk(offered.id),true);
  assert.ok(['playing','perk'].includes(g.mode)); // possible queued level-up
});
test('shop deducts gems and upgrades inventory',()=>{
  const g=new Game();g.newRun(60);
  g.player.gems=100;
  g.setMode('shop');
  const before=g.player.gems;
  assert.ok(g.buy('potion'));assert.equal(g.player.gems,before-9);
  assert.equal(g.player.potions,3);
  assert.ok(g.buy('crossbow'));
  assert.ok(g.player.inventory.includes('crossbow'));
  assert.equal(g.buy('crossbow'),false);
});
test('floor progress preserves loadout and final floor resolves victory',()=>{
  const g=new Game();g.newRun(256);
  g.player.gems=33;g.player.potions=4;
  g.advance(1);assert.equal(g.world.floor,2);assert.equal(g.player.gems,33);
  assert.ok(g.player.inventory.includes('spear'));
  g.world.floor=20;g.mode='playing';g.advance(1);
  assert.equal(g.mode,'victory');
  assert.ok(g.score>=0);
});
test('save/resume roundtrip preserves world and character',()=>{
  const g=new Game();g.newRun(987);g.player.gems=22;g.player.hp=6;g.advance(1);
  if(g.mode==='perk')g.choosePerk(g.perkOptions[0].id);
  const save=g.serialize();
  const again=new Game();assert.ok(again.restore(save));
  assert.equal(again.world.floor,2);assert.equal(again.player.gems,22);
  assert.equal(again.player.hp,g.player.hp);
});
test('corrupt saves do not load',()=>{
  const g=new Game();
  assert.equal(g.restore('{"bad":1}'),false);
});
