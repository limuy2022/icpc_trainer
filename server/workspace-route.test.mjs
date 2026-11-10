import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-route-'));
try {
 await build({entryPoints:['lib/workspace-route.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'route.mjs')});
 const {normalizeRoute,parseWorkspaceHash:parse,workspaceHash:hash}=await import(join(dir,'route.mjs'));
 for(const view of ['bank','training','history','statistics','admin']) {
  const route={view,current:'saved-session'};assert.deepEqual(parse(hash(route),true,route),route);
 }
 assert.deepEqual(parse('#/training/session%20with%2Fsymbols',false),{view:'training',current:'session with/symbols'});
 assert.deepEqual(parse('#/training/%XX',false),{view:'training',current:null});
 for(const invalid of ['#/unknown','#/history/unexpected','#/training/','javascript:alert(1)'])assert.equal(parse(invalid,true).view,'bank');
 assert.equal(parse('#/admin',false).view,'bank');assert.equal(normalizeRoute({view:'admin'},false).view,'bank');
 assert.deepEqual(normalizeRoute(null,true),{view:'bank',current:null});
 assert.equal(normalizeRoute({view:'training',current:'x'.repeat(201)},true).current,null);
 assert.equal(parse('#/statistics',false,{view:'training',current:'last-session'}).current,'last-session');
 assert.equal(hash({view:'history',current:'private/session'}),'#/history');
 console.log('PASS: route round trips, deep training links, retained current selection, malformed URLs, bounded IDs and admin restrictions');
}finally{await rm(dir,{recursive:true,force:true});}
