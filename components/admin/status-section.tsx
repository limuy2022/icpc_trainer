"use client"
import { t as ui, currentLocale, useLocale } from "@/lib/locale"
import type { AdminStatus } from "@/lib/api-types"
import { Download } from "lucide-react"

/** Operations tab: database backup, recent model calls, audit trail, per-account usage. */
export default function StatusSection({
  status,
}: {
  status: AdminStatus | null
}) {
  useLocale()
  return (
    <>
      <section className="admin-section">
        <div className="panel-heading">
          <h2>{ui("数据库与备份")}</h2>
          <a className="secondary" href="/api/admin/backup">
            <Download size={15} />
            {ui("下载数据库备份")}
          </a>
        </div>
        <p className="admin-help">
          {ui(
            "备份包含账号密码哈希、加密的模型密钥和训练记录，请妥善保管。恢复还需要服务器上的加密主密钥配置文件。服务器每天另存一份数据库备份。",
          )}
        </p>
      </section>
      <section className="admin-section">
        <div className="panel-heading">
          <h2>{ui("最近模型调用")}</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{ui("用户")}</th>
                <th>{ui("状态 / 用途")}</th>
                <th>{ui("输入 / 输出 tokens")}</th>
                <th>{ui("时间")}</th>
                <th>{ui("耗时 / 诊断")}</th>
              </tr>
            </thead>
            <tbody>
              {status?.usage.map((r) => (
                <tr key={r.id}>
                  <td>{r.username}</td>
                  <td>
                    {r.status === 0 ? ui("网络失败") : r.status} /{" "}
                    {r.kind === "coach"
                      ? ui("陪练")
                      : r.kind === "translation"
                        ? ui("翻译")
                        : ui("历史")}
                  </td>
                  <td>
                    {r.usage_reported
                      ? `${r.input_tokens} / ${r.output_tokens}`
                      : ui("未报告完整用量")}
                  </td>
                  <td>
                    {new Date(r.created_at).toLocaleString(currentLocale())}
                  </td>
                  <td>
                    {r.duration_ms == null
                      ? "—"
                      : `${(r.duration_ms / 1000).toFixed(1)}s`}
                    <br />
                    {r.error_code || r.finish_reason || "—"}
                    {r.request_id && (
                      <details>
                        <summary>{ui("请求编号")}</summary>
                        <code>{r.request_id}</code>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-section">
        <div className="panel-heading">
          <h2>{ui("最近管理操作")}</h2>
        </div>
        {status?.audit.map((a, i) => (
          <div className="audit-row" key={i}>
            <span>
              {a.username || ui("系统")} · {a.action}
            </span>
            <time>
              {new Date(a.created_at).toLocaleString(currentLocale())}
            </time>
          </div>
        ))}
      </section>
    </>
  )
}

/** Per-account training and model-usage totals. */
export function StatisticsSection({ status }: { status: AdminStatus | null }) {
  useLocale()
  return (
    <section className="admin-section">
      <div className="panel-heading">
        <h2>{ui("各账号训练与用量 · 全部时间")}</h2>
      </div>
      <p className="usage-note">
        {ui(
          "完成题目按题号去重；Token 为接口已报告用量，不含无法回溯的缺失数据。",
        )}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{ui("账号")}</th>
              <th>{ui("完成 / 独立题数")}</th>
              <th>{ui("训练次数")}</th>
              <th>{ui("模型调用 / 接口成功")}</th>
              <th>{ui("输入 Token")}</th>
              <th>{ui("输出 Token")}</th>
              <th>{ui("总 Token")}</th>
              <th>{ui("用量未报告")}</th>
            </tr>
          </thead>
          <tbody>
            {status?.userStats.map((row) => (
              <tr key={row.id}>
                <td>{row.username}</td>
                <td>
                  {row.completedProblems} / {row.independentProblems}
                </td>
                <td>{row.sessions}</td>
                <td>
                  {row.calls} / {row.successfulCalls}
                </td>
                <td>{row.inputTokens.toLocaleString()}</td>
                <td>{row.outputTokens.toLocaleString()}</td>
                <td>{row.totalTokens.toLocaleString()}</td>
                <td>
                  {row.unknownUsageCalls} {ui("次")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
