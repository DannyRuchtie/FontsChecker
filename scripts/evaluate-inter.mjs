import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {buildDecision} from '../decision.mjs';
import {addInterReferences} from '../inter-reference.mjs';
if(!process.env.OPENAI_API_KEY){console.error('Configure OPENAI_API_KEY in .env before evaluating.');process.exit(1);}
const cases=JSON.parse(await readFile(new URL('../eval/manifest.json',import.meta.url),'utf8'));
const results=[];
for(const item of cases){
 const image=`data:image/jpeg;base64,${(await readFile(new URL(`../eval/fixtures/${item.file}`,import.meta.url))).toString('base64')}`;
 for(const withReferences of [false,true]){
  const base=buildDecision({image,mode:'verify',font:'Inter'});const payload=withReferences?addInterReferences(base).payload:base;
  const response=await fetch('https://api.openai.com/v1/decisions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw Error(data.error?.message||`HTTP ${response.status}`);
  const answer=data.answers?.[0];const probability=answer?.type==='predicate'?answer.probability:null;
  results.push({...item,withReferences,probability,prediction:probability===null?'refusal':probability>=.8?'positive':probability<=.2?'negative':'inconclusive',inputTokens:data.usage?.input_tokens});
 }
 console.log(`Completed ${item.file}`);
}
const summary=[false,true].map(withReferences=>{
 const rows=results.filter(x=>x.withReferences===withReferences);
 return {withReferences,cases:rows.length,truePositive:rows.filter(x=>x.expected&&x.prediction==='positive').length,falseNegative:rows.filter(x=>x.expected&&x.prediction==='negative').length,trueNegative:rows.filter(x=>!x.expected&&x.prediction==='negative').length,falsePositive:rows.filter(x=>!x.expected&&x.prediction==='positive').length,inconclusive:rows.filter(x=>x.prediction==='inconclusive').length,refusals:rows.filter(x=>x.prediction==='refusal').length};
});
await mkdir(new URL('../eval/results/',import.meta.url),{recursive:true});await writeFile(new URL('../eval/results/latest.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),summary,results},null,2));console.log(JSON.stringify(summary,null,2));
