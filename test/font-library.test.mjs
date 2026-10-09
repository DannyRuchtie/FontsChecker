import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fontId,prepareFont,attachFontReferences,referenceFile} from '../font-library.mjs';
import {buildDecision} from '../decision.mjs';
const image='data:image/jpeg;base64,aGVsbG8=';
test('font names cannot inject URLs or paths',()=>{assert.equal(fontId('Open Sans'),'opensans');assert.throws(()=>fontId('../private'));assert.throws(()=>fontId('https://evil.test'));});
test('reference serving rejects traversal',async()=>{await assert.rejects(referenceFile('/inter/../../.env'));});
test('official Inter pack is generated with supported sizes, and target stays separate',async()=>{const font=await prepareFont('Inter');assert.equal(font.pack.variantCount,36);assert.deepEqual(font.pack.sizes,[18,32,52]);const {payload,reference}=await attachFontReferences(buildDecision({image,font:'Inter'}),'Inter');assert.equal(payload.input[0].content[1].image_url,image);assert.equal(reference.family,'Inter');assert.ok(reference.previewUrls.length);assert.match(payload.input[0].content[0].text,/REFERENCE ONLY/);});
