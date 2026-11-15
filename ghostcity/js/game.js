import {T,TILE,MAX_FLOOR,WEAPONS,ENEMIES,PERKS,SHOP,makeRng,clamp,dist,angleDiff,formatTime} from './config.js';
import {generateFloor,restoreWorld,serializeWorld,gridToPixel,canStand,moveCircle,tileAt,isSolid,lineOfSight,refreshVision,buildFlow,flowDirection} from './world.js';

const TAU=Math.PI*2;
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};};
const distance=(x,y,xx,yy)=>Math.hypot(x-xx,y-yy);
const SAVE_VERSION=2;
export const SAVE_KEY='ghost-city-reborn-v2';
export const RANK_KEY='ghost-city-reborn-ranks-v2';
export class Game{
  constructor(notify=()=>{}){
    this.notify=notify;
    this.mode='menu';this.seed=(Math.random()*4294967295)>>>0;
    this.rng=makeRng(this.seed);
    this.world=generateFloor(1,this.seed);
    this.player=this.makePlayer();
    this.elapsed=0;this.time=0;this.kills=0;this.score=0;
    this.flow=null;this.flowTimer=0;this.visionTile='';this.visionTimer=0;
    this.anim=0;this.shake=0;this.flash=0;this.slash=null;this.message='';
    this.messages=[];this.perkOptions=[];this.runEnded=false;this.floorStartTime=0;
  }
  makePlayer(){
    const at=gridToPixel(this.world.start.x,this.world.start.y);
    return {x:at.x,y:at.y,r:10,facing:0,hp:8,maxHp:8,shield:0,level:1,xp:0,xpNext:32,
      gems:0,potions:2,energy:25,weapon:'sword',inventory:['sword'],weaponLevels:{sword:1},
      damageMult:1,speedMult:1,dashMult:1,guard:0,crit:0,luck:1,vamp:0,attackMult:1,
      dash:0,dashCd:0,dashX:1,dashY:0,invuln:0,attackCd:0,skillCd:0,walk:0,
      maxFloor:1,perks:[],kills:0,attackPulse:0};
  }
  newRun(seed=((Math.random()*4294967295)>>>0)){
    this.seed=seed>>>0;this.rng=makeRng(this.seed);
    this.world=generateFloor(1,this.seed);this.player=this.makePlayer();
    this.mode='playing';this.elapsed=0;this.time=0;this.kills=0;this.score=0;
    this.flow=null;this.flowTimer=0;this.visionTile='';this.visionTimer=0;
    this.anim=0;this.shake=0;this.flash=0;this.slash=null;this.messages=[];
    this.perkOptions=[];this.runEnded=false;this.floorStartTime=0;
    this.say('지하도시 진입. 20층까지 살아남으세요.',5);
    this.notify('start',{floor:1});
  }
  say(text,duration=3){
    this.message=text;
    this.messages.unshift({text,life:duration});
    this.messages.length=Math.min(4,this.messages.length);
    this.notify('toast',{text});
  }
  sparks(x,y,color='#9cdefa',count=10,force=110){
    for(let n=0;n<count;n++){
      const a=this.rng.rand()*TAU,v=(25+this.rng.rand()*force);
      this.world.effects.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.2+this.rng.rand()*.4,
        max:.6,color,r:1+this.rng.rand()*2.2,type:'spark'});
    }
    if(this.world.effects.length>180)this.world.effects.splice(0,this.world.effects.length-180);
  }
  sound(name){this.notify('sound',{name});}
  weapon(){return WEAPONS[this.player.weapon];}
  weaponLevel(){return this.player.weaponLevels[this.player.weapon]||1;}
  setMode(mode){this.mode=mode;this.notify('mode',{mode});}
  togglePause(){
    if(this.mode==='playing')this.setMode('paused');
    else if(this.mode==='paused')this.setMode('playing');
  }
  changeWeapon(id){
    if(this.mode!=='playing'||!this.player.inventory.includes(id))return false;
    this.player.weapon=id;this.player.attackCd=Math.min(this.player.attackCd,.12);
    this.say(WEAPONS[id].name+' 장착',1.2);this.sound('equip');return true;
  }
  cycleWeapon(direction=1){
    const p=this.player,i=p.inventory.indexOf(p.weapon);
    return this.changeWeapon(p.inventory[(i+direction+p.inventory.length)%p.inventory.length]);
  }
  addWeapon(id){
    if(!WEAPONS[id])return false;
    const p=this.player;
    if(!p.inventory.includes(id)){
      if(p.inventory.length>=7){p.gems+=5;this.say('가방이 가득 찼습니다. 보석 +5');return false;}
      p.inventory.push(id);p.weaponLevels[id]=1;this.say('신규 무기: '+WEAPONS[id].name,4);
    }else{p.weaponLevels[id]=Math.min(8,(p.weaponLevels[id]||1)+1);this.say(WEAPONS[id].name+' 강화! Lv.'+p.weaponLevels[id],3);}
    this.sound('level');return true;
  }
  addXP(amount){
    const p=this.player;p.xp+=amount;this.score+=Math.round(amount*1.5);
    if(p.xp>=p.xpNext&&this.mode==='playing'){
      p.xp-=p.xpNext;p.level++;p.xpNext=Math.floor(p.xpNext*1.21+9);
      const options=[...PERKS];
      for(let i=options.length-1;i>0;i--){const j=this.rng.int(0,i);[options[i],options[j]]=[options[j],options[i]];}
      this.perkOptions=options.slice(0,3);
      this.setMode('perk');this.sparks(p.x,p.y,'#ffdf8e',36,180);this.sound('level');
      this.notify('perk',{options:this.perkOptions});
    }
  }
  choosePerk(id){
    if(this.mode!=='perk'||!this.perkOptions.some(p=>p.id===id))return false;
    const p=this.player;p.perks.push(id);
    switch(id){
      case 'blood':p.maxHp+=2;p.hp=Math.min(p.maxHp,p.hp+2);break;
      case 'steel':p.damageMult*=1.18;break;
      case 'rush':p.speedMult*=1.12;p.dashMult*=.9;break;
      case 'fortune':p.luck*=1.35;break;
      case 'guard':p.guard=1-(1-p.guard)*.85;break;
      case 'vamp':p.vamp+=.15;break;
      case 'fury':p.attackMult*=.88;break;
      case 'hunter':p.crit=Math.min(.65,p.crit+.09);break;
    }
    this.perkOptions=[];this.setMode('playing');this.say('특성 획득: '+PERKS.find(x=>x.id===id).name,4);
    if(p.xp>=p.xpNext)this.addXP(0);
    return true;
  }
  damagePlayer(amount,fromX=null,fromY=null){
    const p=this.player;if(this.mode!=='playing'||p.invuln>0||p.dash>0)return false;
    const reduced=Math.max(1,Math.round(amount*(1-p.guard)));
    if(p.shield){p.shield=Math.max(0,p.shield-reduced);this.say('보호막이 피해를 흡수했습니다.',1.1);}
    else p.hp=Math.max(0,p.hp-reduced);
    p.invuln=.85;this.shake=.3;this.flash=.28;
    this.sparks(p.x,p.y,'#ff7297',20,150);this.sound('hurt');
    if(fromX!==null){
      const d=norm(p.x-fromX,p.y-fromY);
      moveCircle(this.world,p,d.x*18,d.y*18,p.r);
    }
    if(p.hp<=0)this.end(false);
    return true;
  }
  usePotion(){
    if(this.mode!=='playing')return false;
    const p=this.player;
    if(p.potions<=0||p.hp>=p.maxHp)return false;
    p.potions--;p.hp=Math.min(p.maxHp,p.hp+4);
    this.sparks(p.x,p.y,'#7cf2d7',23);this.say('치유 물약 사용 · HP +4',2);this.sound('heal');
    return true;
  }
  dash(dx=0,dy=0){
    if(this.mode!=='playing')return false;
    const p=this.player;
    if(p.dashCd>0||p.dash>0)return false;
    if(!dx&&!dy){dx=Math.cos(p.facing);dy=Math.sin(p.facing);}
    const n=norm(dx,dy);
    p.dashX=n.x;p.dashY=n.y;p.dash=.22;p.invuln=.30+(p.guard>.01?.08:0);
    p.dashCd=2.5*p.dashMult;this.sparks(p.x,p.y,'#84e8ff',22,140);this.sound('dash');
    return true;
  }
  hitEnemy(e,base,ax,ay,push=100,criticalAllowed=true){
    if(!e||e.hp<=0)return;
    const p=this.player;
    const crit=criticalAllowed&&this.rng.rand()<p.crit;
    const amount=Math.max(1,Math.round(base*p.damageMult*(crit?1.8:1)));
    e.hp-=amount;e.hit=.16;this.score+=Math.min(20,Math.round(amount*.35));
    const d=norm(e.x-ax,e.y-ay);
    if(e.kind!=='bossSpider'&&e.kind!=='bossKing')moveCircle(this.world,e,d.x*push*.09,d.y*push*.09,e.r);
    this.sparks(e.x,e.y,crit?'#ffe38e':'#aeeaff',crit?14:7,90);
    this.world.effects.push({x:e.x,y:e.y-18,text:(crit?'✦ ':'')+amount,life:.72,max:.72,type:'text',color:crit?'#ffe49e':'#e4faff'});
    if(e.hp<=0)this.killEnemy(e);
    else this.sound('hit');
  }
  killEnemy(e){
    if(e.dead)return;
    e.dead=true;
    const boss=e.kind==='bossSpider'||e.kind==='bossKing';
    this.sparks(e.x,e.y,boss?'#f8dca8':'#e7acff',boss?58:18,boss?225:140);
    this.shake=boss?.8:.12;this.score+=boss?1500:(ENEMIES[e.kind]?.score||60);
    this.kills++;this.player.kills++;
    if(!boss){
      this.addXP(5+Math.floor(this.world.floor/3));
      if(this.rng.rand()<.23*this.player.luck)this.world.pickups.push({x:e.x,y:e.y,type:'gem',value:1});
      if(this.rng.rand()<.025)this.world.pickups.push({x:e.x,y:e.y,type:'potion',value:1});
      if(this.rng.rand()<this.player.vamp)this.player.hp=Math.min(this.player.maxHp,this.player.hp+1);
    }else{
      this.world.bossDefeated=true;this.addXP(65);this.player.gems+=12;
      this.say(e.kind==='bossSpider'?'메가 스파이더 격파! 출구가 열렸습니다.':'고스트 킹 격파! 도시에 새벽이 찾아옵니다.',7);
      this.notify('bossDefeated',{floor:this.world.floor});
      this.sound('boss');
    }
  }
  attack(dx=0,dy=0){
    if(this.mode!=='playing')return false;
    const p=this.player,weapon=this.weapon();
    if(p.attackCd>0||p.dash>0)return false;
    if(dx||dy)p.facing=Math.atan2(dy,dx);
    p.attackCd=weapon.rate*p.attackMult/(1+Math.min(8,this.weaponLevel()-1)*.035);
    p.attackPulse=.18;this.sound(weapon.id==='crossbow'?'shoot':'swing');
    const power=weapon.power*(1+(this.weaponLevel()-1)*.32);
    if(weapon.id==='crossbow'){
      const vx=Math.cos(p.facing),vy=Math.sin(p.facing);
      this.world.projectiles.push({x:p.x+vx*20,y:p.y+vy*20,vx:vx*520,vy:vy*520,r:5,
        owner:'player',power,life:.85,color:weapon.color,trail:[],pierce:0});
      return true;
    }
    this.slash={x:p.x,y:p.y,angle:p.facing,arc:weapon.arc,range:weapon.range,color:weapon.color,life:.19,max:.19};
    for(const e of [...this.world.enemies]){
      if(e.dead)continue;
      const d=dist(p,e);
      if(d>weapon.range+e.r)continue;
      const a=Math.atan2(e.y-p.y,e.x-p.x);
      if(Math.abs(angleDiff(a,p.facing))<=weapon.arc/2+Math.asin(Math.min(.95,e.r/Math.max(1,d)))){
        this.hitEnemy(e,power,p.x,p.y,weapon.knock);
      }
    }
    if(weapon.id==='hammer'){
      const xx=Math.floor((p.x+Math.cos(p.facing)*42)/TILE),yy=Math.floor((p.y+Math.sin(p.facing)*42)/TILE);
      const idx=yy*this.world.w+xx;
      if(xx>0&&yy>0&&xx<this.world.w-1&&yy<this.world.h-1&&this.world.tiles[idx]===T.RUBBLE){
        this.world.tiles[idx]=T.FLOOR;this.sparks((xx+.5)*TILE,(yy+.5)*TILE,'#e5af8e',16,140);
        this.say('장애물을 파괴했습니다.',1.1);
      }
    }
    return true;
  }
  burst(){
    if(this.mode!=='playing'||this.player.energy<100)return false;
    const p=this.player;p.energy=0;
    this.shake=.38;this.sound('burst');this.sparks(p.x,p.y,'#c7a4ff',62,270);
    this.world.effects.push({x:p.x,y:p.y,radius:0,life:.45,max:.45,type:'ring',color:'#ba99ff'});
    for(const e of [...this.world.enemies])if(!e.dead&&dist(e,p)<155+e.r)this.hitEnemy(e,46,p.x,p.y,210);
    this.say('영혼 폭발!',1.7);
    return true;
  }
  collect(item){
    const p=this.player;
    switch(item.type){
      case 'gem':p.gems+=Math.max(1,Math.round(item.value*p.luck));this.score+=10;this.addXP(1);this.sound('coin');break;
      case 'potion':p.potions=Math.min(9,p.potions+item.value);this.sound('coin');break;
      case 'shield':p.shield=Math.min(8,p.shield+item.value);this.sound('coin');break;
      case 'cache':{
        const keys=Object.keys(WEAPONS).filter(w=>!p.inventory.includes(w));
        if(keys.length&&this.rng.rand()<.75)this.addWeapon(this.rng.pick(keys));
        else{p.gems+=10;this.say('유령 보물상자 · 보석 +10',2);}
        this.sound('level');break;
      }
    }
    this.sparks(item.x,item.y,item.type==='gem'?'#9eecdf':'#f3d798',10,85);
  }
  interact(){
    if(this.mode!=='playing')return false;
    const p=this.player,w=this.world;
    const tx=Math.floor(p.x/TILE),ty=Math.floor(p.y/TILE);
    for(let yy=ty-1;yy<=ty+1;yy++)for(let xx=tx-1;xx<=tx+1;xx++){
      if(xx<0||yy<0||xx>=w.w||yy>=w.h)continue;
      const tile=w.tiles[yy*w.w+xx],distanceTo=distance(p.x,p.y,(xx+.5)*TILE,(yy+.5)*TILE);
      if(distanceTo>56)continue;
      if(tile===T.STAIRS){
        if(w.boss&&!w.bossDefeated){this.say('보스를 처치해야 출구가 열립니다.',3);return true;}
        this.advance(1);return true;
      }
      if(tile===T.SHOP){this.setMode('shop');this.sound('menu');return true;}
      if(tile===T.ELEVATOR||tile===T.BROKEN){
        if(p.gems<5){this.say('엘리베이터 가동 비용: 보석 5개',3);return true;}
        p.gems-=5;
        if(tile===T.BROKEN)this.damagePlayer(1);
        if(this.mode==='playing')this.advance(1);
        return true;
      }
    }
    this.say('상호작용할 수 있는 시설이 없습니다.',1.5);
    return false;
  }
  buy(id){
    if(this.mode!=='shop')return false;
    const item=SHOP.find(x=>x.id===id),p=this.player;
    if(!item||p.gems<item.cost){this.say('보석이 부족합니다.',2);return false;}
    if(id==='heal'&&p.hp>=p.maxHp){this.say('이미 체력이 가득 찼습니다.',2);return false;}
    if(id==='crossbow'&&p.inventory.includes('crossbow')){this.say('이미 보유한 무기입니다.',2);return false;}
    p.gems-=item.cost;
    if(id==='heal')p.hp=Math.min(p.maxHp,p.hp+4);
    if(id==='heart'){p.maxHp++;p.hp++;}
    if(id==='blade')p.weaponLevels[p.weapon]=Math.min(8,(p.weaponLevels[p.weapon]||1)+1);
    if(id==='potion')p.potions++;
    if(id==='ward')p.shield+=2;
    if(id==='crossbow')this.addWeapon('crossbow');
    this.say(item.name+' 구매 완료',2);this.sound('buy');
    return true;
  }
  closeShop(){if(this.mode==='shop')this.setMode('playing');}
  advance(n=1){
    const next=this.world.floor+n;
    if(next>MAX_FLOOR){this.end(true);return;}
    this.world=generateFloor(next,this.seed);
    this.player.x=(this.world.start.x+.5)*TILE;
    this.player.y=(this.world.start.y+.5)*TILE;
    this.player.hp=Math.min(this.player.maxHp,this.player.hp+1);
    this.player.energy=Math.min(100,this.player.energy+10);
    this.player.invuln=1;this.player.dash=0;this.player.dashCd=0;this.player.maxFloor=Math.max(next,this.player.maxFloor);
    this.score+=200;this.addXP(10);this.floorStartTime=this.elapsed;
    this.flow=null;this.flowTimer=0;this.visionTile='';this.visionTimer=0;
    this.sparks(this.player.x,this.player.y,'#a5e8ff',40,200);
    this.say(next===10?'10층 · 메가 스파이더의 둥지':next===20?'20층 · 고스트 킹의 왕좌':
      next>=11?next+'층 · 침수된 유령구역':next+'층 · 버려진 고층도시',5);
    if(next===2&&!this.player.inventory.includes('spear'))this.addWeapon('spear');
    if(next===4&&!this.player.inventory.includes('axe'))this.addWeapon('axe');
    if(next===7&&!this.player.inventory.includes('hammer'))this.addWeapon('hammer');
    this.notify('floor',{floor:next});
    if(this.mode==='playing')this.notify('autosave',{floor:next});
  }
  end(victory){
    if(this.runEnded)return;
    this.runEnded=true;
    this.score=Math.round(this.score*(victory?1.5:1));
    this.setMode(victory?'victory':'dead');
    this.sound(victory?'victory':'dead');
    this.notify('end',{victory,score:this.score,floor:this.world.floor,kills:this.kills,time:this.elapsed,seed:this.seed});
  }
  enemyFire(e,spread=0,speed=230,count=1){
    const targetAngle=Math.atan2(this.player.y-e.y,this.player.x-e.x);
    for(let j=0;j<count;j++){
      const a=targetAngle+(j-(count-1)/2)*spread,sp=speed;
      this.world.projectiles.push({x:e.x+Math.cos(a)*(e.r+9),y:e.y+Math.sin(a)*(e.r+9),
        vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:5,owner:'enemy',power:e.damage,
        life:2.6,color:e.kind==='witch'?'#d99cff':'#ff92ae',trail:[]});
    }
    this.sparks(e.x,e.y,'#ff9bbb',5,60);this.sound('enemyShoot');
  }
  bossTick(e,dt){
    const p=this.player,d=dist(e,p),low=e.hp/e.maxHp<.52;
    e.aiTime+=dt;e.cd-=dt;e.angle=Math.atan2(p.y-e.y,p.x-e.x);
    if(e.kind==='bossSpider'){
      if(d>100){const v=norm(p.x-e.x,p.y-e.y);moveCircle(this.world,e,v.x*e.speed*dt*(low?1.45:1),v.y*e.speed*dt*(low?1.45:1),e.r*.68);}
      if(e.cd<=0){
        if(e.attackStage%3===2){this.enemyFire(e,.40,190,low?9:7);}
        else if(e.attackStage%3===1){
          for(let i=0;i<3;i++){const a=e.aiTime*1.2+i*TAU/3;
            this.world.projectiles.push({x:e.x+Math.cos(a)*45,y:e.y+Math.sin(a)*45,
              vx:Math.cos(a)*170,vy:Math.sin(a)*170,r:9,owner:'enemy',power:1,life:2.4,color:'#aff08a',trail:[]});}
        }else{this.enemyFire(e,.22,240,low?5:3);}
        e.cd=low?1.75:2.35;e.attackStage++;this.shake=.1;
      }
      if(e.summon<=0&&e.hp/e.maxHp<.65){this.spawnAdds(e,'spider',3);e.summon=1;}
      if(e.summon===1&&e.hp/e.maxHp<.29){this.spawnAdds(e,'spider',4);e.summon=2;}
    }else{
      if(d>120){const v=norm(p.x-e.x,p.y-e.y);moveCircle(this.world,e,v.x*e.speed*dt,v.y*e.speed*dt,e.r*.65);}
      if(e.cd<=0){
        this.enemyFire(e,e.attackStage%2===0?.22:.5,245,low?9:7);
        if(low)this.enemyFire(e,.11,295,3);
        e.cd=low?1.4:1.95;e.attackStage++;this.shake=.13;
      }
      if(e.summon<=0&&e.hp/e.maxHp<.6){this.spawnAdds(e,'sentinel',2);e.summon=1;}
      if(e.summon===1&&e.hp/e.maxHp<.3){this.spawnAdds(e,'witch',3);e.summon=2;}
      if(e.teleport<=0&&low&&d<190){
        const tries=[[-150,-100],[150,80],[130,-160],[-180,120]];
        for(const [dx,dy] of tries){
          if(canStand(this.world,e.x+dx,e.y+dy,e.r*.7)){this.sparks(e.x,e.y,'#d0b2ff',20);e.x+=dx;e.y+=dy;break;}
        }
        e.teleport=4;
      }
    }
    if(d<e.r+p.r+1)this.damagePlayer(e.damage,e.x,e.y);
  }
  spawnAdds(boss,kind,count){
    for(let i=0;i<count;i++){
      const a=i*TAU/count+this.rng.rand(),r=84+this.rng.rand()*64,x=boss.x+Math.cos(a)*r,y=boss.y+Math.sin(a)*r;
      if(!canStand(this.world,x,y,14))continue;
      const spec=ENEMIES[kind],sc=1+this.world.floor*.10;
      this.world.enemies.push({id:this.rng.int(0,2e9),kind,x,y,r:12,hp:Math.round(spec.hp*sc),
        maxHp:Math.round(spec.hp*sc),speed:spec.speed,damage:spec.damage,
        attack:spec.attack,cd:1,hit:0,wind:0,aiTime:0,angle:0,teleport:0,charge:0});
      this.sparks(x,y,'#be92f4',14);
    }
  }
  enemyTick(e,dt){
    if(e.kind==='bossSpider'||e.kind==='bossKing'){this.bossTick(e,dt);return;}
    const p=this.player,kind=e.kind,spec=ENEMIES[kind];
    const d=dist(e,p);e.cd-=dt;e.aiTime+=dt;e.angle=Math.atan2(p.y-e.y,p.x-e.x);
    if(d>560)return;
    const shooter=kind==='sniper'||kind==='witch';
    if(shooter&&d<spec.range&&lineOfSight(this.world,e.x,e.y,p.x,p.y)){
      if(e.cd<=0){
        this.enemyFire(e,kind==='witch'?.14:0,kind==='witch'?230:330,kind==='witch'?3:1);
        e.cd=spec.attack+(this.rng.rand()*.5);
        if(kind==='witch'&&e.teleport<=0&&d<120){
          const a=this.rng.rand()*TAU,nx=e.x+Math.cos(a)*125,ny=e.y+Math.sin(a)*125;
          if(canStand(this.world,nx,ny,e.r)){this.sparks(e.x,e.y,'#bd9fff',12);e.x=nx;e.y=ny;this.sparks(e.x,e.y,'#bd9fff',12);}
          e.teleport=4.5;
        }
      }
    }
    const wantMove=shooter?d>spec.range*.70||!lineOfSight(this.world,e.x,e.y,p.x,p.y):d>e.r+p.r+4;
    if(wantMove){
      let direction=flowDirection(this.world,this.flow,e.x,e.y);
      if(direction.x===0&&direction.y===0&&lineOfSight(this.world,e.x,e.y,p.x,p.y))direction=norm(p.x-e.x,p.y-e.y);
      const speed=e.speed*(kind==='hound'&&d<180?1.22:1);
      moveCircle(this.world,e,direction.x*speed*dt,direction.y*speed*dt,e.r);
    }
    if(!shooter&&d<e.r+p.r+9&&e.cd<=0){
      e.cd=spec.attack;
      this.damagePlayer(e.damage,e.x,e.y);
      e.hit=.08;this.sound('enemyHit');
    }
  }
  tick(dt,input={}){
    dt=clamp(Number(dt)||0,0,.04);
    this.anim+=dt;
    if(this.mode!=='playing')return;
    this.time+=dt;this.elapsed+=dt;this.shake=Math.max(0,this.shake-dt);
    this.flash=Math.max(0,this.flash-dt);
    const p=this.player,w=this.world;
    for(const m of this.messages)m.life-=dt;
    this.messages=this.messages.filter(m=>m.life>0);
    p.invuln=Math.max(0,p.invuln-dt);p.attackCd=Math.max(0,p.attackCd-dt);
    p.attackPulse=Math.max(0,p.attackPulse-dt);
    p.dashCd=Math.max(0,p.dashCd-dt);p.dash=Math.max(0,p.dash-dt);
    if(this.slash){this.slash.life-=dt;if(this.slash.life<=0)this.slash=null;}
    let vx=Number(input.moveX)||0,vy=Number(input.moveY)||0;
    if(vx||vy){const n=norm(vx,vy);vx=n.x;vy=n.y;p.facing=Math.atan2(vy,vx);}
    if(input.aimX!=null&&input.aimY!=null)p.facing=Math.atan2(input.aimY-p.y,input.aimX-p.x);
    if(input.dash)this.dash(vx,vy);
    if(input.potion)this.usePotion();
    if(input.skill)this.burst();
    if(input.interact)this.interact();
    if(this.mode!=='playing')return;
    if(input.attack)this.attack();
    const onTile=tileAt(w,p.x,p.y);
    const speed=207*p.speedMult*(onTile===T.WATER?.67:onTile===T.WEB?.50:1);
    if(p.dash>0){
      moveCircle(w,p,p.dashX*speed*3.1*dt,p.dashY*speed*3.1*dt,p.r);
      if(this.rng.rand()<.8)this.sparks(p.x,p.y,'#78e4ff',2,50);
    }else moveCircle(w,p,vx*speed*dt,vy*speed*dt,p.r);
    if(vx||vy)p.walk+=dt*12;
    p.energy=Math.min(100,p.energy+dt*1.2);
    // Vision invalidates on tile motion, then refreshes at low frequency during stationary combat.
    const visionKey=Math.floor(p.x/TILE)+','+Math.floor(p.y/TILE);
    this.visionTimer-=dt;
    if(visionKey!==this.visionTile||this.visionTimer<=0){
      refreshVision(w,p.x,p.y,p.level>=7?12:11);
      this.visionTile=visionKey;this.visionTimer=.24;
    }
    this.flowTimer-=dt;
    if(!this.flow||this.flowTimer<=0){this.flow=buildFlow(w,p.x,p.y);this.flowTimer=.36;}
    for(let i=w.pickups.length-1;i>=0;i--){
      const item=w.pickups[i];
      if(dist(p,item)<21){w.pickups.splice(i,1);this.collect(item);}
    }
    for(const e of [...w.enemies]){
      if(e.dead)continue;
      e.hit=Math.max(0,e.hit-dt);e.teleport=Math.max(0,e.teleport-dt);
      this.enemyTick(e,dt);
      if(this.mode!=='playing')return;
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    for(let i=w.projectiles.length-1;i>=0;i--){
      const b=w.projectiles[i];const n=Math.max(1,Math.ceil(dt*distance(0,0,b.vx,b.vy)/12));
      let removed=false;
      for(let j=0;j<n&&!removed;j++){
        b.x+=b.vx*dt/n;b.y+=b.vy*dt/n;
        if(isSolid(tileAt(w,b.x,b.y))){removed=true;break;}
        if(b.owner==='enemy'){
          if(distance(b.x,b.y,p.x,p.y)<p.r+b.r){
            this.damagePlayer(b.power,b.x,b.y);removed=true;
          }
        }else{
          for(const e of [...w.enemies]){
            if(e.dead)continue;
            if(distance(b.x,b.y,e.x,e.y)<e.r+b.r){
              this.hitEnemy(e,b.power,b.x-b.vx*.01,b.y-b.vy*.01,55);
              removed=true;break;
            }
          }
        }
      }
      b.life-=dt;
      if(removed||b.life<=0||this.mode!=='playing'){
        w.projectiles.splice(i,1);
        if(removed)this.sparks(b.x,b.y,b.color,5,45);
      }
      if(this.mode!=='playing')return;
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    for(let i=w.effects.length-1;i>=0;i--){
      const e=w.effects[i];e.life-=dt;
      if(e.type==='spark'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=.91;e.vy*=.91;}
      if(e.type==='text')e.y-=22*dt;
      if(e.type==='ring')e.radius+=(330*dt);
      if(e.life<=0)w.effects.splice(i,1);
    }
  }
  interactHint(){
    if(this.mode!=='playing')return '';
    const p=this.player,w=this.world,tx=Math.floor(p.x/TILE),ty=Math.floor(p.y/TILE);
    for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++){
      if(x<0||y<0||x>=w.w||y>=w.h)continue;
      if(distance(p.x,p.y,(x+.5)*TILE,(y+.5)*TILE)>56)continue;
      const t=w.tiles[y*w.w+x];
      if(t===T.STAIRS)return w.boss&&!w.bossDefeated?'보스를 처치해야 출구 개방':'[E] 다음 층으로';
      if(t===T.SHOP)return '[E] 유령 상인';
      if(t===T.ELEVATOR)return '[E] 엘리베이터 (보석 5)';
      if(t===T.BROKEN)return '[E] 고장난 엘리베이터 (보석 5 / 피해 1)';
    }
    return '';
  }
  serialize(){
    const data={version:SAVE_VERSION,seed:this.seed,player:this.player,world:serializeWorld(this.world),
      elapsed:this.elapsed,kills:this.kills,score:this.score,time:this.time};
    return JSON.stringify(data);
  }
  restore(raw){
    try{
      const data=typeof raw==='string'?JSON.parse(raw):raw;
      if(!data||data.version!==SAVE_VERSION||!data.player||!data.world)throw Error('Incompatible save');
      this.world=restoreWorld(data.world);
      this.player={...this.makePlayer(),...data.player};
      if(!Number.isFinite(this.player.hp)||!Number.isFinite(this.player.x)||!Number.isFinite(this.player.y))throw Error('Corrupt player');
      this.seed=data.seed>>>0;this.rng=makeRng(this.seed^Math.floor(data.elapsed*1000));
      this.elapsed=data.elapsed||0;this.time=data.time||0;this.kills=data.kills||0;this.score=data.score||0;
      this.flow=null;this.flowTimer=0;this.visionTile='';this.visionTimer=0;this.runEnded=false;this.messages=[];
      refreshVision(this.world,this.player.x,this.player.y,11);
      this.setMode('playing');this.say('지난 탐험을 이어갑니다.',3);return true;
    }catch(e){this.say('저장 데이터가 손상되어 불러올 수 없습니다.',3);return false;}
  }
  summary(){return {floor:this.world.floor,score:this.score,kills:this.kills,time:formatTime(this.elapsed),
    gems:this.player.gems,level:this.player.level,seed:this.seed};}
}
