import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-translation-reuse-'));
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE statement_translations(cache_key TEXT PRIMARY KEY,problem_id TEXT,model_id TEXT,translation TEXT,created_at TEXT,source_hash TEXT,model_name TEXT);CREATE TABLE models(id TEXT,model TEXT,base_url TEXT,provider TEXT)');
const configs=[{id:'a',model:'model-a',base_url:'https://a.example/v1',provider:'openai-compatible'},{id:'b',model:'model-b',base_url:'https://b.example/v1',provider:'openai-compatible'}];
for(const m of configs)db.prepare('INSERT INTO models VALUES(?,?,?,?)').run(m.id,m.model,m.base_url,m.provider);
globalThis.__translationDb=db;globalThis.__models=configs;globalThis.__calls=[];
const text='Given an array of positive integers, find the longest subarray whose sum is at most K.\n\nInput contains $n$ integers.\n\n```text\n3 4\n1 2 3\n```';
try {
 await build({entryPoints:['server/translate.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'translate.mjs'),plugins:[{name:'mocks',setup(b){
 for(const name of ['database','models','model-preferences','security','model-request'])b.onResolve({filter:new RegExp('^\\./'+name+'$')},()=>({path:name,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='database'?`export const db=globalThis.__translationDb;`:a.path==='models'?`export const selectModel=id=>globalThis.__models.find(m=>m.id===id)||globalThis.__models[0];export const validateEndpoint=async()=>{};export const modelKey=()=> 'test-only';`:a.path==='model-preferences'?`export const selectedReasoning=(u,m,v)=>v||'default';`:a.path==='security'?`export const requireUser=()=>({id:'user'});export const fail=(s,m)=>{throw Object.assign(Error(m),{status:s})};`:`export async function requestModel(user,model,kind,url,init){globalThis.__calls.push(model.id);await new Promise(r=>setTimeout(r,2));const body=JSON.parse(init.body);return {response:Response.json({}),data:{choices:[{message:{content:'译文 '+model.model+'：'+body.messages.at(-1).content},finish_reason:'stop'}]}}}`,loader:'js'}));
 }}]});
 const {translate}=await import(join(dir,'translate.mjs'));
 const call=async(extra={})=>{const response=await translate(new Request('https://trainer.example/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({problemId:'1A',text,modelId:'a',...extra})}));assert.equal(response.status,200);return response.json()};
 const first=await call();assert.equal(first.model,'model-a');assert.equal(__calls.length,1);
 const switched=await call({modelId:'b',reasoningEffort:'high'});assert.equal(switched.text,first.text);assert.equal(switched.model,'model-a');assert.equal(switched.cached,true);assert.equal(__calls.length,1);
 assert.equal((await call({text:'\n'+text.replace(/\n/g,'\r\n')+'\n',modelId:'b'})).text,first.text);assert.equal(__calls.length,1);
 const fresh=await call({modelId:'b',reasoningEffort:'high',forceRefresh:true});assert.equal(fresh.model,'model-b');assert.equal(__calls.length,2);assert.equal((await call()).model,'model-b');assert.equal(__calls.length,2);
 await call({text:text+'\nChanged constraints.'});assert.equal(__calls.length,3);
 const before=__calls.length;const parallel=await Promise.all([call({problemId:'2A'}),call({problemId:'2A',modelId:'b',reasoningEffort:'high'})]);assert.equal(__calls.length,before+1);assert.equal(parallel[0].text,parallel[1].text);assert.equal((await call()).text,fresh.text);assert.equal(__calls.length,before+1);
 db.exec('DELETE FROM statement_translations');const legacy=createHash('sha256').update(JSON.stringify(['body-only-v3',text,'a','model-a','https://a.example/v1','default'])).digest('hex');db.prepare('INSERT INTO statement_translations(cache_key,problem_id,model_id,translation,created_at) VALUES(?,?,?,?,?)').run(legacy,'1A','a','原来的有效译文','2026-11-09T00:00:00Z');
 const oldCalls=__calls.length;const migrated=await call({modelId:'b',reasoningEffort:'high'});assert.equal(migrated.text,'原来的有效译文');assert.equal(migrated.model,'model-a');assert.equal(__calls.length,oldCalls);assert.ok(db.prepare('SELECT source_hash FROM statement_translations WHERE cache_key=?').get(legacy).source_hash);
 await call({text:text+'\nOther body.'});assert.equal(__calls.length,oldCalls+1);
 console.log('PASS: model/reasoning switches reuse translations, accurate source attribution, normalized bodies, explicit retranslation, changed-body invalidation, concurrent cross-model deduplication, problem isolation and exact-match legacy cache adoption');
}finally{db.close();delete globalThis.__translationDb;delete globalThis.__models;delete globalThis.__calls;await rm(dir,{recursive:true,force:true});}
