import type { Session } from "./types";
export type SolvePoint = {
  id:string; problemId:string; name:string; rating:number; seconds:number;
  outcome:"independent"|"assisted"; date:string; approximateDate:boolean;
};
export function trainingTrend(sessions:Session[]) {
  let excluded=0;
  const points:SolvePoint[]=[];
  for(const s of sessions) {
    if(s.outcome!=="independent"&&s.outcome!=="assisted")continue;
    const date=s.completedAt||s.createdAt;
    if(!Number.isFinite(s.elapsed)||s.elapsed<=0||!Number.isFinite(s.problem?.rating)||!Number.isFinite(Date.parse(date))) {excluded++;continue;}
    points.push({id:s.id,problemId:s.problem.id,name:s.problem.name,rating:s.problem.rating,seconds:s.elapsed,outcome:s.outcome,date,approximateDate:!s.completedAt});
  }
  return {points:points.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id)),excluded};
}
export function median(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b), n=sorted.length;
  return n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2 : 0;
}
export function selectTrend(points:SolvePoint[],rating:number,mode:"independent"|"assisted"|"all",includeRepeats:boolean) {
  const seen=new Set<string>();
  // Deduplicate before filtering outcome so a familiar repeat isn't treated as a new solve.
  return points.filter(p=>{
    if(!includeRepeats&&seen.has(p.problemId))return false;
    seen.add(p.problemId);return true;
  }).filter(p=>p.rating===rating&&(mode==="all"||p.outcome===mode));
}
export function trendSummary(points:SolvePoint[]) {
  const count=Math.min(5,Math.floor(points.length/2));
  if(count<3)return null;
  const recent=median(points.slice(-count).map(p=>p.seconds));
  const previous=median(points.slice(-2*count,-count).map(p=>p.seconds));
  return {count,recent,previous,improvement:(previous-recent)/previous*100};
}
export function trendChartData(points:SolvePoint[]) {
  return points.map((p,index)=>({...p,index:index+1,minutes:p.seconds/60,rollingMedian:index>=4?median(points.slice(index-4,index+1).map(p=>p.seconds))/60:null}));
}
