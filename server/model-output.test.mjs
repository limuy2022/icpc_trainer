import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-output-'));
try {
 await build({entryPoints:['lib/model-output.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'output.mjs')});
 const {outputParameters:p}=await import(join(dir,'output.mjs'));
 assert.deepEqual(p({}),{});assert.deepEqual(p({max_output_tokens:null}),{});
 assert.deepEqual(p({max_output_tokens:65536}),{max_tokens:65536});
 assert.deepEqual(p({max_output_tokens:32768,output_token_parameter:'max_completion_tokens'}),{max_completion_tokens:32768});
 for(const max_output_tokens of [0,-1,1.1,1048577,NaN])assert.throws(()=>p({max_output_tokens}));
 assert.throws(()=>p({max_output_tokens:1024,output_token_parameter:'bad'}));
 console.log('PASS: native provider defaults, explicit total output budgets, exclusive parameter selection and invalid limit rejection');
}finally{await rm(dir,{recursive:true,force:true});}
