/* 벌레랑 — ORIGINAL SCOREBOOK V2
 * Fourteen composed themes, sixty-four-bar long forms, scored percussion.
 * Original music; no external audio files, samples or third-party melodies.
 * Kept inside index.html at build time so the game remains self-contained.
 */
(function installBugEvoOriginalSoundtrack(){
  "use strict";
  const A=globalThis.__AudioDirector;
  if(!A||A.originalScorebookV2)return;

  // Every phrase contains four 4/4 bars. Numbers are diatonic scale degrees
  // and the durations after ':' are eighth notes. '-' is an intentional rest.
  // Different phrasing, rests, contour and harmonic changes are composed per track.
  const scores={
    meadow:{
      title:"새벽의 날갯짓",bpm:134,root:50,mode:"major",groove:"field",
      chords:[0,4,5,3,0,5,3,4],lead:"flute",answer:"guitar",pad:"strings",arp:"marimba",bass:"round",register:12,
      A:["0:2 2:1 4:1 5:2 4:2","2:2 4:1 5:1 7:2 5:2","4:1 2:1 0:2 -:1 2:1 4:2","3:2 2:1 1:1 0:2 -:2"],
      B:["4:1 5:1 7:2 9:2 7:2","5:2 4:1 2:1 4:2 5:2","6:2 7:2 9:1 7:1 5:2","4:3 2:1 0:4"],
      C:["2:3 0:1 2:2 4:2","5:2 -:1 4:1 2:2 1:2","0:1 2:1 4:2 7:2 5:2","3:2 2:2 0:4"]},
    ocean:{
      title:"빛의 수로",bpm:116,root:52,mode:"dorian",groove:"tide",
      chords:[0,3,6,4,0,6,3,4],lead:"glass",answer:"flute",pad:"airpad",arp:"marimba",bass:"round",register:12,
      A:["0:3 2:1 4:2 3:2","2:2 -:1 4:1 5:3 4:1","3:3 1:1 0:2 2:2","1:4 -:1 0:1 2:2"],
      B:["5:3 7:1 9:2 7:2","6:2 5:1 4:1 2:2 4:2","3:1 5:1 7:3 6:1 5:2","4:3 2:1 0:4"],
      C:["0:2 3:2 4:2 -:2","7:3 5:1 4:2 2:2","3:2 1:1 0:1 -:2 2:2","4:4 3:2 1:2"]},
    cavern:{
      title:"암벽 아래의 숨결",bpm:92,root:38,mode:"minor",groove:"cave",
      chords:[0,5,3,4,0,6,5,4],lead:"cello",answer:"hollow",pad:"organ",arp:"bell",bass:"sub",register:24,
      A:["0:3 -:1 2:2 3:2","2:4 -:2 0:2","-:2 3:2 4:1 3:1 1:2","0:3 -:1 -1:2 0:2"],
      B:["3:3 5:1 6:2 5:2","4:4 2:2 -:2","1:2 3:2 5:2 4:2","2:2 1:2 0:4"],
      C:["0:4 -:2 1:2","-1:3 0:1 2:4","3:3 1:1 0:2 -:2","-1:2 0:6"]},
    iron:{
      title:"철갑의 진군",bpm:138,root:43,mode:"minor",groove:"march",
      chords:[0,5,6,4,0,3,6,4],lead:"horn",answer:"strings",pad:"strings",arp:"piano",bass:"grit",register:19,
      A:["0:2 0:1 2:1 3:2 4:2","5:2 3:1 2:1 0:2 -:2","0:1 2:1 3:2 5:2 6:2","4:3 3:1 2:2 0:2"],
      B:["4:2 6:1 7:1 9:2 7:2","6:2 5:1 3:1 5:2 6:2","7:1 9:1 10:2 9:2 7:2","6:3 4:1 3:2 0:2"],
      C:["0:2 -:1 3:1 2:2 0:2","-1:2 0:2 2:2 3:2","4:2 5:2 3:1 2:1 0:2","2:2 1:2 0:4"]},
    canopy:{
      title:"창공의 나선",bpm:154,root:55,mode:"lydian",groove:"flight",
      chords:[0,1,4,5,0,5,4,1],lead:"flute",answer:"piano",pad:"airpad",arp:"bell",bass:"round",register:12,
      A:["0:1 2:1 4:2 6:2 5:2","4:2 6:1 7:1 9:2 7:2","5:1 4:1 2:2 4:1 6:1 7:2","6:2 4:2 2:4"],
      B:["7:1 9:1 11:2 10:2 9:2","8:1 7:1 9:2 11:2 12:2","10:2 9:1 7:1 6:2 8:2","7:3 5:1 4:4"],
      C:["0:2 4:2 7:2 9:2","8:3 6:1 4:2 2:2","5:2 7:1 9:1 11:2 10:2","9:2 7:2 4:4"]},
    swarm:{
      title:"호박빛 군무",bpm:168,root:52,mode:"mixolydian",groove:"insect",
      chords:[0,4,3,5,0,5,4,3],lead:"marimba",answer:"reed",pad:"strings",arp:"pluck",bass:"round",register:12,
      A:["0:1 4:1 2:1 -:1 5:1 4:1 2:2","3:1 5:1 7:2 -:1 5:1 3:2","4:1 2:1 0:1 2:1 4:2 6:2","5:1 3:1 2:2 0:2 -:2"],
      B:["7:1 9:1 7:1 5:1 8:2 7:2","6:1 8:1 10:2 -:1 9:1 7:2","5:1 7:1 9:1 10:1 9:2 7:2","5:1 4:1 2:2 0:4"],
      C:["0:2 -:1 2:1 5:2 4:2","3:2 5:2 7:1 5:1 3:2","2:1 4:1 6:2 5:2 3:2","4:2 2:2 0:4"]},
    arcane:{
      title:"부서진 별의 잔광",bpm:110,root:53,mode:"lydian",groove:"glass",
      chords:[0,4,1,5,0,1,4,0],lead:"piano",answer:"glass",pad:"choir",arp:"bell",bass:"round",register:12,
      A:["0:4 2:1 4:1 6:2","4:3 -:1 5:2 7:2","6:2 4:2 2:1 -:1 1:2","0:4 -:2 2:2"],
      B:["7:2 9:2 11:2 9:2","8:3 6:1 4:2 6:2","7:1 9:1 10:2 8:2 7:2","6:4 4:2 2:2"],
      C:["2:4 1:2 0:2","4:2 6:2 7:3 -:1","9:3 7:1 6:2 4:2","2:2 1:2 0:4"]},
    marsh:{
      title:"안개꽃의 맥동",bpm:102,root:45,mode:"dorian",groove:"cave",
      chords:[0,3,6,4,0,6,3,0],lead:"flute",answer:"cello",pad:"organ",arp:"marimba",bass:"round",register:19,
      A:["0:3 -:1 2:2 3:2","4:2 3:2 -:2 1:2","2:3 0:1 1:2 -:2","0:4 -:2 -1:2"],
      B:["3:2 5:1 7:1 6:2 5:2","4:3 2:1 3:2 5:2","6:2 -:1 5:1 3:2 2:2","1:2 0:2 -1:4"],
      C:["0:2 1:2 -:2 3:2","2:4 0:2 -:2","3:3 5:1 4:2 2:2","1:4 0:4"]},
    temple:{
      title:"가라앉은 기도의 홀",bpm:108,root:47,mode:"dorian",groove:"ritual",
      chords:[0,6,3,4,0,3,6,4],lead:"flute",answer:"organ",pad:"choir",arp:"bell",bass:"sub",register:19,
      A:["0:4 1:2 3:2","4:2 3:2 1:2 -:2","0:2 -:1 2:1 4:2 5:2","3:4 1:2 0:2"],
      B:["5:3 7:1 8:2 7:2","6:2 4:2 3:1 4:1 6:2","7:2 9:2 8:2 6:2","5:3 3:1 1:4"],
      C:["0:3 3:1 5:4","6:2 4:2 2:2 3:2","1:4 -:2 0:2","-1:2 1:2 0:4"]},
    volcanic:{
      title:"붉은 균열",bpm:164,root:40,mode:"minor",groove:"drive",
      chords:[0,5,6,4,0,3,6,5],lead:"horn",answer:"brass",pad:"strings",arp:"piano",bass:"grit",register:24,
      A:["0:2 2:1 4:1 7:2 6:2","4:1 3:1 2:2 0:2 2:2","3:1 5:1 7:2 9:2 7:2","6:2 4:1 3:1 2:2 0:2"],
      B:["7:1 9:1 11:2 10:1 9:1 7:2","8:2 10:1 11:1 13:2 11:2","9:1 7:1 6:1 7:1 9:2 10:2","11:2 9:1 7:1 6:2 4:2"],
      C:["0:3 -:1 3:2 4:2","5:2 7:2 6:2 4:2","3:1 4:1 6:2 7:2 9:2","7:2 4:2 0:4"]},
    arena:{
      title:"황금 투사의 서약",bpm:166,root:45,mode:"minor",groove:"battle",
      chords:[0,5,6,4,0,3,5,4],lead:"horn",answer:"strings",pad:"strings",arp:"piano",bass:"grit",register:19,
      A:["0:1 2:1 4:2 3:1 4:1 6:2","7:2 6:1 4:1 2:2 0:2","3:1 5:1 7:2 9:1 7:1 5:2","6:2 4:1 3:1 2:2 0:2"],
      B:["7:1 9:1 11:2 10:2 9:2","8:2 7:1 9:1 11:2 13:2","12:1 10:1 9:1 7:1 8:2 10:2","9:2 7:2 4:4"],
      C:["0:2 -:1 2:1 4:2 5:2","6:1 5:1 3:2 4:2 2:2","0:1 3:1 5:2 7:2 6:2","4:2 3:2 0:4"]},
    dread:{
      title:"포식자의 왕관",bpm:154,root:43,mode:"phrygian",groove:"battle",
      chords:[0,1,6,3,0,6,1,4],lead:"cello",answer:"horn",pad:"choir",arp:"piano",bass:"sub",register:19,
      A:["0:3 1:1 3:2 4:2","3:2 1:2 0:2 -:2","1:2 4:1 5:1 7:2 5:2","4:2 3:2 1:4"],
      B:["7:2 8:1 10:1 11:2 10:2","9:2 7:1 5:1 7:2 8:2","10:1 11:1 12:2 11:2 8:2","7:2 5:2 4:4"],
      C:["0:4 1:2 3:2","4:1 5:1 7:2 5:2 4:2","3:2 1:2 0:2 -:2","1:2 0:2 -1:4"]},
    collapse:{
      title:"시간의 파열",bpm:188,root:41,mode:"phrygian",groove:"drive",
      chords:[0,1,6,3,0,3,1,6],lead:"brass",answer:"strings",pad:"organ",arp:"piano",bass:"grit",register:24,
      A:["0:1 1:1 4:1 6:1 7:2 4:2","3:1 5:1 8:1 7:1 6:2 4:2","5:1 7:1 9:2 8:1 6:1 5:2","4:1 3:1 1:2 0:2 -:2"],
      B:["7:1 8:1 11:1 13:1 12:2 10:2","9:1 11:1 14:2 13:1 11:1 9:2","8:1 10:1 12:2 14:2 12:2","11:1 9:1 7:2 5:2 4:2"],
      C:["0:2 -:1 1:1 4:2 7:2","6:1 7:1 9:2 11:2 8:2","5:1 6:1 8:1 9:1 7:2 5:2","4:2 1:2 0:4"]},
    final:{
      title:"생태계의 마지막 심장",bpm:182,root:38,mode:"minor",groove:"final",
      chords:[0,5,6,4,0,3,6,5],lead:"horn",answer:"strings",pad:"choir",arp:"piano",bass:"grit",register:24,
      A:["0:2 2:1 4:1 7:2 6:2","5:1 4:1 3:2 2:2 0:2","3:2 5:1 7:1 9:2 10:2","9:2 7:1 6:1 4:2 2:2"],
      B:["7:1 9:1 11:2 14:2 12:2","10:1 9:1 11:2 13:2 12:2","14:1 12:1 11:1 9:1 10:2 11:2","9:2 7:2 4:4"],
      C:["0:4 3:2 5:2","7:2 6:2 4:2 5:2","3:1 5:1 7:2 9:2 10:2","7:2 4:2 0:4"]}
  };
  const variants={
    surface:["meadow",0,0],treeSap:["meadow",-10,-2,"guitar","flute"],
    treeBough:["meadow",17,0,"guitar","reed"],
    water:["ocean",0,0],arenaWater:["ocean",33,-2,"flute","horn"],
    underground:["cavern",0,0],deep:["cavern",-13,-3,"hollow","cello"],
    spider:["cavern",21,2,"hollow","cello"],
    citadel:["iron",0,0],termiteLow:["iron",-8,-2],termiteHigh:["iron",18,0,"brass","horn"],
    treeCrown:["canopy",0,0],stormRuins:["canopy",20,0,"strings","horn"],
    arenaAir:["canopy",28,2,"strings","reed"],
    hive:["swarm",0,0],crystalRift:["arcane",0,0],
    frostSanctum:["arcane",-12,-1,"glass","flute"],sporeFen:["marsh",0,0],
    sunkenTemple:["temple",0,0],ashCrater:["volcanic",0,0],
    arenaSand:["arena",0,0],arenaForest:["arena",-17,-2,"guitar","horn"],
    arenaChain:["arena",21,0,"brass","strings"],
    boss:["dread",0,0],arenaBoss:["dread",23,-1,"horn","brass"],
    arenaForestBoss:["dread",0,-5,"hollow","cello"],
    arenaDisaster:["collapse",0,0],arenaRiot:["collapse",16,0],
    apexFinal:["final",0,0]
  };

  function parseBar(bar){
    let cursor=0;
    const notes=[];
    for(const token of bar.split(/\s+/)){
      if(!token)continue;
      const m=/^(-?\d+|-):([1-8])$/.exec(token);
      if(!m)throw Error("Invalid score token: "+token);
      const duration=Number(m[2]);
      if(m[1]!=="-")notes.push({on:cursor*2,dur:duration*2,degree:Number(m[1])});
      cursor+=duration;
    }
    if(cursor!==8)throw Error("Score must contain exactly eight eighths: "+bar+" ("+cursor+")");
    return notes;
  }
  const compiled={};
  for(const [name,score] of Object.entries(scores)){
    const phrases={};
    for(const part of ["A","B","C"]){
      if(score[part]?.length!==4)throw Error(name+" missing "+part+" bars");
      phrases[part]=score[part].map(parseBar);
    }
    if(score.chords?.length!==8)throw Error(name+" needs 8-bar harmonic progression");
    compiled[name]={...score,phrases};
  }

  const originalLabels={};
  for(const [scene,spec] of Object.entries(variants)){
    const tr=A.scenes[scene],song=compiled[spec[0]];
    if(!tr||!song)throw Error("Unknown soundtrack scene "+scene);
    originalLabels[scene]=tr.label;
    tr.scoreId=spec[0];
    tr.score=song;
    tr.bpm=Math.max(80,song.bpm+spec[1]);
    tr.root=song.root+spec[2];
    tr.mode=song.mode;
    tr.groove=song.groove;
    tr.prog=song.chords.slice();
    tr.loopBars=64;
    tr.bass=song.bass;
    tr.musicPatch={
      lead:spec[3]||song.lead,answer:spec[4]||song.answer,
      pad:song.pad,arp:song.arp,bass:song.bass
    };
    tr.label=originalLabels[scene]+" · "+song.title;
  }
  const sceneKeys=Object.keys(A.scenes);
  for(const id of sceneKeys)if(!variants[id])throw Error("Unscored scene: "+id);

  const priorEnsure=A.ensure;
  A.ensure=function(){
    const ok=priorEnsure.call(this);
    if(!ok||this.__originalScoreFxInstalled)return ok;
    this.__originalScoreFxInstalled=true;
    // Replace the original aggressively compressed 3.2*2.65 gain stack.
    // The full orchestra is now balanced at the instrument/bus level.
    this.musicMakeup.gain.value=1.04;
    this.master.gain.value=.94;
    this.sfxBus.gain.value=.24;
    this.delayWet.gain.value=.08;
    this.delayFeedbackL.gain.value=.12;
    this.delayFeedbackR.gain.value=.11;
    this.musicComp.threshold.value=-16;
    this.musicComp.ratio.value=2.5;
    this.musicComp.attack.value=.013;
    this.musicComp.release.value=.24;
    this.finalComp.threshold.value=-7;
    this.finalComp.ratio.value=2.8;
    this.finalComp.release.value=.17;
    // Small diffuse room, no network fetch or external samples needed.
    if(typeof this.ctx.createConvolver==="function"){
      const rate=this.ctx.sampleRate,len=Math.floor(rate*1.45);
      const ir=this.ctx.createBuffer(2,len,rate);
      let seed=0x35a9c17f;
      for(let c=0;c<2;c++){
        const data=ir.getChannelData(c);
        let last=0;
        for(let i=0;i<len;i++){
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          const white=(seed/2147483648-1);
          const t=i/len,fade=Math.pow(1-t,3.1);
          last=last*.23+white*.77;
          data[i]=last*fade*.3;
        }
      }
      const room=this.ctx.createConvolver();
      room.buffer=ir;
      const wet=this.ctx.createGain();
      wet.gain.value=.14;
      this.musicBus.connect(room);
      room.connect(wet);
      wet.connect(this.musicComp);
      this.__originalScoreRoom={room,wet};
    }
    return ok;
  };
  A.targetMusicGain=function(){
    if(document.hidden)return 0;
    if(gameOver)return .55;
    if(paused||evoOpen||bestiaryOpen)return .84;
    return 1.36;
  };

  // Humanized short-form synthesis, with a smoother top end than the
  // former heavily driven square-wave and brass-dominant score.
  const P={
    flute:["flute",.045,.26,4600,.07],
    reed:["reed",.028,.23,3450,.05],
    guitar:["pluck",.004,.22,4200,.15],
    pluck:["pluck",.004,.20,4500,.13],
    piano:["soft",.003,.42,5200,.11],
    marimba:["glass",.003,.27,4600,.10],
    glass:["glass",.005,.48,6700,.06],
    bell:["bell",.005,.65,7600,.05],
    strings:["strings",.14,.48,3300,.17],
    cello:["strings",.09,.37,2400,.16],
    horn:["brass",.065,.28,2700,.13],
    brass:["brass",.045,.24,3000,.13],
    hollow:["hollow",.085,.42,1650,.10],
    organ:["organ",.068,.45,2600,.12],
    choir:["airpad",.22,.65,1950,.13],
    airpad:["airpad",.22,.62,2400,.15],
    round:["round",.011,.14,750,.05],
    sub:["sub",.022,.18,450,.035],
    grit:["grit",.012,.14,950,.055]
  };
  A.scoreVoice=function(midi,at,dur,kind,volume,pan=0,brightness=1){
    if(!this.ctx||!Number.isFinite(midi)||!Number.isFinite(at)||!Number.isFinite(dur)||dur<=0)return;
    const patch=P[kind]||P.flute;
    const [wave,attack,release,cutoff,detune]=patch;
    const freq=this.midi(midi);
    if(freq<30||freq>6500)return;
    const g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.Q.value=kind==="reed"?.65:.23;
    filter.frequency.setValueAtTime(Math.min(9500,Math.max(180,cutoff*brightness)),at);
    const amp=Math.max(.00015,volume);
    const rise=Math.min(dur*.37,attack);
    g.gain.setValueAtTime(.00001,at);
    g.gain.linearRampToValueAtTime(amp,at+Math.max(.003,rise));
    const decay=kind==="guitar"||kind==="pluck"||kind==="piano"||kind==="marimba"||kind==="bell"||kind==="glass";
    if(decay){
      g.gain.exponentialRampToValueAtTime(Math.max(.00004,amp*.30),at+Math.max(rise+.02,Math.min(.34,dur*.65)));
    }else{
      g.gain.exponentialRampToValueAtTime(Math.max(.00005,amp*.74),at+Math.max(rise+.03,dur*.82));
    }
    g.gain.exponentialRampToValueAtTime(.00001,at+dur+release);
    const o=this.ctx.createOscillator();
    o.setPeriodicWave(this.getWave(wave));
    o.frequency.setValueAtTime(freq,at);
    o.connect(filter);
    // One quiet detuned partial enhances orchestral width without detuned
    // fifths or large chorusing dissonances.
    if(detune>0&&kind!=="sub"){
      const o2=this.ctx.createOscillator(),og=this.ctx.createGain();
      o2.setPeriodicWave(this.getWave(wave));
      o2.frequency.setValueAtTime(freq,at);
      o2.detune.value=kind==="strings"||kind==="airpad"||kind==="choir"?5:2.4;
      og.gain.value=detune;
      o2.connect(og);
      og.connect(filter);
      o2.start(at);
      o2.stop(at+dur+release+.03);
    }
    filter.connect(g);
    this.routeMusic(g,pan,at);
    o.start(at);
    o.stop(at+dur+release+.03);
    this.notesScheduled++;
  };

  // Four-minute-sized harmonic arcs on fast tracks (~100-150 s per loop),
  // with distinct breakdowns, answers, and a 16-bar finale.
  A.barInfo=function(tr,step=this.step){
    const bar=Math.floor(step/16)%64,i=step%16,sd=60/tr.bpm/4;
    const section=bar<4?"intro":bar<12?"verse":bar<20?"verse2":
      bar<28?"lift":bar<36?"bridge":bar<44?"build":
      bar<60?"finale":"outro";
    return{bar,i,section,sd,beat:i/4,phrase:Math.floor(bar/4)};
  };
  A.loopBars=function(tr){return tr?.score?64:Math.max(16,Math.round(tr?.loopBars||24))};
  A.chordDegree=function(tr,bar){return(tr.score?.chords||tr.prog||[0,5,3,4])[bar%8]||0};

  const velocities={
    intro:.50,verse:.77,verse2:.91,lift:1.02,bridge:.55,
    build:.88,finale:1.13,outro:.57
  };
  function variation(a,phrase){
    if(phrase==="C")return 0;
    if(a.section==="verse2")return a.bar%8>=4?1:0;
    if(a.section==="finale")return a.bar%8>=4?1:0;
    return 0;
  }
  function scorePhrase(a){
    if(a.section==="intro")return"A";
    if(a.section==="verse")return"A";
    if(a.section==="verse2")return a.bar%8>=4?"B":"A";
    if(a.section==="lift")return"B";
    if(a.section==="bridge")return"C";
    if(a.section==="build")return a.bar%8>=4?"B":"C";
    if(a.section==="finale")return a.bar%8>=4?"A":"B";
    return"A";
  }
  function midiFor(tr,degree,oct=0){
    return tr.root+tr.score.register+oct+ A.degreeSemitone(tr,degree);
  }
  function softenedChord(tr,bar){
    const root=A.chordDegree(tr,bar),oct=tr.root;
    return[
      oct+A.degreeSemitone(tr,root),
      oct+12+A.degreeSemitone(tr,root+2),
      oct+12+A.degreeSemitone(tr,root+4)
    ];
  }
  function leadAt(tr,a,at,dynamic){
    const phrase=scorePhrase(a);
    const events=tr.score.phrases[phrase][a.bar%4],evt=events.find(x=>x.on===a.i);
    if(!evt)return;
    if(a.section==="intro"&&(a.bar<2||a.bar%2===0)&&evt.on%8!==0)return;
    if(a.section==="outro"&&evt.on%4!==0)return;
    const patch=tr.musicPatch;
    const phraseDelta=variation(a,phrase);
    const isPeak=a.section==="finale"&&a.bar>=52;
    const note=evt.degree+phraseDelta+(isPeak&&a.bar%4===3?7:0);
    const pianoLegato=tr.score.groove==="glass"||tr.score.groove==="tide";
    const dur=Math.max(.075,evt.dur*a.sd*(pianoLegato?.94:.82));
    const beatAccent=evt.on%8===0?1.06:.92;
    const human=(Math.sin(a.bar*29+a.i*13)*.004+Math.max(0,a.sd*.035));
    const inst=a.section==="intro"||a.section==="verse"||a.section==="bridge"?patch.lead:patch.answer;
    A.scoreVoice(midiFor(tr,note),at+human,dur,inst,.074*dynamic*beatAccent,((a.bar%4)-1.5)*.14,1.05);
    if((a.section==="lift"||a.section==="finale")&&evt.on%8===0&&a.bar%2===1){
      // A written third below the lead, with the harmony resolved to the
      // current chord rather than arbitrary semitone transposition.
      const answer=A.nearestChordDegree(tr,a.bar,note-2);
      A.scoreVoice(midiFor(tr,answer,-12),at+human+.012,dur*.88,patch.lead,.027*dynamic,-.30,.78);
    }
  }
  function padAt(tr,a,at,dynamic){
    if(a.i!==0)return;
    const chord=softenedChord(tr,a.bar);
    const ambient=["cave","glass","ritual"].includes(tr.groove);
    const dur=a.sd*(ambient?15.25: a.section==="finale"?12.8:14.5);
    const gain=.024*dynamic*(ambient?1.10:.85);
    const patch=tr.musicPatch;
    chord.forEach((pitch,i)=>{
      // Open voicings and staggered attacks make the harmony breathe.
      const m=i===0?pitch-0:pitch;
      A.scoreVoice(m,at+i*.016,dur,patch.pad,gain*(i===0?1.12:i===2?.73:.83),
        [-.47,.10,.46][i],.83);
    });
    if(["battle","drive","march","final"].includes(tr.groove)&&a.section!=="bridge"){
      const root=chord[0]+12;
      A.scoreVoice(root,at,a.sd*2.4,"piano",.021*dynamic,-.24,.90);
    }
  }
  function bassAt(tr,a,at,dynamic){
    const ambient=["cave","glass","ritual"].includes(tr.groove),i=a.i;
    const anchors=ambient?[0,8]:tr.groove==="field"||tr.groove==="tide"?[0,8,14]:[0,6,8,14];
    if(!anchors.includes(i)||a.section==="intro"&&i!==0||a.section==="outro"&&i>8)return;
    const root=A.chordDegree(tr,a.bar),fifth=root+4-7;
    const passing=i===14&&a.bar%2?fifth:i===6?fifth:root;
    const midi=tr.root-12+A.degreeSemitone(tr,passing);
    A.scoreVoice(midi,at,a.sd*(ambient?7.1:i===14?1.8:3.0),tr.musicPatch.bass,
      (ambient?.068:.105)*dynamic,i===14?.08:0,.83);
  }
  function figuresAt(tr,a,at,dynamic){
    const ambient=["cave","glass","ritual"].includes(tr.groove);
    const i=a.i,active=ambient?[4,12]:tr.groove==="field"||tr.groove==="tide"?[2,6,10,14]:[2,4,6,10,12,14];
    if(a.section==="intro"||a.section==="bridge"||a.section==="outro")return;
    if(!active.includes(i))return;
    const chord=A.chord(tr,a.bar);
    const index=(Math.floor(i/2)+a.bar)%4;
    const degree=chord[[0,1,2,1][index]];
    const register=tr.score.register+(ambient?12:12);
    A.scoreVoice(tr.root+register+A.degreeSemitone(tr,degree),at+(i%4===2?.009:0),a.sd*.83,
      tr.musicPatch.arp,.025*dynamic,i<8?-.37:.37,1.08);
  }
  function drumAt(tr,a,at,dynamic){
    const i=a.i,g=tr.groove;
    const intro=a.section==="intro",bridge=a.section==="bridge",outro=a.section==="outro";
    const light=intro||bridge||outro;
    const v=(g==="battle"||g==="drive"||g==="final"?.107:.079)*dynamic;
    if(g==="cave"||g==="ritual"){
      if(i===0&&(a.bar%2===0||!light))A.lowDrum(at,v*.83,g==="ritual"?72:59);
      if(i===12&&!light)A.rim(at,v*.30);
      if(i===8&&a.bar%2)A.wood(at,v*.21,515);
      return;
    }
    if(g==="glass"){
      if(i===0&&a.bar%2===0)A.kick(at,v*.44);
      if((i===6||i===14)&&!light)A.shaker(at,v*.12);
      if(i===12&&a.bar%4===3)A.wood(at,v*.17,830);
      return;
    }
    if(g==="tide"){
      if(i===0||i===10&&!light)A.kick(at,v*.63);
      if((i===4||i===12)&&!light)A.rim(at,v*.25);
      if((i===2||i===6||i===10||i===14)&&!intro)A.shaker(at,v*.19);
      if(i===7&&a.bar%4===3)A.wood(at,v*.19,690);
      return;
    }
    if(g==="insect"||g==="flight"){
      if([0,7,10].includes(i)||i===14&&a.bar%2)A.kick(at,v*(light?.55:.90));
      if((i===4||i===12)&&!intro)A.snare(at,v*.50);
      if(i%2===0&&!bridge)A.hat(at,v*(i%4===0?.13:.08));
      if(a.bar%4===3&&i===15)A.wood(at,v*.30,820);
      return;
    }
    if(g==="field"){
      if(i===0||i===8)A.kick(at,v*(light?.52:.86));
      if((i===4||i===12)&&!intro)A.rim(at,v*.42);
      if(i%2===0&&!bridge)A.shaker(at,v*.17);
      if(i===14&&a.bar%4===3)A.wood(at,v*.2,790);
      return;
    }
    const heavy=["battle","drive","final","march"].includes(g);
    if(i===0||i===8||!light&&(i===6||a.bar%2===1&&i===14))A.kick(at,v*(light?.52:1.04));
    if((i===4||i===12)&&!intro)A.snare(at,v*(light?.45:.76));
    if(i%2===0&&!bridge)A.hat(at,v*(i%4===0?.16:.085),false);
    if(heavy&&!light&&a.bar%4===3&&[13,14,15].includes(i)){
      A.tom(at+i%2*.007,v*(i===15?.43:.24),[112,91,68][i-13]);
    }
    if(a.section==="finale"&&a.bar%8===4&&i===0)A.cymbal(at,v*.39);
  }

  A.scheduleStep=function(at){
    const tr=this.scenes[this.scene]||this.scenes.surface;
    const a=this.barInfo(tr);
    const dynamic=velocities[a.section]||1;
    padAt(tr,a,at,dynamic);
    bassAt(tr,a,at,dynamic);
    leadAt(tr,a,at,dynamic);
    figuresAt(tr,a,at,dynamic);
    drumAt(tr,a,at,dynamic);
  };

  A.originalScorebookV2={
    version:"ORIGINAL_SCOREBOOK_V2_64BAR",
    songCount:Object.keys(scores).length,
    sceneCount:Object.keys(variants).length,
    songs:Object.fromEntries(Object.entries(scores).map(([key,x])=>[key,{
      title:x.title,mode:x.mode,tempo:x.bpm,chordBars:x.chords.length,
      uniqueWrittenBars:x.A.length+x.B.length+x.C.length
    }])),
    audit(){
      const issues=[];
      for(const [id,scene] of Object.entries(A.scenes)){
        if(!scene.score||scene.loopBars!==64||!scene.musicPatch)issues.push("unscored:"+id);
      }
      return{
        version:this.version,originalSongs:this.songCount,scenes:this.sceneCount,
        writtenBars:Object.keys(scores).length*12,loopBars:64,
        minLoopSeconds:+Math.min(...Object.values(A.scenes).map(x=>64*4*60/x.bpm)).toFixed(1),
        issues,pass:issues.length===0&&A.harmonySafety().pass
      };
    }
  };
  Object.assign(globalThis.__bugEvoBuild||{},{
    originalSoundtrackV2Audit:()=>A.originalScorebookV2.audit()
  });
  if(typeof A.refreshUi==="function")A.refreshUi();
})();
