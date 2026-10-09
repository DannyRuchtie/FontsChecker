import {comparisonMessage,verdictPresentation,localVerdictPresentation} from './evidence.js';
import {createRegionStore,processRegions} from './regions.js';
document.addEventListener('dragstart',event=>{if(event.target instanceof HTMLImageElement)event.preventDefault();});
const $=id=>document.getElementById(id);
let source=null,prepared=null,busy=false,generation=0,ocrUsage=null,typographyProfile=null;
const regions=createRegionStore();let addingRegion=false;
const cleanText=text=>text.replace(/[\u0000-\u001f\u007f-\u009f\u200b\ufeff]/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
function status(message){$('status').textContent=message;const pending=$('result').querySelector('.pending-message');if(pending)pending.textContent=message;}
function pendingVerdict(){const box=$('result');box.className='verdict-pending';box.hidden=false;box.setAttribute('aria-busy','true');box.replaceChildren(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));const row=element('div','','pending-row');const spinner=element('span','','loading-spinner');spinner.setAttribute('aria-hidden','true');row.append(spinner,element('p','Starting analysis…','pending-message'));box.append(row);}
function finishVerdict(change){const box=$('result');const before=box.getBoundingClientRect().height;box.removeAttribute('aria-busy');change();const after=box.getBoundingClientRect().height;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&before&&after)box.animate([{height:`${before}px`,overflow:'hidden'},{height:`${after}px`,overflow:'hidden'}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});}
function verdictMessage(title,message){finishVerdict(()=>{const box=$('result');box.className='';box.replaceChildren(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'),element('h2',title),element('p',message));});}

function update(){ $('analyze').disabled=!prepared||busy;$('add-region').disabled=!prepared||busy||regions.items.length>=regions.limit;$('analyze').textContent=regions.items.length>1?`Analyze ${regions.items.length} regions ↗`:'Analyze image ↗'; }
function saveActive(){if(regions.active){regions.active.font=$('font').value.trim();regions.active.text=cleanText($('sample-text').value);regions.active.profile=typographyProfile;}}
function selectRegion(id){saveActive();const item=regions.select(id);typographyProfile=item.profile;ocrUsage=item.ocrUsage||null;$('font').value=item.font;$('sample-text').value=item.text;addingRegion=false;renderRegionControls();prepareTarget();}
function renderRegionControls(){
 const list=$('region-list');list.replaceChildren();$('region-tools').hidden=!prepared;
 regions.items.forEach((item,index)=>{const button=element('button',`${index+1} · ${item.text||'Select a line'}`,'region-tab');button.type='button';button.disabled=busy;button.setAttribute('aria-pressed',String(item===regions.active));button.onclick=()=>selectRegion(item.id);list.append(button);});
 const layer=$('region-boxes');layer.replaceChildren();regions.items.forEach((item,index)=>{const region=item.profile?.region;if(!region)return;const box=element('div',String(index+1),'region-box'+(item===regions.active?' active':''));Object.assign(box.style,{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`});layer.append(box);});
 $('remove-region').hidden=regions.items.length<2;$('remove-region').disabled=busy;update();
}
$('add-region').onclick=()=>{addingRegion=true;status('Drag a box around another complete line, including accents and punctuation.');};
$('remove-region').onclick=()=>{regions.remove(regions.active.id);const item=regions.active;typographyProfile=item.profile;$('font').value=item.font;$('sample-text').value=item.text;renderRegionControls();renderAllResults();prepareTarget();};
async function prepare(file){
 const version=++generation; prepared=null;update();$('result').hidden=true;$('measurement').hidden=true;
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose a PNG, JPG or WebP under 20 MB.');
  status('Preparing your image locally…');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,Number($('size').value)/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const data=canvas.toDataURL('image/jpeg',.88);if(data.length>3_000_000)throw Error('Image is still too large. Choose a smaller image size.');
  if(version!==generation)return;
  $('preview-frame').style.setProperty('--ratio',canvas.width/canvas.height);source=file;prepared=data;$('sample-text').value='';ocrUsage=null;typographyProfile=null;$('preview').src=data;$('preview-frame').hidden=false;$('selection-hint').hidden=false;$('text-region').hidden=true;$('placeholder').hidden=true;$('clear').hidden=false;
  regions.clear();regions.add({font:$('font').value.trim()});addingRegion=false;renderRegionControls();
  $('image-info').textContent=`${canvas.width} × ${canvas.height} · ${fmt(file.size)} → ${fmt(Math.round((data.length-data.indexOf(',')-1)*.75))}`;status('Ready. Select a complete line. Add regions to check several fonts in the same image.');
 }catch(e){if(version===generation)status(e.message);}finally{update();}
}
$('file').onchange=e=>{if(e.target.files[0])prepare(e.target.files[0]);};
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over');});
for(const event of ['dragleave','drop'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.remove('over');if(event==='drop'&&e.dataTransfer.files[0]&&!busy)prepare(e.dataTransfer.files[0]);});
$('clear').onclick=()=>{generation++;source=prepared=null;regions.clear();addingRegion=false;renderRegionControls();$('preview').removeAttribute('src');$('preview-frame').hidden=true;$('selection-hint').hidden=true;$('text-region').hidden=true;$('placeholder').hidden=false;$('clear').hidden=true;$('file').value='';$('image-info').textContent='Your image stays here until you click Analyze.';$('result').hidden=true;$('measurement').hidden=true;status('');update();};
$('size').onchange=()=>{if(source)prepare(source);};
let fontTimer, fontVersion=0;
async function prepareTarget(){const version=++fontVersion;const name=$('font').value.trim();if(!name)return;$('reference-info').textContent='Downloading font and generating reference pack…';try{const r=await fetch('/api/font?name='+encodeURIComponent(name));const data=await r.json();if(!r.ok)throw Error(data.error);if(version!==fontVersion)return;$('reference-info').textContent=`${data.family}: ${data.pack.variantCount} variants · 18 / 32 / 52 px · cached and ready.`;}catch(e){if(version===fontVersion)$('reference-info').textContent=e.message;}}
$('font').oninput=()=>{if(regions.active){regions.active.font=$('font').value.trim();regions.active.request=null;}renderAllResults();clearTimeout(fontTimer);fontVersion++;$('reference-info').textContent='Preparing selected font…';fontTimer=setTimeout(prepareTarget,800);};
prepareTarget();
$('sample-text').oninput=()=>{if(!typographyProfile?.manual){typographyProfile=null;$('text-region').hidden=true;}saveActive();if(regions.active)regions.active.request=null;renderRegionControls();renderAllResults();};
async function comparisonCrop(image,region,display=true){
 if(display)$('text-region').hidden=true;
 if(!region||![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.width<=0||region.height<=0||region.x<0||region.y<0||region.x+region.width>1.01||region.y+region.height>1.01)return image;
 const bitmap=await createImageBitmap(image===prepared&&source?source:await (await fetch(image)).blob());
 const px=region.manual?0:3/bitmap.width,py=region.manual?0:3/bitmap.height;
 const x=Math.max(0,region.x-px),y=Math.max(0,region.y-py),right=Math.min(1,region.x+region.width+px),bottom=Math.min(1,region.y+region.height+py);
 const sx=Math.floor(x*bitmap.width),sy=Math.floor(y*bitmap.height),w=Math.ceil(right*bitmap.width)-sx,h=Math.ceil(bottom*bitmap.height)-sy;
 const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));canvas.getContext('2d').drawImage(bitmap,sx,sy,w,h,0,0,canvas.width,canvas.height);bitmap.close();
 if(display)Object.assign($('text-region').style,{left:`${x*100}%`,top:`${y*100}%`,width:`${(right-x)*100}%`,height:`${(bottom-y)*100}%`});if(display)$('text-region').hidden=regions.items.length>1;
 const lossless=canvas.toDataURL('image/png');return lossless.length<=3_000_000?lossless:canvas.toDataURL('image/jpeg',.95);
}
let regionStart=null;
function pointerRegion(e){const r=$('preview-frame').getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));return {x:Math.min(regionStart.x,x),y:Math.min(regionStart.y,y),width:Math.abs(x-regionStart.x),height:Math.abs(y-regionStart.y)};}
$('preview-frame').onpointerdown=e=>{if(busy)return;e.preventDefault();e.stopPropagation();const r=$('preview-frame').getBoundingClientRect();regionStart={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};$('preview-frame').setPointerCapture(e.pointerId);};
$('preview-frame').onpointermove=e=>{if(!regionStart||busy)return;const region=pointerRegion(e);Object.assign($('text-region').style,{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`});$('text-region').hidden=false;};
$('preview-frame').onpointercancel=()=>{regionStart=null;renderRegionControls();};
$('preview-frame').onclick=e=>{e.preventDefault();e.stopPropagation();};
$('preview-frame').onpointerup=e=>{if(!regionStart||busy)return;const region=pointerRegion(e);regionStart=null;if(region.width<.01||region.height<.01)return;if(addingRegion){saveActive();regions.add({font:$('font').value.trim()});addingRegion=false;}$('sample-text').value='';ocrUsage=null;typographyProfile={weight:'unknown',style:'unknown',size:'unknown',certainty:'low',text:'',region,manual:true};saveActive();regions.active.request=null;renderRegionControls();renderAllResults();comparisonCrop(prepared,{...region,manual:true});status('Region selected. Include every accent and descender. Analyze to read the line, or type it exactly.');};
function element(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function renderEvidence(request,box=$('result')){if(!request.aiData)return;const presentation=verdictPresentation(request.aiData,request.measurement,request.font);box.className='confidence-'+presentation.tone;const title=box.querySelector('.verdict-title');if(title)title.textContent=presentation.title;box.querySelector('.evidence-note')?.remove();const message=comparisonMessage(request.aiData,request.measurement);if(message){const note=element('p',message,'evidence-note');const anchor=box.querySelector('.confidence-label');if(anchor)anchor.after(note);else box.append(note);}}
function renderMeasurement(data,box=$('measurement')){box.className=data.statusLabel==='Strong measured similarity'?'measurement-supported':data.statusLabel==='Another font fits better'?'measurement-other':'measurement-ambiguous';box.replaceChildren();box.hidden=false;box.append(element('h2','Local letter-shape measurement'));if(data.status!=='measured'){box.append(element('p','Not checked: '+data.reason));return;}if(data.resultCache?.hit)box.append(element('p','Cached local measurement · exact same image, text and font files','metric'));box.append(element('p',data.statusLabel||'Uncalibrated shape measurement','measurement-status'),element('p',`Measured text: ${data.text} · ${data.coverage} characters · ${data.segmentation||'projection fallback'}`,'metric'),element('p',data.margin===null?'Contrast comparison incomplete':`Target advantage over closest contrast: ${data.margin??'—'} percentage points · ${(data.contrasts||[]).map(x=>`${x.family}: ${x.score??'not checked'}%`).join(' · ')}`,'metric'));box.append(element('p',`${data.best.shapeSimilarity}% exact shape overlap · ${data.family} ${data.best.weight}${data.best.italic?' italic':''} · optical size ${data.best.opticalSize??'n/a'}`,'shape-score'),element('p',`Edge-tolerant similarity: ${data.best.edgeToleranceSimilarity??'—'}% · Lowest letter: ${data.best.minimumLetterSimilarity}% · average spacing difference: ${data.best.spacingMeanDifferencePx} px`));if(data.layers){const explainer=element('div','','layer-explainer');explainer.append(element('h3','How the layers line up'),element('p','We isolate the text pixels, render the same characters from the actual font, then align each pair of letters. Move the slider to fade the rendered font over the original.'));const stack=element('div','','layer-stack');const original=document.createElement('img');original.draggable=false;original.src=data.layers.original;original.alt='Original image letters, separated and aligned';const reference=document.createElement('img');reference.draggable=false;reference.src=data.layers.reference;reference.alt='Actual font letters aligned over the original';reference.className='reference-layer';reference.style.opacity='.5';stack.append(original,reference);const label=element('label','Font reference opacity · 50%');const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='50';slider.setAttribute('aria-label','Font reference opacity');slider.oninput=()=>{reference.style.opacity=slider.value/100;label.textContent=`Font reference opacity · ${slider.value}%`;};explainer.append(stack,label,slider,element('p','Blue layer: original · Orange layer: rendered font. Letter positions here are normalized; spacing is measured separately.','metric'));box.append(explainer);}const img=document.createElement('img');img.draggable=false;img.src=data.overlay;img.alt='Individually aligned letters: shared pixels dark, original only blue, reference only orange';img.style.maxWidth='100%';box.append(img,element('p','Dark: shared pixels · Blue: original only · Orange: font reference only'),element('p',data.notice,'metric'));const details=document.createElement('details');details.append(element('summary','Letter scores and candidate variants'),element('pre',JSON.stringify({...data,overlay:undefined,layers:undefined},null,2)));box.append(details);}
function render(data,request,box=$('result')){
box.replaceChildren();box.className='';box.hidden=false;
 const answer=data.answers.find(x=>x.name==='font_match')||data.answers[0],readable=data.answers.find(x=>x.name==='readable_text');
 box.append(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));
 if(answer.type==='refusal'){
  box.className='confidence-uncertain';box.append(element('h2','No decision returned'),element('p','OpenAI returned a refusal, so no visual estimate is available. Local measurements remain separate.'));
 }else if(answer.type==='predicate'&&Number.isFinite(answer.probability)){
  const p=answer.probability,insufficient=readable?.type==='refusal'||(readable?.type==='predicate'&&readable.probability<.7);
  const presentation=verdictPresentation(data,request.measurement,request.font);box.className='confidence-'+presentation.tone;
  box.append(element('div',insufficient?'Not enough readable text':`${Math.round(p*100)}%`,'confidence-number'),element('p',insufficient?'Font confidence unavailable':'AI estimate · not calibrated accuracy','confidence-label'));
  box.append(element('h2',presentation.title,'verdict-title'));
 }else throw Error('Unexpected decision response.');
 box.append(element('p',`Compared “${request.text}” with ${data.reference?.variantCount??'available'} ${request.font} variants and ${data.reference?.contrasts?.length??0} contrast families.`));
 box.append(element('p',data.resultCache?.hit?'Cached AI verdict · no new OpenAI request':`${(data.elapsedMs/1000).toFixed(1)}s total · references ${data.timings?.referenceMs??'—'}ms · OpenAI ${data.timings?.openaiMs??'—'}ms`,'metric'));
 const info=element('details');info.append(element('summary','Comparison timing and details'));
 info.append(element('p',data.resultCache?.hit?`Cached verdict age: ${Math.round(data.resultCache.ageMs/1000)}s`:`${data.usage?.input_tokens??'—'} input tokens · ${data.model||'gpt-6-luna'}`,'metric'));
 if(data.timings)info.append(element('p',`Reference preparation: ${data.timings.referenceMs}ms · OpenAI wait: ${data.timings.openaiMs}ms`,'metric'));
 if(readable?.type==='predicate')info.append(element('p',`${Math.round(readable.probability*100)}% estimated text sufficiency. Confidence thresholds are provisional.`,'metric'));
 info.append(element('p',request.cropped?(request.profile?.manual?'Checked your selected text region.':'Checked the highlighted text region (approximate automatic location).'):'Text region could not be located; checked the full image.','metric'));
 if(data.reference)info.append(element('p',`${data.reference.family} · ${data.reference.variantCount} variants · sizes ${data.reference.sizes.join(' / ')} px · ${data.reference.coverage}`,'metric'));
 if(data.textExtractionUsage)info.append(element('p',`Fallback text reading: ${data.textExtractionUsage.input_tokens} input + ${data.textExtractionUsage.output_tokens} output tokens (Responses API)`,'metric'));
 if(data.attempts)info.append(element('p',data.attempts.length>1?'Explicit broader comparison retry requested.':'One comparison pass.','metric'));
 if(data.fallbackError)info.append(element('p',data.fallbackError,'metric'));
 if(request.profile)info.append(element('p',`Image estimate: ${request.profile.weight} · ${request.profile.style} · ${request.profile.size} size · ${request.profile.certainty} certainty. Weight and style do not exclude font variants.`,'metric'));
 if(data.reference)info.append(element('p',data.resultCache?.hit||data.reference.cacheHit?'Reference sheets reused from cache.':'New reference sheets generated and cached for this text.','metric'));
 box.append(info);
 if(data.reference){
  const previews=element('details');previews.append(element('summary','See the actual comparison references'));
  for(const url of [...(data.reference.previewUrls||[]),...(data.reference.contrasts||[]).map(x=>x.previewUrl)]){const img=document.createElement('img');img.draggable=false;img.src=url;img.alt='Generated font reference specimens';img.style.width='100%';previews.append(img);}
  previews.append(element('p','Contrast references: '+(data.reference.contrasts||[]).map(x=>x.family).join(', '),'metric'));
  const link=element('a','Font file source');link.href=data.reference.source;link.target='_blank';link.rel='noreferrer';previews.append(link);box.append(previews);
 }
 const details=element('details');details.append(element('summary','View API response'),element('pre',JSON.stringify(data,null,2)));box.append(details);
}
function regionPresentation(request,font){
 if(!request)return {tone:'uncertain',title:'Not analyzed yet'};
 if(request?.aiData)return verdictPresentation(request.aiData,request.measurement,font);
 if(request?.error)return {tone:'uncertain',title:'Text needs checking'};
 const presentation=localVerdictPresentation(request?.measurement);
 return request?.aiState==='pending'?{...presentation,tone:'uncertain',title:presentation.percentage!==null?`${presentation.title} · AI pending`:'Checking this region'}:presentation;
}
function aiAvailability(request){
 if(request?.aiError)return `AI estimate unavailable: ${request.aiError}`;
 if(request?.aiState==='disabled')return 'AI estimate off · this server has no OpenAI key. Local measurement needs no key.';
 if(request?.aiState==='pending')return 'AI estimate pending · local overlap is already available when measured.';
 return '';
}
function renderLocalVerdict(request){
 const local=localVerdictPresentation(request.measurement),presentation=regionPresentation(request,request.font),box=$('result');
 box.hidden=false;box.className='confidence-'+presentation.tone;box.replaceChildren(element('p','THE VERDICT · LOCAL COMPARISON','eyebrow'));
 if(local.percentage!==null)box.append(element('div',`${local.percentage}%`,'confidence-number'),element('p','Measured shape overlap · not font identity confidence','confidence-label'));
 else if(request.localState==='pending'){const row=element('div','','pending-row');row.append(element('span','','loading-spinner'),element('p','Measuring letter shapes…'));box.append(row);}
 box.append(element('h2',presentation.title,'verdict-title'));
 if(request.measurement?.status==='measured')box.append(element('p',request.measurement.margin===null?'Contrast comparison incomplete':`Target advantage over closest contrast: ${request.measurement.margin} percentage points`,'metric'));
 else if(request.measurement)box.append(element('p',request.measurement.reason));
 const availability=aiAvailability(request);if(availability){const row=element('div','','pending-row');if(request.aiState==='pending')row.append(element('span','','loading-spinner'));row.append(element('p',availability,'metric'));box.append(row);}
}
function renderAllResults(){
 const items=regions.items;if(!items.some(item=>item.request)){$('result').hidden=true;$('measurement').hidden=true;return;}
 if(items.length===1){
  const r=items[0].request;if(!r)return;
  if(r.aiData)finishVerdict(()=>{render(r.aiData,r);renderEvidence(r);});
  else if(r.error)verdictMessage('Text needs checking',r.error);
  else finishVerdict(()=>renderLocalVerdict(r));
  if(r.measurement)renderMeasurement(r.measurement);else if(r.localState==='pending'){$('measurement').hidden=false;$('measurement').className='';$('measurement').replaceChildren(element('h2','Local letter-shape measurement'));const row=element('div','','pending-row');row.append(element('span','','loading-spinner'),element('p','Measuring letter shapes…'));$('measurement').append(row);}
  else renderMeasurement({status:'not_checked',reason:r.error||'No local measurement was returned. Select a complete line and check its text.'});
  return;
 }
 const expanded=new Set([...$('measurement').querySelectorAll('details[open][data-region]')].map(node=>node.dataset.region));
 finishVerdict(()=>{
  const box=$('result');box.className='multi-verdict';box.hidden=false;box.replaceChildren(element('p','THE VERDICT · REGION COMPARISONS','eyebrow'),element('h2',`${items.length} regions · separate font checks`),element('p','Each percentage is labeled by its source. Local overlap measures letter shapes; an AI estimate is separate and uncalibrated.','metric'));
  items.forEach((item,index)=>{
   const r=item.request,presentation=regionPresentation(r,item.font);
   const card=element('div','','region-verdict confidence-'+presentation.tone);const header=element('div','','region-result-heading');header.append(element('strong',`Region ${index+1} · ${item.font}`),element('span',item.text||'Reading text…'));card.append(header);
   const local=r?.measurement;const answer=r?.aiData?.answers?.find(x=>x.name==='font_match'),readable=r?.aiData?.answers?.find(x=>x.name==='readable_text');
   const hasAI=answer?.type==='predicate'&&Number.isFinite(answer.probability)&&readable?.type!=='refusal'&&!(readable?.type==='predicate'&&readable.probability<.7),shape=localVerdictPresentation(local).percentage;
   const row=element('div','','region-score-row');if(hasAI||shape!==null)row.append(element('strong',hasAI?`${Math.round(answer.probability*100)}%`:`${shape}%`,'region-ai-score'));row.append(element('span',presentation.title));if(r?.aiState==='pending'||r?.localState==='pending')row.prepend(element('span','','loading-spinner'));card.append(row);
   if(hasAI||shape!==null)card.append(element('p',hasAI?'AI estimate · not calibrated accuracy':'Measured shape overlap · not font identity confidence','region-score-label'));
   card.append(element('p',local?.status==='measured'?`Local overlap ${local.best.shapeSimilarity}% · lead ${local.margin??'unavailable'} pts · ${local.statusLabel}`:local?`Local: ${local.reason}`:r?.error||r?.aiError||(r?'Waiting for the checks to finish…':'Analyze this region to compare its font.'),'metric'));
   const availability=aiAvailability(r);if(availability&&!r?.error)card.append(element('p',availability,'metric'));
   if(r?.aiData){const details=element('details');details.append(element('summary','AI details and references'));const body=element('div');render(r.aiData,r,body);renderEvidence(r,body);details.append(body);card.append(details);}box.append(card);
  });
 });
 const box=$('measurement');box.className='multi-measurement';box.hidden=false;box.replaceChildren(element('h2','Local letter-shape measurements'));
 items.forEach((item,index)=>{
  const r=item.request,local=r?.measurement,details=element('details','','region-measurement');details.dataset.region=String(item.id);details.open=expanded.has(String(item.id));if(local?.statusLabel==='Strong measured similarity')details.classList.add('measurement-supported');else if(local?.statusLabel==='Another font fits better')details.classList.add('measurement-other');const summary=element('summary',`Region ${index+1} · ${item.font} · ${local?.status==='measured'?`${local.best.shapeSimilarity}% overlap · ${local.statusLabel}`:local?'Not checked':r?.error?'Text needs checking':r?'Measuring…':'Not analyzed yet'}`);details.append(summary);
  if(local){const body=element('div');renderMeasurement(local,body);details.append(body);}else details.append(element('p',r?.error||'Local results will appear here.'));
  box.append(details);
 });
}
async function checkRegion(item){
 const request=item.request;request.phase='reading';renderAllResults();
 try{
  if(!request.profile||!request.text){
   const manual=request.profile?.manual?request.profile:null;
   const image=manual?await comparisonCrop(prepared,{...manual.region,manual:true},false):request.image;
   const response=await fetch('/api/extract-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,text:request.text,singleLine:!!manual})});
   const ocr=await response.json();if(!response.ok)throw Error(ocr.error||'Could not read this line. Type its text to continue.');
   if(!request.text)request.text=cleanText(ocr.text);
   item.ocrUsage=ocr.usage;request.profile=manual?{...ocr.profile,region:manual.region,manual:true}:ocr.profile;
  }
  if(!request.text)throw Error('Enter the exact text from the selected line.');
  item.text=request.text;item.profile=request.profile;if(item===regions.active){$('sample-text').value=item.text;typographyProfile=item.profile;}
  request.image=await comparisonCrop(prepared,request.profile?.region?{...request.profile.region,manual:request.profile.manual}:null,regions.items.length===1);request.cropped=request.image!==prepared;
  request.phase='comparing';renderRegionControls();renderAllResults();
  const payload={image:request.image,font:request.font,text:request.text,profile:request.profile};
  const localTask=(async()=>{try{const response=await fetch('/api/measure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();request.measurement=response.ok?data:{status:'not_checked',reason:data.error};}catch(e){request.measurement={status:'not_checked',reason:e.message};}finally{request.localState='done';renderAllResults();}})();
  const aiTask=request.aiState==='disabled'?Promise.resolve():(async()=>{try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'Visual comparison failed.');if(item.ocrUsage)data.textExtractionUsage=item.ocrUsage;request.aiData=data;}catch(e){request.aiError=e.message;}finally{request.aiState='done';renderAllResults();}})();
  await Promise.all([localTask,aiTask]);
 }catch(e){request.error=e.message;request.localState=request.aiState='done';}finally{request.phase='done';renderAllResults();}
}
$('analyze').onclick=async()=>{
 if(!prepared||busy)return;saveActive();busy=true;update();document.querySelectorAll('input,textarea,select,#clear').forEach(x=>x.disabled=true);pendingVerdict();$('measurement').hidden=true;
 try{await refreshAiConfiguration();}catch(e){verdictMessage('Server unavailable',e.message);status(e.message);busy=false;document.querySelectorAll('input,textarea,select,#clear').forEach(x=>x.disabled=false);renderRegionControls();return;}
 const begin=Date.now();for(const item of regions.items)item.request={image:prepared,font:item.font,text:item.text,profile:item.profile,phase:'queued',localState:'pending',aiState:window.aiConfigured===false?'disabled':'pending'};
 renderRegionControls();const updateProgress=()=>{const finished=regions.items.filter(item=>item.request?.phase==='done').length;status(regions.items.length>1?`${finished} / ${regions.items.length} regions complete · ${Math.floor((Date.now()-begin)/1000)}s`:`${regions.active.request.phase==='reading'?'Reading selected text':regions.active.request.localState==='done'?'Local measurement ready':'Measuring letter shapes'} · ${regions.active.request.aiState==='pending'?'Waiting for AI estimate':regions.active.request.aiState==='disabled'?'AI disabled':'AI finished'} · ${Math.floor((Date.now()-begin)/1000)}s`);};
 updateProgress();const timer=setInterval(updateProgress,1000);renderAllResults();
 try{await processRegions(regions.items,checkRegion,2);const failed=regions.items.filter(item=>item.request?.error).length;status(failed?`${regions.items.length-failed} / ${regions.items.length} regions checked. Correct the text or selection for ${failed} ${failed===1?'region':'regions'} and analyze again.`:'Comparison finished. Each region has separate evidence; percentages are not averaged.');}
 finally{clearInterval(timer);busy=false;document.querySelectorAll('input,textarea,select,#clear').forEach(x=>x.disabled=false);renderRegionControls();update();}
};
async function refreshAiConfiguration(){const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error('Cannot reach the font checker server.');const data=await response.json();window.aiConfigured=data.configured;return data;}
refreshAiConfiguration().then(data=>{if(!prepared)status(data.configured?'Ready. Upload an image to begin.':'Tesseract OCR and letter measurement are ready. Add an OpenAI key only for the separate AI estimate.');}).catch(()=>status('Cannot reach the font checker server.'));
