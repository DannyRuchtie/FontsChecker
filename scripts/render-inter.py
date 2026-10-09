"""Generate reference atlases and separate synthetic evaluation examples.
Requires: pip install pillow fonttools brotli
Run from repository root: python scripts/render-inter.py
"""
from pathlib import Path
from io import BytesIO
import hashlib, json
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path('references/inter')
manifest={'source':'https://rsms.me/inter/','version':'4.1','fonts':[],'atlases':[]}
evalroot=Path('eval/fixtures'); evalroot.mkdir(parents=True,exist_ok=True)
examples=[]
for italic in (False,True):
    name='InterVariable-Italic.woff2' if italic else 'InterVariable.woff2'
    variable=TTFont(root/name)
    manifest['fonts'].append({'file':name,'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest(),'axes':{a.axisTag:[a.minValue,a.defaultValue,a.maxValue] for a in variable['fvar'].axes}})
    for optical in (14,32):
        sheet=Image.new('RGB',(1150,990),'white'); draw=ImageDraw.Draw(sheet)
        for index,weight in enumerate(range(100,901,100)):
            instance=instantiateVariableFont(variable,{'wght':weight,'opsz':optical},inplace=False);instance.flavor=None
            data=BytesIO();instance.save(data)
            font=ImageFont.truetype(BytesIO(data.getvalue()),36)
            y=index*110+12
            draw.text((18,y),f'{weight} / opsz {optical}',fill='#666666',font=ImageFont.load_default(size=14))
            draw.text((160,y),'Ag a g e R G Q I l 1 0 O @ &',font=font,fill='black')
            draw.text((160,y+47),'Hamburgefontsiv 0123456789',font=font,fill='black')
            # Evaluation uses different text and sizes, no font-family labels.
            sample=Image.new('RGB',(940,180),'#f6f7f2'); sd=ImageDraw.Draw(sample)
            samplefont=ImageFont.truetype(BytesIO(data.getvalue()),29 if optical==14 else 49)
            sd.text((20,24),'Quiet mornings, bright ideas.',font=samplefont,fill='#252b27')
            sd.text((20,92),'Design 2027 — a new beginning',font=samplefont,fill='#252b27')
            filename=f'inter-{weight}-{optical}-{"italic" if italic else "upright"}.jpg';sample.save(evalroot/filename,quality=88)
            examples.append({'file':filename,'expected':True,'weight':weight,'opticalSize':optical,'italic':italic,'kind':'synthetic'})
        filename=f'{"italic" if italic else "upright"}-{optical}.png';sheet.save(root/filename)
        manifest['atlases'].append({'file':filename,'weights':[100,900],'opticalSize':optical,'italic':italic})
# System fonts are rendered into negative examples; font files are not distributed.
for path in [Path('/System/Library/Fonts/Helvetica.ttc'),Path('/System/Library/Fonts/Supplemental/Arial.ttf'),Path('/System/Library/Fonts/Supplemental/Verdana.ttf'),Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf')]:
    if not path.exists():continue
    for size in (29,49):
        im=Image.new('RGB',(940,180),'#f6f7f2');d=ImageDraw.Draw(im);f=ImageFont.truetype(str(path),size)
        d.text((20,24),'Quiet mornings, bright ideas.',font=f,fill='#252b27');d.text((20,92),'Design 2027 — a new beginning',font=f,fill='#252b27')
        filename=f'negative-{path.stem.replace(" ","-").lower()}-{size}.jpg';im.save(evalroot/filename,quality=88)
        examples.append({'file':filename,'expected':False,'family':path.stem,'size':size,'kind':'synthetic'})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
Path('eval/manifest.json').write_text(json.dumps(examples,indent=2)+'\n')
print(f'Generated {len(manifest["atlases"])} reference atlases and {len(examples)} evaluation cases.')

# Browser reference fonts: keep variable weight, pin optical size.
fontroot=Path('public/fonts');fontroot.mkdir(parents=True,exist_ok=True)
css=[]
for style in ('upright','italic'):
    for opsz in (14,32):
        f=TTFont(root/('InterVariable'+('-Italic' if style=='italic' else '')+'.woff2'))
        f=instantiateVariableFont(f,{'opsz':opsz},inplace=True)
        f.save(fontroot/f'{style}-{opsz}.woff2')
        css.append(f'@font-face{{font-family:InterRef-{style}-{opsz};src:url(/fonts/{style}-{opsz}.woff2);font-weight:100 900;font-style:normal;font-display:block;}}')
Path('public/inter-fonts.css').write_text('\n'.join(css))
