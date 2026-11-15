// Classic-only persistence. Storage failures never break gameplay.
export const SAVE_KEY='ghost-city-classic-v1';
export const RANK_KEY='ghost-city-classic-ranks-v1';
export function createStorage(getGame,onSave=()=>{}){
  function read(key){try{return localStorage.getItem(key);}catch{return null;}}
  function write(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
  function del(key){try{localStorage.removeItem(key);}catch{}}
  function ranks(){try{const v=JSON.parse(read(RANK_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
  function persist(){
    const game=getGame();
    if(!game||game.runEnded||['menu','dead','victory'].includes(game.mode))return;
    const ok=write(SAVE_KEY,game.serialize());
    onSave(ok);
    return ok;
  }
  function finish(record){
    del(SAVE_KEY);
    const score={score:record.score,floor:record.floor,kills:record.kills,time:Math.round(record.time),victory:record.victory};
    write(RANK_KEY,JSON.stringify([...ranks(),score].sort((a,b)=>b.score-a.score).slice(0,10)));
  }
  return {read,write,del,ranks,persist,finish,SAVE:SAVE_KEY,RANKS:RANK_KEY};
}
