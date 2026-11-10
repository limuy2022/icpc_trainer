import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-browser-models-'));
try {
 await build({entryPoints:['lib/browser-models.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'browser.mjs')});
 const storage=()=>{const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k)};};
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window={location:{origin:'https://trainer.example'},dispatchEvent:()=>{}};
 const {readBrowserModels:read,saveBrowserModels:save,browserModelMetadata:metadata,browserCompletion:complete,browserModelPayload:payload,browserModelList:list}=await import(join(dir,'browser.mjs'));
 const secret='LOCAL_ONLY_FAKE_KEY';const model={id:'browser-fixture',label:'Mine',model:'test',provider:'openai-compatible',base_url:'https://provider.example/v1',key:secret,max_output_tokens:null,output_token_parameter:'max_tokens',remember:false};
 save('a',[model]);assert.ok(sessionStorage.getItem('icpc-browser-models:a').includes(secret));assert.ok(!localStorage.getItem('icpc-browser-models:a').includes(secret));assert.equal(read('a').length,1);assert.deepEqual(read('b'),[]);assert.ok(!JSON.stringify(metadata(model)).includes(secret));assert.equal(metadata(model).scope,'browser');
 const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init});if(url.endsWith('/models'))return Response.json({data:[{id:'model-b'},{id:'model-a'}]});return new Response('data: '+JSON.stringify({choices:[{delta:{content:'answer'},finish_reason:'stop'}],usage:{total_tokens:3}})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});};
 const signal=new AbortController().signal;const result=await complete('a',model,{...payload(model,'default'),messages:[{role:'user',content:'hello'}]},{signal});assert.equal(result.text,'answer');assert.equal(calls[0].url,'https://provider.example/v1/chat/completions');assert.equal(calls[0].init.headers.Authorization,'Bearer '+secret);assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.signal,signal);assert.ok(!calls[0].init.body.includes(secret));
 assert.deepEqual(await list(model),['model-a','model-b']);assert.ok(calls.every(c=>new URL(c.url).origin==='https://provider.example'));
 const before=calls.length;for(const base_url of ['https://trainer.example/api','http://provider.example','https://user:secret@provider.example','https://provider.example?key=bad'])await assert.rejects(()=>complete('a',{...model,base_url},{}));assert.equal(calls.length,before);
 globalThis.fetch=async(url)=>{calls.push({url});throw new TypeError('network blocked');};await assert.rejects(()=>complete('a',model,{}),/CORS/);assert.equal(calls.length,before+1);assert.ok(calls.every(c=>new URL(c.url).origin==='https://provider.example'));
 save('a',[{...model,remember:true}]);assert.ok(localStorage.getItem('icpc-browser-models:a').includes(secret));assert.equal(sessionStorage.getItem('icpc-browser-models:a'),'[]');
 console.log('PASS: session-only defaults, explicit browser persistence, account isolation, key-free metadata, provider-only authorization, no website cookies, CORS errors without proxy fallback and local usage');
}finally{await rm(dir,{recursive:true,force:true});}
