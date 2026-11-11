"use client"
import { t as ui, currentLocale, useLocale } from "@/lib/locale"
import DifficultyBadge from "@/components/difficulty-badge"
import type { Session } from "@/lib/types"
import {} from "@/lib/types"
import type {} from "react"
import { useRef } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  NotebookPen,
  Upload,
} from "lucide-react"

const outcomes = {
  training: "训练中",
  independent: "独立解出",
  assisted: "提示后解出",
  review: "待重练",
}
const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

/** Training journal: pending and completed sessions, plus import/export controls. */
export default function HistoryView({
  sessions,
  trainingSessions,
  completed,
  now,
  syncState,
  resume,
  navigate,
  exportData,
  setSessions,
  setToast,
}: {
  sessions: Session[]
  trainingSessions: Session[]
  completed: Session[]
  now: number
  syncState: string
  resume: (session: Session) => void
  navigate: (view: import("@/lib/workspace-route").WorkspaceView) => void
  exportData: () => void
  setSessions: (next: Session[] | ((prev: Session[]) => Session[])) => void
  setToast: (message: string) => void
}) {
  useLocale()
  const importInput = useRef<HTMLInputElement>(null)
  return (
    <>
      <main className="main-content history-page">
        <div className="section-title history-title">
          <div>
            <div className="eyebrow">MY THINKING JOURNAL</div>
            <h1>{ui("每一次卡住，都留下线索。")}</h1>
            <p>
              {trainingSessions.length} {ui("次训练 ·")}
              {
                trainingSessions.filter(
                  (s) => s.outcome === "training" || s.outcome === "review",
                ).length
              }{" "}
              {ui("道待继续 ·")}
              {completed.length} {ui("道已完成")}
            </p>
          </div>
          <button
            className="secondary"
            onClick={exportData}
            disabled={!sessions.length}
          >
            <Download size={16} />
            {ui("导出记录")}
          </button>
        </div>
        {!sessions.length ? (
          <div className="empty large-empty">
            <NotebookPen size={36} />
            <h3>{ui("你的第一条思考记录，还在下一道题里。")}</h3>
            <button className="primary" onClick={() => navigate("bank")}>
              {ui("挑一道题")}
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <div className="history-groups">
            {[
              {
                title: ui("未完成"),
                subtitle: ui("接着上次的观察，继续向前一步。"),
                icon: Clock3,
                items: trainingSessions.filter(
                  (s) => s.outcome === "training" || s.outcome === "review",
                ),
                empty: ui("目前没有未完成的训练，去挑一道新题吧。"),
                kind: "pending",
              },
              {
                title: ui("已完成"),
                subtitle: ui("已经走通的题，和留下的思考。"),
                icon: CheckCircle2,
                items: completed,
                empty: ui("完成训练并标记解出后，会收录在这里。"),
                kind: "finished",
              },
            ].map((group) => (
              <section
                className={"history-group " + group.kind}
                key={group.kind}
              >
                <div className="history-group-heading">
                  <div>
                    <h2>
                      <group.icon size={18} />
                      {group.title}
                      <span>{group.items.length}</span>
                    </h2>
                    <p>{group.subtitle}</p>
                  </div>
                </div>
                {group.items.length ? (
                  <div className="history-list">
                    {group.items.map((s) => (
                      <article key={s.id}>
                        <div className="history-date">
                          {new Date(s.createdAt).toLocaleDateString(
                            currentLocale(),
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                          <span>CF {s.problem.rating}</span>
                        </div>
                        <div className="history-main">
                          <h3>
                            <span>{s.problem.id}</span>
                            {s.problem.name}
                          </h3>
                          <div>
                            <DifficultyBadge rating={s.problem.rating} />
                            <span className={"outcome " + s.outcome}>
                              {ui(outcomes[s.outcome])}
                            </span>
                            <span>
                              <Clock3 size={13} />
                              {fmt(
                                s.elapsed +
                                  (s.startedAt
                                    ? Math.max(
                                        0,
                                        Math.floor((now - s.startedAt) / 1000),
                                      )
                                    : 0),
                              )}
                            </span>
                            <span>
                              {s.hints === 4
                                ? ui("已查看解法")
                                : ui("{0} 级提示", [s.hints])}
                            </span>
                            <span>
                              {
                                s.messages.filter((m) => m.role === "user")
                                  .length
                              }{" "}
                              {ui("轮思考")}
                            </span>
                          </div>
                          {s.takeaway && <p>{s.takeaway}</p>}
                        </div>
                        <button className="row-start" onClick={() => resume(s)}>
                          {s.outcome === "training"
                            ? ui("继续训练")
                            : s.outcome === "review"
                              ? ui("重新练习")
                              : ui("查看复盘")}
                          <ArrowUpRight size={15} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="history-group-empty">{group.empty}</div>
                )}
              </section>
            ))}
          </div>
        )}
        <div className="history-data-heading">
          <span>{ui("记录与备份")}</span>
          <span className="history-sync" role="status">
            <span className="connection on" />
            {ui(syncState)}
          </span>
        </div>
        <div className="import-toolbar">
          <button
            className="secondary"
            onClick={() => importInput.current?.click()}
          >
            <Upload size={15} />
            {ui("导入 JSON 备份")}
          </button>
          <button
            className="text-button"
            onClick={() => {
              try {
                const old = JSON.parse(
                  localStorage.getItem("icpc-sessions-v1") || "[]",
                )
                if (!Array.isArray(old) || !old.length) {
                  setToast("此浏览器没有旧版记录")
                  return
                }
                if (
                  !window.confirm(
                    ui(
                      "将本浏览器旧版训练记录导入当前账号？请确认这些记录属于你。",
                    ),
                  )
                )
                  return
                const ids = new Set(sessions.map((s) => s.id))
                setSessions((prev) => [
                  ...prev,
                  ...old
                    .filter((s) => !ids.has(s.id))
                    .map((s) => ({ ...s, startedAt: null })),
                ])
                setToast("旧版记录已合并，正在同步")
              } catch {
                setToast("旧版记录无法读取，请从 JSON 备份导入")
              }
            }}
          >
            {ui("迁移本浏览器旧版记录")}
          </button>
        </div>
      </main>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            const parsed = JSON.parse(await file.text())
            if (
              !Array.isArray(parsed) ||
              parsed.some(
                (x) => !x?.id || !x?.problem?.id || !Array.isArray(x.messages),
              )
            )
              throw Error("记录文件格式无效")
            const existing = new Set(sessions.map((s) => s.id))
            setSessions((prev) => [
              ...prev,
              ...parsed
                .filter((x) => !existing.has(x.id))
                .map((x) => ({ ...x, startedAt: null })),
            ])
            setToast("记录已合并，正在保存到服务器")
          } catch (err) {
            setToast((err as Error).message)
          }
          e.target.value = ""
        }}
      />
    </>
  )
}
