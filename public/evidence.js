// Keep the model estimate and pixel measurements separate; explain their relationship.
export function comparisonMessage(ai,local){
 const answer=ai?.answers?.find(x=>x.name==='font_match');
 if(answer?.type!=='predicate'||!Number.isFinite(answer.probability)||!local)return null;
 if(local.status!=='measured')return 'Local letter shapes could not be checked. The AI estimate has no local measurement to support it.';
 const p=answer.probability,score=local.best?.shapeSimilarity;
 if(score<60)return 'Local measurement is unreliable. Check the selected line and its transcription before interpreting either score.';
 if((p<=.2&&score>=85)||(p>=.8&&local.margin!==null&&local.margin<=-3))return 'The AI estimate and local comparison disagree. Check the transcription and letter overlays; neither result establishes font identity.';
 if(local.statusLabel==='Strong measured similarity'&&p<.8)return 'Local shapes strongly resemble the selected font, while the AI estimate remains uncertain. These are separate, uncalibrated signals.';
 return null;
}
