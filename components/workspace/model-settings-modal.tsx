"use client"
import { t as ui } from "@/lib/locale"
import { api } from "@/lib/api-client"
import type { ModelOption, ModelPreferencesResponse } from "@/lib/api-types"
import { type ReasoningLevel } from "@/lib/reasoning"
import { saveBrowserPreferences } from "@/lib/browser-models"
import type { Account } from "@/lib/types"
import Modal from "./modal"
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import { useState } from "react"

/** Model selection modal: site models vs browser-direct models, with reasoning level. */
export default function ModelSettingsModal({
  user,
  models,
  modelId,
  setModelId,
  setModelName,
  reasoningEffort,
  supportedEfforts,
  selectedModel,
  efforts,
  setEfforts,
  syncState,
  onClose,
  onManageKeys,
  onSaved,
  onBrowserSaved,
}: {
  user: Account
  models: ModelOption[]
  modelId: string
  setModelId: (id: string) => void
  modelName: string
  setModelName: (name: string) => void
  reasoningEffort: ReasoningLevel
  supportedEfforts: { value: string; label: string }[]
  selectedModel: ModelOption | undefined
  efforts: Record<string, ReasoningLevel>
  setEfforts: (next: Record<string, ReasoningLevel>) => void
  syncState: string
  onClose: () => void
  onManageKeys: () => void
  onSaved: (preferences: { efforts: Record<string, ReasoningLevel> }) => void
  onBrowserSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  return (
    <Modal label={ui("陪练模型")} closeLabel={ui("关闭设置")} onClose={onClose}>
      <span className="modal-icon">
        <Sparkles size={25} />
      </span>
      <h2>{ui("选择陪练模型")}</h2>
      <p>
        {ui(
          "网站模型由服务器代调；本机模型的 Key 仅存在此浏览器，直接请求服务商，不上传本站。",
        )}
      </p>
      <div className="model-choice">
        <span id="model-choice-label">{ui("当前陪练模型")}</span>
        <div
          className="model-options"
          role="listbox"
          aria-labelledby="model-choice-label"
        >
          {models.map((m) => (
            <button
              type="button"
              key={m.id}
              role="option"
              aria-selected={modelId === m.id}
              disabled={busy}
              onClick={() => {
                setError("")
                setModelId(m.id)
                setModelName(m.model)
              }}
            >
              <strong>{m.label}</strong>
              <span>
                {m.model} ·{" "}
                {ui(m.scope === "browser" ? "本机直连" : "网站密钥")}
              </span>
            </button>
          ))}
        </div>
        {!models.length && (
          <p>{ui("没有可选模型，请添加本机模型或联系管理员授权。")}</p>
        )}
      </div>
      <label>
        {ui("推理等级")}
        <select
          aria-label={ui("推理等级")}
          value={reasoningEffort}
          disabled={busy || !models.length}
          onChange={(e) =>
            setEfforts({
              ...efforts,
              [modelId]: e.target.value as ReasoningLevel,
            })
          }
        >
          {supportedEfforts.map((option) => (
            <option key={option.value} value={option.value}>
              {ui(option.label)}
            </option>
          ))}
        </select>
      </label>
      <p className="reasoning-help">
        {/glm-5\.3/i.test(selectedModel?.model || "")
          ? ui(
              "GLM-5.3 始终开启思考，可选择轻度、增强或深度；模型默认使用服务商默认等级。",
            )
          : /glm-/i.test(selectedModel?.model || "")
            ? ui("按当前 GLM 型号提供可用思考选项。")
            : ui(
                "非默认等级通过 reasoning_effort 发送，兼容接口需要支持该参数；不支持时请选模型默认。",
              )}
        {ui(
          "更高等级可能增加等待时间与 Token 消耗。设置用于后续陪练和翻译，按账号和模型保存。",
        )}
      </p>
      {error && (
        <div className="form-error" role="alert">
          {ui(error)}
        </div>
      )}
      <div className="settings-note">
        <CheckCircle2 size={16} />
        <span>
          {ui(syncState)}。
          {user.role === "admin"
            ? ui("添加或修改模型请进入管理员面板。")
            : ui("网站密钥需管理员授权；自带 Key 仅本机直连。")}
        </span>
      </div>
      <button type="button" className="secondary" onClick={onManageKeys}>
        {ui("管理我的 API Key")}
      </button>
      <div className="modal-actions">
        <span className="muted">
          {ui(
            selectedModel?.scope === "browser"
              ? "本机直连：切屏后可能中断"
              : "网站模型：支持后台生成",
          )}
        </span>
        <button
          className="primary"
          disabled={busy || !models.length}
          onClick={async () => {
            setBusy(true)
            setError("")
            try {
              if (selectedModel?.scope === "browser") {
                saveBrowserPreferences(user.id, {
                  selectedModelId: modelId,
                  efforts: { ...efforts, [modelId]: reasoningEffort },
                })
                onBrowserSaved()
                return
              }
              const data = await api<ModelPreferencesResponse>(
                "/api/model-preferences",
                { method: "PATCH", body: { modelId, reasoningEffort } },
              )
              saveBrowserPreferences(user.id, {
                selectedModelId: modelId,
                efforts: { ...efforts, ...data.preferences.efforts },
              })
              onSaved(data.preferences)
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? ui("正在保存…") : ui("保存并开始思考")}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  )
}
