"use client"
import { t as ui, useLocale, currentLocale } from "@/lib/locale"
import { lazy, Suspense, useEffect, useState } from "react"
import {
  RefreshCw,
  Target,
  MessageCircle,
  Zap,
  Clock3,
  CheckCircle2,
  BarChart3,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { StatsResponse } from "@/lib/api-types"
const TimeTrend = lazy(() => import("./time-trend-chart"))
const number = (n: number | undefined) =>
  Number(n || 0).toLocaleString(currentLocale())
const kindName: Record<string, string> = {
  coach: "思维陪练",
  translation: "题面翻译",
  legacy: "历史调用（未分类）",
}
export default function StatisticsPanel({
  save,
}: {
  save: () => Promise<void>
}) {
  useLocale()
  const [data, setData] = useState<StatsResponse | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function load() {
    setBusy(true)
    setError("")
    try {
      await save()
      setData(await api<StatsResponse>("/api/stats"))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    // Mount-time fetch; every setState inside load() runs after its await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, [])
  const totals = data?.totals
  const cards = [
    {
      label: ui("已完成题目"),
      value: totals?.completedProblems,
      unit: ui("道"),
      icon: Target,
      note: ui("按题号去重 · {0} 次解出训练", [
        number(totals?.completedSessions),
      ]),
    },
    {
      label: ui("独立解出"),
      value: totals?.independentProblems,
      unit: ui("道"),
      icon: CheckCircle2,
      note: ui("标记为独立解出的不同题目"),
    },
    {
      label: ui("实际模型调用"),
      value: totals?.calls,
      unit: ui("次"),
      icon: Zap,
      note: ui("接口成功 {0} 次 · 失败 {1} 次", [
        number(totals?.successfulCalls),
        number((totals?.calls || 0) - (totals?.successfulCalls || 0)),
      ]),
    },
    {
      label: ui("已记录 Token"),
      value: totals?.totalTokens,
      unit: "",
      icon: BarChart3,
      note: ui("输入 {0} · 输出 {1}", [
        number(totals?.inputTokens),
        number(totals?.outputTokens),
      ]),
    },
    {
      label: ui("累计思考"),
      value: Math.floor((totals?.thinkingSeconds || 0) / 60),
      unit: ui("分钟"),
      icon: Clock3,
      note: ui("{0} 次训练 · {1} 次未完成", [
        number(totals?.sessions),
        number(totals?.pendingSessions),
      ]),
    },
    {
      label: ui("讨论轮数"),
      value: totals?.discussionRounds,
      unit: ui("轮"),
      icon: MessageCircle,
      note: ui("训练记录中发送的用户消息数"),
    },
  ]
  return (
    <main className="main-content statistics-page">
      <div className="section-title history-title">
        <div>
          <div className="eyebrow">MY TRAINING STATISTICS</div>
          <h1>{ui("看见每一步的积累。")}</h1>
          <p>{ui("当前账号的训练记录与模型用量。")}</p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={16} className={busy ? "spin" : ""} />
          {busy ? ui("正在更新") : ui("刷新统计")}
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {ui(error)}
        </div>
      )}
      {data && (
        <Suspense
          fallback={
            <div className="usage-empty">{ui("正在加载用时趋势…")}</div>
          }
        >
          <TimeTrend trend={data.trend || { points: [], excluded: 0 }} />
        </Suspense>
      )}
      <section className="usage-cards">
        {cards.map((card) => (
          <article key={card.label}>
            <div>
              <card.icon size={17} />
              <span>{card.label}</span>
            </div>
            <strong>
              {data ? number(card.value) : "—"}
              <small>{card.unit}</small>
            </strong>
            <p>{data ? card.note : ui("正在读取统计…")}</p>
          </article>
        ))}
      </section>
      {data && (
        <>
          <p className="usage-note">
            {ui("仅累计模型接口已返回的用量；")}
            {number(totals?.unknownUsageCalls)}{" "}
            {ui(
              "次调用未报告完整用量，不按 0 Token 解读。翻译命中缓存或复用同一在途请求，不重复计为模型调用。历史数据按现有日志回溯，早期未记录的网络失败无法补齐。",
            )}
          </p>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>{ui("按模型统计 · 全部时间")}</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{ui("模型")}</th>
                    <th>{ui("调用 / 接口成功")}</th>
                    <th>{ui("输入 Token")}</th>
                    <th>{ui("输出 Token")}</th>
                    <th>{ui("已记录总 Token")}</th>
                    <th>{ui("用量未报告")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((row) => (
                    <tr key={row.modelId + row.model}>
                      <td>{row.model}</td>
                      <td>
                        {number(row.calls)} / {number(row.successfulCalls)}
                      </td>
                      <td>{number(row.inputTokens)}</td>
                      <td>{number(row.outputTokens)}</td>
                      <td>{number(row.totalTokens)}</td>
                      <td>
                        {number(row.unknownUsageCalls)} {ui("次")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.models.length && (
                <p className="usage-empty">{ui("还没有模型调用记录。")}</p>
              )}
            </div>
          </section>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>{ui("按用途统计 · 全部时间")}</h2>
            </div>
            <div className="usage-kinds">
              {data.kinds.map((row) => (
                <div key={row.kind}>
                  <span>{ui(kindName[row.kind] || row.kind)}</span>
                  <strong>
                    {number(row.calls)} {ui("次")}
                  </strong>
                  <span>{number(row.totalTokens)} Token</span>
                </div>
              ))}
              {!data.kinds.length && (
                <p className="usage-empty">
                  {ui("讨论和翻译发生后，会显示在这里。")}
                </p>
              )}
            </div>
          </section>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>{ui("最近 30 天 · 北京时间")}</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{ui("日期")}</th>
                    <th>{ui("模型调用")}</th>
                    <th>{ui("接口成功")}</th>
                    <th>{ui("已记录 Token")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{number(row.calls)}</td>
                      <td>{number(row.successfulCalls)}</td>
                      <td>{number(row.totalTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.daily.length && (
                <p className="usage-empty">
                  {ui("最近 30 天还没有模型调用。")}
                </p>
              )}
            </div>
          </section>
          <p className="usage-note">
            {ui("更新于")}
            {new Date(data.updatedAt).toLocaleString(currentLocale())}{" "}
            {ui("· 完成状态由用户自行标记，未同步 CF 判题。")}
          </p>
        </>
      )}
    </main>
  )
}
