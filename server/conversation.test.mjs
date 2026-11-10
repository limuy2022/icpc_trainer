import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-conversation-'));
try {
 for(const file of ['conversation','training-merge'])await build({entryPoints:[`lib/${file}.ts`],bundle:true,platform:'node',format:'esm',outfile:join(dir,`${file}.mjs`)});
 const {reviseConversation:revise,matchesConversation:matches}=await import(join(dir,'conversation.mjs'));
 const {mergeTraining:merge}=await import(join(dir,'training-merge.mjs'));
 const base={id:'s',messages:[{role:'user',content:'original'},{role:'assistant',content:'old response'},{role:'user',content:'later question'},{role:'assistant',content:'later reply'}],notes:'keep',hints:4,elapsed:100,outcome:'assisted'};
 assert.ok(matches({...base,messagesVersion:''},base.messages,undefined));assert.ok(matches({...base,messages:base.messages.map(m=>({...m,extra:'ignored'}))},base.messages));assert.ok(!matches({...base,messagesVersion:'new'},base.messages));assert.ok(!matches({...base,messages:base.messages.slice(1)},base.messages));
 const edited=revise(base,0,' changed ');assert.deepEqual(edited.messages,[{role:'user',content:'changed'}]);assert.equal(edited.recoveredVersions[0].value,base.messages);assert.equal(edited.hints,4);assert.equal(edited.notes,'keep');assert.equal(edited.elapsed,100);assert.equal(base.messages.length,4);
 const recalled=revise(base,2);assert.deepEqual(recalled.messages,base.messages.slice(0,2));assert.throws(()=>revise(base,1,'invalid'));assert.throws(()=>revise(base,0,'  '));assert.throws(()=>revise(base,-1));
 const stale={...base,messages:[...base.messages,{role:'user',content:'stale tab append'}]};
 for(const [local,remote] of [[edited,stale],[stale,edited],[recalled,stale],[stale,recalled]]){const result=merge([base],[local],[remote])[0];const expected=local.messagesVersion?local:remote;assert.deepEqual(result.messages,expected.messages);assert.equal(result.hints,4);assert.ok(result.recoveredVersions.some(v=>v.field==='messages'));}
 const second=revise(edited,0,'newer');for(const pair of [[edited,second],[second,edited]])assert.deepEqual(merge([base],[pair[0]],[pair[1]])[0].messages,second.messages);
 const reply={...edited,messages:[...edited.messages,{role:'assistant',content:'new response'}]};assert.deepEqual(merge([edited],[reply],[edited])[0].messages,reply.messages);
 console.log('PASS: edit/recall suffix invalidation, archived history, unchanged hint exposure, stale-tab protection, deterministic branch conflicts and new replies');
}finally{await rm(dir,{recursive:true,force:true});}
