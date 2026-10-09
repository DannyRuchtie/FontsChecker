export const profileSchema={type:'object',properties:{region:{anyOf:[{type:'object',properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height'],additionalProperties:false},{type:'null'}]},text:{type:'string'},weight:{type:'string',enum:['thin','regular','medium','bold','black','unknown']},style:{type:'string',enum:['upright','italic','unknown']},size:{type:'string',enum:['small','body','display','unknown']},certainty:{type:'string',enum:['high','medium','low']}},required:['region','text','weight','style','size','certainty'],additionalProperties:false};
export function selectReferences(profile){
 if(!profile||!['high','medium'].includes(profile.certainty))return null;
 const centers={thin:200,regular:400,medium:500,bold:700,black:900};const center=centers[profile.weight];
 const radius=profile.certainty==='high'?150:250;
 const selection={minWeight:center?Math.max(100,center-radius):100,maxWeight:center?Math.min(1000,center+radius):1000,style:profile.certainty==='high'&&['upright','italic'].includes(profile.style)?profile.style:'unknown',sizes:profile.certainty==='high'&&profile.size==='small'?[18,32]:profile.certainty==='high'&&profile.size==='display'?[32,52]:[18,32,52]};
 return center||selection.style!=='unknown'||selection.sizes.length<3?selection:null;
}
export function shouldBroaden(data,selection){const match=data.answers?.find(x=>x.name==='font_match');const readable=data.answers?.find(x=>x.name==='readable_text');return !!selection&&match?.type==='predicate'&&match.probability>.2&&match.probability<.8&&readable?.type==='predicate'&&readable.probability>=.7;}
