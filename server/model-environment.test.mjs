import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-model-env-'));
try {
 await build({entryPoints:['lib/model-environment.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'env.mjs')});
 const {environmentModel:read,environmentModelKey:key}=await import(join(dir,'env.mjs'));
 assert.equal(read({}),undefined);
 const generic={AI_API_KEY:' generic-test-key ',AI_BASE_URL:'https://api.example.com/v1/',AI_MODEL:'test-model',AI_MODEL_LABEL:'My model',GLM_API_KEY:'legacy-test-key'};
 assert.deepEqual(read(generic),{id:'builtin-env',label:'My model',provider:'openai-compatible',base_url:'https://api.example.com/v1',model:'test-model',key:'generic-test-key'});
 assert.equal(key(generic,'builtin-env'),'generic-test-key');assert.equal(key(generic,'builtin-glm'),'legacy-test-key');
 assert.equal(key({AI_API_KEY:'new'},'builtin-glm'),''); // never leak the other provider's key
 assert.equal(read({...generic,AI_PROVIDER:'glm'}).provider,'glm');
 for(const env of [{AI_API_KEY:'x'},{...generic,AI_MODEL:''},{...generic,AI_BASE_URL:'http://api.example.com/v1'},{...generic,AI_BASE_URL:'https://user:password@api.example.com/v1'},{...generic,AI_BASE_URL:'https://api.example.com/v1?q=secret'}])assert.throws(()=>read(env));
 const legacy=read({GLM_API_KEY:'old-key',GLM_MODEL:'GLM-test'});assert.equal(legacy.id,'builtin-glm');assert.equal(legacy.model,'GLM-test');assert.equal(legacy.key,'old-key');
 await build({entryPoints:['server/models.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'models.mjs'),plugins:[{name:'mock',setup(b){
 b.onResolve({filter:/^\.\/database$/},()=>({path:'db',namespace:'mock'}));
 b.onResolve({filter:/^\.\/security$/},()=>({path:'security',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='db'?`export const db={prepare:()=>({get:()=>globalThis.__existing,run:(...args)=>{globalThis.__insert=args;globalThis.__existing={id:args[0]}}})};export const transaction=f=>f();`:`export const audit=()=>{};export const checkOrigin=()=>{};export const decryptKey=v=>'decrypted:'+v;export const encryptKey=v=>v;export const fail=(status,message)=>{throw Error(message)};export const requireUser=()=>({id:'test'});`,loader:'js'}));
 }}]});
 const saved={...process.env};Object.assign(process.env,generic);
 const models=await import(join(dir,'models.mjs'));models.initModels();assert.deepEqual(globalThis.__insert.slice(0,5),['builtin-env','My model','openai-compatible','https://api.example.com/v1','test-model']);
 globalThis.__insert=undefined;process.env.AI_MODEL='changed';models.initModels();assert.equal(globalThis.__insert,undefined);
 assert.equal(models.modelKey({id:'builtin-env',env_key:1}),'generic-test-key');assert.equal(models.modelKey({id:'builtin-glm',env_key:1}),'legacy-test-key');assert.equal(models.modelKey({id:'manual',env_key:0,encrypted_key:'stored'}),'decrypted:stored');
 delete globalThis.__existing;delete process.env.AI_API_KEY;models.initModels();assert.equal(globalThis.__insert[0],'builtin-glm');
 process.env=saved;
 console.log('PASS: generic bootstrap, provider selection, no overwrite, key isolation, encrypted admin keys and legacy GLM compatibility');
} finally {await rm(dir,{recursive:true,force:true});}
