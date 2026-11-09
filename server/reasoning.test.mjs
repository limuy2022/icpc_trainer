import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-reasoning-'));
try {
 await build({entryPoints:['lib/reasoning.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'reasoning.mjs')});
 const {reasoningParameters:p,reasoningOptions:o}=await import(join(dir,'reasoning.mjs'));
 const glm={provider:'glm',model:'GLM-5.3'};
 assert.deepEqual(o(glm).map(v=>v.value),['default','low','high','max']);
 for(const level of ['low','high','max'])assert.deepEqual(p(glm,level),{thinking:{type:'enabled'},reasoning_effort:level});
 assert.deepEqual(p(glm,'default'),{thinking:{type:'enabled'}});assert.throws(()=>p(glm,'off'));assert.throws(()=>p(glm,'medium'));
 assert.deepEqual(p({provider:'openai-compatible',model:'z-ai/glm-5.3-flash'},'high'),{thinking:{type:'enabled'},reasoning_effort:'high'});
 assert.deepEqual(p({model:'GLM-5.2'},'off'),{thinking:{type:'disabled'}});assert.deepEqual(p({model:'GLM-5.2'},'max'),{thinking:{type:'enabled'},reasoning_effort:'max'});
 assert.deepEqual(p({model:'GLM-4.7'},'on'),{thinking:{type:'enabled'}});assert.throws(()=>p({model:'GLM-4.7'},'low'));
 assert.deepEqual(p({model:'custom'},'default'),{});assert.deepEqual(p({model:'custom'},'medium'),{reasoning_effort:'medium'});assert.throws(()=>p({model:'custom'},'max'));
 console.log('PASS: model-specific reasoning levels, always-on GLM-5.3, legacy GLM switches, compatibility parameters and invalid-level rejection');
}finally{await rm(dir,{recursive:true,force:true});}
