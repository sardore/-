// Composition root: connects rules, UI, input, sound and persistence.
import {ClassicGame} from './classic.js';
import {Renderer} from './render.js';
import {clamp} from './config.js';
import {createStorage} from './classic/storage.js';
import {createAudio} from './classic/audio.js';
import {createUI} from './classic/ui.js';
import {startControls} from './classic/controls.js';

const renderer=new Renderer(document.getElementById('game-canvas'),document.getElementById('minimap'));
const audio=createAudio();
let game,ui;
const store=createStorage(()=>game,ok=>ui?.markSaved(ok));
function emit(type,payload){
  if(type==='sound')audio.play(payload.name);
  if(type==='toast')ui?.toast(payload.text);
  if(type==='start'||type==='floor'){
    const p=game.player,w=game.world;
    renderer.camera.x=clamp(p.x-renderer.w/2,0,Math.max(0,w.w*32-renderer.w));
    renderer.camera.y=clamp(p.y-renderer.h/2,0,Math.max(0,w.h*32-renderer.h));
    ui?.invalidateWeapons();
    if(type==='floor')store.persist();
  }
  if(type==='end')store.finish(payload);
  if(['mode','end','start','floor'].includes(type))ui?.resetOverlay();
}
game=new ClassicGame(emit);
ui=createUI({game,renderer,store});
startControls({game,renderer,ui,store,audio});
