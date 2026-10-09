// Per-process cache: exact inputs only; neither images nor results are persisted.
export function createResultCache({limit=12,ttlMs=600000,maxBytes=12000000,now=Date.now}={}) {
 const entries=new Map();let bytes=0;
 const remove=key=>{const entry=entries.get(key);if(entry){bytes-=entry.bytes||0;entries.delete(key);}};
 return {
  async get(key,compute){
   let entry=entries.get(key);
   if(entry&&now()-entry.created>=ttlMs){remove(key);entry=null;}
   if(entry){entries.delete(key);entries.set(key,entry);return {value:structuredClone(await entry.task),hit:true,ageMs:now()-entry.created};}
   entry={created:now(),bytes:0};entry.task=Promise.resolve().then(compute);entries.set(key,entry);
   while(entries.size>limit)remove(entries.keys().next().value);
   try{const value=await entry.task;entry.bytes=Buffer.byteLength(JSON.stringify(value));if(entries.get(key)===entry){bytes+=entry.bytes;while(bytes>maxBytes&&entries.size)remove(entries.keys().next().value);}return {value:structuredClone(value),hit:false,ageMs:0};}catch(error){if(entries.get(key)===entry)remove(key);throw error;}
  },
  delete(key){remove(key);},
  clear(){entries.clear();bytes=0;}
 };
}
