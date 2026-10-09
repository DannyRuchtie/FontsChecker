"""Local mask comparison. No uploaded pixels are persisted."""
import sys,json,base64,hashlib
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw,ImageFont,ImageFilter,ImageChops
from fontTools.ttLib import TTFont
import importlib.util
_helper_spec=importlib.util.spec_from_file_location('font_instances',Path(__file__).with_name('font-instances.py'));_helper=importlib.util.module_from_spec(_helper_spec);_helper_spec.loader.exec_module(_helper);instance_file=_helper.instance_file

def segments(mask):
 # Projection handles detached dots; touching letters are deliberately rejected.
 runs=[];start=None
 for x in range(mask.width):
  ink=mask.crop((x,0,x+1,mask.height)).getbbox() is not None
  if ink and start is None:start=x
  if start is not None and (not ink or x==mask.width-1):
   end=x if not ink else x+1;runs.append((start,end));start=None
 return runs

def component_glyphs(mask):
 # Pixel connectivity can separate letters whose x ranges overlap (e.g. ГД).
 # No candidate font or transcription is used to choose these boundaries.
 width,height=mask.size;pixels=bytearray(mask.tobytes());parts=[]
 for seed,value in enumerate(pixels):
  if not value:continue
  pixels[seed]=0;stack=[seed];points=[];left=width;top=height;right=bottom=0
  while stack:
   index=stack.pop();points.append(index);x=index%width;y=index//width
   left=min(left,x);top=min(top,y);right=max(right,x+1);bottom=max(bottom,y+1)
   for yy in range(max(0,y-1),min(height,y+2)):
    for xx in range(max(0,x-1),min(width,x+2)):
     neighbor=yy*width+xx
     if pixels[neighbor]:pixels[neighbor]=0;stack.append(neighbor)
  parts.append({'box':(left,top,right,bottom),'points':points})
 groups=[]
 for part in sorted(parts,key=lambda p:len(p['points']),reverse=True):
  l,t,r,b=part['box'];choices=[]
  for group in groups:
   gl,gt,gr,gb=group['body'];overlap=max(0,min(r,gr)-max(l,gl));gap=max(gt-b,t-gb,0)
   # Only attach a small, vertically detached mark to an overlapping body.
   # Keep neighbouring bodies separate even when their bounding boxes overlap.
   if (b<=gt or t>=gb) and len(part['points'])<=len(group['points'])*.4 and overlap>=min(r-l,gr-gl)*.5 and gap<=max(b-t,gb-gt)*.6:
    choices.append((overlap/min(r-l,gr-gl),-gap,group))
  if choices:
   group=max(choices,key=lambda choice:choice[:2])[2];gl,gt,gr,gb=group['box'];group['box']=(min(l,gl),min(t,gt),max(r,gr),max(b,gb));group['points'].extend(part['points'])
  else:part['body']=part['box'];groups.append(part)
 glyphs=[];runs=[]
 for group in sorted(groups,key=lambda p:(p['box'][0]+p['box'][2])/2):
  l,t,r,b=group['box'];tile=bytearray((r-l)*(b-t))
  for index in group['points']:tile[(index//width-t)*(r-l)+index%width-l]=255
  glyphs.append(Image.frombytes('L',(r-l,b-t),bytes(tile)));runs.append((l,r))
 return glyphs,runs

def score(a,b):
 w=max(a.width,b.width)+12;h=max(a.height,b.height)+12
 aa=Image.new('L',(w,h));aa.paste(a,((w-a.width)//2,(h-a.height)//2))
 # Count/filter the original once, not nine times for every candidate.
 n_a=sum(aa.histogram()[128:]);near_a=aa.filter(ImageFilter.MaxFilter(3));n_b=sum(b.histogram()[128:])
 best=-1;overlay=None;tolerant=0
 for dx in range(-1,2):
  for dy in range(-1,2):
   bb=Image.new('L',(w,h));bb.paste(b,((w-b.width)//2+dx,(h-b.height)//2+dy))
   overlap=sum(ImageChops.multiply(aa,bb).histogram()[128:])
   value=2*overlap/max(1,n_a+n_b)
   if value>best:
    best=value;overlay=(aa,bb)
 # Tolerant overlap is diagnostic only; exact Dice ranks font variants.
 near_b=overlay[1].filter(ImageFilter.MaxFilter(3))
 hits_a=sum(ImageChops.multiply(aa,near_b).histogram()[128:]);hits_b=sum(ImageChops.multiply(overlay[1],near_a).histogram()[128:])
 tolerant=(hits_a+hits_b)/max(1,n_a+n_b)
 return best,overlay,tolerant

def run(r):
 text=' '.join(''.join(' ' if ord(c)<32 or 127<=ord(c)<=159 or c in '\u200b\ufeff' else c for c in r.get('text','')).split());letters=''.join(text.split())
 if not text:return {'status':'not_checked','reason':'No readable comparison text. Type the words from your selected region and analyze again.'}
 if sum(c.isalnum() for c in letters)<3:return {'status':'not_checked','reason':'Select a region with at least three letters or digits for a useful shape comparison.'}
 if len(text)>120:return {'status':'not_checked','reason':'Comparison text exceeds 120 characters. Select a shorter line.'}
 im=Image.open(BytesIO(base64.b64decode(r['image'].split(',')[1]))).convert('L')
 if im.width*im.height>3000000:return {'status':'not_checked','reason':'Crop is too large.'}
 # Clean backgrounds only: choose the minority of a high-contrast binary split.
 lo,hi=im.getextrema()
 if hi-lo<60:return {'status':'not_checked','reason':'Insufficient text/background contrast.'}
 ocr_lines=(r.get('ocr') or {}).get('lines',[])
 normalized=lambda value:''.join(value.split())
 matches=[line for line in ocr_lines if line.get('confidence',0)>=.4 and len(normalized(line['text']))>=3 and normalized(line['text']) == normalized(text)]
 selected=max(matches,key=lambda line:len(normalized(line['text']))) if matches else None
 if selected:
  text=selected['text'];letters=normalized(text);glyphs=[g for g in selected['glyphs'] if not g['character'].isspace()]
  if ''.join(g['character'] for g in glyphs)!=letters:return {'status':'not_checked','reason':'OCR could not locate every transcribed character.'}
  target=[];runs=[];groups=[];vertical=[];sx=1 if selected.get('pixels') else im.width;sy=1 if selected.get('pixels') else im.height
  # Vision may return the same word box for each requested character.
  # Group these boxes, then split ink within each OCR word rather than
  # mistakenly treating the whole word as every individual character.
  for g in glyphs:
   key=tuple(round(g[k],5) for k in ['x','y','width','height'])
   if groups and groups[-1][0]==key:groups[-1][1].append(g)
   else:groups.append((key,[g]))
  for key,group in groups:
   g=group[0];left=max(0,int(g['x']*sx)-1);top=max(0,int(g['y']*sy)-1);right=min(im.width,int((g['x']+g['width'])*sx)+2);bottom=min(im.height,int((g['y']+g['height'])*sy)+2)
   tile=im.crop((left,top,right,bottom));low,high=tile.getextrema()
   if high-low<40:return {'status':'not_checked','reason':'An OCR word has insufficient contrast.'}
   border=[tile.getpixel((x,y)) for x,y in [(0,0),(tile.width-1,0),(0,tile.height-1),(tile.width-1,tile.height-1)]];bg=sorted(border)[len(border)//2]
   glyph=tile.point(lambda value:255 if (value<(low+high)/2 if bg>(low+high)/2 else value>(low+high)/2) else 0);bb=glyph.getbbox()
   if not bb:return {'status':'not_checked','reason':'OCR word contains no measurable ink.'}
   vertical.append((top+bb[1],top+bb[3]));parts=[(bb[0],bb[2])] if len(group)==1 else segments(glyph)
   if len(parts)!=len(group):return {'status':'not_checked','reason':'OCR word contains touching or disconnected characters that cannot be separated reliably.'}
   for lft,rgt in parts:
    part=glyph.crop((lft,0,rgt,glyph.height));ink=part.getbbox();target.append(part.crop(ink));runs.append((left+lft,left+rgt))

  lineheight=max(v[1] for v in vertical)-min(v[0] for v in vertical)
  mask=Image.new('L',(1,max(1,round(lineheight))))

 else:
  initial=im.point(lambda v:255 if v<(lo+hi)/2 else 0)
  options=[]
  for polarity in [initial,ImageOps.invert(initial)]:
   mask=polarity.copy()
   # Remove exterior background components while retaining text inside panels.
   for x,y in [(0,0),(mask.width-1,0),(0,mask.height-1),(mask.width-1,mask.height-1)]:
    if mask.getpixel((x,y)):ImageDraw.floodfill(mask,(x,y),0)
   bbox=mask.getbbox()
   if not bbox:continue
   clipped=bbox[0]==0 or bbox[1]==0 or bbox[2]==mask.width or bbox[3]==mask.height
   mask=mask.crop(bbox)
   bands=segments(mask.transpose(Image.Transpose.TRANSPOSE));merged=[]
   for top,bottom in bands:
    if merged and top-merged[-1][1]<=max(3,(bottom-top)*.3):merged[-1]=(merged[-1][0],bottom)
    else:merged.append((top,bottom))
   candidates=[mask] if len(merged)==1 else []
   for top,bottom in merged:
    line=mask.crop((0,top,mask.width,bottom));bb=line.getbbox()
    if bb:candidates.append(line.crop(bb))
   for line in candidates:
    runs=segments(line)
    # A wide isolated trailing icon (such as an arrow) is not a letter.
    if len(runs)==len(letters)+1 and runs[-1][1]-runs[-1][0]>line.height*1.3:
     line=line.crop((0,0,runs[-2][1],line.height));runs=segments(line)
    method='projection fallback';glyphs=None
    if len(runs)!=len(letters):
     glyphs,runs=component_glyphs(line);method='connected components with detached marks'
    if len(runs)==len(letters) and line.height>=16:
     if not any(line.size==v[0].size and line.tobytes()==v[0].tobytes() for v in options):options.append((line,glyphs,runs,method,clipped))
  if len(options)!=1:return {'status':'not_checked','reason':'Could not isolate one complete line matching the transcription. The box may clip letters, include other lines, or contain touching glyphs. Drag around the complete text line and enter exactly that line.'}
  mask,target,runs,segmentation,clipped=options[0]
  if clipped:return {'status':'not_checked','reason':'Text ink reaches the edge of this crop. Draw a slightly larger box including complete letters, accents and descenders.'}
  if len(runs)!=len(letters):return {'status':'not_checked','reason':f'Could not separate the {len(letters)} transcribed characters reliably ({len(runs)} pixel groups). The crop may clip letters, include neighboring text, or contain touching glyphs. Drag around one complete line and make its transcription match exactly.'}
  if mask.height<16:return {'status':'not_checked','reason':'Letters are too small to measure (minimum 16 px line height).'}
  if target is None:target=[mask.crop((a,0,b,mask.height)).crop(mask.crop((a,0,b,mask.height)).getbbox()) for a,b in runs]
 if mask.height<16:return {'status':'not_checked','reason':'Selected line is too small for reliable measurement (minimum 16 px ink height).'}
 root=Path(r['directory']);cache=root/'measurement-fonts';cache.mkdir(exist_ok=True);results=[]
 for path in sorted(root.iterdir()):
  if path.suffix not in ('.ttf','.woff2'):continue
  f=TTFont(path)
  if any(ord(c) not in f.getBestCmap() for c in letters):continue
  axes={a.axisTag:(a.minValue,a.defaultValue,a.maxValue) for a in f['fvar'].axes} if 'fvar' in f else {}
  weights=sorted(set([axes['wght'][0],axes['wght'][2]]+[w for w in range(100,1000,100) if axes['wght'][0]<=w<=axes['wght'][2]])) if 'wght' in axes else [f['OS/2'].usWeightClass]
  optical=sorted(set([axes['opsz'][0],axes['opsz'][1],min(32,axes['opsz'][2])])) if 'opsz' in axes else [None]
  for op in optical:
   for weight in weights:
    coords={tag:v[1] for tag,v in axes.items()};coords.update({'wght':weight} if 'wght' in axes else {});coords.update({'opsz':op} if op is not None else {})
    file=instance_file(root,path,f,coords)
    font=ImageFont.truetype(str(file),max(24,mask.height*2));box=font.getbbox(text);ref=Image.new('L',(max(1,box[2]-box[0]+4),max(1,box[3]-box[1]+4)));ImageDraw.Draw(ref).text((2-box[0],2-box[1]),text,font=font,fill=255)
    ref=ref.crop(ref.getbbox());factor=mask.height/ref.height;ref=ref.resize((max(1,round(ref.width*factor)),mask.height),Image.Resampling.LANCZOS).point(lambda v:255 if v>127 else 0)
    rr=[];reference_glyphs=[]
    prefix=''
    for c in text:
     if not c.isspace():
      cb=font.getbbox(c);tile=Image.new('L',(max(1,cb[2]-cb[0]),max(1,cb[3]-cb[1])));ImageDraw.Draw(tile).text((-cb[0],-cb[1]),c,font=font,fill=255)
      tile=tile.resize((max(1,round(tile.width*factor)),max(1,round(tile.height*factor))),Image.Resampling.LANCZOS).point(lambda v:255 if v>127 else 0)
      bb=tile.getbbox()
      if not bb:break
      reference_glyphs.append(tile.crop(bb));left=round(font.getlength(prefix)*factor)+round(cb[0]*factor)+bb[0];rr.append((left,left+tile.width))
     prefix+=c
    if len(reference_glyphs)!=len(target):continue
    scores=[];overlays=[];tolerant_scores=[];pair_cache={}
    for a,b in zip(target,reference_glyphs):
     key=(a.size,a.tobytes(),b.size,b.tobytes())
     if key not in pair_cache:pair_cache[key]=score(a,b)
     value,pair,tolerant=pair_cache[key];scores.append(value);overlays.append(pair);tolerant_scores.append(tolerant)
    spacing=sum(abs((runs[i][0]-runs[i-1][0])-(rr[i][0]-rr[i-1][0])) for i in range(1,len(runs)))/max(1,len(runs)-1)
    results.append({'weight':weight,'italic':bool(f['head'].macStyle&2) or 'italic' in path.name.lower(),'opticalSize':op,'shapeSimilarity':round(100*sum(scores)/len(scores),1),'minimumLetterSimilarity':round(100*min(scores),1),'edgeToleranceSimilarity':round(100*sum(tolerant_scores)/len(tolerant_scores),1),'spacingMeanDifferencePx':round(spacing,2),'letters':[{'letter':c,'similarity':round(v*100,1)} for c,v in zip(letters,scores)],'_overlays':overlays})
 if not results:return {'status':'not_checked','reason':'Candidate characters could not be separated reliably, or the font lacks the transcribed glyphs.'}
 results.sort(key=lambda v:v['shapeSimilarity'],reverse=True);best=results[0];pairs=best['_overlays'];width=sum(a.width+8 for a,b in pairs);height=max(a.height for a,b in pairs);canvas=Image.new('RGB',(width,height),'white');original=Image.new('RGBA',(width,height));reference=Image.new('RGBA',(width,height));x=0
 for a,b in pairs:
  tile=Image.new('RGB',a.size,'white');both=ImageChops.multiply(a,b);tile.paste('#2871ed',(0,0),a);tile.paste('#f47925',(0,0),b);tile.paste('#252b27',(0,0),both);canvas.paste(tile,(x,0));layer=Image.new('RGBA',a.size,'#2871ed');layer.putalpha(a);original.paste(layer,(x,0));layer=Image.new('RGBA',b.size,'#f47925');layer.putalpha(b);reference.paste(layer,(x,0));x+=a.width+8
 def encoded(image):
  buf=BytesIO();image.save(buf,format='PNG');return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()
 layers={'original':encoded(original),'reference':encoded(reference)}
 buf=BytesIO();canvas.save(buf,format='PNG')
 for v in results:v.pop('_overlays',None)
 return {'status':'measured','method':'Exact binary Dice overlap with independent letter alignment, uniform word-height scaling and translation ±1 px; tolerant overlap is diagnostic only; no glyph stretching.','text':text,'coverage':len(letters),'segmentation':'OCR positions with ink refinement' if selected else segmentation,'best':best,'candidates':results[:5],'layers':layers,'overlay':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode(),'notice':'Similarity is not font identity confidence. Spacing is reported separately in crop pixels; leading is not measured. Clean single-line backgrounds only.'}
if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin))))
 except Exception:print(json.dumps({'status':'not_checked','reason':'Image segmentation or font rendering failed; no measurement reported.'}))
