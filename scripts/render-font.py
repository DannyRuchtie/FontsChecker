"""Render authoritative font files. Input/output are JSON, passed through stdin/stdout."""
import sys,json,hashlib
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageDraw,ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
request=json.load(sys.stdin);root=Path(request['directory']);text=request.get('text') or 'Ag a g e R G Q I l 1 0 O @ & 0123456789'
variants=[];seen=set()
for path in sorted(root.glob('*')):
 if path.suffix not in ('.ttf','.woff2'):continue
 f=TTFont(path);axes={a.axisTag:[a.minValue,a.defaultValue,a.maxValue] for a in f['fvar'].axes} if 'fvar' in f else {}
 if any(ord(ch) not in f.getBestCmap() for ch in text if not ch.isspace()):raise ValueError('The selected font lacks glyphs for part of this text. Use text supported by the font.')
 italic=bool(f['head'].macStyle&2) or 'italic' in path.name.lower()
 weights=sorted(set([axes['wght'][0],axes['wght'][2]]+[w for w in range(100,1000,100) if axes['wght'][0]<=w<=axes['wght'][2]])) if 'wght' in axes else [f['OS/2'].usWeightClass]
 optical=sorted(set([axes['opsz'][0],axes['opsz'][1],min(32,axes['opsz'][2])])) if 'opsz' in axes else [None]
 for op in optical:
  for weight in weights:
   key=(italic,weight,op)
   if key in seen:continue
   seen.add(key)
   coords={tag:values[1] for tag,values in axes.items()};coords.update({'wght':weight} if 'wght' in axes else {});coords.update({'opsz':op} if op is not None else {})
   instance=instantiateVariableFont(f,coords,inplace=False) if axes else f
   instance.flavor=None;buf=BytesIO();instance.save(buf)
   variants.append({'weight':weight,'italic':italic,'opticalSize':op,'font':buf.getvalue(),'sourceFile':path.name,'axes':axes})
# All available standard weight/style/optical samples are generated; paginate to keep glyphs readable.
output=root/'renders'/hashlib.sha256(('v1:'+request.get('text','')).encode()).hexdigest()[:20];output.mkdir(parents=True,exist_ok=True)
entries=[]
for start in range(0,len(variants),9):
 rows=variants[start:start+9];image=Image.new('RGB',(1400,len(rows)*190),'white');d=ImageDraw.Draw(image)
 for i,v in enumerate(rows):
  y=i*190;d.text((15,y+4),f'{v["weight"]} {"italic" if v["italic"] else "upright"} opsz {v["opticalSize"] or "n/a"}',font=ImageFont.load_default(size=13),fill='#666')
  for size,offset in [(18,35),(32,78),(52,145)]:
   font=ImageFont.truetype(BytesIO(v['font']),size)
   # Wrap to prevent tiny glyphs on long lines. Bound transcription length at caller.
   line=text
   while len(line)>1 and d.textlength(line,font=font)>1320:line=line[:-1]
   d.text((24,y+offset-size//2),line,font=font,fill='black')
 filename=f'atlas-{start//9}.jpg';image.save(output/filename,quality=92)
 entries.append({'file':str((output/filename).relative_to(root)),'variants':[{k:v[k] for k in ('weight','italic','opticalSize','sourceFile','axes')} for v in rows]})
print(json.dumps({'atlases':entries,'variantCount':len(variants),'sizes':[18,32,52],'text':text,'defaultAxesOnly':True}))
