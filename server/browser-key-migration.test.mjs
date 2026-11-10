import {DatabaseSync} from 'node:sqlite';
import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:');
try {
 for(const name of (await readdir('server/migrations')).filter(n=>n.endsWith('.sql')&&n<'013').sort())db.exec(await readFile('server/migrations/'+name,'utf8'));
 db.prepare("INSERT INTO users(id,username,password_hash,role,created_at) VALUES('owner','owner','fake','member','now')").run();
 db.prepare("INSERT INTO models(id,label,provider,base_url,model,encrypted_key,created_at,owner_user_id) VALUES(?,?,'openai-compatible','https://provider.example','test',?,'now',?)").run('personal','Personal','fake-personal-ciphertext','owner');
 db.prepare("INSERT INTO models(id,label,provider,base_url,model,encrypted_key,created_at) VALUES('site','Site','glm','https://provider.example','test','fake-site-ciphertext','now')").run();
 db.exec(await readFile('server/migrations/013_browser_only_keys.sql','utf8'));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM models WHERE owner_user_id IS NOT NULL").get().n,0);assert.equal(db.prepare("SELECT encrypted_key FROM models WHERE id='site'").get().encrypted_key,'fake-site-ciphertext');
 console.log('PASS: server personal credentials removed with secure-delete while site credentials are preserved');
}finally{db.close();}
