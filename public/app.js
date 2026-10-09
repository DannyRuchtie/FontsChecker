import {comparisonMessage} from './evidence.js';
document.addEventListener('dragstart',event=>{if(event.target instanceof HTMLImageElement)event.preventDefault();});
const $=id=>document.getElementById(id);
let source=null,prepared=null,busy=false,generation=0,ocrUsage=null,typographyProfile=null;
const cleanText=text=>text.replace(/[\u0000-\u001f\u007f-\u009f\u200b\ufeff]/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
function status(message){$('status').textContent=message;const pending=$('result').querySelector('.pending-message');if(pending)pending.textContent=message;}
function pendingVerdict(){const box=$('result');box.className='verdict-pending';box.hidden=false;box.setAttribute('aria-busy','true');box.replaceChildren(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));const row=element('div','','pending-row');const spinner=element('span','','loading-spinner');spinner.setAttribute('aria-hidden','true');row.append(spinner,element('p','Starting analysis…','pending-message'));box.append(row);}
function finishVerdict(change){const box=$('result');const before=box.getBoundingClientRect().height;box.removeAttribute('aria-busy');change();const after=box.getBoundingClientRect().height;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&before&&after)box.animate([{height:`${before}px`,overflow:'hidden'},{height:`${after}px`,overflow:'hidden'}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});}
function verdictMessage(title,message){finishVerdict(()=>{const box=$('result');box.className='';box.replaceChildren(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'),element('h2',title),element('p',message));});}

function update(){ $('analyze').disabled=!prepared||busy; }
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
  $('image-info').textContent=`${canvas.width} × ${canvas.height} · ${fmt(file.size)} → ${fmt(Math.round((data.length-data.indexOf(',')-1)*.75))}`;status('Ready. Drag around one complete text line, or Analyze to locate it automatically.');
 }catch(e){if(version===generation)status(e.message);}finally{update();}
}
$('file').onchange=e=>{if(e.target.files[0])prepare(e.target.files[0]);};
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over');});
for(const event of ['dragleave','drop'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.remove('over');if(event==='drop'&&e.dataTransfer.files[0]&&!busy)prepare(e.dataTransfer.files[0]);});
$('clear').onclick=()=>{generation++;source=prepared=null;$('preview').removeAttribute('src');$('preview-frame').hidden=true;$('selection-hint').hidden=true;$('text-region').hidden=true;$('placeholder').hidden=false;$('clear').hidden=true;$('file').value='';$('image-info').textContent='Your image stays here until you click Analyze.';$('result').hidden=true;$('measurement').hidden=true;status('');update();};
$('size').onchange=()=>{if(source)prepare(source);};
let fontTimer, fontVersion=0;
async function prepareTarget(){const version=++fontVersion;const name=$('font').value.trim();if(!name)return;$('reference-info').textContent='Downloading font and generating reference pack…';try{const r=await fetch('/api/font?name='+encodeURIComponent(name));const data=await r.json();if(!r.ok)throw Error(data.error);if(version!==fontVersion)return;$('reference-info').textContent=`${data.family}: ${data.pack.variantCount} variants · 18 / 32 / 52 px · cached and ready.`;}catch(e){if(version===fontVersion)$('reference-info').textContent=e.message;}}
$('font').oninput=()=>{$('result').hidden=true;$('measurement').hidden=true;clearTimeout(fontTimer);fontVersion++;$('reference-info').textContent='Preparing selected font…';fontTimer=setTimeout(prepareTarget,800);};
prepareTarget();
$('sample-text').oninput=()=>{if(typographyProfile?.manual)return;typographyProfile=null;$('text-region').hidden=true;};
async function comparisonCrop(image,region,display=true){
 if(display)$('text-region').hidden=true;
 if(!region||![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.width<=0||region.height<=0||region.x<0||region.y<0||region.x+region.width>1.01||region.y+region.height>1.01)return image;
 const bitmap=await createImageBitmap(image===prepared&&source?source:await (await fetch(image)).blob());
 const px=region.manual?0:3/bitmap.width,py=region.manual?0:3/bitmap.height;
 const x=Math.max(0,region.x-px),y=Math.max(0,region.y-py),right=Math.min(1,region.x+region.width+px),bottom=Math.min(1,region.y+region.height+py);
 const sx=Math.floor(x*bitmap.width),sy=Math.floor(y*bitmap.height),w=Math.ceil(right*bitmap.width)-sx,h=Math.ceil(bottom*bitmap.height)-sy;
 const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));canvas.getContext('2d').drawImage(bitmap,sx,sy,w,h,0,0,canvas.width,canvas.height);bitmap.close();
 if(display)Object.assign($('text-region').style,{left:`${x*100}%`,top:`${y*100}%`,width:`${(right-x)*100}%`,height:`${(bottom-y)*100}%`});if(display)$('text-region').hidden=false;
 const lossless=canvas.toDataURL('image/png');return lossless.length<=3_000_000?lossless:canvas.toDataURL('image/jpeg',.95);
}
let regionStart=null;
$('preview-frame').onpointerdown=e=>{if(busy)return;e.preventDefault();e.stopPropagation();const r=$('preview-frame').getBoundingClientRect();regionStart={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};$('preview-frame').setPointerCapture(e.pointerId);};
$('preview-frame').onclick=e=>{e.preventDefault();e.stopPropagation();};
$('preview-frame').onpointerup=e=>{if(!regionStart||busy)return;const r=$('preview-frame').getBoundingClientRect();const end={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};const region={x:Math.min(regionStart.x,end.x),y:Math.min(regionStart.y,end.y),width:Math.abs(end.x-regionStart.x),height:Math.abs(end.y-regionStart.y)};regionStart=null;if(region.width<.01||region.height<.01)return;$('sample-text').value='';ocrUsage=null;$('measurement').hidden=true;$('result').hidden=true;typographyProfile={weight:'unknown',style:'unknown',size:'unknown',certainty:'low',text:$('sample-text').value.trim(),region,manual:true};comparisonCrop(prepared,{...region,manual:true});status('New region selected. Analyze to read its text automatically, or type the exact line.');};
function element(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function renderEvidence(request){const box=$('result');box.querySelector('.evidence-note')?.remove();const message=comparisonMessage(request.aiData,request.measurement);if(message){const note=element('p',message,'evidence-note');const anchor=box.querySelector('.confidence-label');if(anchor)anchor.after(note);else box.append(note);}}
function renderMeasurement(data){const box=$('measurement');box.className=data.statusLabel==='Strong measured similarity'?'measurement-supported':data.statusLabel==='Another font fits better'?'measurement-other':'measurement-ambiguous';box.replaceChildren();box.hidden=false;box.append(element('h2','Local letter-shape measurement'));if(data.status!=='measured'){box.append(element('p','Not checked: '+data.reason));return;}if(data.resultCache?.hit)box.append(element('p','Cached local measurement · exact same image, text and font files','metric'));box.append(element('p',data.statusLabel||'Uncalibrated shape measurement','measurement-status'),element('p',`Measured text: ${data.text} · ${data.coverage} characters · ${data.segmentation||'projection fallback'}`,'metric'),element('p',data.margin===null?'Contrast comparison incomplete':`Target advantage over closest contrast: ${data.margin??'—'} percentage points · ${(data.contrasts||[]).map(x=>`${x.family}: ${x.score??'not checked'}%`).join(' · ')}`,'metric'));box.append(element('p',`${data.best.shapeSimilarity}% exact shape overlap · ${data.family} ${data.best.weight}${data.best.italic?' italic':''} · optical size ${data.best.opticalSize??'n/a'}`,'shape-score'),element('p',`Edge-tolerant similarity: ${data.best.edgeToleranceSimilarity??'—'}% · Lowest letter: ${data.best.minimumLetterSimilarity}% · average spacing difference: ${data.best.spacingMeanDifferencePx} px`));if(data.layers){const explainer=element('div','','layer-explainer');explainer.append(element('h3','How the layers line up'),element('p','We isolate the text pixels, render the same characters from the actual font, then align each pair of letters. Move the slider to fade the rendered font over the original.'));const stack=element('div','','layer-stack');const original=document.createElement('img');original.draggable=false;original.src=data.layers.original;original.alt='Original image letters, separated and aligned';const reference=document.createElement('img');reference.draggable=false;reference.src=data.layers.reference;reference.alt='Actual font letters aligned over the original';reference.className='reference-layer';reference.style.opacity='.5';stack.append(original,reference);const label=element('label','Font reference opacity · 50%');const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='50';slider.setAttribute('aria-label','Font reference opacity');slider.oninput=()=>{reference.style.opacity=slider.value/100;label.textContent=`Font reference opacity · ${slider.value}%`;};explainer.append(stack,label,slider,element('p','Blue layer: original · Orange layer: rendered font. Letter positions here are normalized; spacing is measured separately.','metric'));box.append(explainer);}const img=document.createElement('img');img.draggable=false;img.src=data.overlay;img.alt='Individually aligned letters: shared pixels dark, original only blue, reference only orange';img.style.maxWidth='100%';box.append(img,element('p','Dark: shared pixels · Blue: original only · Orange: font reference only'),element('p',data.notice,'metric'));const details=document.createElement('details');details.append(element('summary','Letter scores and candidate variants'),element('pre',JSON.stringify({...data,overlay:undefined,layers:undefined},null,2)));box.append(details);}
function render(data,request){
 const box=$('result');box.replaceChildren();box.className='';box.hidden=false;
 const answer=data.answers.find(x=>x.name==='font_match')||data.answers[0],readable=data.answers.find(x=>x.name==='readable_text');
 box.append(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));
 if(answer.type==='refusal'){
  box.className='confidence-uncertain';box.append(element('h2','No decision returned'),element('p','OpenAI returned a refusal, so no visual estimate is available. Local measurements remain separate.'));
 }else if(answer.type==='predicate'&&Number.isFinite(answer.probability)){
  const p=answer.probability,insufficient=readable?.type==='refusal'||(readable?.type==='predicate'&&readable.probability<.7);
  box.className=insufficient||p>.2&&p<.8?'confidence-uncertain':p>=.8?'confidence-high':'confidence-low';
  box.append(element('div',insufficient?'Not enough readable text':`${Math.round(p*100)}%`,'confidence-number'),element('p',insufficient?'Font confidence unavailable':'AI estimate · not calibrated accuracy','confidence-label'));
  box.append(element('h2',insufficient?'Insufficient readable text':p>=.8?`AI suggests ${request.font}`:p<=.2?`Unlikely to be ${request.font}`:p>=.5?`AI leans toward ${request.font}`:'AI estimate is inconclusive'));
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
$('analyze').onclick=async()=>{
 if(!prepared||busy)return;
 const request={image:prepared,font:$('font').value.trim(),text:cleanText($('sample-text').value),profile:typographyProfile};
 busy=true;update();document.querySelectorAll('input,textarea,select,#clear').forEach(x=>x.disabled=true);pendingVerdict();$('measurement').hidden=true;
 let timer;const begin=Date.now();let localDone=false,aiDone=false;
 try{
  status('Reading the selected text…');
  if(!request.profile||!request.text){
   const manual=request.profile?.manual?request.profile:null;
   const image=manual?await comparisonCrop(prepared,{...manual.region,manual:true},false):request.image;
   const response=await fetch('/api/extract-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,text:request.text,singleLine:!!manual})});
   const ocr=await response.json();if(!response.ok)throw Error(ocr.error||'Could not read this line. Type its text to continue.');
   if(!request.text)request.text=cleanText(ocr.text);
   ocrUsage=ocr.usage;request.profile=manual?{...ocr.profile,region:manual.region,manual:true}:ocr.profile;typographyProfile=request.profile;
  }
  if(!request.text)throw Error('Enter the exact text from the selected line.');
  $('sample-text').value=request.text;
  request.image=await comparisonCrop(prepared,request.profile?.region?{...request.profile.region,manual:request.profile.manual}:null);request.cropped=request.image!==prepared;
  const updateProgress=()=>status(`${localDone?'Local measurement ready':'Measuring letter shapes'} · ${window.aiConfigured===false?'AI estimate disabled':aiDone?'AI estimate ready':'Waiting for OpenAI’s visual estimate'} · ${Math.floor((Date.now()-begin)/1000)}s`);
  updateProgress();timer=setInterval(updateProgress,1000);
  const localTask=(async()=>{try{const response=await fetch('/api/measure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const data=await response.json();request.measurement=data;renderMeasurement(response.ok?data:{status:'not_checked',reason:data.error});renderEvidence(request);}catch(e){renderMeasurement({status:'not_checked',reason:e.message});}finally{localDone=true;updateProgress();}})();
  const aiTask=window.aiConfigured===false?Promise.resolve():(async()=>{try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,measurement:undefined})});const data=await response.json();if(!response.ok)throw Error(data.error||'Visual comparison failed.');if(ocrUsage)data.textExtractionUsage=ocrUsage;request.aiData=data;finishVerdict(()=>{render(data,request);renderEvidence(request);});}catch(e){verdictMessage('AI estimate could not finish',e.message);}finally{aiDone=true;updateProgress();}})();
  await Promise.all([localTask,aiTask]);
  if(window.aiConfigured===false)verdictMessage('Local comparison complete','See the letter-shape results below. The separate AI estimate is optional and needs an OpenAI key.');
  status('Comparison finished. AI estimates and local measurements are separate evidence.');
 }catch(e){verdictMessage('Text needs checking',e.message);status(e.message);}finally{clearInterval(timer);busy=false;document.querySelectorAll('input,textarea,select,#clear').forEach(x=>x.disabled=false);update();}
};
fetch('/api/status').then(r=>r.json()).then(data=>{if(!data.configured)status('Local OCR and letter measurement are ready. Add an OpenAI key only for the separate AI estimate.');window.aiConfigured=data.configured;}).catch(()=>status('Cannot reach the local server.'));
