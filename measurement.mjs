import {brightLetterMask} from './image-preprocessing.mjs';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readPositions} from './ocr-positions.mjs';
import {resolve} from 'node:path';
import {prepareFont,contrastFamilies} from './font-library.mjs';
import {validateImage} from './decision.mjs';
import {createResultCache} from './result-cache.mjs';
const cache=createResultCache({maxBytes:12000000});
export async function measureFont(request){
 const started=performance.now();validateImage(request.image);
 if(typeof request.text!=='string'||request.text.length>120)throw Error('Enter up to 120 characters for comparison.');
 const names=[request.font||'Inter',...contrastFamilies(request.font||'Inter')];
 const fonts=await Promise.all(names.map(async(name,i)=>{try{return await prepareFont(name);}catch(e){if(i===0)throw e;return {family:name};}}));
 const fingerprint=await Promise.all(fonts.map(async f=>f.directory?Promise.all(f.files.map(x=>readFile(resolve(f.directory,x.file)))):f.family));
 const key=createHash('sha256').update(request.image).update(request.text).update(JSON.stringify(names));
 for(const f of fingerprint)for(const source of Array.isArray(f)?f:[f])key.update(source);
 key.update(await readFile('scripts/measure-font.py'));key.update(await readFile('scripts/font-instances.py'));key.update(await readFile('scripts/ocr-mask.py'));key.update(await readFile('ocr-positions.mjs'));
 const cached=await cache.get(key.digest('hex'),async()=>{
  const timings={ocrMs:0};
  let measurementImage=request.image;
  const run=async(font,ocr)=>font.directory?JSON.parse(await new Promise((ok,fail)=>{const child=execFile(resolve('.renderer/bin/python'),[resolve('scripts/measure-font.py')],{timeout:180000,maxBuffer:4000000},(e,out)=>e?fail(Error('Local measurement could not finish.')):ok(out));child.stdin.end(JSON.stringify({directory:font.directory,image:measurementImage,text:request.text,ocr}));})):({status:'not_checked'});
  const measureStarted=performance.now();let target=await run(fonts[0],null),ocr=null;
  if(target.status!=='measured'||target.best?.shapeSimilarity<60){try{const mask=await brightLetterMask(request.image);if(mask.image){measurementImage=mask.image;const masked=await run(fonts[0],null);if(masked.status==='measured')target=masked;else measurementImage=request.image;}}catch{}}
  if(target.status!=='measured'){const ocrStart=performance.now();try{ocr=await readPositions(measurementImage,{singleLine:true});if(!ocr.lines.some(x=>x.text.replace(/\s/g,'')===request.text.replace(/\s/g,'')))ocr=await readPositions(measurementImage,{block:true});}catch{}timings.ocrMs=Math.round(performance.now()-ocrStart);if(ocr)target=await run(fonts[0],ocr);}
  timings.targetMs=Math.round(performance.now()-measureStarted);
  if(target.status!=='measured')return {...target,family:fonts[0].family,timings};
  const contrastStart=performance.now();
  // Use the same segmentation path and literal text for each competing font.
  const contrasts=await Promise.all(fonts.slice(1).map(async font=>{try{const r=await run(font,ocr);return {family:font.family,status:r.status,score:r.best?.shapeSimilarity};}catch{return {family:font.family,status:'not_checked'};}}));
  timings.contrastMs=Math.round(performance.now()-contrastStart);
  const competitor=Math.max(...contrasts.filter(x=>typeof x.score==='number').map(x=>x.score));
  const margin=contrasts.length>=2&&contrasts.every(x=>x.status==='measured')&&Number.isFinite(competitor)?Math.round((target.best.shapeSimilarity-competitor)*10)/10:null;
  return {...target,family:fonts[0].family,contrasts,margin,statusLabel:target.best.shapeSimilarity<60?'Measurement unreliable':margin===null?'Comparison incomplete':margin>=3&&target.best.shapeSimilarity>=90?'Strong measured similarity':margin<=-3?'Another font fits better':'Similar fonts remain ambiguous',calibrated:false,timings};
 });
 return {...cached.value,resultCache:{hit:cached.hit,ageMs:cached.ageMs,ttlMs:600000},timings:{...cached.value.timings,totalMs:Math.round(performance.now()-started)}};
}
