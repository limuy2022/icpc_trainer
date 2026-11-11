import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-assistant-'));
try {
 await build({entryPoints:['server/assistant-knowledge.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'knowledge.mjs'),plugins:[{name:'bank',setup(b){b.onResolve({filter:/\.\/problems$/},()=>({path:'bank',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export async function problems(request){globalThis.__query=new URL(request.url);return Response.json({items:[{id:'1A',contestId:1,index:'A',name:'Verified fixture',rating:1500}]});}`,loader:'js'}));}}]});
 const {assistantKnowledge:k}=await import(join(dir,'knowledge.mjs'));let calls=0;
 globalThis.fetch=async(url)=>{calls++;assert.ok(url.startsWith('https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/'));return new Response('## Verified knowledge fixture\nUnion and find operations.');};
 let result=await k('并查集','auto',true,1600);assert.equal(result.sources.length,2);assert.equal(result.sources[0].url,'https://oi-wiki.org/ds/dsu/');assert.ok(result.context.includes('Verified knowledge fixture'));assert.equal(__query.searchParams.get('min'),'1500');assert.equal(__query.searchParams.get('max'),'1900');
 await k('推荐练习\0并查集','auto',false,1600);assert.equal(calls,1);
 result=await k('unmatched','https://evil.example',false,null);assert.equal(result.sources.length,0);assert.equal(calls,1);
 let requested;
 globalThis.fetch=async(url)=>{requested=url;return new Response('Verified chapter reference.');};
 result=await k('并查集','wiki-basic_index',false,null);
 assert.ok(requested.endsWith('/docs/basic/index.md'));
 assert.equal(result.sources[0].url,'https://oi-wiki.org/basic/');
 globalThis.fetch=async()=>new Response('',{status:404});result=await k('二分','auto',false,null);assert.deepEqual(result.sources,[]);assert.ok(result.context.includes('未取得'));
 console.log('PASS: fixed-source retrieval, actual-source attribution, cached OI Wiki content, conversation topic fallback, rating-based CF candidates, unavailable-source honesty and arbitrary URL rejection');
}finally{await rm(dir,{recursive:true,force:true});}
