import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecision} from '../decision.mjs';
import {addInterReferences} from '../inter-reference.mjs';
const image='data:image/png;base64,aGVsbG8=';
test('target remains first with four official references',()=>{const {payload,reference}=addInterReferences(buildDecision({image,font:' inter '}));assert.equal(reference.images,4);assert.equal(payload.input[0].content[1].image_url,image);assert.match(payload.input[0].content[0].text,/Judge only text in the TARGET/);});
test('matching text adds four references; other fonts have no Inter references',()=>{assert.equal(addInterReferences(buildDecision({image}),Array(4).fill(image)).reference.images,8);assert.equal(addInterReferences(buildDecision({image,font:'Roboto'})).reference,null);assert.throws(()=>addInterReferences(buildDecision({image}),[image]));});
