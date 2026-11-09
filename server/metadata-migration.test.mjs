import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-meta-migrate-'));
try {
 const env={...process.env,DATABASE_PATH:join(dir,'test.sqlite'),MODEL_ENCRYPTION_KEY:'17'.repeat(32)};
 let result=spawnSync(process.execPath,['admin.mjs','init-admin'],{cwd:resolve('release'),env,input:JSON.stringify({username:'admin',password:'Test-Password-For-Migration-234!'}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const db=new DatabaseSync(env.DATABASE_PATH);
 const raw='### C. Test\n\ntime limit per test\n\n2 seconds\n\nmemory limit per test\n\n256 MB\n\ninput\n\nstdin\n\noutput\n\nstdout\n\nBody with constraints and samples.';
 const {id}=db.prepare('SELECT id FROM users').get();
 db.prepare("INSERT INTO training_data(user_id,payload,revision,updated_at) VALUES(?,?,7,'2026-11-09')").run(id,JSON.stringify([{id:'old',statement:raw,notes:'keep',messages:[{role:'user',content:'keep chat'}]}]));
 db.prepare('INSERT INTO statement_cache(problem_id,payload,fetched_at) VALUES(?,?,?)').run('1A',JSON.stringify({text:raw,title:'C. Test'}),'2026-11-09');
 db.prepare('DELETE FROM schema_migrations WHERE name=?').run('statement-metadata-v1');db.close();
 await build({entryPoints:['server/database.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'database.mjs')});
 for(let pass=0;pass<2;pass++) {
  result=spawnSync(process.execPath,[join(dir,'database.mjs')],{cwd:resolve('release'),env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const check=new DatabaseSync(env.DATABASE_PATH);const row=check.prepare('SELECT payload,revision FROM training_data').get();const [session]=JSON.parse(row.payload);
  assert.equal(row.revision,8);assert.equal(session.statement,'Body with constraints and samples.');assert.equal(session.statementMetadata.details.length,4);assert.equal(session.notes,'keep');assert.equal(session.messages[0].content,'keep chat');
  const cached=JSON.parse(check.prepare('SELECT payload FROM statement_cache').get().payload);assert.equal(cached.text,session.statement);assert.equal(cached.metadata.details[0].value,'2 seconds');check.close();
 }
 console.log('PASS: atomic legacy session/cache migration, separate metadata, revision bump, preserved notes/chat and idempotent restart');
}finally{await rm(dir,{recursive:true,force:true});}
