// Keep the model estimate and pixel measurements separate; explain their relationship.
export function localVerdictPresentation(local){
 if(local?.status!=='measured'||!Number.isFinite(local.best?.shapeSimilarity))return {tone:'uncertain',title:local?'Local measurement unavailable':'Measuring letter shapes',percentage:null};
 const percentage=local.best.shapeSimilarity;
 if(percentage<60)return {tone:'uncertain',title:'Measurement unreliable',percentage};
 if(local.margin===null)return {tone:'uncertain',title:'Comparison incomplete',percentage};
 if(local.statusLabel==='Strong measured similarity')return {tone:'high',title:'Strong measured similarity',percentage};
 if(local.statusLabel==='Another font fits better')return {tone:'low',title:'Another font fits better',percentage};
 return {tone:'uncertain',title:'Similar fonts remain ambiguous',percentage};
}
export function verdictPresentation(ai,local,font='the selected font'){
 const answer=ai?.answers?.find(x=>x.name==='font_match');
 const readable=ai?.answers?.find(x=>x.name==='readable_text');
 if(answer?.type!=='predicate'||!Number.isFinite(answer.probability))return {tone:'uncertain',title:'No AI decision available'};
 const p=answer.probability;
 if(readable?.type==='refusal'||(readable?.type==='predicate'&&readable.probability<.7))return {tone:'uncertain',title:'Insufficient readable text'};
 if(!local)return {tone:'uncertain',title:'Waiting for local evidence'};
 if(local.status!=='measured')return {tone:'uncertain',title:'Font match unverified'};
 if(local.best?.shapeSimilarity<60)return {tone:'uncertain',title:'Measurement unreliable'};
 if(local.margin===null)return {tone:'uncertain',title:'Comparison incomplete'};
 if(p>=.8&&local.statusLabel==='Strong measured similarity')return {tone:'high',title:`Evidence supports ${font}`};
 if(p<=.2&&local.margin<=-3)return {tone:'low',title:`Evidence argues against ${font}`};
 if((p>=.8&&local.margin<=-3)||(p<=.2&&local.best?.shapeSimilarity>=85))return {tone:'uncertain',title:'Conflicting font evidence'};
 if(local.margin<=-3)return {tone:'uncertain',title:'Local comparison favors another font'};
 return {tone:'uncertain',title:local.statusLabel==='Strong measured similarity'?'Strong local match · AI uncertain':'Similar fonts remain ambiguous'};
}
export function comparisonMessage(ai,local){
 const answer=ai?.answers?.find(x=>x.name==='font_match');
 if(answer?.type!=='predicate'||!Number.isFinite(answer.probability)||!local)return null;
 if(local.status!=='measured')return 'Local letter shapes could not be checked. The AI estimate has no local measurement to support it.';
 const p=answer.probability,score=local.best?.shapeSimilarity;
 if(score<60)return 'Local measurement is unreliable. Check the selected line and its transcription before interpreting either score.';
 if((p<=.2&&score>=85)||(p>=.8&&local.margin!==null&&local.margin<=-3))return 'The AI estimate and local comparison disagree. Check the transcription and letter overlays; neither result establishes font identity.';
 if(local.statusLabel==='Strong measured similarity'&&p<.8)return 'Local shapes strongly resemble the selected font, while the AI estimate remains uncertain. These are separate, uncalibrated signals.';
 if(p>=.8&&local.statusLabel!=='Strong measured similarity')return 'The AI estimate is high, but local comparison cannot distinguish this font from the alternatives. A green result needs both checks to support the match.';
 return null;
}
