import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-ai-body-'));
const header='### C. Test\n\ntime limit per test\n\n2 seconds\n\nmemory limit per test\n\n256 megabytes\n\ninput\n\nstandard input\n\noutput\n\nstandard output\n\n';
const body='Given an array of n integers, find the maximum sum of a contiguous subarray.\n\n## Input\n\nAn integer n, with 1 <= n <= 100000.\n\n## Output\n\nPrint the sum.\n\n```text\n3\n1 2 3\n```';
try {
 for(const name of ['translate','coach']) {
  await build({entryPoints:[`server/${name}.ts`],bundle:true,platform:'node',format:'esm',outfile:join(dir,`${name}.mjs`),plugins:[{name:'mock-infrastructure',setup(b){
   b.onResolve({filter:/^\.\/editorials$/},()=>({path:'editorials',namespace:'mock'}));
   b.onResolve({filter:/^\.\/database$/},()=>({path:'db',namespace:'mock'}));
   b.onResolve({filter:/^\.\/security$/},()=>({path:'security',namespace:'mock'}));
   b.onResolve({filter:/^\.\/models$/},()=>({path:'models',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='editorials'?`export const getEditorial=async()=>({text:'OFFICIAL_REFERENCE_FIXTURE: verified boundary and invariant.',url:'https://codeforces.com/blog/entry/1',fetchedAt:'2026-11-10T00:00:00Z'});`:a.path==='db'?`export const db={prepare:()=>({get:()=>undefined,all:()=>[],run:()=>({})})};export const transaction=fn=>fn();`:a.path==='security'?`export class HttpError extends Error {} export const checkOrigin=()=>{};export const requireUser=()=>({id:'test'});export const fail=(status,message)=>{throw Error(message)};`:`export const selectModel=()=>({id:'mock',model:'GLM-5.3',provider:'glm',base_url:'https://example.com/v1'});export const modelKey=()=> 'not-real';export const validateEndpoint=async()=>{};`,loader:'js'}));
  }}]});
  const mod=await import(join(dir,`${name}.mjs`));let sent,signal;
  globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);signal=options.signal;const source=sent.messages.at(-1).content;return Response.json({choices:[{message:{content:name==='translate'?source:'这是一个用于验证正文请求的测试回复。',reasoning_content:'模型返回的推理'},finish_reason:'stop'}]});};
  const response=await (mod.translate||mod.POST)(new Request('http://localhost/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:header+body,statement:header+body,problemId:'1A',problem:'1A',messages:[],reasoningEffort:'high',mode:'visualize'})}));
  assert.equal(response.status,200);assert.equal(sent.max_tokens,undefined);assert.equal(sent.max_completion_tokens,undefined);assert.equal(sent.thinking.type,"enabled");assert.equal(sent.reasoning_effort,"high");
  if(name==='coach'){const system=sent.messages.find(m=>m.role==='system').content;assert.ok(system.includes('交互式图示讲解能力'));assert.ok(system.includes('用户请求用交互图示解释当前卡点'));assert.ok(system.includes('icpc-visual'));assert.ok(sent.messages.some(m=>m.content.includes('OFFICIAL_REFERENCE_FIXTURE')));assert.ok(system.includes('不要因看到完整题解而提前泄露'));assert.ok(system.includes('数学排版要求'));assert.ok(system.includes('$a_i$'));assert.ok(system.includes('\\sum_{i=l}^{r}'));assert.ok(!system.includes('\\\\sum'));assert.ok(system.includes('$$\n'));}
  const userPrompt=sent.messages.filter(m=>m.role==='user').map(m=>m.content).join('\n');
  for(const excluded of ['time limit per test','memory limit per test','standard input','standard output','256 megabytes','C. Test'])assert.ok(!userPrompt.includes(excluded),excluded);
  assert.ok(userPrompt.includes('## Input'));assert.ok(userPrompt.includes('100000'));
  if(name==='coach'){const result=await response.json();assert.equal(result.reasoning,'模型返回的推理');assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,false);}
  if(name==='coach'){
   const request=signal=>new Request('http://localhost/api/coach',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({statement:header+body,problemId:'1A',messages:[],stream:true})});
   const timeout=AbortSignal.timeout;
   try {
    AbortSignal.timeout=()=>{throw Error('Coaching must not install a generation deadline');};
    const live=await mod.POST(request());const events=(await live.text()).trim().split('\n').map(JSON.parse);
    assert.equal(events.find(e=>e.type==='reasoning').text,'模型返回的推理');
    assert.equal(events.find(e=>e.type==='done').reasoning,'模型返回的推理');
    let upstreamSignal;
    globalThis.fetch=async(url,options)=>{upstreamSignal=options.signal;await new Promise((_,reject)=>{if(upstreamSignal.aborted)reject(upstreamSignal.reason);else upstreamSignal.addEventListener('abort',()=>reject(upstreamSignal.reason),{once:true});});};
    const cancel=new AbortController();const response=await mod.POST(request(cancel.signal));cancel.abort();
    const cancelled=await response.text();assert.equal(upstreamSignal.aborted,true);assert.ok(!cancelled.includes('"type":"done"'));
   }finally{AbortSignal.timeout=timeout;}
  }
  if(name==='coach'){
   globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return Response.json({choices:[{message:{content:'自由算法问题的回答。'},finish_reason:'stop'}]});};
   const response=await mod.POST(new Request('http://localhost/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assistant:true,messages:[{role:'user',content:'Explain a simple loop.'}],assistantProfile:{style:'auto',known:'basic loops',goal:'understand proofs'}})}));
   assert.equal(response.status,200);const answer=await response.json();assert.deepEqual(answer.sources,[]);assert.ok(sent.messages[0].content.includes('不要要求用户先提供竞赛题'));assert.ok(sent.messages[0].content.includes('basic loops'));assert.ok(!sent.messages.some(m=>m.content.includes('OFFICIAL_REFERENCE_FIXTURE')));
  }
  if(name==='coach'){
   globalThis.fetch=async()=>{throw Error('prepare-only must never call an upstream model');};
   const response=await mod.POST(new Request('http://localhost/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prepareOnly:true,browserModel:{model:'browser-glm',provider:'glm',key:'NEVER_ECHO_THIS'},statement:header+body,problemId:'1A',messages:[],reasoningEffort:'on'})}));
   assert.equal(response.status,200);const result=await response.json();assert.ok(!JSON.stringify(result).includes('NEVER_ECHO_THIS'));assert.ok(result.payload.messages.some(m=>m.content.includes('OFFICIAL_REFERENCE_FIXTURE')));assert.equal(result.payload.thinking.type,'enabled');
  }
  if(name==='coach'){
   globalThis.fetch=async(url)=>{assert.ok(url.startsWith('https://raw.githubusercontent.com/'));return new Response('## Verified DSU reference. Union and find operations.');};
   const request=lesson=>new Request('http://localhost/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prepareOnly:true,browserModel:{model:'browser-model',provider:'openai-compatible'},assistant:true,lesson,messages:[{role:'user',content:'Teach this stage.'}]})});
   const response=await mod.POST(request({topicId:'dsu',stage:'quiz'}));assert.equal(response.status,200);const prepared=await response.json();assert.equal(prepared.lesson.stage,'quiz');assert.equal(prepared.lesson.topicId,'dsu');assert.ok(prepared.payload.messages[0].content.includes('等待用户回答'));assert.ok(prepared.payload.messages[0].content.includes('不要把自评'));assert.equal((await mod.POST(request({topicId:'dsu',stage:'invented'}))).status,400);
  }
  if(name==='translate'){const result=await response.json();assert.ok(result.text.includes('3\n1 2 3'));}
 }
 console.log('PASS: translation and coaching send body only; constraints, Input/Output sections and samples preserved');
}finally{await rm(dir,{recursive:true,force:true});}
