import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {brightLetterMask} from '../image-preprocessing.mjs';
test('bright-letter fallback works for a tight crop with more than 40% ink',async()=>{
 const fixture=execFileSync('.renderer/bin/python',['-c',"from PIL import Image,ImageDraw;from io import BytesIO;import base64;im=Image.new('RGB',(120,40),(235,100,25));d=ImageDraw.Draw(im);[d.rectangle((5+i*22,4,20+i*22,35),fill='white') for i in range(5)];b=BytesIO();im.save(b,format='PNG');print('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())"],{encoding:'utf8'}).trim();
 const result=await brightLetterMask(fixture);assert.match(result.image,/^data:image\/png;base64,/);
});
test('plain backgrounds do not trigger the colored-background fallback',async()=>{
 const fixture=execFileSync('.renderer/bin/python',['-c',"from PIL import Image;from io import BytesIO;import base64;im=Image.new('RGB',(120,40),'white');b=BytesIO();im.save(b,format='PNG');print('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())"],{encoding:'utf8'}).trim();
 assert.deepEqual(await brightLetterMask(fixture),{});
});
