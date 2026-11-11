"use client"
import { t as ui, useLocale } from "@/lib/locale"
import { api } from "@/lib/api-client"
import type { AdminModelRow, AdminStatus, AdminUserRow } from "@/lib/api-types"
import UsersSection from "./admin/users-section"
import ModelsSection from "./admin/models-section"
import StatusSection, { StatisticsSection } from "./admin/status-section"
import { useEffect, useState } from "react"
import { CheckCircle2, RefreshCw } from "lucide-react"
import type { AdminMutation } from "./admin/panel-types"

/** Site administration: accounts, shared models, operations and usage statistics. */
export default function AdminPanel({
  onModelsChanged,
}: {
  onModelsChanged: () => void
}) {
  useLocale()
  const [tab, setTab] = useState("users"),
    [users, setUsers] = useState<AdminUserRow[]>([]),
    [models, setModels] = useState<AdminModelRow[]>([]),
    [status, setStatus] = useState<AdminStatus | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false)
  async function load() {
    try {
      const [u, m, s] = await Promise.all([
        api<{ users: AdminUserRow[] }>("/api/admin/users"),
        api<{ models: AdminModelRow[] }>("/api/admin/models"),
        api<AdminStatus>("/api/admin/status"),
      ])
      setUsers(u.users)
      setModels(m.models)
      setStatus(s)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    // Mount-time fetch; every setState inside load() runs after its await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])
  const mutate: AdminMutation = async (path, body, method) => {
    setBusy(true)
    setError("")
    try {
      await api(path, { method, body })
      await load()
      onModelsChanged()
      setNotice(ui("已保存"))
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="main-content">
      <div className="section-title history-title">
        <div>
          <div className="eyebrow">SITE ADMINISTRATION</div>
          <h1>{ui("管理这个小小的练习场。")}</h1>
          <p>{ui("管理账号、网站模型授权和运行情况。")}</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={15} />
          {ui("刷新")}
        </button>
      </div>
      <div className="admin-stats">
        <span>
          {status?.stats.users || 0} {ui("个账号")}
        </span>
        <span>
          {status?.stats.records || 0} {ui("次训练")}
        </span>
        <span>
          {status?.stats.calls || 0} {ui("次模型调用")}
        </span>
      </div>
      <div className="admin-tabs">
        {[
          ["users", ui("账号管理")],
          ["models", ui("模型管理")],
          ["status", ui("运行与备份")],
          ["statistics", ui("用户统计")],
        ].map(([v, l]) => (
          <button
            className={tab === v ? "selected" : ""}
            key={v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {ui(error)}
        </div>
      )}
      {notice && (
        <div className="admin-notice">
          <CheckCircle2 size={14} />
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {tab === "users" && (
        <UsersSection users={users} busy={busy} error={error} mutate={mutate} />
      )}
      {tab === "models" && (
        <ModelsSection
          models={models}
          busy={busy}
          error={error}
          mutate={mutate}
        />
      )}
      {tab === "statistics" && <StatisticsSection status={status} />}
      {tab === "status" && <StatusSection status={status} />}
    </main>
  )
}
