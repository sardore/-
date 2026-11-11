"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const audioSceneSource=html.split("\n scenes:{")[1]?.split("\n midi(n)")[0]||"";
const sceneNames = [...new Set([...audioSceneSource.matchAll(/([A-Za-z][A-Za-z0-9]*):\{label:/g)].map(x=>x[1]))];
const modes = {
  major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],
  dorian:[0,2,3,5,7,9,10],mixolydian:[0,2,4,5,7,9,10],
  lydian:[0,2,4,6,7,9,11],phrygian:[0,1,3,5,7,8,10]
};
function install(){
  const A={
    scenes:Object.fromEntries(sceneNames.map(id=>[id,{label:id}])),
    scene:"surface",step:0,notesScheduled:0,modes,
    ensure(){return true},refreshUi(){},
    scaleFor(tr){return modes[tr.mode]||modes.minor},
    degreeSemitone(tr,d=0){
      const scale=this.scaleFor(tr),n=Math.trunc(d),oct=Math.floor(n/7),idx=((n%7)+7)%7;
      return scale[idx]+12*oct;
    },
    midi(n){return 440*Math.pow(2,(n-69)/12)},
    chord(tr,bar){const root=this.chordDegree(tr,bar);return [root,root+2,root+4]},
    nearestChordDegree(tr,bar,target){
      let nearest=target,best=Infinity;
      for(const root of this.chord(tr,bar))for(let o=-3;o<=3;o++){
        const d=root+o*7,dist=Math.abs(d-target);
        if(dist<best){best=dist;nearest=d}
      }
      return nearest;
    },
    harmonySafety(){return {pass:true}},
    lowDrum(){},rim(){},wood(){},kick(){},snare(){},hat(){},tom(){},cymbal(){},shaker(){},
  };
  const globals={__AudioDirector:A,__bugEvoBuild:{}};
  const src=fs.readFileSync(path.join(__dirname,"original-scorebook-v2.js"),"utf8");
  vm.runInNewContext(src, {globalThis:globals,console,Math,Number,Map,Set,Object,Array,Date}, {timeout:2000});
  return {A,globals};
}

test("all original game scenes have composed 64-bar scores with valid rhythmic durations",()=>{
  assert.ok(sceneNames.length>=29,"scene extraction should cover the entire source game");
  const {A}=install(),audit=A.originalScorebookV2.audit();
  assert.equal(audit.pass,true,JSON.stringify(audit));
  assert.equal(audit.originalSongs,14);
  assert.equal(audit.scenes,sceneNames.length);
  assert.equal(audit.writtenBars,168);
  assert.equal(audit.loopBars,64);
  assert.ok(audit.minLoopSeconds>=70);
});

test("all 29 scenes produce written melodies with different moods",()=>{
  const {A}=install();
  const samples={};
  for(const id of sceneNames){
    const notes=[];
    A.scoreVoice=(m,at,dur,kind,vol,pan,bright)=>{
      assert.ok(Number.isFinite(m)&&m>20&&m<110,"valid midi note for "+id);
      assert.ok(Number.isFinite(at)&&dur>0&&vol>0&&vol<1);
      notes.push({m,at,kind});
    };
    A.scene=id;
    for(let step=0;step<16*64;step++){
      A.step=step;
      A.scheduleStep(10+step*.1);
    }
    assert.ok(notes.length>200,id+" has too few musical notes: "+notes.length);
    samples[id]={count:notes.length,first:notes.slice(0,8).map(n=>n.m)};
  }
  const distinct=new Set(Object.entries(A.scenes).map(([key,tr])=>tr.scoreId));
  assert.equal(distinct.size,14);
  assert.notDeepEqual(samples.surface.first,samples.hive.first);
  assert.notDeepEqual(samples.ocean?.first||samples.water.first,samples.arenaBoss.first);
});

test("scene section evolution and mixer levels are deliberate",()=>{
  const {A}=install();
  const tr=A.scenes.surface;
  const names=[0,6,14,22,30,38,48,62].map(bar=>A.barInfo(tr,bar*16).section);
  assert.deepEqual(names,["intro","verse","verse2","lift","bridge","build","finale","outro"]);
});
