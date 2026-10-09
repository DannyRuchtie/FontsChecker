import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareFont} from '../font-library.mjs';
// Export only generic diagnostic sheets, never cached user transcriptions.
const genericKey=createHash('sha256').update('v1:').digest('hex').slice(0,20);
for(const family of process.argv.slice(2).length?process.argv.slice(2):['Inter','Roboto','Open Sans']){
 const font=await prepareFont(family);const target=resolve('references/packs',font.id);await mkdir(target,{recursive:true});
 for(const file of [...font.files.map(x=>x.file),font.license,'source.json'])await cp(resolve(font.directory,file),resolve(target,file));
 await mkdir(resolve(target,'renders'),{recursive:true});await cp(resolve(font.directory,'renders',genericKey),resolve(target,'renders',genericKey),{recursive:true});
 console.log(`Prebuilt ${font.family}: ${font.pack.variantCount} variants, generic text only.`);
}
