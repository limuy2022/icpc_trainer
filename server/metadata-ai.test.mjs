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
   b.onResolve({filter:/^\.\/database$/},()=>({path:'db',namespace:'mock'}));
   b.onResolve({filter:/^\.\/security$/},()=>({path:'security',namespace:'mock'}));
   b.onResolve({filter:/^\.\/models$/},()=>({path:'models',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='db'?`export const db={prepare:()=>({get:()=>undefined,run:()=>({})})};`:a.path==='security'?`export const requireUser=()=>({id:'test'});export const fail=(status,message)=>{throw Error(message)};`:`export const selectModel=()=>({id:'mock',model:'mock',base_url:'https://example.com/v1'});export const modelKey=()=> 'not-real';export const validateEndpoint=async()=>{};`,loader:'js'}));
  }}]});
  const mod=await import(join(dir,`${name}.mjs`));let sent;
  globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);const source=sent.messages.at(-1).content;return Response.json({choices:[{message:{content:name==='translate'?source:'这是一个用于验证正文请求的测试回复。'},finish_reason:'stop'}]});};
  const response=await (mod.translate||mod.POST)(new Request('http://localhost/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:header+body,statement:header+body,problemId:'1A',problem:'1A',messages:[]})}));
  assert.equal(response.status,200);
  if(name==='coach'){const system=sent.messages.find(m=>m.role==='system').content;assert.ok(system.includes('数学排版要求'));assert.ok(system.includes('$a_i$'));assert.ok(system.includes('\\sum_{i=l}^{r}'));assert.ok(!system.includes('\\\\sum'));assert.ok(system.includes('$$\n'));}
  const userPrompt=sent.messages.filter(m=>m.role==='user').map(m=>m.content).join('\n');
  for(const excluded of ['time limit per test','memory limit per test','standard input','standard output','256 megabytes','C. Test'])assert.ok(!userPrompt.includes(excluded),excluded);
  assert.ok(userPrompt.includes('## Input'));assert.ok(userPrompt.includes('100000'));
  if(name==='translate'){const result=await response.json();assert.ok(result.text.includes('3\n1 2 3'));}
 }
 console.log('PASS: translation and coaching send body only; constraints, Input/Output sections and samples preserved');
}finally{await rm(dir,{recursive:true,force:true});}
