export const profileSchema={type:'object',properties:{region:{anyOf:[{type:'object',properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height'],additionalProperties:false},{type:'null'}]},text:{type:'string'},weight:{type:'string',enum:['thin','regular','medium','bold','black','unknown']},style:{type:'string',enum:['upright','italic','unknown']},size:{type:'string',enum:['small','body','display','unknown']},certainty:{type:'string',enum:['high','medium','low']}},required:['region','text','weight','style','size','certainty'],additionalProperties:false};
export function selectReferences(profile){
 if(!profile||!['high','medium'].includes(profile.certainty))return null;
 // OCR's apparent weight/style is too unreliable to exclude real family variants.
 const sizes=profile.certainty==='high'&&profile.size==='small'?[18,32]:profile.certainty==='high'&&profile.size==='display'?[32,52]:[18,32,52];
 return sizes.length<3?{minWeight:100,maxWeight:1000,style:'unknown',sizes}:null;
}
export function shouldBroaden(data,selection){const match=data.answers?.find(x=>x.name==='font_match');const readable=data.answers?.find(x=>x.name==='readable_text');return !!selection&&match?.type==='predicate'&&match.probability>.2&&match.probability<.8&&readable?.type==='predicate'&&readable.probability>=.7;}
