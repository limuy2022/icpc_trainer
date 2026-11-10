import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-personal-fetch-'));
try {
 await build({entryPoints:['server/personal-fetch.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'fetch.mjs'),plugins:[{name:'network',setup(b){
  b.onResolve({filter:/^node:(dns|https)$/},a=>({path:a.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='node:dns'?`export const lookup=(host,options,callback)=>callback(null,globalThis.__addresses);`:`import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';export function request(url,options,onResponse){globalThis.__request={url,options};const req=new EventEmitter();req.end=body=>{globalThis.__body=body;options.lookup(url.hostname,{family:0,all:true},error=>{if(error){req.emit('error',error);return;}const res=Readable.from([Buffer.from('model response')]);res.statusCode=globalThis.__status||200;res.headers={'content-type':'text/plain'};onResponse(res);});};return req;}`,loader:'js'}));
 }}]});
 const {fetchPersonalModel:f,publicModelLookup,publicModelAddress:publicIP}=await import(join(dir,'fetch.mjs'));
 for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','198.18.0.1','192.0.0.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1','224.0.0.1','invalid'])assert.equal(publicIP(address),false,address);
 for(const address of ['93.184.216.34','8.8.8.8','2606:4700::1111'])assert.equal(publicIP(address),true,address);
 globalThis.__addresses=[{address:'93.184.216.34',family:4}];
 const signal=new AbortController().signal;
 const response=await f('https://model.example/v1/chat/completions',{method:'POST',body:'{"model":"mine"}',signal,headers:{Authorization:'Bearer fake-personal-key'}});
 assert.equal(await response.text(),'model response');assert.equal(__request.options.lookup,publicModelLookup);assert.equal(__request.options.agent,false);assert.equal(__request.options.signal,signal);assert.equal(__body,'{"model":"mine"}');assert.equal(__request.options.headers.authorization,'Bearer fake-personal-key');
 // DNS changes after preflight cannot reach loopback on the actual connection lookup.
 globalThis.__addresses=[{address:'127.0.0.1',family:4}];await assert.rejects(()=>f('https://model.example/v1'),/non-public/);
 globalThis.__addresses=[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}];await assert.rejects(()=>f('https://model.example/v1'),/non-public/);
 globalThis.__addresses=[{address:'93.184.216.34',family:4}];globalThis.__status=302;await assert.rejects(()=>f('https://model.example/v1'),/redirects/);
 for(const url of ['http://model.example','https://127.0.0.1','https://[::1]','https://user:secret@model.example','https://model.example:8443'])await assert.rejects(()=>f(url),/Invalid model endpoint/);
 console.log('PASS: connection-time DNS validation, private/mixed-address and rebinding rejection, redirects blocked, TLS endpoint validation, streamed responses and abort signal forwarding');
}finally{await rm(dir,{recursive:true,force:true});}
