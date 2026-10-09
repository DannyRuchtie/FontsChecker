import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRegionStore,processRegions} from '../public/regions.js';
test('region text, target fonts and results remain independent',()=>{
 const store=createRegionStore(2);const first=store.add({font:'Inter',text:'Headline',request:{aiData:'first'}}),second=store.add({font:'Gothic A1',text:'Caption'});
 store.select(first.id);store.active.text='Updated headline';assert.equal(second.text,'Caption');assert.equal(second.font,'Gothic A1');assert.equal(store.active.request.aiData,'first');assert.throws(()=>store.add(),/up to 2/);store.remove(first.id);assert.equal(store.active,second);store.clear();assert.equal(store.items.length,0);assert.equal(store.active,undefined);
});
test('batch work checks each region once with bounded concurrency',async()=>{
 let running=0,maximum=0;const checked=[];
 await processRegions([1,2,3,4,5],async item=>{running++;maximum=Math.max(maximum,running);await new Promise(resolve=>setTimeout(resolve,5));checked.push(item);running--;},2);
 assert.equal(maximum,2);assert.deepEqual(checked.sort(),[1,2,3,4,5]);
});
