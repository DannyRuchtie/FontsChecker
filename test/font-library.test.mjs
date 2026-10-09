import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontId,prepareFont,attachFontReferences,referenceFile,contrastFamilies} from '../font-library.mjs';
import {buildDecision} from '../decision.mjs';
const image='data:image/jpeg;base64,aGVsbG8=';
test('font names cannot inject URLs or paths',()=>{assert.equal(fontId('Open Sans'),'opensans');assert.throws(()=>fontId('../private'));assert.throws(()=>fontId('https://evil.test'));});
test('reference serving rejects traversal',async()=>{await assert.rejects(referenceFile('/inter/../../.env'));});
test('Inter checks include the known close Gothic A1 competitor',()=>{assert.deepEqual(contrastFamilies('Inter'),['Roboto','Open Sans','Gothic A1']);assert.deepEqual(contrastFamilies('Gothic A1'),['Inter','Roboto','Open Sans']);});
test('official Inter pack is generated with supported sizes, and target stays separate',async()=>{const font=await prepareFont('Inter');assert.equal(font.pack.variantCount,36);assert.deepEqual(font.pack.sizes,[18,32,52]);const {payload,reference}=await attachFontReferences(buildDecision({image,font:'Inter'}),'Inter');assert.equal(payload.input[0].content[1].image_url,image);assert.equal(reference.family,'Inter');assert.ok(reference.previewUrls.length);assert.match(payload.input[0].content[0].text,/REFERENCE ONLY/);});
