import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-time-trend-'));
try{
 await build({entryPoints:['lib/time-trend.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'trend.mjs')});
 await build({entryPoints:['lib/training-stats.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'stats.mjs')});
 const {trainingStats}=await import(join(dir,'stats.mjs'));assert.equal(trainingStats([{kind:'assistant',messages:[],elapsed:10,outcome:'independent',problem:{id:'assistant'}}]).sessions,0);
 const {trainingTrend,selectTrend,trendSummary,trendChartData,median}=await import(join(dir,'trend.mjs'));
 const make=(id,seconds,rating=1600,outcome='independent')=>({id,problem:{id,name:id,rating},elapsed:seconds,outcome,createdAt:`2026-10-${String(10+Number(id.replace(/\D/g,''))).padStart(2,'0')}T00:00:00Z`});
 const sessions=[make('1',600),make('2',540),make('3',660),make('4',360),make('5',300),make('6',420),make('7',999,1800),make('8',100,1600,'training'),make('9',100,1600,'review'),make('10',0),{...make('11',-5)},{...make('12',100),createdAt:'bad'}];
 sessions.push({...make('13',100),kind:'assistant'});
 const trend=trainingTrend(sessions.reverse());assert.equal(trend.points.length,7);assert.equal(trend.excluded,3);assert.equal(trend.points[0].id,'1');assert.equal(trend.points[0].approximateDate,true);
 const points=selectTrend(trend.points,1600,'independent',false);assert.equal(points.length,6);const summary=trendSummary(points);assert.equal(summary.count,3);assert.equal(summary.previous,600);assert.equal(summary.recent,360);assert.equal(summary.improvement,40);
 assert.equal(trendSummary(points.slice(0,5)),null);assert.equal(median([1,2,3,4]),2.5);
 const chart=trendChartData(points);assert.equal(chart[0].rollingMedian,null);assert.equal(chart[4].rollingMedian,9);assert.equal(chart[5].rollingMedian,7);assert.equal(chart[0].minutes,10);
 const repeat={...trend.points[0],id:'repeat',outcome:'assisted',seconds:30};
 assert.equal(selectTrend([...trend.points,repeat],1600,'all',false).length,6);assert.equal(selectTrend([...trend.points,repeat],1600,'all',true).length,7);assert.equal(selectTrend([...trend.points,repeat],1600,'assisted',false).length,0);
 assert.equal(trainingTrend([{...make('1',60),completedAt:'2026-11-01T00:00:00Z'}]).points[0].approximateDate,false);
 console.log('PASS: solved-only samples, exact-rating filters, invalid times, chronological ordering, repeat exclusion, outcome separation, rolling medians and sample-size-aware comparisons');
}finally{await rm(dir,{recursive:true,force:true});}
