import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-rating-'));
try {
 await build({entryPoints:['lib/rating-range.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'range.mjs')});
 const {ratingRange:range,difficultyOptions:options}=await import(join(dir,'range.mjs'));
 assert.deepEqual(range(1600),{min:1500,max:1900});assert.deepEqual(range(1678),{min:1578,max:1978});
 assert.deepEqual(range(null),{min:1400,max:1800});assert.deepEqual(range(),range(null));assert.deepEqual(range(0),{min:800,max:800});assert.deepEqual(range(800),{min:800,max:1100});assert.deepEqual(range(3500),{min:3400,max:3500});assert.deepEqual(range(5000),{min:3500,max:3500});
 assert.ok(options(1578).includes(1578));assert.ok(options(1978).includes(1978));assert.equal(options(1500).filter(v=>v===1500).length,1);assert.deepEqual(options(1578),options(1578).toSorted((a,b)=>a-b));
 console.log('PASS: rating offsets, exact non-hundred values, clipping, empty defaults and selectable bounds');
}finally{await rm(dir,{recursive:true,force:true});}
