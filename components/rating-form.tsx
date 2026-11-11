"use client"
import { t as ui, useLocale } from "@/lib/locale"
import { useState } from "react"
import { api } from "@/lib/api-client"
import { ratingRange } from "@/lib/rating-range"
export default function RatingForm({
  rating,
  onSaved,
}: {
  rating: number | null
  onSaved: (rating: number | null) => void
}) {
  useLocale()
  const [value, setValue] = useState(rating == null ? "" : String(rating)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const parsed = value.trim() === "" ? null : Number(value)
  const valid =
    parsed === null ||
    (Number.isInteger(parsed) && parsed >= 0 && parsed <= 5000)
  const range = ratingRange(valid ? parsed : null)
  return (
    <form
      className="account-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) {
          setError("请输入 0–5000 的整数")
          return
        }
        setBusy(true)
        setError("")
        try {
          const data = await api<{ cfRating: number | null }>("/api/profile", {
            method: "PATCH",
            body: { cfRating: parsed },
          })
          onSaved(data.cfRating)
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <h2>{ui("我的 CF 等级分")}</h2>
      <p>
        {ui(
          "填写自己的 Codeforces Rating，或用一个估计分数作为训练起点。保存后按等级分 −100 到 +300 预设选题。",
        )}
      </p>
      <label>
        {ui("个人等级分")}
        <input
          aria-label={ui("个人 CF 等级分")}
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ui("例如 1600")}
          disabled={busy}
        />
      </label>
      <div className="rating-preview">
        {valid
          ? ui("默认题目难度：{0}–{1}", [range.min, range.max])
          : ui("请输入有效的整数等级分")}
        <small>
          {ui("题库范围为 800–3500，超出部分按边界截取；留空使用 1400–1800。")}
        </small>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {ui(error)}
        </div>
      )}
      <button className="primary" disabled={busy || !valid}>
        {busy ? ui("正在保存…") : ui("保存并应用预设")}
      </button>
    </form>
  )
}
