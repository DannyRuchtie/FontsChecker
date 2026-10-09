import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecision} from '../decision.mjs';
import {addInterReferences} from '../inter-reference.mjs';
const image='data:image/png;base64,aGVsbG8=';
test('Inter target remains first and references are explicitly separate',()=>{const {payload,reference}=addInterReferences(buildDecision({image,mode:'verify',font:' inter '}));const parts=payload.input[0].content;assert.equal(reference.images,4);assert.equal(parts[1].image_url,image);assert.equal(parts.filter(x=>x.type==='input_image').length,5);assert.match(parts[0].text,/Judge only text in the TARGET/);});
test('shortlist Inter gets references while unrelated fonts do not',()=>{assert.ok(addInterReferences(buildDecision({image,mode:'identify',candidates:['Inter','Roboto']})).reference);assert.equal(addInterReferences(buildDecision({image,mode:'verify',font:'Roboto'})).reference,null);});
