import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonMessage,verdictPresentation,localVerdictPresentation} from '../public/evidence.js';
const ai=p=>({answers:[{name:'font_match',type:'predicate',probability:p}]});
test('disagreement remains explicit without changing the AI probability',()=>{
 const data=ai(.02);assert.match(comparisonMessage(data,{status:'measured',best:{shapeSimilarity:86},margin:-1}),/disagree/);assert.equal(data.answers[0].probability,.02);
 assert.match(comparisonMessage(ai(.56),{status:'measured',best:{shapeSimilarity:98},margin:5,statusLabel:'Strong measured similarity'}),/separate, uncalibrated/);
});
test('unreliable or missing local evidence never supports a verdict',()=>{
 assert.match(comparisonMessage(ai(.99),{status:'not_checked'}),/could not be checked/);
 assert.match(comparisonMessage(ai(.99),{status:'measured',best:{shapeSimilarity:21}}),/unreliable/);
 assert.equal(comparisonMessage({answers:[{name:'font_match',type:'refusal'}]},{status:'measured'}),null);
});
test('high AI probabilities need independent local support to be green',()=>{
 const data=ai(.87);const strong={status:'measured',best:{shapeSimilarity:98},margin:6,statusLabel:'Strong measured similarity'};
 assert.equal(verdictPresentation(data).tone,'uncertain');
 assert.equal(verdictPresentation(data,{status:'not_checked'}).tone,'uncertain');
 assert.equal(verdictPresentation(data,{...strong,margin:1.4,statusLabel:'Similar fonts remain ambiguous'}).tone,'uncertain');
 assert.equal(verdictPresentation(data,strong).tone,'high');
 const other={...strong,margin:-4.4,statusLabel:'Another font fits better'};assert.equal(verdictPresentation(data,other).tone,'uncertain');assert.match(verdictPresentation(data,other).title,/Conflicting/);
 assert.match(verdictPresentation(ai(.54),other).title,/another font/);
 assert.equal(verdictPresentation(ai(.05),other).tone,'low');assert.equal(verdictPresentation(ai(.05),strong).tone,'uncertain');assert.equal(data.answers[0].probability,.87);
});
test('local-only verdicts expose measured percentages without inventing AI confidence',()=>{
 const local={status:'measured',best:{shapeSimilarity:99.1},margin:5.8,statusLabel:'Strong measured similarity'};
 assert.deepEqual(localVerdictPresentation(local),{tone:'high',title:'Strong measured similarity',percentage:99.1});
 assert.equal(localVerdictPresentation({...local,margin:1,statusLabel:'Similar fonts remain ambiguous'}).tone,'uncertain');
 assert.equal(localVerdictPresentation({...local,margin:-4,statusLabel:'Another font fits better'}).tone,'low');
 assert.equal(localVerdictPresentation({...local,margin:null}).tone,'uncertain');
 assert.equal(localVerdictPresentation({...local,best:{shapeSimilarity:21}}).title,'Measurement unreliable');
 assert.equal(localVerdictPresentation({status:'not_checked'}).percentage,null);
 assert.equal(localVerdictPresentation().percentage,null);
 assert.equal(verdictPresentation(null,local).tone,'uncertain');
});
