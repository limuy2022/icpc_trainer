import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-memory-'));
try{
 for(const [name,path] of [['memory','lib/learner-memory.ts'],['assistant','lib/assistant.ts']])await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',outfile:join(dir,name+'.mjs')});
 const {memoryDefaults,validateLearnerMemory:validate,memoryContext:context}=await import(join(dir,'memory.mjs'));
 const {newAssistantSession,assistantSessionTitle}=await import(join(dir,'assistant.mjs'));
 const first=newAssistantSession();first.messages.push({role:'user',content:'OLD_THREAD_ONLY'});first.notes='old notes';first.assistantProfile.topic='dsu';
 const fresh=newAssistantSession();assert.notEqual(first.id,fresh.id);assert.deepEqual(fresh.messages,[]);assert.equal(fresh.notes,'');assert.equal(fresh.assistantProfile.topic,'auto');assert.equal(assistantSessionTitle({...first,assistantTitle:'Renamed'}),'Renamed');
 const memory={...memoryDefaults(),background:'confirmed background',goal:'proofs',algorithms:Array.from({length:12},(_,i)=>({name:'algorithm-'+i,level:'learning',note:''}))};
 assert.equal(context(memory,'algorithm-10').includes('algorithm-0'),false);assert.ok(context(memory,'algorithm-10').includes('algorithm-10'));assert.ok(!context(memory,'unrelated').includes('algorithm-9'));assert.equal(context({...memory,enabled:false},'algorithm-10'),'');assert.equal(context(memoryDefaults(),'question'),'');
 const cleaned=validate({...memory,secret:'not forwarded'});assert.equal(cleaned.secret,undefined);
 for(const value of [{...memory,algorithms:[{name:'x',level:'expert',note:''}]},{...memory,background:'x'.repeat(1501)},{...memory,algorithms:[{name:'DP',level:'learning',note:''},{name:'dp',level:'explain',note:''}]}])assert.throws(()=>validate(value));
 console.log('PASS: unique empty assistant sessions, fresh topic context, explicit titles, bounded relevant self-reported memory, per-account document validation, disabling and duplicate/invalid-entry rejection');
}finally{await rm(dir,{recursive:true,force:true});}
