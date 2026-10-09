"""Local mask comparison. No uploaded pixels are persisted."""
import sys,json,base64,hashlib
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw,ImageFont,ImageFilter,ImageChops
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

def segments(mask):
 # Projection handles detached dots; touching letters are deliberately rejected.
 runs=[];start=None
 for x in range(mask.width):
  ink=mask.crop((x,0,x+1,mask.height)).getbbox() is not None
  if ink and start is None:start=x
  if start is not None and (not ink or x==mask.width-1):
   end=x if not ink else x+1;runs.append((start,end));start=None
 return runs

def score(a,b):
 w=max(a.width,b.width)+12;h=max(a.height,b.height)+12
 aa=Image.new('L',(w,h));aa.paste(a,((w-a.width)//2,(h-a.height)//2))
 best=0;overlay=None
 for dx in range(-2,3):
  for dy in range(-2,3):
   bb=Image.new('L',(w,h));bb.paste(b,((w-b.width)//2+dx,(h-b.height)//2+dy))
   near_a=aa.filter(ImageFilter.MaxFilter(3));near_b=bb.filter(ImageFilter.MaxFilter(3))
   n_a=sum(aa.histogram()[128:]);n_b=sum(bb.histogram()[128:])
   hits_a=sum(ImageChops.multiply(aa,near_b).histogram()[128:]);hits_b=sum(ImageChops.multiply(bb,near_a).histogram()[128:])
   value=(hits_a+hits_b)/max(1,n_a+n_b)
   if value>best:
    best=value;overlay=(aa,bb)
 if overlay is None:overlay=(aa,bb)
 return best,overlay

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
 initial=im.point(lambda v:255 if v<(lo+hi)/2 else 0)
 options=[]
 for polarity in [initial,ImageOps.invert(initial)]:
  mask=polarity.copy()
  # Remove exterior background components while retaining text inside panels.
  for x in range(mask.width):
   for y in [0,mask.height-1]:
    if mask.getpixel((x,y)):ImageDraw.floodfill(mask,(x,y),0)
  for y in range(mask.height):
   for x in [0,mask.width-1]:
    if mask.getpixel((x,y)):ImageDraw.floodfill(mask,(x,y),0)
  bbox=mask.getbbox()
  if not bbox:continue
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
   if len(runs)==len(letters) and line.height>=16:
    if not any(line.size==v.size and line.tobytes()==v.tobytes() for v in options):options.append(line)
 if len(options)!=1:return {'status':'not_checked','reason':'Could not isolate one complete line matching the transcription. The box may clip letters, include other lines, or contain touching glyphs. Drag around the complete text line and enter exactly that line.'}
 mask=options[0];runs=segments(mask)
 if len(runs)!=len(letters):return {'status':'not_checked','reason':f'Could not separate the {len(letters)} transcribed characters reliably ({len(runs)} pixel groups). The crop may clip letters, include neighboring text, or contain touching glyphs. Drag around one complete line and make its transcription match exactly.'}
 if mask.height<16:return {'status':'not_checked','reason':'Letters are too small to measure (minimum 16 px line height).'}
 target=[mask.crop((a,0,b,mask.height)).crop(mask.crop((a,0,b,mask.height)).getbbox()) for a,b in runs]
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
    key=hashlib.sha256(path.read_bytes()+json.dumps(coords,sort_keys=True).encode()).hexdigest()[:24];file=cache/(key+'.ttf')
    if not file.exists():
     instance=instantiateVariableFont(f,coords,inplace=False) if axes else f;instance.flavor=None;instance.save(file)
    font=ImageFont.truetype(str(file),max(24,mask.height*2));box=font.getbbox(text);ref=Image.new('L',(max(1,box[2]-box[0]+4),max(1,box[3]-box[1]+4)));ImageDraw.Draw(ref).text((2-box[0],2-box[1]),text,font=font,fill=255)
    ref=ref.crop(ref.getbbox());factor=mask.height/ref.height;ref=ref.resize((max(1,round(ref.width*factor)),mask.height),Image.Resampling.LANCZOS).point(lambda v:255 if v>127 else 0)
    rr=segments(ref)
    if len(rr)!=len(target):continue
    scores=[];overlays=[]
    for a,(left,right) in zip(target,rr):
     b=ref.crop((left,0,right,ref.height));b=b.crop(b.getbbox());value,pair=score(a,b);scores.append(value);overlays.append(pair)
    spacing=sum(abs((runs[i][0]-runs[i-1][0])-(rr[i][0]-rr[i-1][0])) for i in range(1,len(runs)))/max(1,len(runs)-1)
    results.append({'weight':weight,'italic':bool(f['head'].macStyle&2) or 'italic' in path.name.lower(),'opticalSize':op,'shapeSimilarity':round(100*sum(scores)/len(scores),1),'minimumLetterSimilarity':round(100*min(scores),1),'spacingMeanDifferencePx':round(spacing,2),'letters':[{'letter':c,'similarity':round(v*100,1)} for c,v in zip(letters,scores)],'_overlays':overlays})
 if not results:return {'status':'not_checked','reason':'Candidate characters could not be separated reliably, or the font lacks the transcribed glyphs.'}
 results.sort(key=lambda v:v['shapeSimilarity'],reverse=True);best=results[0];pairs=best['_overlays'];width=sum(a.width+8 for a,b in pairs);height=max(a.height for a,b in pairs);canvas=Image.new('RGB',(width,height),'white');x=0
 for a,b in pairs:
  tile=Image.new('RGB',a.size,'white');both=ImageChops.multiply(a,b);tile.paste('#2871ed',(0,0),a);tile.paste('#f47925',(0,0),b);tile.paste('#252b27',(0,0),both);canvas.paste(tile,(x,0));x+=a.width+8
 buf=BytesIO();canvas.save(buf,format='PNG')
 for v in results:v.pop('_overlays',None)
 return {'status':'measured','method':'Independent letter alignment, uniform word-height scaling, 1 px edge tolerance, translation ±2 px; no glyph stretching.','text':text,'coverage':len(letters),'best':best,'candidates':results[:5],'overlay':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode(),'notice':'Similarity is not font identity confidence. Spacing is reported separately in crop pixels; leading is not measured. Clean single-line backgrounds only.'}
if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin))))
 except Exception:print(json.dumps({'status':'not_checked','reason':'Image segmentation or font rendering failed; no measurement reported.'}))
