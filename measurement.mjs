import {execFile} from 'node:child_process';
import {readPositions} from './ocr-positions.mjs';
import {resolve} from 'node:path';
import {prepareFont} from './font-library.mjs';
import {validateImage} from './decision.mjs';
export async function measureFont(request){
 validateImage(request.image);
 if(typeof request.text!=='string'||request.text.length>120)throw Error('Enter up to 120 characters for comparison.');
 const font=await prepareFont(request.font||'Inter');
 let ocr;try{ocr=await readPositions(request.image);}catch{ocr=null;}
 const run=async(directory)=>JSON.parse(await new Promise((ok,fail)=>{const child=execFile(resolve('.renderer/bin/python'),[resolve('scripts/measure-font.py')],{timeout:180000,maxBuffer:4000000},(e,out)=>e?fail(Error('Local measurement could not finish.')):ok(out));child.stdin.end(JSON.stringify({directory,image:request.image,text:request.text,ocr}));}));
 const target=await run(font.directory);
 if(target.status!=='measured')return {...target,family:font.family};
 const contrasts=[];for(const name of ['Inter','Roboto','Open Sans'].filter(x=>x.toLowerCase()!==font.family.toLowerCase()).slice(0,2)){const other=await prepareFont(name);const result=await run(other.directory);contrasts.push({family:other.family,status:result.status,score:result.best?.shapeSimilarity});}
 const competitor=Math.max(...contrasts.filter(x=>typeof x.score==='number').map(x=>x.score));const margin=contrasts.length===2&&contrasts.every(x=>x.status==='measured')&&Number.isFinite(competitor)?Math.round((target.best.shapeSimilarity-competitor)*10)/10:null;
 return {...target,family:font.family,contrasts,margin,statusLabel:margin===null?'Comparison incomplete':margin>=3&&target.best.shapeSimilarity>=90?'Strong measured similarity':margin<=-3?'Another font fits better':'Similar fonts remain ambiguous',calibrated:false};
}
