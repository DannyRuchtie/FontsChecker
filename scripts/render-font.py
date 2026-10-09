"""Render authoritative font files. Input/output are JSON, passed through stdin/stdout."""
import sys,json,hashlib
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
import importlib.util
_helper_spec=importlib.util.spec_from_file_location('font_instances',Path(__file__).with_name('font-instances.py'));_helper=importlib.util.module_from_spec(_helper_spec);_helper_spec.loader.exec_module(_helper);instance_file=_helper.instance_file
request=json.load(sys.stdin);root=Path(request['directory']);text=request.get('text') or 'Ag a g e R G Q I l 1 0 O @ & 0123456789'
selection=request.get('selection') or {};sizes=selection.get('sizes',[18,32,52])
variants=[];seen=set()
for path in sorted(root.glob('*')):
 if path.suffix not in ('.ttf','.woff2'):continue
 f=TTFont(path);axes={a.axisTag:[a.minValue,a.defaultValue,a.maxValue] for a in f['fvar'].axes} if 'fvar' in f else {}
 if any(ord(ch) not in f.getBestCmap() for ch in text if not ch.isspace()):raise ValueError('The selected font lacks glyphs for part of this text. Use text supported by the font.')
 italic=bool(f['head'].macStyle&2) or 'italic' in path.name.lower()
 weights=sorted(set([axes['wght'][0],axes['wght'][2]]+[w for w in range(100,1000,100) if axes['wght'][0]<=w<=axes['wght'][2]])) if 'wght' in axes else [f['OS/2'].usWeightClass]
 optical=sorted(set([axes['opsz'][0],axes['opsz'][1],min(32,axes['opsz'][2])])) if 'opsz' in axes else [None]
 if selection.get('style') in ('upright','italic') and italic != (selection['style']=='italic'):continue
 weights=[w for w in weights if selection.get('minWeight',0)<=w<=selection.get('maxWeight',1000)]
 for op in optical:
  for weight in weights:
   key=(italic,weight,op)
   if key in seen:continue
   seen.add(key)
   coords={tag:values[1] for tag,values in axes.items()};coords.update({'wght':weight} if 'wght' in axes else {});coords.update({'opsz':op} if op is not None else {})
   file=instance_file(root,path,f,coords)
   variants.append({'weight':weight,'italic':italic,'opticalSize':op,'font':str(file),'sourceFile':path.name,'axes':axes})
# All available standard weight/style/optical samples are generated; paginate to keep glyphs readable.
output=root/'renders'/request.get('key',hashlib.sha256(('v1:'+request.get('text','')).encode()).hexdigest()[:20]);output.mkdir(parents=True,exist_ok=True)
entries=[];columns=2 if selection.get('compact') else 1
# Wide short strings must retain every character, even in a compact request.
if columns==2 and any(ImageFont.truetype(v['font'],size).getlength(text)>620 for v in variants for size in sizes):columns=1
page=9*columns
for start in range(0,len(variants),page):
 rows=variants[start:start+page];rowheight=30+sum(size+12 for size in sizes);image=Image.new('RGB',(1400,min(9,len(rows))*rowheight),'white');d=ImageDraw.Draw(image)
 for i,v in enumerate(rows):
  x=(i//9)*700;y=(i%9)*rowheight;d.text((x+15,y+4),f'{v["weight"]} {"italic" if v["italic"] else "upright"} opsz {v["opticalSize"] or "n/a"}',font=ImageFont.load_default(size=13),fill='#666')
  offset=28
  for size in sizes:
   font=ImageFont.truetype(v['font'],size)
   # Long transcriptions use a readable prefix; never shrink the glyphs to fit.
   line=text
   while len(line)>1 and d.textlength(line,font=font)>(620 if columns==2 else 1320):line=line[:-1]
   d.text((x+24,y+offset),line,font=font,fill='black');offset+=size+12
 filename=f'atlas-{start//page}.jpg';image.save(output/filename,quality=92)
 entries.append({'file':str((output/filename).relative_to(root)),'variants':[{k:v[k] for k in ('weight','italic','opticalSize','sourceFile','axes')} for v in rows]})
print(json.dumps({'atlases':entries,'variantCount':len(variants),'sizes':sizes,'text':text,'defaultAxesOnly':True}))
