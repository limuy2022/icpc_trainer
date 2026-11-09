import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-difficulty-'));
try {
 await build({entryPoints:['lib/difficulty.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'difficulty.mjs')});
 const {estimatedDifficulty:get,difficultyLevels:levels}=await import(join(dir,'difficulty.mjs'));
 for(const level of levels){assert.equal(get(level.min)?.name,level.name);if(Number.isFinite(level.max))assert.equal(get(level.max)?.name,level.name);}
 for(let rating=800;rating<=3500;rating+=100)assert.ok(get(rating));
 for(const rating of [0,799,NaN,Infinity])assert.equal(get(rating),undefined);
 assert.equal(get(2300).color,'blue');assert.equal(get(2000).color,'cyan');
 console.log('PASS: eight difficulty bands, overlap boundaries, supported CF ratings and unrated values');
} finally {await rm(dir,{recursive:true,force:true});}
