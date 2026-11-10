import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-editorial-'));
const paragraph='The invariant is maintained after each operation; handle the smallest input separately and prove necessity and sufficiency.';
const article=`<div><h3><a href="/contest/123/problem/B">123B - previous</a></h3><p>PREVIOUS_SOLUTION</p><h3><a href="/contest/123/problem/C">123C - target</a></h3><p>${paragraph}</p><p>For comparison, <a href="/contest/123/problem/B">previous problem</a> uses a different invariant.</p><pre>for (int i=0; i&lt;n; ++i) solve();</pre><script>UNTRUSTED_SCRIPT</script><h3><a href="/contest/123/problem/D">123D - next</a></h3><p>NEXT_SOLUTION</p></div>`;
const page='<div class="sidebox"><div class="caption">Contest materials</div><a href="/blog/entry/77">Tutorial (en)</a><a href="https://evil.example/blog/entry/78">Tutorial (en)</a><a href="/blog/entry/79">Announcement</a></div><a href="/blog/entry/80">Tutorial unrelated</a>';
try {
 await build({entryPoints:['lib/editorials.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'parse.mjs')});
 const {tutorialLinks,editorialSection}=await import(join(dir,'parse.mjs'));
 assert.deepEqual(tutorialLinks(page),['https://codeforces.com/blog/entry/77']);
 const section=editorialSection(article,'123','C');assert.ok(section.includes(paragraph));assert.ok(section.includes('for (int i=0; i<n; ++i)'));for(const other of ['PREVIOUS_SOLUTION','NEXT_SOLUTION','UNTRUSTED_SCRIPT'])assert.ok(!section.includes(other));
 assert.throws(()=>editorialSection(article,'124','C'));assert.throws(()=>editorialSection('<p>'+paragraph+'</p>','123','C'));
 assert.ok(editorialSection('<h3>123C - target</h3><p>'+paragraph+'</p><h3>123D - next</h3><p>NEXT</p>','123','C').includes(paragraph));
 await build({entryPoints:['server/editorials.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'cache.mjs'),plugins:[{name:'db',setup(b){b.onResolve({filter:/^\.\/database$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const db={prepare:()=>({get:id=>globalThis.__rows.get(id),run:(id,payload,fetched_at)=>globalThis.__rows.set(id,{payload,fetched_at})})};`,loader:'js'}));}}]});
 globalThis.__rows=new Map();let calls=0;
 globalThis.fetch=async url=>{calls++;if(String(url).includes('problemset/problem'))return new Response('',{status:403});if(String(url).includes('codewithsathya'))return new Response(page);return Response.json({status:'OK',result:{id:77,content:article}});};
 const {getEditorial}=await import(join(dir,'cache.mjs'));
 const result=await getEditorial('123','C');assert.ok(result.text.includes(paragraph));assert.equal(result.url,'https://codeforces.com/blog/entry/77');assert.ok(result.discoveryUrl.includes('codewithsathya'));assert.equal(calls,3);
 await getEditorial('123','C');assert.equal(calls,3);
 await assert.rejects(()=>getEditorial('123','DONTMATCH')); // invalid ID
 await assert.rejects(()=>getEditorial('123','A'));const afterFailure=calls;await assert.rejects(()=>getEditorial('123','A'));assert.equal(calls,afterFailure);
 __rows.set('123C',{payload:JSON.stringify(result),fetched_at:'2000-01-01'});globalThis.fetch=async()=>new Response('',{status:503});assert.equal((await getEditorial('123','C')).stale,true);
 await build({entryPoints:['server/coach.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'coach.mjs'),plugins:[{name:'coach-mocks',setup(b){
 for(const name of ['database','security','models','editorials'])b.onResolve({filter:new RegExp('^\\./'+name+'$')},()=>({path:name,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='database'?`export const db={prepare:()=>({get:()=>undefined,run:()=>{}})};export const transaction=f=>f();`:a.path==='security'?`export const checkOrigin=()=>{};export const requireUser=()=>({id:'test'});export const fail=(s,m)=>{throw Error(m)};`:a.path==='models'?`export const selectModel=()=>({id:'model',model:'generic-model',provider:'openai-compatible',base_url:'https://model.example/v1'});export const validateEndpoint=async()=>{};export const modelKey=()=> 'fake-key';`:`export const getEditorial=async()=>{if(globalThis.__missing)throw Error('missing');return globalThis.__editorial};`,loader:'js'}));
 }}]});
 const {POST}=await import(join(dir,'coach.mjs'));globalThis.__editorial=result;let sent;calls=0;
 globalThis.fetch=async(url,options)=>{calls++;sent=JSON.parse(options.body);return Response.json({choices:[{message:{content:'讨论当前观察。'}}]});};
 const request=(extra={})=>new Request('https://trainer.example/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({problemId:'123C',statement:paragraph,messages:[{role:'user',content:'My conjecture'}],mode:'hint1',...extra})});
 let response=await POST(request());assert.equal(response.status,200);let data=await response.json();assert.equal(data.editorial.status,'ready');assert.ok(sent.messages.some(m=>m.content.includes(result.text)));assert.ok(sent.messages[0].content.includes('只给一个观察方向'));assert.ok(!JSON.stringify(data).includes(paragraph));
 response=await POST(request({language:'en'}));assert.equal(response.status,200);assert.ok(sent.messages[0].content.includes('Response language: English.'));assert.ok(sent.messages[0].content.includes('使用英文'));assert.ok(!sent.messages[0].content.includes('使用中文'));
 response=await POST(request({stream:true}));assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes('ndjson'));const chunks=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(chunks[0].type,'status');assert.ok(chunks.some(c=>c.type==='delta'));assert.equal(chunks.at(-1).type,'done');assert.equal(chunks.at(-1).text,'讨论当前观察。');
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'partial'},finish_reason:'length'}]});response=await POST(request({stream:true}));const failed=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.equal(failed.at(-1).type,'error');assert.ok(failed.at(-1).error.includes('达到上限'));assert.ok(!failed.some(c=>c.type==='done'));
 globalThis.fetch=async(url,options)=>{calls++;sent=JSON.parse(options.body);return Response.json({choices:[{message:{content:'讨论当前观察。'}}]});};
 globalThis.__missing=true;calls=0;response=await POST(request());assert.equal(response.status,503);assert.equal(calls,0);assert.equal((await response.json()).editorial.status,'unavailable');
 response=await POST(request({allowUnverified:'true'}));assert.equal(response.status,503);assert.equal(calls,0);
 response=await POST(request({allowUnverified:true}));assert.equal(response.status,200);assert.equal(calls,1);assert.equal((await response.json()).editorial.status,'unavailable');assert.ok(sent.messages.some(m=>m.content.includes('本次未获取到官方题解')));
 assert.equal((await POST(request({problemId:'invalid'}))).status,400);
 console.log('PASS: material-link provenance, exact section boundaries, source filtering, cache/failure cooldown/stale fallback, reference injection, no spoilers in metadata, fail-closed and explicit unverified override');
} finally {await rm(dir,{recursive:true,force:true});}
