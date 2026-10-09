import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectReferences,shouldBroaden} from '../reference-selection.mjs';
test('uncertain profile retains full coverage',()=>{assert.equal(selectReferences({certainty:'low',weight:'bold'}),null);assert.equal(selectReferences({certainty:'high',weight:'unknown',style:'unknown',size:'unknown'}),null);});
test('apparent weight never excludes family variants',()=>{assert.deepEqual(selectReferences({certainty:'high',weight:'bold',style:'upright',size:'display'}),{minWeight:100,maxWeight:1000,style:'unknown',sizes:[32,52]});assert.equal(selectReferences({certainty:'medium',weight:'regular',style:'italic'}),null);});
test('only inconclusive readable narrowed checks trigger retry',()=>{const data={answers:[{name:'font_match',type:'predicate',probability:.5},{name:'readable_text',type:'predicate',probability:1}]};assert.ok(shouldBroaden(data,{}));assert.equal(shouldBroaden(data,null),false);data.answers[1].probability=.1;assert.equal(shouldBroaden(data,{}),false);});
test('reference packs retain every family variant and reuse cache',async()=>{
 const {attachFontReferences}=await import('../font-library.mjs');const {buildDecision}=await import('../decision.mjs');
 const selection=selectReferences({certainty:'high',weight:'regular',style:'upright',size:'body'});
 const {reference}=await attachFontReferences(buildDecision({image:'data:image/jpeg;base64,aGVsbG8=',font:'Inter',text:'Quiet mornings, bright ideas.'}),'Inter','Quiet mornings, bright ideas.',selection);
 assert.equal(reference.variantCount,36);assert.equal(reference.images,6);assert.deepEqual(reference.selection,selection);
 const repeated=await attachFontReferences(buildDecision({image:'data:image/jpeg;base64,aGVsbG8=',font:'Inter',text:'Quiet mornings, bright ideas.'}),'Inter','Quiet mornings, bright ideas.',selection);assert.ok(repeated.reference.cacheHit);
});
test('compact short-text sheets preserve variants and wide strings keep full-width rows',async()=>{
 const {attachFontReferences}=await import('../font-library.mjs');const {buildDecision}=await import('../decision.mjs');
 const input=text=>buildDecision({image:'data:image/jpeg;base64,aGVsbG8=',font:'Inter',text});
 const compact=await attachFontReferences(input('Inter'),'Inter','Inter');
 assert.equal(compact.reference.variantCount,36);assert.equal(compact.reference.generatedImages,2);assert.deepEqual(compact.reference.sizes,[52]);
 const metadata=compact.payload.input[0].content.find(x=>x.type==='input_text'&&x.text.startsWith('REFERENCE ONLY. Variant labels')).text;
 assert.match(metadata,/"italic":true/);assert.match(metadata,/"italic":false/);assert.match(metadata,/"weight":100/);assert.match(metadata,/"weight":900/);assert.match(metadata,/"opticalSize":14/);assert.match(metadata,/"opticalSize":32/);
 const wide=await attachFontReferences(input('WWWWWWWWWWWWWWWWWW'),'Inter','WWWWWWWWWWWWWWWWWW');
 assert.equal(wide.reference.generatedImages,4);assert.equal(wide.reference.variantCount,36);
});
