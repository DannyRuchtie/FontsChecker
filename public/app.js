const $=id=>document.getElementById(id);
let source=null,prepared=null,busy=false,generation=0,ocrUsage=null,typographyProfile=null;
const fmt=n=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
function status(message){$('status').textContent=message;}
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
  $('preview-frame').style.setProperty('--ratio',canvas.width/canvas.height);source=file;prepared=data;$('sample-text').value='';ocrUsage=null;typographyProfile=null;$('preview').src=data;$('preview-frame').hidden=false;$('text-region').hidden=true;$('placeholder').hidden=true;$('clear').hidden=false;
  $('image-info').textContent=`${canvas.width} × ${canvas.height} · ${fmt(file.size)} → ${fmt(Math.round((data.length-data.indexOf(',')-1)*.75))}`;status('Ready. Only the resized image will be sent.');
 }catch(e){if(version===generation)status(e.message);}finally{update();}
}
$('file').onchange=e=>{if(e.target.files[0])prepare(e.target.files[0]);};
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over');});
for(const event of ['dragleave','drop'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.remove('over');if(event==='drop'&&e.dataTransfer.files[0]&&!busy)prepare(e.dataTransfer.files[0]);});
$('clear').onclick=()=>{generation++;source=prepared=null;$('preview').removeAttribute('src');$('preview-frame').hidden=true;$('text-region').hidden=true;$('placeholder').hidden=false;$('clear').hidden=true;$('file').value='';$('image-info').textContent='Your image stays here until you click Analyze.';$('result').hidden=true;$('measurement').hidden=true;status('');update();};
$('size').onchange=()=>{if(source)prepare(source);};
let fontTimer, fontVersion=0;
async function prepareTarget(){const version=++fontVersion;const name=$('font').value.trim();if(!name)return;$('reference-info').textContent='Downloading font and generating reference pack…';try{const r=await fetch('/api/font?name='+encodeURIComponent(name));const data=await r.json();if(!r.ok)throw Error(data.error);if(version!==fontVersion)return;$('reference-info').textContent=`${data.family}: ${data.pack.variantCount} variants · 18 / 32 / 52 px · cached and ready.`;}catch(e){if(version===fontVersion)$('reference-info').textContent=e.message;}}
$('font').oninput=()=>{clearTimeout(fontTimer);fontVersion++;$('reference-info').textContent='Preparing selected font…';fontTimer=setTimeout(prepareTarget,800);};
prepareTarget();
$('sample-text').oninput=()=>{if(typographyProfile?.manual)return;typographyProfile=null;$('text-region').hidden=true;};
async function comparisonCrop(image,region){
 $('text-region').hidden=true;
 if(!region||![region.x,region.y,region.width,region.height].every(Number.isFinite)||region.width<=0||region.height<=0||region.x<0||region.y<0||region.x+region.width>1.01||region.y+region.height>1.01)return image;
 const bitmap=await createImageBitmap(await (await fetch(image)).blob());
 const pad=Math.max(3/bitmap.height,region.height*.65);
 const x=Math.max(0,region.x-pad),y=Math.max(0,region.y-pad),right=Math.min(1,region.x+region.width+pad),bottom=Math.min(1,region.y+region.height+pad);
 const sx=Math.floor(x*bitmap.width),sy=Math.floor(y*bitmap.height),w=Math.ceil(right*bitmap.width)-sx,h=Math.ceil(bottom*bitmap.height)-sy;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(bitmap,sx,sy,w,h,0,0,w,h);bitmap.close();
 Object.assign($('text-region').style,{left:`${x*100}%`,top:`${y*100}%`,width:`${(right-x)*100}%`,height:`${(bottom-y)*100}%`});$('text-region').hidden=false;
 return canvas.toDataURL('image/jpeg',.95);
}
let regionStart=null;
$('preview-frame').onpointerdown=e=>{if(busy)return;e.preventDefault();e.stopPropagation();const r=$('preview-frame').getBoundingClientRect();regionStart={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};$('preview-frame').setPointerCapture(e.pointerId);};
$('preview-frame').onclick=e=>{e.preventDefault();e.stopPropagation();};
$('preview-frame').onpointerup=e=>{if(!regionStart||busy)return;const r=$('preview-frame').getBoundingClientRect();const end={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};const region={x:Math.min(regionStart.x,end.x),y:Math.min(regionStart.y,end.y),width:Math.abs(end.x-regionStart.x),height:Math.abs(end.y-regionStart.y)};regionStart=null;if(region.width<.01||region.height<.01)return;typographyProfile={weight:'unknown',style:'unknown',size:'unknown',certainty:'low',text:$('sample-text').value.trim(),region,manual:true};comparisonCrop(prepared,region);status('Text region selected. Enter its transcription, then analyze.');};
function element(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function renderMeasurement(data){const box=$('measurement');box.replaceChildren();box.hidden=false;box.append(element('h2','Local letter-shape measurement'));if(data.status!=='measured'){box.append(element('p','Not checked: '+data.reason));return;}box.append(element('p',`${data.best.shapeSimilarity}% shape similarity · ${data.family} ${data.best.weight}${data.best.italic?' italic':''} · optical size ${data.best.opticalSize??'n/a'}`),element('p',`Lowest letter: ${data.best.minimumLetterSimilarity}% · average spacing difference: ${data.best.spacingMeanDifferencePx} px`));const img=document.createElement('img');img.src=data.overlay;img.alt='Individually aligned letters: shared pixels dark, original only blue, reference only orange';img.style.maxWidth='100%';box.append(img,element('p','Dark: shared pixels · Blue: original only · Orange: font reference only'),element('p',data.notice,'metric'));const details=document.createElement('details');details.append(element('summary','Letter scores and candidate variants'),element('pre',JSON.stringify({...data,overlay:undefined},null,2)));box.append(details);}
function render(data,request){const box=$('result');box.replaceChildren();box.hidden=false;const answer=data.answers.find(x=>x.name==='font_match')||data.answers[0];const readable=data.answers.find(x=>x.name==='readable_text');box.append(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));
 if(answer.type==='refusal'){box.append(element('h2','No decision returned'),element('p','OpenAI declined this question. Try a different image.'),element('p',request.cropped?'Submitted the highlighted text region (approximate automatic location).':'Text region could not be located; submitted the full image.','metric'));return;}
 if(answer.type==='predicate'){
  if(typeof answer.probability!=='number')throw Error('Unexpected decision response.');
  const p=answer.probability;const insufficient=readable?.type==='refusal'||(readable?.type==='predicate'&&readable.probability<.7);box.append(element('h2',insufficient?'Insufficient readable text':p>=.8?`Likely ${request.font}`:p<=.2?`Unlikely to be ${request.font}`:'Inconclusive'),element('p',`${Math.round(p*100)}% estimated probability that readable text uses ${request.font}. This is a model estimate, not measured accuracy.`));
 }else throw Error('Unexpected decision response.');
 box.append(element('p',`${(data.elapsedMs/1000).toFixed(1)}s · ${data.usage?.input_tokens??'—'} input tokens · ${data.model||'gpt-6-luna'}`,'metric'));
 if(readable?.type==='predicate')box.append(element('p',`${Math.round(readable.probability*100)}% estimated text sufficiency. Confidence thresholds are provisional.`,'metric'));
 box.append(element('p',request.cropped?'Checked the highlighted text region (approximate automatic location).':'Text region could not be located; checked the full image.','metric'));
 if(data.reference) box.append(element('p',`Compared with ${data.reference.family} · ${data.reference.variantCount} generated variants · sizes ${data.reference.sizes.join(" / ")} px${data.reference.matchedText ? " · matching text included" : ""}`,'metric'));
 if(data.textExtractionUsage)box.append(element('p',`Text reading: ${data.textExtractionUsage.input_tokens} input + ${data.textExtractionUsage.output_tokens} output tokens (Responses API)`,'metric'));
 if(data.attempts)box.append(element('p',data.attempts.length>1?'Initial comparison was inconclusive; retried with broader references.':'One comparison pass.','metric'));
 if(data.fallbackError)box.append(element('p',data.fallbackError,'metric'));
 if(request.profile)box.append(element('p',`Image estimate: ${request.profile.weight} · ${request.profile.style} · ${request.profile.size} size · ${request.profile.certainty} certainty. Used only to select references.`,'metric'));
 if(data.reference)box.append(element('p',data.reference.cacheHit?'Reference sheets reused from cache.':'New reference sheets generated and cached for this text.','metric'));
 if(data.reference){const previews=document.createElement('details');previews.append(element('summary','See the actual comparison references'));for(const url of [...(data.reference.previewUrls||[]),...(data.reference.contrasts||[]).map(x=>x.previewUrl)]){const img=document.createElement('img');img.src=url;img.alt='Generated font reference specimens';img.style.width='100%';previews.append(img);}box.append(previews);box.append(element('p','Contrast references: '+(data.reference.contrasts||[]).map(x=>x.family).join(', '),'metric'));const link=document.createElement('a');link.href=data.reference.source;link.textContent='Font file source';link.target='_blank';link.rel='noreferrer';box.append(link);}
 const details=document.createElement('details');details.append(element('summary','View API response'),element('pre',JSON.stringify(data,null,2)));box.append(details);
}
$('analyze').onclick=async()=>{if(!prepared||busy)return;const request={image:prepared,font:$('font').value.trim(),text:$('sample-text').value.trim(),profile:typographyProfile};busy=true;update();document.querySelectorAll('input,textarea,select,[data-mode],#clear').forEach(x=>x.disabled=true);$('result').hidden=true;$('measurement').hidden=true;status('Checking letterforms with OpenAI…');try{if(!request.profile){status('Reading text and estimating weight/style…');const ocrResponse=await fetch('/api/extract-text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:request.image,text:request.text})});const ocr=await ocrResponse.json();if(!ocrResponse.ok)throw Error(ocr.error||'Could not read text. Enter it manually to continue.');if(!request.text){request.text=ocr.text;$('sample-text').value=ocr.text;}ocrUsage=ocr.usage;typographyProfile=ocr.profile;request.profile=ocr.profile;}request.image=await comparisonCrop(prepared,request.profile?.region);request.cropped=request.image!==prepared;status('Measuring letter shapes locally…');try{const localResponse=await fetch('/api/measure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const local=await localResponse.json();renderMeasurement(localResponse.ok?local:{status:'not_checked',reason:local.error});}catch{renderMeasurement({status:'not_checked',reason:'Local measurement could not finish.'});}status('Comparing letterforms — cached references are reused when available…');const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const data=await response.json();if(!response.ok)throw Error(data.error||'Analysis failed.');if(ocrUsage)data.textExtractionUsage=ocrUsage;render(data,request);status('Analysis complete.');}catch(e){status(e.message);}finally{busy=false;document.querySelectorAll('input,textarea,select,[data-mode],#clear').forEach(x=>x.disabled=false);update();}};
fetch('/api/status').then(r=>r.json()).then(data=>{if(!data.configured)status('Setup needed: add OPENAI_API_KEY to .env and restart the server.');}).catch(()=>status('Cannot reach the local server.'));
