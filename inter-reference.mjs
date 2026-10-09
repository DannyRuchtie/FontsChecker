import {readFile} from 'node:fs/promises';
import {validateImage} from './decision.mjs';
const manifest=JSON.parse(await readFile(new URL('./references/inter/manifest.json',import.meta.url),'utf8'));
const images=await Promise.all(manifest.atlases.map(async entry=>({type:'input_image',image_url:`data:image/png;base64,${(await readFile(new URL(`./references/inter/${entry.file}`,import.meta.url))).toString('base64')}`})));
export function addInterReferences(payload, matchedImages=[]) {
  if(!/use the "inter" font family/i.test(payload.questions[0].instructions))return {payload,reference:null};
  const parts=payload.input[0].content;
  parts[0].text+=' The first image is the TARGET. Judge only text in the TARGET. The following four images are known Inter 4.1 REFERENCE specimens, not target evidence. They cover upright and italic weights 100–900, optical sizes 14 and 32. Compare shared glyph outlines, proportions, counters, terminals, and spacing. Match family rather than weight. Account for optical size and alternative glyph settings; no single glyph is definitive. Similar fonts such as Arial, Helvetica, Roboto and SF Pro can look close; remain uncertain when shared glyph evidence is insufficient. Never count reference images as evidence that the target contains Inter.';
  if(!Array.isArray(matchedImages) || (matchedImages.length!==0 && matchedImages.length!==4)) throw Error('Expected four matching-text reference images.');
  matchedImages.forEach(validateImage);
  parts.push({type:'input_text',text:'REFERENCE ONLY: Inter 4.1, rendered from rsms.me/inter font files. Order: upright opsz 14, upright opsz 32, italic opsz 14, italic opsz 32. Labels describe reference variants only.'},...images);
  if(matchedImages.length) parts.push({type:'input_text',text:'Additional REFERENCE ONLY: the transcribed text rendered in official Inter. Same variant order as above, nine weights each. These are not the target.'},...matchedImages.map(image_url=>({type:'input_image',image_url})));
  return {payload,reference:{family:'Inter',version:manifest.version,source:manifest.source,images:images.length+matchedImages.length,matchedText:matchedImages.length>0}};
}
