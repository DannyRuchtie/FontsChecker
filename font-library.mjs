import {readFile,writeFile,mkdir,cp,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve('.cache/fonts'),inflight=new Map(),rendering=new Map();
export function fontId(name){if(typeof name!=='string'||!name.trim()||name.length>100||!/^[\p{L}\p{N} ._-]+$/u.test(name))throw Error('Enter a plain font-family name.');return name.toLowerCase().replace(/[^a-z0-9]/g,'');}
async function download(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Font download failed (${r.status}).`);const buffer=Buffer.from(await r.arrayBuffer());if(buffer.length>15_000_000)throw Error('Font file is too large.');return buffer;}
async function render(directory,text,selection=null){
 const key=directory+':'+text+JSON.stringify(selection);if(rendering.has(key))return rendering.get(key);const task=renderOnce(directory,text,selection);rendering.set(key,task);try{return await task;}finally{rendering.delete(key);}
}
async function renderOnce(directory,text,selection){
 const key=createHash('sha256').update(selection?'v2:'+text+JSON.stringify(selection):'v1:'+text).digest('hex').slice(0,20);const file=resolve(directory,'renders',key,'manifest.json');
 try{return {...JSON.parse(await readFile(file,'utf8')),cacheHit:true};}catch{}
 const script=resolve('scripts/render-font.py');
 // stdin avoids shell interpolation of font names and transcribed text.
 const result=await new Promise((ok,fail)=>{execFile(resolve('.renderer/bin/python'),[script],{timeout:180000,maxBuffer:4_000_000},(error,stdout,stderr)=>error?fail(Error(stderr.includes('lacks glyphs')?'The font does not support the transcribed text. Edit it and retry.':'Reference rendering failed. Run npm run setup:fonts and retry.')):ok(stdout)).stdin.end(JSON.stringify({directory,text,selection,key}));});
 const data=JSON.parse(result);await writeFile(file,JSON.stringify(data,null,2));return {...data,cacheHit:false};
}
export async function prepareFont(name){const id=fontId(name);if(!id)throw Error('Font name is not supported.');if(inflight.has(id))return inflight.get(id);
 const task=(async()=>{const directory=resolve(root,id);await mkdir(directory,{recursive:true});let metadata;
 try{await readFile(resolve(directory,'source.json'));}catch{try{await cp(resolve('references/packs',id),directory,{recursive:true});}catch{}}
 try{metadata=JSON.parse(await readFile(resolve(directory,'source.json'),'utf8'));}catch{
  if(id==='inter'){
   const files=[];for(const file of ['InterVariable.woff2','InterVariable-Italic.woff2']){const from=resolve('references/inter',file);await copyFile(from,resolve(directory,file));files.push({file,sha256:createHash('sha256').update(await readFile(from)).digest('hex')});}
   await copyFile(resolve('references/inter/LICENSE.txt'),resolve(directory,'LICENSE.txt'));metadata={family:'Inter',source:'https://rsms.me/inter/',version:'4.1',files,license:'LICENSE.txt'};
  }else{
   let listing,folder;
   for(const license of ['ofl','apache','ufl']){folder=`${license}/${id}`;const r=await fetch(`https://api.github.com/repos/google/fonts/contents/${folder}`,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/vnd.github+json'}});if(r.status===404)continue;if(!r.ok)throw Error(`Google Fonts lookup failed (${r.status}). Try later.`);listing=await r.json();break;}
   if(!Array.isArray(listing))throw Error('Font not found in Google Fonts. Try its exact family name; proprietary fonts are not downloaded.');
   const metadataEntry=listing.find(x=>x.name==='METADATA.pb');let family=name.trim();if(metadataEntry){const raw=(await download(metadataEntry.download_url)).toString();family=raw.match(/^name: "([^"]+)"/m)?.[1]||family;if(fontId(family)!==id)throw Error('Font metadata does not match the requested family.');}
   const entries=listing.filter(x=>x.name.endsWith('.ttf'));if(!entries.length||entries.length>40)throw Error('This font package is not supported.');
   const license=listing.find(x=>/^(OFL|LICENSE|LICENCE|UFL).*\.(txt|TXT)$/.test(x.name));if(!license)throw Error('Font package has no license file.');
   const files=[];for(const entry of entries){if(!entry.download_url?.startsWith('https://raw.githubusercontent.com/google/fonts/'))throw Error('Unexpected font source.');const data=await download(entry.download_url);await writeFile(resolve(directory,entry.name),data);files.push({file:entry.name,sha256:createHash('sha256').update(data).digest('hex'),url:entry.download_url,gitBlob:entry.sha});}
   await writeFile(resolve(directory,license.name),await download(license.download_url));metadata={family,source:`https://github.com/google/fonts/tree/main/${folder}`,files,license:license.name,downloadedAt:new Date().toISOString()};
  }
  await writeFile(resolve(directory,'source.json'),JSON.stringify(metadata,null,2));
 }
 const pack=await render(directory,'');return {...metadata,id,directory,pack};})();inflight.set(id,task);try{return await task;}finally{inflight.delete(id);}}
export async function attachFontReferences(payload,font,text='',selection=null){
 const prepared=await prepareFont(font);let effectiveSelection=selection;let pack=text||selection?await render(prepared.directory,text,selection):prepared.pack;
 if(!pack.variantCount){pack=text?await render(prepared.directory,text):prepared.pack;effectiveSelection=null;}
 // Cap transmission, not generation. Select pages across all styles/optical sizes.
 const atlases=pack.atlases.length<=6?pack.atlases:Array.from({length:6},(_,i)=>pack.atlases[Math.round(i*(pack.atlases.length-1)/5)]);
 const parts=payload.input[0].content;parts[0].text+=` The first image is the TARGET. The next ${atlases.length} images are REFERENCE ONLY, rendered from actual ${JSON.stringify(prepared.family)} font files. Never treat reference text as target evidence. They include available weights, upright/italic and optical-size samples at ${pack.sizes.join(", ")} pixels. Other axes remain at defaults. Compare shared glyphs across multiple characters; if references are insufficient or a lookalike cannot be distinguished, remain uncertain.`;
 parts.push({type:'input_text',text:'REFERENCE ONLY. Variant labels and font source metadata: '+JSON.stringify(atlases.map(x=>x.variants))},...await Promise.all(atlases.map(async x=>({type:'input_image',image_url:'data:image/jpeg;base64,'+(await readFile(resolve(prepared.directory,x.file))).toString('base64')}))));
 const contrasts=[];
 for(const name of ['Inter','Roboto','Open Sans'].filter(name=>fontId(name)!==prepared.id).slice(0,2)){
  const other=await prepareFont(name);let otherPack=text||selection?await render(other.directory,text,selection):other.pack;
  if(!otherPack.variantCount)otherPack=text?await render(other.directory,text):other.pack;
  const sheet=otherPack.atlases.find(x=>x.variants.some(v=>!v.italic&&v.weight===400))||otherPack.atlases[0];
  parts.push({type:'input_text',text:`CONTRAST REFERENCE ONLY: ${other.family}, a different font. Compare shared target glyphs against these too. This is not target evidence.`},{type:'input_image',image_url:'data:image/jpeg;base64,'+(await readFile(resolve(other.directory,sheet.file))).toString('base64')});
  contrasts.push({cacheHit:otherPack.cacheHit,family:other.family,source:other.source,previewUrl:`/api/reference/${other.id}/${sheet.file}`});
 }
 payload.questions[0].instructions+=' Compare the target against BOTH the requested font and the differently named contrast references. If a contrast font explains the glyphs equally well, do not confidently declare a match. Similarity to a broad sans-serif category is insufficient.';
 return {payload,reference:{family:prepared.family,source:prepared.source,version:prepared.version,images:atlases.length+contrasts.length,generatedImages:pack.atlases.length,contrasts,variantCount:pack.variantCount,selection:effectiveSelection,sizes:pack.sizes,matchedText:!!text,cacheHit:pack.cacheHit&&contrasts.every(x=>x.cacheHit),coverage:'Available standard weights, styles and sampled optical sizes; other axes default.',previewUrls:atlases.map(x=>`/api/reference/${prepared.id}/${x.file}`)}};
}
export async function referenceFile(path){if(!/^\/[a-z0-9]+\/renders\/[a-f0-9]{20}\/atlas-\d+\.jpg$/.test(path))throw Error('Invalid reference path.');return readFile(resolve(root,'.'+path));}
