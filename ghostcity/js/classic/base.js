// Minimal shared lifecycle for the original-rule game.
// Intentionally independent of the free-movement Reborn simulation.
import {makeRng,formatTime} from '../config.js';

export class ClassicBase {
  constructor(notify=()=>{}){
    this.notify=notify;
    this.seed=(Math.random()*4294967295)>>>0;
    this.rng=makeRng(this.seed);
    this.mode='menu';
    this.world=null;this.player=null;
    this.elapsed=0;this.time=0;this.kills=0;this.score=0;
    this.flow=null;this.flowTimer=0;this.visionTile='';this.visionTimer=0;
    this.anim=0;this.shake=0;this.flash=0;this.slash=null;
    this.message='';this.messages=[];this.runEnded=false;
  }
  say(text,duration=3){
    this.message=text;
    this.messages.unshift({text,life:duration});
    this.messages.length=Math.min(4,this.messages.length);
    this.notify('toast',{text});
  }
  sparks(x,y,color='#9cdefa',count=10,force=110){
    if(!this.world)return;
    const effects=this.world.effects;
    for(let i=0;i<count;i++){
      const angle=this.rng.rand()*Math.PI*2;
      const velocity=25+this.rng.rand()*force;
      effects.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,
        life:.2+this.rng.rand()*.4,max:.6,color,r:1+this.rng.rand()*2.2,type:'spark'});
    }
    if(effects.length>180)effects.splice(0,effects.length-180);
  }
  sound(name){this.notify('sound',{name});}
  togglePause(){
    if(this.mode==='playing')this.setMode('paused');
    else if(this.mode==='paused')this.setMode('playing');
  }
  end(victory){
    if(this.runEnded)return;
    this.runEnded=true;
    this.score=Math.round(this.score*(victory?1.5:1));
    this.setMode(victory?'victory':'dead');
    this.sound(victory?'victory':'dead');
    this.notify('end',{victory,score:this.score,floor:this.world.floor,
      kills:this.kills,time:this.elapsed,seed:this.seed});
  }
  summary(){
    return {floor:this.world.floor,score:this.score,kills:this.kills,
      time:formatTime(this.elapsed),gems:this.player.gems,
      level:this.player.level,seed:this.seed};
  }
}
