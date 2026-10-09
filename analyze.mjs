import {createHash} from 'node:crypto';
import {createResultCache} from './result-cache.mjs';
import {buildDecision} from './decision.mjs';
import {attachFontReferences} from './font-library.mjs';
import {selectReferences,shouldBroaden} from './reference-selection.mjs';
const cache=createResultCache();
export async function analyzeFont(request){
 const started=performance.now();
 const selection=selectReferences(request.profile);
 const {payload,reference}=await attachFontReferences(buildDecision(request),request.font||'Inter',request.text?.trim()||'',selection);
 const referenceMs=Math.round(performance.now()-started);
 const key=createHash('sha256').update(JSON.stringify({payload,retryBroad:request.retryBroad===true})).digest('hex');
 const cached=await cache.get(key,async()=>{
  const upstream=async body=>{const res=await fetch('https://api.openai.com/v1/decisions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await res.json();if(!res.ok)throw Error(data.error?.message||'OpenAI could not complete this request.');if(!data.answers?.length)throw Error('OpenAI returned no decision.');return data;};
  const apiStart=performance.now();let data=await upstream(payload),current=reference;
  // A refusal is not a reusable completed verdict.
  if(data.answers.some(x=>x.type==='refusal'))return {...data,reference:current,refused:true,timings:{openaiMs:Math.round(performance.now()-apiStart)}};
  const attempts=[{referenceImages:current.images,variantCount:current.variantCount,usage:data.usage,answers:data.answers}];let fallbackError;
  if(request.retryBroad===true&&shouldBroaden(data,selection))try{const broad=await attachFontReferences(buildDecision(request),request.font||'Inter',request.text?.trim()||'');data=await upstream(broad.payload);current=broad.reference;attempts.push({referenceImages:current.images,variantCount:current.variantCount,usage:data.usage,answers:data.answers});}catch{fallbackError='Broader comparison failed; showing the first result.';}
  return {...data,refused:data.answers.some(x=>x.type==='refusal'),usage:{input_tokens:attempts.reduce((n,x)=>n+(x.usage?.input_tokens||0),0),output_tokens:attempts.reduce((n,x)=>n+(x.usage?.output_tokens||0),0),total_tokens:attempts.reduce((n,x)=>n+(x.usage?.total_tokens||0),0)},reference:current,attempts,fallbackError,timings:{openaiMs:Math.round(performance.now()-apiStart)}};
 });
 if(cached.value.refused)cache.delete(key);
 return {...cached.value,elapsedMs:Math.round(performance.now()-started),resultCache:{hit:cached.hit,ageMs:cached.ageMs,ttlMs:600000},timings:{referenceMs,openaiMs:cached.hit?0:cached.value.timings.openaiMs,totalMs:Math.round(performance.now()-started)}};
}
