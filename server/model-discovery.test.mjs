import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-discovery-'));
try {
 await build({entryPoints:['server/model-discovery.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'mocks',setup(b){
 for(const name of ['database','models','security'])b.onResolve({filter:new RegExp('^\\./'+name+'$')},()=>({path:name,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='database'?`export const db={prepare:()=>({get:()=>globalThis.__old})};`:a.path==='models'?`export const modelKey=()=> 'stored-test-key';export const validateEndpoint=async v=>{const u=new URL(v);if(u.protocol!=='https:'||u.hostname==='localhost')throw Error('blocked');return v.replace(/\\/+$/,'')};`:`export const fail=(status,message)=>{throw Object.assign(Error(message),{status})};export const requireUser=()=>{if(globalThis.__nonAdmin)fail(403,'admin only');return {id:'admin'}};export const checkOrigin=r=>{if(r.headers.get('origin')==='https://evil.example')fail(403,'origin')};export const throttle=()=>{};`,loader:'js'}));
 }}]});
 const {discoverModels}=await import(join(dir,'test.mjs'));
 const request=(body,origin='https://trainer.example')=>new Request('https://trainer.example/api/admin/models/discover',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 const base={base_url:'https://model.example/v1',key:'new-test-key'};let calls=0,upstream;
 globalThis.fetch=async(url,options)=>{calls++;upstream={url,options};return Response.json({data:[{id:'model-b'},{id:'model-a'},{id:'model-b'},{id:null},{id:'x'.repeat(121)}],ignored_secret:'stored-test-key'});};
 let response=await discoverModels(request(base));assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.models,['model-a','model-b']);assert.ok(!JSON.stringify(result).includes('test-key'));assert.equal(upstream.url,'https://model.example/v1/models');assert.equal(upstream.options.method,'GET');assert.equal(upstream.options.headers.Authorization,'Bearer new-test-key');assert.equal(upstream.options.redirect,'error');assert.ok(upstream.options.signal);
 await assert.rejects(()=>discoverModels(request({base_url:base.base_url})),e=>e.status===400);await assert.rejects(()=>discoverModels(request({...base,id:'missing'})),e=>e.status===404);
 globalThis.__old={id:'existing',base_url:base.base_url,env_key:1};
 await discoverModels(request({id:'existing',base_url:base.base_url}));assert.equal(upstream.options.headers.Authorization,'Bearer stored-test-key');
 await assert.rejects(()=>discoverModels(request({id:'existing',base_url:'https://different.example/v1'})),/重新填写密钥/);
 await discoverModels(request({...base,id:'existing',base_url:'https://different.example/v1'}));assert.equal(upstream.options.headers.Authorization,'Bearer new-test-key');
 const before=calls;globalThis.__nonAdmin=true;await assert.rejects(()=>discoverModels(request(base)),e=>e.status===403);globalThis.__nonAdmin=false;await assert.rejects(()=>discoverModels(request(base,'https://evil.example')),e=>e.status===403);await assert.rejects(()=>discoverModels(request({...base,base_url:'https://localhost'})),/blocked/);assert.equal(calls,before);
 for(const status of [401,403,404,405,429,500]){globalThis.fetch=async()=>new Response('DO_NOT_RETURN_PRIVATE_RESPONSE',{status});await assert.rejects(()=>discoverModels(request(base)),e=>!e.message.includes('PRIVATE')&&e.status>=400);}
 for(const content of ['not json',JSON.stringify({models:['invalid-shape']})]){globalThis.fetch=async()=>new Response(content);await assert.rejects(()=>discoverModels(request(base)),/格式无效/);}
 globalThis.fetch=async()=>{throw Error('new-test-key private network details')};await assert.rejects(()=>discoverModels(request(base)),e=>e.status===502&&!e.message.includes('test-key'));
 globalThis.fetch=async()=>Response.json({data:[]});assert.deepEqual((await (await discoverModels(request(base))).json()).models,[]);
 console.log('PASS: authenticated model discovery, origin/endpoint checks, explicit and stored keys, endpoint key isolation, deduplicated IDs only, no secret echo, unsupported APIs and invalid responses');
}finally{await rm(dir,{recursive:true,force:true});}
