import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {buildDecision} from './decision.mjs';
const assets = {'/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css']};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server = http.createServer(async(req,res)=>{
  try {
    if(req.method==='GET' && req.url==='/api/status') return json(res,200,{configured:!!process.env.OPENAI_API_KEY});
    if(req.method==='POST' && req.url==='/api/analyze') {
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return json(res,403,{error:'Request origin is not allowed.'});
      let body='';
      for await(const chunk of req){body+=chunk;if(body.length>3_100_000) return json(res,413,{error:'Image request is too large.'});}
      let payload;try{payload=buildDecision(JSON.parse(body));}catch(e){return json(res,400,{error:e.message});}
      if(!process.env.OPENAI_API_KEY) return json(res,503,{error:'Add OPENAI_API_KEY to the server’s .env file, then restart npm start.'});
      const started=Date.now();
      const upstream=await fetch('https://api.openai.com/v1/decisions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
      const data=await upstream.json();
      if(!upstream.ok) return json(res,upstream.status,{error:data.error?.message||'OpenAI could not complete this request.'});
      if(!Array.isArray(data.answers)||!data.answers.length) return json(res,502,{error:'OpenAI returned no decision.'});
      return json(res,200,{...data,elapsedMs:Date.now()-started});
    }
    if(req.method==='GET' && assets[req.url]){const [file,type]=assets[req.url];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));}
    json(res,404,{error:'Not found'});
  }catch(e){json(res,502,{error:e.name==='TimeoutError'?'OpenAI took too long. Please try again.':'The request failed. Check the server connection and try again.'});}
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${process.env.PORT || 3000} is already in use. Stop the existing server, or run PORT=3001 npm start.`
    : `Could not start Fonts Checker: ${error.message}`);
  process.exit(1);
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`Fonts Checker: http://localhost:${process.env.PORT||3000}`));
