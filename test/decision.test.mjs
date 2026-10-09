import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecision} from '../decision.mjs';
const image='data:image/png;base64,aGVsbG8=';
test('shortlist includes abstention and inline image',()=>{const p=buildDecision({image,mode:'identify',candidates:['Inter','Roboto','Inter']});assert.equal(p.model,'gpt-6-luna');assert.deepEqual(p.questions[0].choices.map(x=>x.value),['Inter','Roboto','unknown']);assert.equal(p.input[0].content[1].image_url,image);});
test('verification is a predicate, not a forced match',()=>{const p=buildDecision({image,mode:'verify',font:'Inter'});assert.equal(p.questions[0].type,'predicate');assert.match(p.questions[0].instructions,/Inter/);});
test('reject unsupported images, missing target and invalid candidates',()=>{assert.throws(()=>buildDecision({image:'https://example.com/a.png',mode:'verify',font:'Inter'}));assert.throws(()=>buildDecision({image,mode:'verify',font:''}));assert.throws(()=>buildDecision({image,mode:'identify',candidates:['Inter','Inter']}));assert.throws(()=>buildDecision({image,mode:'identify',candidates:['Inter','unknown']}));});
