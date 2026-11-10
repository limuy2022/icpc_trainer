"use client";
import {t as ui,useLocale,currentLocale} from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import { api } from "./account-gate";
import {modelPresets,detectModelPreset,applyModelPreset} from "@/lib/model-presets";
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
  useLocale();
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
  const [presetId,setPresetId]=useState("custom");
  const selectedPreset=modelPresets.find(p=>p.id===presetId);
  const [discovered,setDiscovered]=useState<string[]>([]),[discovering,setDiscovering]=useState(false),[discoveryError,setDiscoveryError]=useState("");
  const discoveryAbort=useRef<AbortController|null>(null);
  const discoveryKey=JSON.stringify([modelForm?.id,modelForm?.base_url,modelForm?.key]);
  const discoveryContext=useRef(discoveryKey);discoveryContext.current=discoveryKey;
  useEffect(()=>{discoveryAbort.current?.abort();setDiscovered([]);setDiscoveryError("");setDiscovering(false);return()=>discoveryAbort.current?.abort();},[discoveryKey]);
  async function fetchModelList(){
    if(!modelForm||discovering)return;
    const context=discoveryKey,controller=new AbortController();discoveryAbort.current=controller;
    setDiscovering(true);setDiscoveryError("");setDiscovered([]);
    try{
      const response=await fetch("/api/admin/models/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:modelForm.id,base_url:modelForm.base_url,key:modelForm.key}),signal:controller.signal});
      const data=await response.json() as {models?:string[];error?:string};
      if(controller.signal.aborted||context!==discoveryContext.current)return;
      if(!response.ok)throw Error(data.error||"获取模型列表失败，请手动填写模型 ID");
      setDiscovered(data.models||[]);
      if(!data.models?.length)setDiscoveryError("接口没有返回可选模型，请手动填写模型 ID");
    }catch(error){if(!controller.signal.aborted&&context===discoveryContext.current)setDiscoveryError((error as Error).message);}
    finally{if(context===discoveryContext.current)setDiscovering(false);}
  }
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
      setNotice(ui("已保存"));
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
          <h1>{ui("管理这个小小的练习场。")}</h1>
          <p>{ui("手动开通账号，配置模型，查看运行情况。")}</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={15} />
          {ui("刷新")}</button>
      </div>
      <div className="admin-stats">
        <span>{status?.stats.users || 0} {ui("个账号")}</span>
        <span>{status?.stats.records || 0} {ui("次训练")}</span>
        <span>{status?.stats.calls || 0} {ui("次模型调用")}</span>
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
        <section className="admin-section">
          <div className="panel-heading">
            <h2>
              <Users size={17} />
              {ui("账号管理")}</h2>
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
              {ui("添加账号")}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ui("账号")}</th>
                  <th>{ui("权限")}</th>
                  <th>{ui("状态")}</th>
                  <th>{ui("最近登录")}</th>
                  <th>{ui("操作")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role === "admin" ? ui("管理员") : ui("成员")}</td>
                    <td>
                      {u.disabled
                        ? ui("已停用")
                        : u.must_change_password
                          ? ui("待设置密码")
                          : ui("正常")}
                    </td>
                    <td>
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString(currentLocale())
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
                        {u.disabled ? ui("启用") : ui("停用")}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const newPassword = window.prompt(
                            ui("输入临时新密码（至少12位），对方下次登录必须修改。此处不会显示旧密码。"),
                          );
                          if (newPassword)
                            void mutate(
                              "/api/admin/users",
                              { id: u.id, password: newPassword },
                              "PATCH",
                            );
                        }}
                      >
                        {ui("重置密码")}</button>
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
              {ui("模型管理")}</h2>
            <button
              className="primary"
              onClick={() => {
                setPresetId("custom");
                setModelForm({
                  label: "",
                  provider: "openai-compatible",
                  base_url: "",
                  model: "",
                  key: "",
                  enabled: true,
                  is_default: false,
                });
              }}
            >
              <Plus size={15} />
              {ui("添加模型")}</button>
          </div>
          <p className="admin-help">
            {ui("支持 OpenAI Chat Completions 兼容接口。密钥加密保存，列表和编辑接口都不会返回原值。")}</p>
          {models.map((m) => (
            <article className="model-card" key={m.id}>
              <div>
                <h3>
                  {m.label}
                  {Boolean(m.is_default) && (
                    <span className="tag selected">{ui("默认")}</span>
                  )}
                </h3>
                <p>
                  {m.model} · {m.base_url}
                </p>
                <small>
                  {m.enabled ? ui("启用") : ui("停用")} ·{" "}
                  {m.env_key
                    ? ui("服务端环境密钥")
                    : m.has_key
                      ? ui("密钥已加密保存")
                      : ui("未配置密钥")}
                </small>
              </div>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    setPresetId(detectModelPreset(m));
                    setModelForm({
                      ...m,
                      original_base_url:m.base_url,
                      key: "",
                      enabled: Boolean(m.enabled),
                      is_default: Boolean(m.is_default),
                    });
                  }}
                >
                  {ui("编辑")}</button>
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
                  {ui("设为默认")}</button>
                <button
                  className="text-button"
                  disabled={busy || m.is_default}
                  onClick={() => {
                    if (window.confirm(ui("删除这个模型配置？训练记录仍然保留。")))
                      void mutate("/api/admin/models", { id: m.id }, "DELETE");
                  }}
                >
                  {ui("删除")}</button>
              </div>
            </article>
          ))}
        </section>
      )}
      {tab === "statistics" && <section className="admin-section"><div className="panel-heading"><h2>{ui("各账号训练与用量 · 全部时间")}</h2></div><p className="usage-note">{ui("完成题目按题号去重；Token 为接口已报告用量，不含无法回溯的缺失数据。")}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{ui("账号")}</th><th>{ui("完成 / 独立题数")}</th><th>{ui("训练次数")}</th><th>{ui("模型调用 / 接口成功")}</th><th>{ui("输入 Token")}</th><th>{ui("输出 Token")}</th><th>{ui("总 Token")}</th><th>{ui("用量未报告")}</th></tr></thead><tbody>{status?.userStats?.map((row:any)=><tr key={row.id}><td>{row.username}</td><td>{row.completedProblems} / {row.independentProblems}</td><td>{row.sessions}</td><td>{row.calls} / {row.successfulCalls}</td><td>{row.inputTokens.toLocaleString()}</td><td>{row.outputTokens.toLocaleString()}</td><td>{row.totalTokens.toLocaleString()}</td><td>{row.unknownUsageCalls} {ui("次")}</td></tr>)}</tbody></table></div></section>}
      {tab === "status" && (
        <>
          <section className="admin-section">
            <div className="panel-heading">
              <h2>{ui("数据库与备份")}</h2>
              <a className="secondary" href="/api/admin/backup">
                <Download size={15} />
                {ui("下载数据库备份")}</a>
            </div>
            <p className="admin-help">
              {ui("备份包含账号密码哈希、加密的模型密钥和训练记录，请妥善保管。恢复还需要服务器上的加密主密钥配置文件。服务器每天另存一份数据库备份。")}</p>
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
                  {status?.usage.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.username}</td>
                      <td>{r.status === 0 ? ui("网络失败") : r.status} / {r.kind === "coach" ? ui("陪练") : r.kind === "translation" ? ui("翻译") : ui("历史")}</td>
                      <td>
                        {r.usage_reported ? `${r.input_tokens} / ${r.output_tokens}` : ui("未报告完整用量")}
                      </td>
                      <td>{new Date(r.created_at).toLocaleString(currentLocale())}</td>
                      <td>{r.duration_ms==null?"—":`${(r.duration_ms/1000).toFixed(1)}s`}<br/>{r.error_code||r.finish_reason||"—"}{r.request_id&&<details><summary>{ui("请求编号")}</summary><code>{r.request_id}</code></details>}</td>
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
            {status?.audit.map((a: any, i: number) => (
              <div className="audit-row" key={i}>
                <span>
                  {a.username || ui("系统")} · {a.action}
                </span>
                <time>{new Date(a.created_at).toLocaleString(currentLocale())}</time>
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
              aria-label={ui("关闭添加账号")}
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
              <h2>{ui("手动添加账号")}</h2>
              <label>
                {ui("用户名")}<input
                  required
                  pattern="[a-zA-Z0-9_.\-]{3,40}"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                {ui("临时密码")}<input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                {ui("权限")}<select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">{ui("成员")}</option>
                  <option value="admin">{ui("管理员")}</option>
                </select>
              </label>
              <p>{ui("首次登录必须修改临时密码。")}</p>
              {error && <div className="form-error">{ui(error)}</div>}
              <button className="primary" disabled={busy}>
                {ui("创建账号")}</button>
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
              aria-label={ui("关闭模型编辑")}
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
              <h2>{modelForm.id ? ui("编辑模型") : ui("添加模型")}</h2>
              <label>{ui("常用厂商")}<select aria-label={ui("常用厂商")} value={presetId} onChange={e=>{setPresetId(e.target.value);setModelForm(applyModelPreset(modelForm,e.target.value));}}>
                <option value="custom">{ui("自定义兼容接口")}</option>
                {modelPresets.map(p=><option key={p.id} value={p.id}>{ui(p.label)}</option>)}
              </select></label>
              <p className="provider-preset-help">{ui("选择厂商可填入接口地址和类型；模型 ID 按账号可用模型填写，地址仍可编辑。")}{selectedPreset&&<> <a href={selectedPreset.docs} target="_blank" rel="noreferrer">{ui("官方接入文档")}</a></>}</p>
              <label>
                {ui("显示名称")}<input
                  required
                  value={modelForm.label}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, label: e.target.value })
                  }
                />
              </label>
              <label>
                {ui("接口类型")}<select
                  value={modelForm.provider}
                  onChange={(e) => {setPresetId("custom");setModelForm({ ...modelForm, provider: e.target.value });}}
                >
                  <option value="openai-compatible">
                    {ui("OpenAI Chat Completions 兼容")}</option>
                  <option value="glm">GLM</option>
                </select>
              </label>
              <label>
                Base URL
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/v1"
                  value={modelForm.base_url}
                  onChange={(e) => {setPresetId("custom");setModelForm({ ...modelForm, base_url: e.target.value, key:"" });}}
                />
              </label>
              <label>
                {ui("模型 ID")}<input
                  required
                  value={modelForm.model}
                  onChange={(e) =>
                    setModelForm({ ...modelForm, model: e.target.value })
                  }
                />
              </label>
              <div className="model-discovery">
                <button type="button" className="secondary" disabled={discovering||!modelForm.base_url.trim()} onClick={()=>void fetchModelList()}><RefreshCw size={14} className={discovering?"spin":""}/>{ui(discovering?"正在获取模型…":"获取模型列表")}</button>
                <small>{ui("先填写 API Key；编辑已有模型时可使用服务端保存的密钥。")}</small>
              </div>
              {discovered.length>0&&<label>{ui("从已获取列表选择")}<select aria-label={ui("从已获取列表选择")} value={discovered.includes(modelForm.model)?modelForm.model:""} onChange={e=>{if(e.target.value)setModelForm({...modelForm,model:e.target.value});}}><option value="">{ui("选择模型，或在上方手动填写")}</option>{discovered.map(id=><option key={id} value={id}>{id}</option>)}</select><small>{ui("已获取 {0} 个模型；列表不代表每个模型都支持聊天。",[discovered.length])}</small></label>}
              {discoveryError&&<p className="form-error" role="alert">{ui(discoveryError)}</p>}
              <label>
                API Key {modelForm.id ? ui(modelForm.base_url.replace(/\/+$/,"")===modelForm.original_base_url.replace(/\/+$/,"")?"（留空保留原密钥）":"（更换接口后需重新填写）") : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!modelForm.id || modelForm.base_url.replace(/\/+$/,"")!==modelForm.original_base_url.replace(/\/+$/,"")}
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
                  {ui("启用")}</label>
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
                  {ui("默认模型")}</label>
              </div>
              {error && <div className="form-error">{ui(error)}</div>}
              <button className="primary" disabled={busy}>
                {ui("保存模型")}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
