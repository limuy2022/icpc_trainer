import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-checkpoints-'));
const realSet=globalThis.setTimeout,realClear=globalThis.clearTimeout;
try {
 await build({entryPoints:['lib/checkpoint-scheduler.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'scheduler.mjs')});
 const {createCheckpointScheduler}=await import(join(dir,'scheduler.mjs'));
 let clock=0,sequence=0,value='',writes=[];const timers=new Map();
 globalThis.setTimeout=(fn,delay)=>{const id=++sequence;timers.set(id,{at:clock+delay,fn});return id};globalThis.clearTimeout=id=>timers.delete(id);
 const tick=ms=>{const end=clock+ms;while(true){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=end;};
 const scheduler=createCheckpointScheduler(()=>writes.push({value,time:clock}));
 value='first';scheduler.schedule();assert.equal(writes.length,0);tick(100);value='latest';scheduler.schedule();tick(249);assert.equal(writes.length,0);tick(1);assert.equal(writes[0].value,'latest');
 writes=[];const start=clock;
 for(let i=0;i<15;i++){value='continuous-'+i;scheduler.schedule();tick(100);}
 assert.equal(writes.length,1);assert.equal(writes[0].time-start,1000);tick(150);assert.equal(writes.length,2);assert.equal(writes[1].value,'continuous-14');
 value='last character';scheduler.schedule();scheduler.flush();assert.equal(writes.at(-1).value,'last character');const flushed=writes.length;tick(2000);assert.equal(writes.length,flushed);
 scheduler.schedule();scheduler.cancel();tick(2000);assert.equal(writes.length,flushed);
 console.log('PASS: no synchronous keypress serialization, batched latest draft, bounded continuous-typing delay, immediate page-exit flush and timer cleanup');
}finally{globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear;await rm(dir,{recursive:true,force:true});}
