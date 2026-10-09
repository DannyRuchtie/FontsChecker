// Prefer prominent complete lines over long rows of small specimen labels.
export function selectOCRLine(lines, literal='') {
 const compact=x=>x.replace(/\s+/g,'');
 const eligible=lines.filter(x=>x.confidence>=.4&&compact(x.text).length>=3&&(!literal||compact(literal).includes(compact(x.text))));
 return eligible.sort((a,b)=>{
  const score=x=>Math.max(1,x.bbox.y1-x.bbox.y0)*Math.sqrt(Math.min(40,compact(x.text).length))*x.confidence;
  return score(b)-score(a);
 })[0];
}
