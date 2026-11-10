import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-request-usage-'));
try {
 // Expose mock log rows through a second bundled entry in the same module.
 await build({stdin:{contents:`export { requestModel } from '${process.cwd()}/server/model-request.ts';export { rows } from './database';`,resolveDir:process.cwd()+'/server'},bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'mock-db',setup(b){b.onResolve({filter:/^\.\/database$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export const rows=[];export const db={prepare:()=>({run:(...args)=>rows.push(args)})};`,loader:'js'}));}}]});
 const {requestModel,rows}=await import(join(dir,'test.mjs'));
 const model={id:'id',model:'fixture-model'};
 const call=()=>requestModel('user',model,'coach','https://example.com',{});
 globalThis.fetch=async()=>Response.json({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:35}});
 await call();assert.equal(rows.length,1);assert.deepEqual([rows[0][3],rows[0][4],rows[0][8],rows[0][9]],[10,20,35,1]);
 globalThis.fetch=async()=>Response.json({choices:[]});await call();assert.equal(rows[1][9],0);
 globalThis.fetch=async()=>Response.json({usage:{total_tokens:7}});await call();assert.equal(rows[2][8],7);assert.equal(rows[2][9],0);
 globalThis.fetch=async()=>new Response('denied',{status:429});await call();assert.equal(rows[3][2],429);
 globalThis.fetch=async()=>{throw Error('timeout')};await assert.rejects(call());assert.equal(rows[4][2],0);
 globalThis.fetch=async()=>new Response('invalid json');await assert.rejects(call());assert.equal(rows[5][2],200);assert.equal(rows[5][9],0);
 globalThis.fetch=async()=>Response.json({usage:{prompt_tokens:0,completion_tokens:0}});await call();assert.equal(rows[6][9],1);
 assert.ok(rows.every(row=>typeof row[10]==='string'&&row[10].length===36&&Number.isInteger(row[11])));assert.equal(rows[3][12],'upstream_http_429');assert.equal(rows[4][12],'network_error');assert.equal(rows[5][12],'invalid_json');
 assert.equal(rows.length,7);assert.ok(rows.every(row=>row[0]==='user'&&row[6]==='coach'&&row[7]==='fixture-model'));
 console.log('PASS: one log per real attempt, reported total preserved, unknown/partial/zero usage, HTTP/network/JSON failures');
}finally{await rm(dir,{recursive:true,force:true});}
