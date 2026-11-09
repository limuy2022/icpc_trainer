"use client";
import { useEffect, useState } from "react";
import { api } from "./account-gate";
import {
  Download,
  Plus,
  RefreshCw,
  Settings2,
  Users,
  X,
  CheckCircle2,
} from "lucide-react";
export default function AdminPanel({
  onModelsChanged,
}: {
  onModelsChanged: () => void;
}) {
  const [tab, setTab] = useState("users"),
    [users, setUsers] = useState<any[]>([]),
    [models, setModels] = useState<any[]>([]),
    [status, setStatus] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [userForm, setUserForm] = useState(false),
    [modelForm, setModelForm] = useState<any>(null);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("member");
  async function load() {
    try {
      const [u, m, s] = await Promise.all([
        api("/api/admin/users"),
        api("/api/admin/models"),
        api("/api/admin/status"),
      ]);
      setUsers(u.users);
      setModels(m.models);
      setStatus(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function mutate(path: string, body: unknown, method: string) {
    setBusy(true);
    setError("");
    try {
      await api(path, body, method);
      await load();
      onModelsChanged();
      setNotice("已保存");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="main-content">
      <div className="section-title history-title">
        <div>
          <div className="eyebrow">SITE ADMINISTRATION</div>
          <h1>管理这个小小的练习场。</h1>
          <p>手动开通账号，配置模型，查看运行情况。</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={15} />
          刷新
        </button>
      </div>
      <div className="admin-stats">
        <span>{status?.stats.users || 0} 个账号</span>
        <span>{status?.stats.records || 0} 次训练</span>
        <span>{status?.stats.calls || 0} 次模型调用</span>
      </div>
      <div className="admin-tabs">
        {[
          ["users", "账号管理"],
          ["models", "模型管理"],
          ["status", "运行与备份"],
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
          {error}
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
        <section className="admin-section">
          <div className="panel-heading">
            <h2>
              <Users size={17} />
              账号管理
            </h2>
            <button
              className="primary"
              onClick={() => {
                setUserForm(true);
                setUsername("");
                setPassword("");
                setRole("member");
              }}
            >
              <Plus size={15} />
              添加账号
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>权限</th>
                  <th>状态</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role === "admin" ? "管理员" : "成员"}</td>
                    <td>
                      {u.disabled
                        ? "已停用"
                        : u.must_change_password
                          ? "待设置密码"
                          : "正常"}
                    </td>
                    <td>
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString("zh-CN")
                        : "—"}
                    </td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            "/api/admin/users",
                            { id: u.id, disabled: !u.disabled },
                            "PATCH",
                          )
                        }
                      >
                        {u.disabled ? "启用" : "停用"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const newPassword = window.prompt(
                            "输入临时新密码（至少12位），对方下次登录必须修改。此处不会显示旧密码。",
                          );
                          if (newPassword)
                            void mutate(
                              "/api/admin/users",
                              { id: u.id, password: newPassword },
                              "PATCH",
                            );
                        }}
                      >
                        重置密码
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "models" && (
        <section className="admin-section">
          <div className="panel-heading">
            <h2>
              <Settings2 size={17} />
              模型管理
            </h2>
            <button
              className="primary"
              onClick={() =>
                setModelForm({
                  label: "",
                  provider: "openai-compatible",
                  base_url: "https://api.openai.com/v1",
                  model: "",
                  key: "",
                  enabled: true,
                  is_default: false,
                })
              }
            >
              <Plus size={15} />
              添加模型
            </button>
          </div>
          <p className="admin-help">
            支持 GLM 与 OpenAI Chat Completions
            兼容接口。密钥加密保存，列表和编辑接口都不会返回原值。
          </p>
          {models.map((m) => (
            <article className="model-card" key={m.id}>
              <div>
                <h3>
                  {m.label}
                  {Boolean(m.is_default) && (
                    <span className="tag selected">默认</span>
                  )}
                </h3>
                <p>
                  {m.model} · {m.base_url}
                </p>
                <small>
                  {m.enabled ? "启用" : "停用"} ·{" "}
                  {m.env_key
                    ? "服务端环境密钥"
                    : m.has_key
                      ? "密钥已加密保存"
                      : "未配置密钥"}
                </small>
              </div>
              <div>
                <button
                  className="text-button"
                  onClick={() =>
                    setModelForm({
                      ...m,
                      key: "",
                      enabled: Boolean(m.enabled),
                      is_default: Boolean(m.is_default),
                    })
                  }
                >
                  编辑
                </button>
                <button
                  className="text-button"
                  disabled={busy || m.is_default}
                  onClick={() =>
                    mutate(
                      "/api/admin/models",
                      { ...m, is_default: true, enabled: true },
                      "PATCH",
                    )
                  }
                >
                  设为默认
                </button>
                <button
                  className="text-button"
                  disabled={busy || m.is_default}
                  onClick={() => {
                    if (window.confirm("删除这个模型配置？训练记录仍然保留。"))
                      void mutate("/api/admin/models", { id: m.id }, "DELETE");
                  }}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {tab === "status" && (
        <>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>数据库与备份</h2>
              <a className="secondary" href="/api/admin/backup">
                <Download size={15} />
                下载数据库备份
              </a>
            </div>
            <p className="admin-help">
              备份包含账号密码哈希、加密的模型密钥和训练记录，请妥善保管。恢复还需要服务器上的加密主密钥配置文件。服务器每天另存一份数据库备份。
            </p>
          </section>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>最近模型调用</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>状态</th>
                    <th>输入 / 输出 tokens</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {status?.usage.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.username}</td>
                      <td>{r.status}</td>
                      <td>
                        {r.input_tokens} / {r.output_tokens}
                      </td>
                      <td>{new Date(r.created_at).toLocaleString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>最近管理操作</h2>
            </div>
            {status?.audit.map((a: any, i: number) => (
              <div className="audit-row" key={i}>
                <span>
                  {a.username || "系统"} · {a.action}
                </span>
                <time>{new Date(a.created_at).toLocaleString("zh-CN")}</time>
              </div>
            ))}
          </section>
        </>
      )}
      {userForm && (
        <div className="modal-overlay">
          <section className="modal">
            <button
              className="modal-close"
              onClick={() => setUserForm(false)}
              aria-label="关闭添加账号"
            >
              <X size={19} />
            </button>
            <form
              className="account-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    "/api/admin/users",
                    { username, password, role },
                    "POST",
                  )
                ) {
                  setUserForm(false);
                  setPassword("");
                }
              }}
            >
              <h2>手动添加账号</h2>
              <label>
                用户名
                <input
                  required
                  pattern="[a-zA-Z0-9_.\-]{3,40}"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                临时密码
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                权限
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
              <p>首次登录必须修改临时密码。</p>
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={busy}>
                创建账号
              </button>
            </form>
          </section>
        </div>
      )}
      {modelForm && (
        <div className="modal-overlay">
          <section className="modal">
            <button
              className="modal-close"
              onClick={() => setModelForm(null)}
              aria-label="关闭模型编辑"
            >
              <X size={19} />
            </button>
            <form
              className="account-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    "/api/admin/models",
                    modelForm,
                    modelForm.id ? "PATCH" : "POST",
                  )
                )
                  setModelForm(null);
              }}
            >
              <h2>{modelForm.id ? "编辑模型" : "添加模型"}</h2>
              <label>
                显示名称
                <input
                  required
                  value={modelForm.label}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, label: e.target.value })
                  }
                />
              </label>
              <label>
                接口类型
                <select
                  value={modelForm.provider}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, provider: e.target.value })
                  }
                >
                  <option value="openai-compatible">
                    OpenAI Chat Completions 兼容
                  </option>
                  <option value="glm">GLM</option>
                </select>
              </label>
              <label>
                Base URL
                <input
                  type="url"
                  required
                  value={modelForm.base_url}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, base_url: e.target.value })
                  }
                />
              </label>
              <label>
                模型 ID
                <input
                  required
                  value={modelForm.model}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, model: e.target.value })
                  }
                />
              </label>
              <label>
                API Key {modelForm.id ? "（留空保留原密钥）" : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!modelForm.id}
                  value={modelForm.key}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, key: e.target.value })
                  }
                />
              </label>
              <div className="admin-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={modelForm.enabled}
                    onChange={(e) =>
                      setModelForm({ ...modelForm, enabled: e.target.checked })
                    }
                  />
                  启用
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={modelForm.is_default}
                    onChange={(e) =>
                      setModelForm({
                        ...modelForm,
                        is_default: e.target.checked,
                      })
                    }
                  />
                  默认模型
                </label>
              </div>
              {error && <div className="form-error">{error}</div>}
              <button className="primary" disabled={busy}>
                保存模型
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
