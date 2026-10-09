const $=id=>document.getElementById(id);
let mode='identify',source=null,prepared=null,busy=false,generation=0;
const fmt=n=>n>1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.round(n/1024)} KB`;
function status(message){$('status').textContent=message;}
function update(){ $('analyze').disabled=!prepared||busy; }
async function prepare(file){
 const version=++generation; prepared=null;update();$('result').hidden=true;
 try{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Choose a PNG, JPG or WebP under 20 MB.');
  status('Preparing your image locally…');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,Number($('size').value)/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const data=canvas.toDataURL('image/jpeg',.88);if(data.length>3_000_000)throw Error('Image is still too large. Choose a smaller image size.');
  if(version!==generation)return;
  source=file;prepared=data;$('preview').src=data;$('preview').hidden=false;$('placeholder').hidden=true;$('clear').hidden=false;
  $('image-info').textContent=`${canvas.width} × ${canvas.height} · ${fmt(file.size)} → ${fmt(Math.round((data.length-data.indexOf(',')-1)*.75))}`;status('Ready. Only the resized image will be sent.');
 }catch(e){if(version===generation)status(e.message);}finally{update();}
}
$('file').onchange=e=>{if(e.target.files[0])prepare(e.target.files[0]);};
$('drop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}};
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over');});
for(const event of ['dragleave','drop'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.remove('over');if(event==='drop'&&e.dataTransfer.files[0]&&!busy)prepare(e.dataTransfer.files[0]);});
$('clear').onclick=()=>{generation++;source=prepared=null;$('preview').removeAttribute('src');$('preview').hidden=true;$('placeholder').hidden=false;$('clear').hidden=true;$('file').value='';$('image-info').textContent='Your image stays here until you click Analyze.';$('result').hidden=true;status('');update();};
$('size').onchange=()=>{if(source)prepare(source);};
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));$('identify').hidden=mode!=='identify';$('verify').hidden=mode!=='verify';$('result').hidden=true;});
function element(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function render(data,request){const box=$('result');box.replaceChildren();box.hidden=false;const answer=data.answers[0];box.append(element('p','THE VERDICT · VISUAL ESTIMATE','eyebrow'));
 if(answer.type==='refusal'){box.append(element('h2','No decision returned'),element('p','OpenAI declined this question. Try a different image.'));return;}
 if(answer.type==='predicate'){
  if(typeof answer.probability!=='number')throw Error('Unexpected decision response.');
  const p=answer.probability;box.append(element('h2',p>=.8?`Likely ${request.font}`:p<=.2?`Unlikely to be ${request.font}`:'Inconclusive'),element('p',`${Math.round(p*100)}% estimated probability that readable text uses ${request.font}. This is a model estimate, not measured accuracy.`));
 }else if(answer.type==='choice'){
  box.append(element('h2',answer.choice==='unknown'?'No convincing shortlist match':`Possible match: ${answer.choice}`),element('p','This compares only your shortlist. A match does not establish that the font was sourced from Google Fonts.'));
  for(const option of [...(answer.probabilities||[])].sort((a,b)=>b.probability-a.probability).slice(0,5)){const row=element('div','','bar-row');row.append(element('span',option.value==='unknown'?'Unknown / other':String(option.value)));const bar=element('div','','bar');const fill=element('i','');fill.style.width=`${Math.min(100,Math.max(0,option.probability*100))}%`;bar.append(fill);row.append(bar,element('span',`${Math.round(option.probability*100)}%`));box.append(row);}
 }else throw Error('Unexpected decision response.');
 box.append(element('p',`${(data.elapsedMs/1000).toFixed(1)}s · ${data.usage?.input_tokens??'—'} input tokens · ${data.model||'gpt-6-luna'}`,'metric'));
 if(data.reference) box.append(element('p',`Compared with official Inter ${data.reference.version} specimens · upright and italic · weights 100–900 · optical sizes 14 / 32`,'metric'));
 const details=document.createElement('details');details.append(element('summary','View API response'),element('pre',JSON.stringify(data,null,2)));box.append(details);
}
$('analyze').onclick=async()=>{if(!prepared||busy)return;const request={image:prepared,mode,font:$('font').value.trim(),candidates:$('candidates').value.split('\n').map(x=>x.trim()).filter(Boolean)};busy=true;update();document.querySelectorAll('input,textarea,select,[data-mode],#clear').forEach(x=>x.disabled=true);$('result').hidden=true;status('Checking letterforms with OpenAI…');try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const data=await response.json();if(!response.ok)throw Error(data.error||'Analysis failed.');render(data,request);status('Analysis complete.');}catch(e){status(e.message);}finally{busy=false;document.querySelectorAll('input,textarea,select,[data-mode],#clear').forEach(x=>x.disabled=false);update();}};
fetch('/api/status').then(r=>r.json()).then(data=>{if(!data.configured)status('Setup needed: add OPENAI_API_KEY to .env and restart the server.');}).catch(()=>status('Cannot reach the local server.'));
