"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import { RefreshCw, Target, MessageCircle, Zap, Clock3, CheckCircle2, BarChart3 } from "lucide-react";
import { api } from "./account-gate";
const TimeTrend = lazy(()=>import("./time-trend-chart"));
const number = (n: number) => Number(n || 0).toLocaleString("zh-CN");
const kindName: Record<string,string> = { coach: "思维陪练", translation: "题面翻译", legacy: "历史调用（未分类）" };
export default function StatisticsPanel({ save }: {save: () => Promise<void>}) {
  const [data,setData] = useState<any>(null), [busy,setBusy] = useState(false), [error,setError] = useState("");
  async function load() {
    setBusy(true);setError("");
    try {await save();setData(await api("/api/stats"));} catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  const totals=data?.totals;
  const cards = [
    {label:"已完成题目",value:totals?.completedProblems,unit:"道",icon:Target,note:`按题号去重 · ${number(totals?.completedSessions)} 次解出训练`},
    {label:"独立解出",value:totals?.independentProblems,unit:"道",icon:CheckCircle2,note:"标记为独立解出的不同题目"},
    {label:"实际模型调用",value:totals?.calls,unit:"次",icon:Zap,note:`接口成功 ${number(totals?.successfulCalls)} 次 · 失败 ${number((totals?.calls||0)-(totals?.successfulCalls||0))} 次`},
    {label:"已记录 Token",value:totals?.totalTokens,unit:"",icon:BarChart3,note:`输入 ${number(totals?.inputTokens)} · 输出 ${number(totals?.outputTokens)}`},
    {label:"累计思考",value:Math.floor((totals?.thinkingSeconds||0)/60),unit:"分钟",icon:Clock3,note:`${number(totals?.sessions)} 次训练 · ${number(totals?.pendingSessions)} 次未完成`},
    {label:"讨论轮数",value:totals?.discussionRounds,unit:"轮",icon:MessageCircle,note:"训练记录中发送的用户消息数"},
  ];
  return <main className="main-content statistics-page">
    <div className="section-title history-title"><div><div className="eyebrow">MY TRAINING STATISTICS</div><h1>看见每一步的积累。</h1><p>当前账号的训练记录与模型用量。</p></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16} className={busy?"spin":""}/>{busy?"正在更新":"刷新统计"}</button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {data && <Suspense fallback={<div className="usage-empty">正在加载用时趋势…</div>}><TimeTrend trend={data.trend || {points:[],excluded:0}} /></Suspense>}
    <section className="usage-cards">{cards.map(card=><article key={card.label}><div><card.icon size={17}/><span>{card.label}</span></div><strong>{data?number(card.value):"—"}<small>{card.unit}</small></strong><p>{data?card.note:"正在读取统计…"}</p></article>)}</section>
    {data && <>
      <p className="usage-note">仅累计模型接口已返回的用量；{number(totals.unknownUsageCalls)} 次调用未报告完整用量，不按 0 Token 解读。翻译命中缓存或复用同一在途请求，不重复计为模型调用。历史数据按现有日志回溯，早期未记录的网络失败无法补齐。</p>
      <section className="admin-section"><div className="panel-heading"><h2>按模型统计 · 全部时间</h2></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>模型</th><th>调用 / 接口成功</th><th>输入 Token</th><th>输出 Token</th><th>已记录总 Token</th><th>用量未报告</th></tr></thead><tbody>{data.models.map((row:any)=><tr key={row.modelId+row.model}><td>{row.model}</td><td>{number(row.calls)} / {number(row.successfulCalls)}</td><td>{number(row.inputTokens)}</td><td>{number(row.outputTokens)}</td><td>{number(row.totalTokens)}</td><td>{number(row.unknownUsageCalls)} 次</td></tr>)}</tbody></table>{!data.models.length&&<p className="usage-empty">还没有模型调用记录。</p>}</div></section>
      <section className="admin-section"><div className="panel-heading"><h2>按用途统计 · 全部时间</h2></div><div className="usage-kinds">{data.kinds.map((row:any)=><div key={row.kind}><span>{kindName[row.kind]||row.kind}</span><strong>{number(row.calls)} 次</strong><span>{number(row.totalTokens)} Token</span></div>)}{!data.kinds.length&&<p className="usage-empty">讨论和翻译发生后，会显示在这里。</p>}</div></section>
      <section className="admin-section"><div className="panel-heading"><h2>最近 30 天 · 北京时间</h2></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>日期</th><th>模型调用</th><th>接口成功</th><th>已记录 Token</th></tr></thead><tbody>{data.daily.map((row:any)=><tr key={row.day}><td>{row.day}</td><td>{number(row.calls)}</td><td>{number(row.successfulCalls)}</td><td>{number(row.totalTokens)}</td></tr>)}</tbody></table>{!data.daily.length&&<p className="usage-empty">最近 30 天还没有模型调用。</p>}</div></section>
      <p className="usage-note">更新于 {new Date(data.updatedAt).toLocaleString("zh-CN")} · 完成状态由用户自行标记，未同步 CF 判题。</p>
    </>}
  </main>;
}
