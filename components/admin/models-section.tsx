"use client"
import { t as ui, useLocale } from "@/lib/locale"
import { api } from "@/lib/api-client"
import type { AdminModelForm, AdminModelRow } from "@/lib/api-types"
import {
  modelPresets,
  detectModelPreset,
  applyModelPreset,
} from "@/lib/model-presets"
import Modal from "@/components/workspace/modal"
import { Plus, RefreshCw, Settings2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { AdminMutation } from "./panel-types"

/** Site model administration: cards, preset-driven editor modal and model-ID discovery. */
export default function ModelsSection({
  models,
  busy,
  error,
  mutate,
}: {
  models: AdminModelRow[]
  busy: boolean
  error: string
  mutate: AdminMutation
}) {
  useLocale()
  const [modelForm, setModelForm] = useState<AdminModelForm | null>(null)
  const [modelSearch, setModelSearch] = useState("")
  const [presetId, setPresetId] = useState("custom")
  const selectedPreset = modelPresets.find((p) => p.id === presetId)
  const [discovered, setDiscovered] = useState<string[]>([]),
    [discovering, setDiscovering] = useState(false),
    [discoveryError, setDiscoveryError] = useState("")
  const discoveryAbort = useRef<AbortController | null>(null)
  const discoveryKey = JSON.stringify([
    modelForm?.id,
    modelForm?.base_url,
    modelForm?.key,
  ])
  const discoveryContext = useRef(discoveryKey)
  useEffect(() => {
    discoveryContext.current = discoveryKey
  }, [discoveryKey])
  // Cancel any in-flight discovery when the form context changes (or on unmount).
  useEffect(() => {
    discoveryAbort.current?.abort()
    return () => discoveryAbort.current?.abort()
  }, [discoveryKey])
  // Reset discovery state when the form context changes (official adjust-during-render pattern).
  const [prevDiscoveryKey, setPrevDiscoveryKey] = useState(discoveryKey)
  if (prevDiscoveryKey !== discoveryKey) {
    setPrevDiscoveryKey(discoveryKey)
    setDiscovered([])
    setDiscoveryError("")
    setDiscovering(false)
  }
  async function fetchModelList() {
    if (!modelForm || discovering) return
    const context = discoveryKey,
      controller = new AbortController()
    discoveryAbort.current = controller
    setDiscovering(true)
    setDiscoveryError("")
    setDiscovered([])
    try {
      const data = await api<{ models?: string[] }>(
        "/api/admin/models/discover",
        {
          method: "POST",
          body: {
            id: modelForm.id,
            base_url: modelForm.base_url,
            key: modelForm.key,
          },
          signal: controller.signal,
        },
      )
      if (controller.signal.aborted || context !== discoveryContext.current)
        return
      setDiscovered(data.models || [])
      if (!data.models?.length)
        setDiscoveryError("接口没有返回可选模型，请手动填写模型 ID")
    } catch (error) {
      if (!controller.signal.aborted && context === discoveryContext.current)
        setDiscoveryError((error as Error).message)
    } finally {
      if (context === discoveryContext.current) setDiscovering(false)
    }
  }
  return (
    <section className="admin-section">
      <div className="panel-heading">
        <h2>
          <Settings2 size={17} />
          {ui("模型管理")}
        </h2>
        <button
          className="primary"
          onClick={() => {
            setPresetId("custom")
            setModelForm({
              label: "",
              provider: "openai-compatible",
              base_url: "",
              model: "",
              key: "",
              enabled: true,
              is_default: false,
            })
          }}
        >
          <Plus size={15} />
          {ui("添加模型")}
        </button>
      </div>
      <p className="admin-help">
        {ui(
          "这里配置网站共享模型，Key 会加密保存在服务器。个人使用请到「管理我的 API Key」添加本机模型。",
        )}
      </p>
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
                setPresetId(detectModelPreset(m))
                setModelForm({
                  ...m,
                  original_base_url: m.base_url,
                  key: "",
                  enabled: Boolean(m.enabled),
                  is_default: Boolean(m.is_default),
                })
              }}
            >
              {ui("编辑")}
            </button>
            <button
              className="text-button"
              disabled={busy || Boolean(m.is_default)}
              onClick={() =>
                mutate(
                  "/api/admin/models",
                  { ...m, is_default: true, enabled: true },
                  "PATCH",
                )
              }
            >
              {ui("设为默认")}
            </button>
            <button
              className="text-button"
              disabled={busy || Boolean(m.is_default)}
              onClick={() => {
                if (window.confirm(ui("删除这个模型配置？训练记录仍然保留。")))
                  void mutate("/api/admin/models", { id: m.id }, "DELETE")
              }}
            >
              {ui("删除")}
            </button>
          </div>
        </article>
      ))}
      {modelForm && (
        <Modal
          label={ui("模型编辑")}
          closeLabel={ui("关闭模型编辑")}
          onClose={() => setModelForm(null)}
        >
          <form
            className="account-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await mutate(
                  "/api/admin/models",
                  modelForm,
                  modelForm.id ? "PATCH" : "POST",
                )
              )
                setModelForm(null)
            }}
          >
            <h2>{modelForm.id ? ui("编辑模型") : ui("添加模型")}</h2>
            <label>
              {ui("常用厂商")}
              <select
                aria-label={ui("常用厂商")}
                value={presetId}
                onChange={(e) => {
                  setPresetId(e.target.value)
                  setModelForm(applyModelPreset(modelForm, e.target.value))
                }}
              >
                <option value="custom">{ui("自定义兼容接口")}</option>
                {modelPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {ui(p.label)}
                  </option>
                ))}
              </select>
            </label>
            <p className="provider-preset-help">
              {ui(
                "选择厂商可填入接口地址和类型；模型 ID 按账号可用模型填写，地址仍可编辑。",
              )}
              {selectedPreset && (
                <>
                  {" "}
                  <a
                    href={selectedPreset.docs}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ui("官方接入文档")}
                  </a>
                </>
              )}
            </p>
            <label>
              {ui("显示名称")}
              <input
                required
                value={modelForm.label}
                onChange={(e) =>
                  setModelForm({ ...modelForm, label: e.target.value })
                }
              />
            </label>
            <label>
              {ui("接口类型")}
              <select
                value={modelForm.provider}
                onChange={(e) => {
                  setPresetId("custom")
                  setModelForm({ ...modelForm, provider: e.target.value })
                }}
              >
                <option value="openai-compatible">
                  {ui("OpenAI Chat Completions 兼容")}
                </option>
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
                onChange={(e) => {
                  setPresetId("custom")
                  setModelForm({
                    ...modelForm,
                    base_url: e.target.value,
                    key: "",
                  })
                }}
              />
            </label>
            <label>
              {ui("模型 ID")}
              <input
                required
                value={modelForm.model}
                onChange={(e) =>
                  setModelForm({ ...modelForm, model: e.target.value })
                }
              />
            </label>
            <div className="model-discovery">
              <button
                type="button"
                className="secondary"
                disabled={discovering || !modelForm.base_url.trim()}
                onClick={() => void fetchModelList()}
              >
                <RefreshCw size={14} className={discovering ? "spin" : ""} />
                {ui(discovering ? "正在获取模型…" : "获取模型列表")}
              </button>
              <small>
                {ui("先填写 API Key；编辑已有模型时可使用服务端保存的密钥。")}
              </small>
            </div>
            <label>
              {ui("输出 Token 上限")}
              <input
                type="number"
                min="1"
                max="1048576"
                step="1"
                placeholder={ui("留空使用服务商默认值")}
                value={modelForm.max_output_tokens ?? ""}
                onChange={(e) =>
                  setModelForm({
                    ...modelForm,
                    max_output_tokens: e.target.value,
                  })
                }
              />
              <small>
                {ui(
                  "推理模型的预算可能同时包含思考和最终回答；请按该型号文档设置。",
                )}
              </small>
            </label>
            <label>
              {ui("输出 Token 参数")}
              <select
                value={modelForm.output_token_parameter || "max_tokens"}
                onChange={(e) =>
                  setModelForm({
                    ...modelForm,
                    output_token_parameter: e.target.value,
                  })
                }
              >
                <option value="max_tokens">max_tokens</option>
                <option value="max_completion_tokens">
                  max_completion_tokens
                </option>
              </select>
              <small>
                {ui("按服务商接口要求选择；留空上限时不发送此参数。")}
              </small>
            </label>
            {discovered.length > 0 && (
              <div>
                <span>{ui("从已获取列表选择")}</span>
                <label>
                  {ui("筛选模型列表")}
                  <input
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                </label>
                <div
                  role="listbox"
                  aria-label={ui("从已获取列表选择")}
                  className="model-options"
                >
                  {discovered
                    .filter((id) =>
                      id.toLowerCase().includes(modelSearch.toLowerCase()),
                    )
                    .slice(0, 100)
                    .map((id) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={modelForm.model === id}
                        key={id}
                        onClick={() =>
                          setModelForm({ ...modelForm, model: id })
                        }
                      >
                        {id}
                      </button>
                    ))}
                </div>
                <small>
                  {ui("已获取 {0} 个模型；列表不代表每个模型都支持聊天。", [
                    discovered.length,
                  ])}
                </small>
              </div>
            )}
            {discoveryError && (
              <p className="form-error" role="alert">
                {ui(discoveryError)}
              </p>
            )}
            <label>
              API Key{" "}
              {modelForm.id
                ? ui(
                    modelForm.base_url.replace(/\/+$/, "") ===
                      modelForm.original_base_url?.replace(/\/+$/, "")
                      ? "（留空保留原密钥）"
                      : "（更换接口后需重新填写）",
                  )
                : ""}
              <input
                type="password"
                autoComplete="new-password"
                required={
                  !modelForm.id ||
                  modelForm.base_url.replace(/\/+$/, "") !==
                    modelForm.original_base_url?.replace(/\/+$/, "")
                }
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
                {ui("启用")}
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
                {ui("默认模型")}
              </label>
            </div>
            {error && <div className="form-error">{ui(error)}</div>}
            <button className="primary" disabled={busy}>
              {ui("保存模型")}
            </button>
          </form>
        </Modal>
      )}
    </section>
  )
}
