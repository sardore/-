import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../js/',import.meta.url);
const core=['classic.js','classic/base.js','classic/rules.js',
  'classic/combat.js','classic/enemies.js','classic/inventory.js',
  'classic/progression.js','classic/persistence.js','world.js'];
const old=["./game.js","./main.js","../game.js","../main.js"];
test('classic game core has no DOM, browser storage, audio or presentation dependencies',async()=>{
  for(const path of core){
    const source=await readFile(new URL(path,root),'utf8');
    assert.doesNotMatch(source,/\b(?:document|window|localStorage|AudioContext|requestAnimationFrame)\b/,
      path+' should be environment-agnostic');
    for(const id of old)assert.ok(!source.includes("from '"+id+"'"),
      path+' must not depend on discarded real-time game');
  }
});
test('composition root stays intentionally small and imports only feature modules',async()=>{
  const content=await readFile(new URL('classic-main.js',root),'utf8');
  assert.ok(content.split('\n').length<80,'avoid reintroducing monolithic entrypoints');
  for(const module of ['classic/storage.js','classic/audio.js','classic/ui.js','classic/controls.js'])
    assert.ok(content.includes(module),module+' should be composed explicitly');
});
test('production HTML points at classic entrypoint, not removed prototype',async()=>{
  const html=await readFile(new URL('../index.html',root),'utf8');
  assert.ok(html.includes('./js/classic-main.js'));
  assert.ok(!html.includes('src="./js/main.js"'));
});
