import {execFile} from 'node:child_process';import {resolve} from 'node:path';
export async function brightLetterMask(image){return new Promise((ok,fail)=>{const p=execFile(resolve('.renderer/bin/python'),[resolve('scripts/ocr-mask.py')],{timeout:10000,maxBuffer:3000000},(e,out)=>e?fail(e):ok(JSON.parse(out)));p.stdin.end(JSON.stringify({image}));});}
