import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonMessage} from '../public/evidence.js';
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
