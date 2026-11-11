import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-lessons-'));
try {
 for(const [name,path] of [['lessons','lib/lessons.ts'],['merge','lib/training-merge.ts'],['jobs','lib/coach-job.ts']])await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',outfile:join(dir,name+'.mjs')});
 const {lessonCatalog,lessonChapters,lessonStages,lessonDefinition,newLessonSession,completeLessonStage,isLessonMastered,setLessonMastered}=await import(join(dir,'lessons.mjs'));
 const {mergeTraining}=await import(join(dir,'merge.mjs'));const {applyJobReply}=await import(join(dir,'jobs.mjs'));
 assert.equal(lessonCatalog.length,365);assert.equal(lessonChapters.length,10);
 assert.equal(new Set(lessonCatalog.map(t=>t.id)).size,lessonCatalog.length);
 assert.equal(new Set(lessonCatalog.map(t=>t.path)).size,lessonCatalog.length);
 assert.equal(lessonCatalog.find(t=>t.path==='misc/mo-algo-secondary-offline').name,'莫队二次离线');
 for(const id of ['fenwick','hld','max-flow','persistent-seg','dsu','binary-search','greedy','dp','seg','shortest','prefix','kmp'])assert.ok(lessonCatalog.find(topic=>topic.id===id));
 assert.equal(lessonStages.length,7);assert.ok(lessonStages.find(s=>s.id==='quiz').instruction.includes('不提前泄露答案'));
 const first=newLessonSession('dsu',{known:'arrays',style:'auto',topic:'auto',goal:'regional'});assert.equal(first.kind,'assistant');assert.equal(first.assistantProfile.known,'arrays');assert.equal(first.lesson.mastery,'learning');assert.notEqual(first.id,newLessonSession('dp').id);
 assert.equal(lessonDefinition({topicId:'invented',stage:'quiz'}),undefined);assert.equal(lessonDefinition({topicId:'dsu',stage:'invented'}),undefined);assert.throws(()=>newLessonSession('invented'));
 let session=first;for(const stage of lessonStages){assert.equal(session.lesson.stage,stage.id);session=completeLessonStage(session);}assert.equal(session.lesson.completed.length,7);assert.equal(session.lesson.mastery,'learning');assert.equal(completeLessonStage(session).lesson.completed.length,7);
 const stored=JSON.parse(JSON.stringify(session));assert.deepEqual(stored.lesson,session.lesson);
 const local={...first,lesson:{...first.lesson,stage:'algorithm',completed:['prerequisites']}};
 const remote={...first,lesson:{...first.lesson,stage:'proof',completed:['intuition']}};
 const merged=mergeTraining([first],[local],[remote])[0];assert.deepEqual(new Set(merged.lesson.completed),new Set(['prerequisites','intuition']));
 const [newlyMastered]=setLessonMastered([],'wiki-misc_mo-algo-secondary-offline',true);
 assert.ok(isLessonMastered(newlyMastered.lesson));assert.deepEqual(newlyMastered.messages,[]);assert.deepEqual(newlyMastered.lesson.completed,[]);
 assert.ok(isLessonMastered({...first.lesson,mastery:'implement'}));
 const [marked]=setLessonMastered([first],'dsu',true);
 for(const [left,right] of [[marked,local],[local,marked]]){
  const [combined]=mergeTraining([first],[left],[right]);
  assert.ok(isLessonMastered(combined.lesson));assert.equal(combined.lesson.stage,'algorithm');
  const [unmarked]=setLessonMastered([combined],'dsu',false);
  assert.equal(isLessonMastered(unmarked.lesson),false);assert.deepEqual(unmarked.lesson.completed,['prerequisites']);
 }
 const job={id:'lesson-reply',sessionId:first.id,status:'done',text:'explanation',reasoning:'',branchHash:'x',createdAt:'now',result:{text:'explanation',lesson:{topicId:'dsu',stage:'prerequisites'}}};
 assert.equal(applyJobReply(first,job,true).messages[0].lessonStage,'prerequisites');
 console.log('PASS: independent topic sessions, canonical stages, explicit self-assessment, idempotent progress, persisted state, concurrent progress union and correct reply-stage attribution');
}finally{await rm(dir,{recursive:true,force:true});}
