import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {createWorker} from 'tesseract.js';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
let workerPromise,queue=Promise.resolve();
const results=new Map();
async function worker(){if(!workerPromise)workerPromise=(async()=>{await mkdir(resolve('.cache/ocr'),{recursive:true});return createWorker('eng',1,{cachePath:resolve('.cache/ocr')});})();return workerPromise;}
function recognizePositions(image){
 const task=queue.then(async()=>{const w=await worker();const {data}=await w.recognize(Buffer.from(image.split(',')[1],'base64'),{},{blocks:true});const lines=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){const glyphs=[];for(const word of line.words||[])for(const symbol of word.symbols||[]){const b=symbol.bbox;glyphs.push({character:symbol.text,x:b.x0,y:b.y0,width:b.x1-b.x0,height:b.y1-b.y0});}lines.push({text:line.text.trim(),confidence:line.confidence/100,glyphs,pixels:true,bbox:line.bbox});}
 const dimensions=await new Promise((ok,fail)=>{const child=execFile(resolve('.renderer/bin/python'),['-c',"import sys,json,base64;from PIL import Image;from io import BytesIO;r=json.load(sys.stdin);im=Image.open(BytesIO(base64.b64decode(r['image'].split(',')[1])));print(json.dumps({'width':im.width,'height':im.height}))"],{timeout:10000},(e,out)=>e?fail(e):ok(JSON.parse(out)));child.stdin.end(JSON.stringify({image}));});
 return {lines,engine:'Tesseract.js',text:data.text,...dimensions};});queue=task.catch(()=>{});return task;
}
export function readPositions(image){
 const key=createHash('sha256').update(image).digest('hex');
 if(results.has(key))return results.get(key);
 const task=recognizePositions(image);results.set(key,task);
 if(results.size>12)results.delete(results.keys().next().value);
 task.catch(()=>{if(results.get(key)===task)results.delete(key);});
 return task;
}
export async function closeOCR(){results.clear();if(workerPromise){await (await workerPromise).terminate();workerPromise=null;}}
