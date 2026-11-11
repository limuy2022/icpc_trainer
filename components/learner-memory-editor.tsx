"use client"
import { useEffect, useState } from "react"
import { t as ui, useLocale } from "@/lib/locale"
import { api } from "@/lib/api-client"
import type { LearnerMemoryResponse } from "@/lib/api-types"
import {
  memoryDefaults,
  type LearnerMemory,
  type Mastery,
} from "@/lib/learner-memory"
export default function LearnerMemoryEditor({
  onSaved,
}: {
  onSaved: () => void
}) {
  useLocale()
  const [memory, setMemory] = useState<LearnerMemory>(memoryDefaults),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function load() {
    try {
      const data = await api<LearnerMemoryResponse>("/api/learner-memory")
      setMemory(data.memory)
      setRevision(data.revision)
      setReady(true)
      setError("")
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    // Mount-time load; every setState inside load() runs after its await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])
  const update = (
    index: number,
    value: Partial<LearnerMemory["algorithms"][number]>,
  ) =>
    setMemory({
      ...memory,
      algorithms: memory.algorithms.map((item, i) =>
        i === index ? { ...item, ...value } : item,
      ),
    })
  return (
    <form
      className="account-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError("")
        try {
          await api("/api/learner-memory", {
            method: "PATCH",
            body: { memory, revision },
          })
          onSaved()
        } catch (error) {
          setError((error as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <h2>{ui("跨会话学习记忆")}</h2>
      <p>
        {ui(
          "只保存你确认的学习档案，不自动分析旧对话给你打分。可编辑、删除或关闭，当前会话的说明优先。",
        )}
      </p>
      <button type="button" className="text-button" onClick={() => void load()}>
        {ui("重新加载")}
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          setMemory({ ...memoryDefaults(), enabled: memory.enabled })
        }
      >
        {ui("清空内容（保存后生效）")}
      </button>
      <fieldset disabled={!ready || busy}>
        <label className="assistant-memory-toggle">
          <input
            type="checkbox"
            checked={memory.enabled}
            onChange={(e) =>
              setMemory({ ...memory, enabled: e.target.checked })
            }
          />
          {ui("启用跨会话学习记忆")}
        </label>
        <label>
          {ui("我的基础与水平（自述）")}
          <textarea
            maxLength={1500}
            value={memory.background}
            onChange={(e) =>
              setMemory({ ...memory, background: e.target.value })
            }
          />
        </label>
        <label>
          {ui("长期学习目标")}
          <textarea
            maxLength={1500}
            value={memory.goal}
            onChange={(e) => setMemory({ ...memory, goal: e.target.value })}
          />
        </label>
        {memory.algorithms.map((item, index) => (
          <div className="algorithm-memory-entry" key={index}>
            <label>
              {ui("算法名称")}
              <input
                required
                maxLength={80}
                value={item.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            <label>
              {ui("掌握情况（自评）")}
              <select
                value={item.level}
                onChange={(e) =>
                  update(index, { level: e.target.value as Mastery })
                }
              >
                <option value="learning">{ui("正在学习")}</option>
                <option value="explain">{ui("能解释原理")}</option>
                <option value="implement">{ui("能独立实现并说明边界")}</option>
              </select>
            </label>
            <label>
              {ui("具体依据或待补缺口")}
              <input
                maxLength={300}
                value={item.note}
                onChange={(e) => update(index, { note: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setMemory({
                  ...memory,
                  algorithms: memory.algorithms.filter((_, i) => i !== index),
                })
              }
            >
              {ui("删除这条记忆")}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={memory.algorithms.length >= 40}
          onClick={() =>
            setMemory({
              ...memory,
              algorithms: [
                ...memory.algorithms,
                { name: "", level: "learning", note: "" },
              ],
            })
          }
        >
          {ui("添加算法记忆")}
        </button>
        <p className="muted">
          {ui(
            "关闭后不附加这份学习记忆；等级分选题和当前会话偏好仍按原设置使用。",
          )}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {ui(error)}
          </div>
        )}
        <button className="primary" type="submit">
          {ui("保存学习记忆")}
        </button>
      </fieldset>
      {!ready && error && <div className="form-error">{ui(error)}</div>}
    </form>
  )
}
