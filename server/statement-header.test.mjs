import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-header-'));
try {
 await build({entryPoints:['lib/statement-header.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'parser.mjs')});
 const {parseStatementHeader:parse,splitStatement,normalizeSessionStatement}=await import(join(dir,'parser.mjs'));
 const body='Mahmoud was trying to solve the vertex cover problem.\n\n## Input\n\nTwo integers.\n\n```text\n1 2\n```';
 for(const title of ['### C. Mahmoud and Ehab','C. Mahmoud and Ehab']) {
  const result=parse(`${title}\n\ntime limit per test\n\n2 seconds\n\nmemory limit per test\n\n256 megabytes\n\ninput\n\nstandard input\n\noutput\n\nstandard output\n\n${body}`);
  assert.equal(result.body,body);assert.equal(result.details.length,4);assert.equal(result.details[0].value,'2 seconds');assert.equal(result.title,'C. Mahmoud and Ehab');
 }
 const zh=parse('### 标题\n\n时间限制：2 秒\n\n内存限制：256 MB\n\n输入\n\n标准输入\n\n输出\n\n标准输出\n\n正文');
 assert.equal(zh.body,'正文');assert.equal(zh.details.length,4);
 for (const value of ['## Input\n\nRead two integers.', '### Custom title\n\nSome description.', 'time limit per test\n\n2 seconds\n\nDescription']) assert.equal(parse(value).body,value);
 const raw='### C. Test\n\n时间限制\n\n2 秒\n\n空间限制\n\n256 MB\n\n正文与约束';
 const split=splitStatement(raw);assert.equal(split.text,'正文与约束');assert.equal(split.metadata.details[1].label,'内存限制');
 const normalized=normalizeSessionStatement({statement:raw,notes:'keep notes'});assert.equal(normalized.statement,'正文与约束');assert.equal(normalized.notes,'keep notes');assert.deepEqual(normalizeSessionStatement(normalized),normalized);
 console.log('PASS: CF split/inline headers, Chinese metadata, body and sample preservation, safe unrecognized fallback');
} finally {await rm(dir,{recursive:true,force:true});}
