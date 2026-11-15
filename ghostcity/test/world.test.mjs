import test from 'node:test';
import assert from 'node:assert/strict';
import {generateFloor,isReachable,canStand,tileAt,moveCircle,refreshVision,buildFlow} from '../js/world.js';
import {MAX_FLOOR,TILE,T} from '../js/config.js';

test('all normal and boss floors are connected across 160 deterministic seeds',()=>{
  const seeds=[1,3,7,11,21,42,2026,9001];
  for(let floor=1;floor<=MAX_FLOOR;floor++)for(const seed of seeds){
    const world=generateFloor(floor,seed);
    assert.equal(world.floor,floor);
    assert.ok(isReachable(world,world.start,world.stairs),'unreachable floor '+floor+' / seed '+seed);
    assert.equal(tileAt(world,(world.stairs.x+.5)*TILE,(world.stairs.y+.5)*TILE),T.STAIRS);
    assert.ok(canStand(world,(world.start.x+.5)*TILE,(world.start.y+.5)*TILE,10));
    assert.ok(world.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
  }
});
test('floor generation is stable for same seed and differs for different seeds',()=>{
  const a=generateFloor(8,515),b=generateFloor(8,515),c=generateFloor(8,516);
  assert.deepEqual(a.tiles,b.tiles);
  assert.deepEqual(a.stairs,b.stairs);
  assert.notDeepEqual(a.tiles,c.tiles);
});
test('bosses spawn on floors 10 and 20 only',()=>{
  for(let floor=1;floor<=20;floor++){
    const w=generateFloor(floor,777);
    assert.equal(w.enemies.filter(e=>e.kind.startsWith('boss')).length,floor===10||floor===20?1:0);
  }
});
test('walls block movement; discovery and navigation respect traversability',()=>{
  const w=generateFloor(1,45);
  const px=(w.start.x+.5)*TILE,py=(w.start.y+.5)*TILE;
  const count=Array.from(w.seen).reduce((a,b)=>a+b,0);
  refreshVision(w,(w.stairs.x+.5)*TILE,(w.stairs.y+.5)*TILE,11);
  assert.ok(Array.from(w.seen).reduce((a,b)=>a+b,0)>=count);
  const p={x:px,y:py};moveCircle(w,p,-TILE*500,0,10);
  assert.ok(p.x>10);
  assert.ok(buildFlow(w,px,py).some(n=>n===0));
});
