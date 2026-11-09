"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { median, selectTrend, trendChartData, trendSummary, type SolvePoint } from "@/lib/time-trend";
const minutes=(seconds:number)=>(seconds/60).toLocaleString("zh-CN",{maximumFractionDigits:1});
function PointTooltip({active,payload}:any) {
  const point=payload?.[0]?.payload;
  if(!active||!point)return null;
  return <div className="trend-tooltip"><strong>{point.problemId} · {point.name}</strong><p>CF {point.rating} · {point.outcome==="independent"?"独立解出":"提示后解出"}</p><p>{minutes(point.seconds)} 分钟{point.rollingMedian!==null?` · 近 5 题中位数 ${point.rollingMedian.toFixed(1)} 分钟`:""}</p><p>{new Date(point.date).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})}{point.approximateDate?"（开始时间）":"（完成时间）"}</p></div>;
}
export default function TimeTrendChart({trend}:{trend:{points:SolvePoint[];excluded:number}}) {
  const ratings=[...new Set(trend.points.map(p=>p.rating))].sort((a,b)=>a-b);
  const [chosen,setChosen]=useState<number|null>(null),[mode,setMode]=useState<"independent"|"assisted"|"all">("independent"),[repeats,setRepeats]=useState(false);
  const rating=chosen!==null&&ratings.includes(chosen)?chosen:trend.points.at(-1)?.rating;
  const points=rating===undefined?[]:selectTrend(trend.points,rating,mode,repeats);
  const summary=trendSummary(points), chart=trendChartData(points);
  return <section className="admin-section time-trend">
    <div className="panel-heading"><h2>同难度解题用时趋势</h2><span className="trend-count">{points.length} 个有效样本</span></div>
    <div className="trend-controls"><label>CF 难度<select aria-label="趋势题目难度" value={rating??""} disabled={!ratings.length} onChange={e=>setChosen(Number(e.target.value))}>{!ratings.length&&<option value="">暂无已解出题目</option>}{ratings.map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>解出方式<select aria-label="趋势解出方式" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="independent">独立解出</option><option value="assisted">提示后解出</option><option value="all">全部解出</option></select></label><label className="trend-repeat"><input type="checkbox" checked={repeats} onChange={e=>setRepeats(e.target.checked)}/>包含同题重做</label></div>
    {!points.length?<div className="usage-empty">{trend.points.length?"当前难度暂无符合条件的记录，可切换难度或解出方式。":"完成训练并标记解出后，会在这里生成用时曲线。"}</div>:<>
      <div className="trend-insight"><strong>{summary?(Math.abs(summary.improvement)<5?"近期用时大致持平":`近期用时中位数${summary.improvement>0?"下降":"上升"} ${Math.abs(summary.improvement).toFixed(1)}%`):"继续积累，观察自己的节奏"}</strong><p>{summary?`最近 ${summary.count} 题 ${minutes(summary.recent)} 分钟，对比此前 ${summary.count} 题 ${minutes(summary.previous)} 分钟。`:`当前中位数 ${minutes(median(points.map(p=>p.seconds)))} 分钟；至少 6 个同难度、同筛选条件的样本后再比较前后变化。`}</p></div>
      <div className="trend-legend"><span><i className="trend-dot"/>单题训练用时</span><span><i className="trend-line"/>近 5 题滚动中位数</span><span>横轴：同难度训练顺序 · 纵轴：分钟</span></div>
      <div className="trend-chart" role="img" aria-label={`CF ${rating} 解题用时趋势，${points.length} 个样本，按训练先后排列`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:15,right:18,bottom:8,left:0}} accessibilityLayer><CartesianGrid stroke="var(--line)" strokeDasharray="3 3"/><XAxis dataKey="index" tick={{fill:"var(--muted)",fontSize:12}} minTickGap={24} tickFormatter={value=>`第 ${value} 题`} stroke="var(--line)"/><YAxis width={48} domain={[0,"auto"]} tick={{fill:"var(--muted)",fontSize:12}} stroke="var(--line)"/><Tooltip content={<PointTooltip/>} trigger="hover"/><Line dataKey="minutes" name="单题用时" stroke="var(--trend-raw)" strokeWidth={1.5} dot={(props:any)=>props.payload.outcome==="assisted"?<rect key={props.index} x={props.cx-4} y={props.cy-4} width={8} height={8} fill="var(--trend-assisted)" rx={1}/>:<circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="var(--trend-raw)"/>} activeDot={{r:6}} isAnimationActive={false}/><Line dataKey="rollingMedian" name="近 5 题中位数" stroke="var(--trend-median)" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
      <details className="trend-records"><summary>查看 {points.length} 条记录明细</summary><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>顺序 / 日期</th><th>题目</th><th>方式</th><th>训练用时</th></tr></thead><tbody>{points.map((p,i)=><tr key={p.id}><td>{i+1} · {new Date(p.date).toLocaleDateString("zh-CN",{timeZone:"Asia/Shanghai"})}</td><td>{p.problemId} {p.name}</td><td>{p.outcome==="independent"?"独立解出":"提示后解出"}</td><td>{minutes(p.seconds)} 分钟</td></tr>)}</tbody></table></div></details>
    </>}
    <p className="trend-method">默认比较首次解出的不同题目，避免重做熟题混入；不计未完成、待重练、零用时或无效记录。{mode==="all"?"当前混合展示两种解出方式：圆点为独立解出，方点为提示后解出，比较时请注意提示的影响。":""}用时来自训练计时器，包含思考和讨论，不是 CF 提交耗时。旧记录缺少完成时间时按开始时间排序。{trend.excluded?`已排除 ${trend.excluded} 条无效的已解出记录。`:""}曲线只描述已解出题目的用时变化，样本少或题型变化时不能据此认定能力提高。</p>
  </section>;
}
