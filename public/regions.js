export function createRegionStore(limit=6){
 let items=[],activeId=null,nextId=1;
 const active=()=>items.find(item=>item.id===activeId);
 return {
  get items(){return items;},get active(){return active();},get limit(){return limit;},
  add(values={}){if(items.length>=limit)throw Error(`Check up to ${limit} regions at a time.`);const item={id:nextId++,font:'Inter',text:'',profile:null,...values};items.push(item);activeId=item.id;return item;},
  select(id){if(!items.some(item=>item.id===id))throw Error('Region not found.');activeId=id;return active();},
  remove(id){items=items.filter(item=>item.id!==id);if(activeId===id)activeId=items[0]?.id??null;},
  clear(){items=[];activeId=null;nextId=1;}
 };
}
// Bound concurrent region work; each region independently runs AI and local checks.
export async function processRegions(items,run,concurrency=2){
 let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
  while(next<items.length){const index=next++;await run(items[index],index);}
 }));
}
