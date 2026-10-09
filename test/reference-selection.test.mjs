import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectReferences,shouldBroaden} from '../reference-selection.mjs';
test('uncertain profile retains full coverage',()=>{assert.equal(selectReferences({certainty:'low',weight:'bold'}),null);assert.equal(selectReferences({certainty:'high',weight:'unknown',style:'unknown',size:'unknown'}),null);});
test('high certainty uses a range, style and nearby sizes',()=>{assert.deepEqual(selectReferences({certainty:'high',weight:'bold',style:'upright',size:'display'}),{minWeight:550,maxWeight:850,style:'upright',sizes:[32,52]});assert.equal(selectReferences({certainty:'medium',weight:'regular',style:'italic'}).style,'unknown');});
test('only inconclusive readable narrowed checks trigger retry',()=>{const data={answers:[{name:'font_match',type:'predicate',probability:.5},{name:'readable_text',type:'predicate',probability:1}]};assert.ok(shouldBroaden(data,{}));assert.equal(shouldBroaden(data,null),false);data.answers[1].probability=.1;assert.equal(shouldBroaden(data,{}),false);});
test('narrowed rendered pack excludes unrelated variants and reuses cache',async()=>{
 const {attachFontReferences}=await import('../font-library.mjs');const {buildDecision}=await import('../decision.mjs');
 const selection=selectReferences({certainty:'high',weight:'regular',style:'upright',size:'body'});
 const {reference}=await attachFontReferences(buildDecision({image:'data:image/jpeg;base64,aGVsbG8=',font:'Inter',text:'Quiet mornings, bright ideas.'}),'Inter','Quiet mornings, bright ideas.',selection);
 assert.equal(reference.variantCount,6);assert.equal(reference.images,3);assert.ok(reference.cacheHit);assert.deepEqual(reference.selection,selection);
});
