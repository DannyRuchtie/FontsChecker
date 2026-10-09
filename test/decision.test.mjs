import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDecision} from '../decision.mjs';
const image='data:image/png;base64,aGVsbG8=';
test('target font is configurable with Inter default',()=>{assert.match(buildDecision({image}).questions[0].instructions,/"Inter"/);assert.match(buildDecision({image,font:'Roboto'}).questions[0].instructions,/"Roboto"/);});
test('transcription is provided as evidence not instructions',()=>{const p=buildDecision({image,text:'Design 2027'});assert.match(p.input[0].content[0].text,/Design 2027/);assert.equal(p.questions[0].type,'predicate');});
test('font-name words retain visual glyph evidence without becoming semantic proof',()=>{const p=buildDecision({image,text:'Inter'});assert.match(p.input[0].content[0].text,/printed font name can supply letter shapes/);assert.match(p.input[0].content[0].text,/meaning is never evidence/);});
test('reject unsupported image, empty font and oversized text',()=>{assert.throws(()=>buildDecision({image:'https://example.com/a.png'}));assert.throws(()=>buildDecision({image,font:''}));assert.throws(()=>buildDecision({image,text:'a'.repeat(121)}));});
