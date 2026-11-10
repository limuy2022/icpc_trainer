import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-i18n-'));
try {
 await build({entryPoints:['lib/i18n.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'i18n.mjs')});
 const {translate:t}=await import(join(dir,'i18n.mjs'));
 assert.equal(t('训练记录','zh-CN'),'训练记录');assert.equal(t('训练记录','en'),'Training History');
 assert.equal(t('Some user data: 我的算法','en'),'Some user data: 我的算法');
 const entries=JSON.parse(await readFile('lib/locales/en.json','utf8'));
 assert.ok(Object.keys(entries).length>=600);
 for(const [key,value] of Object.entries(entries)){
  assert.equal(typeof value,'string',key);assert.ok(value.trim(),key);
  const slots=s=>[...s.matchAll(/\{(\d+)\}/g)].map(m=>m[1]).sort();assert.deepEqual(slots(key),slots(value),key);
 }
 const template=Object.keys(entries).find(k=>k.includes('{0}'));
 assert.ok(!t(template,'en',['EXAMPLE']).includes('{0}'));
 assert.equal(t(template.replace('{0}','EXAMPLE'),'en'),t(template,'en',['EXAMPLE']));
 console.log('PASS: bilingual catalog coverage, placeholder parity, dynamic strings, Chinese preservation and user data fallback');
} finally {await rm(dir,{recursive:true,force:true});}
