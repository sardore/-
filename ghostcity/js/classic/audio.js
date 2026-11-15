// Synthesis-only audio; the game runs without audio permission.
export function createAudio(){
  let ctxAudio=null,muted=false;
  function sound(id){
  if(muted)return;
  try{
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A)return;
    if(!ctxAudio)ctxAudio=new A();
    if(ctxAudio.state==='suspended')ctxAudio.resume();
    const notes={swing:[200,105,.12],hit:[140,60,.13],hurt:[230,60,.32],coin:[570,890,.09],
      equip:[420,570,.08],dash:[400,820,.2],level:[510,960,.24],heal:[320,700,.28],
      buy:[530,830,.17],boss:[160,40,.6],dead:[380,50,.6],victory:[390,980,.7],
      enemyShoot:[250,190,.08]};
    const [a,b,d]=notes[id]||[300,360,.09],os=ctxAudio.createOscillator(),g=ctxAudio.createGain();
    os.type=['hurt','boss','dead'].includes(id)?'sawtooth':'triangle';
    const t=ctxAudio.currentTime;os.frequency.setValueAtTime(a,t);
    os.frequency.exponentialRampToValueAtTime(Math.max(40,b),t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.065,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);g.connect(ctxAudio.destination);
    os.start(t);os.stop(t+d+.01);
  }catch{}
}

  function toggle(){muted=!muted;return muted;}
  return {play:sound,toggle,get muted(){return muted;}};
}
