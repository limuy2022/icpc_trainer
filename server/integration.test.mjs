import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'icpc-auth-test-'));
const port=18549,base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),DATABASE_PATH:join(temp,'test.sqlite'),MODEL_ENCRYPTION_KEY:'17'.repeat(32),GLM_API_KEY:'test-seed-not-real',COOKIE_SECURE:'false',APP_ORIGIN:base};
const initial='Test-Admin-Password-284!';
const init=spawnSync(process.execPath,['admin.mjs','init-admin'],{cwd:resolve('release'),env,input:JSON.stringify({username:'admin',password:initial}),encoding:'utf8'});assert.equal(init.status,0,init.stderr);
const server=spawn(process.execPath,['server.mjs'],{cwd:resolve('release'),env,stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(path,{body,method=body?'POST':'GET',cookie='',origin=base}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.arrayBuffer(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 for(let i=0;i<40;i++){try{if((await call('/api/health')).status===200)break;}catch{}await sleep(100);}
 assert.equal((await call('/api/problems')).status,401);assert.equal((await call('/api/admin/users')).status,401);
 assert.equal((await call('/api/auth',{body:{username:'admin',password:'wrong'}})).status,401);
 let login=await call('/api/auth',{body:{username:'admin',password:initial}});assert.equal(login.status,200);let admin=login.cookie;assert.equal(login.data.user.password_hash,undefined);
 assert.equal((await call('/api/config',{cookie:admin})).status,403);
 const newPass='Updated-Admin-Password-453!';let changed=await call('/api/account',{method:'PATCH',cookie:admin,body:{currentPassword:initial,newPassword:newPass}});assert.equal(changed.status,200);const revoked=admin;admin=changed.cookie;assert.equal((await call('/api/config',{cookie:revoked})).status,401);
 assert.equal((await call('/api/admin/users',{cookie:admin,body:{username:'friend',password:'Friend-Temporary-Password-123!'}})).status,200);
 const list=await call('/api/admin/users',{cookie:admin});assert.ok(!JSON.stringify(list.data).includes('scrypt:'));const memberId=list.data.users.find(u=>u.username==='friend').id;
 login=await call('/api/auth',{body:{username:'friend',password:'Friend-Temporary-Password-123!'}});changed=await call('/api/account',{method:'PATCH',cookie:login.cookie,body:{currentPassword:'Friend-Temporary-Password-123!',newPassword:'Friend-Private-Password-123!'}});const member=changed.cookie;
 assert.equal((await call('/api/admin/users',{cookie:member})).status,403);
 assert.equal((await call('/api/admin/models',{cookie:member})).status,403);
 assert.equal((await call('/api/admin/backup',{cookie:member})).status,403);
 assert.equal((await call('/api/sessions',{cookie:admin,method:'PUT',origin:'https://evil.example',body:{sessions:[],revision:0}})).status,403);
 const record={id:'record-1',problem:{id:'1A'},messages:[],notes:'private notes',statement:'test',hints:0,elapsed:0,startedAt:null,createdAt:new Date().toISOString(),outcome:'training',takeaway:''};
 assert.equal((await call('/api/sessions',{cookie:admin,method:'PUT',body:{sessions:[record],revision:0}})).status,200);
 const retried=await call('/api/sessions',{cookie:admin,method:'PUT',body:{sessions:[record],revision:0}});assert.equal(retried.status,200);assert.equal(retried.data.revision,1);
 assert.equal((await call('/api/translate',{body:{}})).status,401);
 assert.equal((await call('/api/sessions',{cookie:admin,method:'PUT',body:{sessions:[],revision:0}})).status,409);
 assert.equal((await call('/api/sessions',{cookie:member})).data.sessions.length,0);
 assert.equal((await call('/api/sessions',{cookie:admin})).data.sessions[0].notes,'private notes');
 let result=await call('/api/admin/models',{cookie:admin,body:{label:'Test model',provider:'openai-compatible',model:'test-model',base_url:'https://api.openai.com/v1',key:'secret-test-model-key',enabled:true}});assert.equal(result.status,200,JSON.stringify(result.data));
 result=await call('/api/admin/models',{cookie:admin});assert.ok(!JSON.stringify(result.data).includes('secret-test-model-key'));assert.ok(result.data.models.some(m=>m.label==='Test model'));
 assert.equal((await call('/api/admin/models',{cookie:admin,body:{label:'bad',model:'bad',base_url:'https://127.0.0.1/v1',key:'x'}})).status,400);
 result=await call('/api/admin/backup',{cookie:admin});assert.equal(result.status,200);const binary=Buffer.from(result.data);assert.equal(binary.subarray(0,15).toString(),'SQLite format 3');assert.ok(!binary.includes(Buffer.from('secret-test-model-key')));
 assert.equal((await call('/api/admin/users',{cookie:admin,method:'PATCH',body:{id:memberId,disabled:true}})).status,200);assert.equal((await call('/api/config',{cookie:member})).status,401);
 await call('/api/auth',{cookie:admin,method:'DELETE'});assert.equal((await call('/api/config',{cookie:admin})).status,401);
 console.log('PASS: forced password change, session revocation, member/admin isolation, account disable, CSRF, concurrent-save conflict, record isolation, encrypted model keys, endpoint restrictions, backup and logout.');
}finally{server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));rmSync(temp,{recursive:true,force:true});}
