import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {prepareFont} from './font-library.mjs';
import {validateImage} from './decision.mjs';
export async function measureFont(request){
 validateImage(request.image);
 if(typeof request.text!=='string'||request.text.length>120)throw Error('Enter up to 120 characters for comparison.');
 const font=await prepareFont(request.font||'Inter');
 const stdout=await new Promise((ok,fail)=>{const child=execFile(resolve('.renderer/bin/python'),[resolve('scripts/measure-font.py')],{timeout:180000,maxBuffer:4000000},(e,out)=>e?fail(Error('Local measurement could not finish.')):ok(out));child.stdin.end(JSON.stringify({directory:font.directory,image:request.image,text:request.text}));});
 return {...JSON.parse(stdout),family:font.family};
}
