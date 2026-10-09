import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFont} from '../analyze.mjs';
test('AI cache shares identical checks, distinguishes changed inputs, and never keeps refusals or failures',async()=>{
 const original=globalThis.fetch;let calls=0,mode='success';
 globalThis.fetch=async url=>{assert.equal(url,'https://api.openai.com/v1/decisions');calls++;if(mode==='failure')throw Error('Network unavailable');return {ok:true,json:async()=>({answers:mode==='refusal'?[{name:'font_match',type:'refusal'}]:[{name:'font_match',type:'predicate',probability:.5},{name:'readable_text',type:'predicate',probability:1}],usage:{input_tokens:123,output_tokens:0,total_tokens:123}})};};
 const request={image:'data:image/png;base64,Y2FjaGV0ZXN0',font:'Inter',text:'Cache'};
 try{
  const [a,b]=await Promise.all([analyzeFont(request),analyzeFont(request)]);assert.equal(calls,1);assert.ok(a.resultCache.hit!==b.resultCache.hit);
  const cached=await analyzeFont(request);assert.equal(calls,1);assert.equal(cached.timings.openaiMs,0);
  await analyzeFont({...request,text:'Cached'});assert.equal(calls,2);
  await analyzeFont({...request,image:'data:image/png;base64,Y2hhbmdlZA=='});assert.equal(calls,3);
  mode='refusal';const refusal={...request,text:'Refusal'};await analyzeFont(refusal);await analyzeFont(refusal);assert.equal(calls,5);
  mode='failure';const failing={...request,text:'Failure'};await assert.rejects(analyzeFont(failing));await assert.rejects(analyzeFont(failing));assert.equal(calls,7);
 }finally{globalThis.fetch=original;}
});
