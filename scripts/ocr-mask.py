"""Optional bright-letter mask for a colored background; JSON stdin/stdout, no files."""
import sys,json,base64
from io import BytesIO
from PIL import Image
r=json.load(sys.stdin);im=Image.open(BytesIO(base64.b64decode(r['image'].split(',')[1]))).convert('RGB')
pixels=list(im.get_flattened_data());colored=sum(max(p)-min(p)>35 for p in pixels)/len(pixels)
mask=Image.new('L',im.size);mask.putdata([0 if min(p)>=235 and max(p)-min(p)<=20 else 255 for p in pixels]);ink=sum(v==0 for v in mask.get_flattened_data())/len(pixels)
if colored>.15 and .01<ink<.8:
 # Remove small detached highlights before OCR treats them as punctuation.
 from collections import deque
 w,h=mask.size;data=list(mask.get_flattened_data());seen=set();minimum=max(8,int(h*h*.002))
 for start,value in enumerate(data):
  if value or start in seen:continue
  queue=deque([start]);seen.add(start);component=[]
  while queue:
   at=queue.popleft();component.append(at);x=at%w;y=at//w
   for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1),(x+1,y+1)):
    if 0<=nx<w and 0<=ny<h:
     n=ny*w+nx
     if data[n]==0 and n not in seen:seen.add(n);queue.append(n)
  if len(component)<minimum:
   for at in component:data[at]=255
 mask.putdata(data)
 out=BytesIO();mask.save(out,format='PNG');print(json.dumps({'image':'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode(),'method':'bright neutral foreground on colored background'}))
else:print('{}')
