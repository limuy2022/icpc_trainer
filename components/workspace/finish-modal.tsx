"use client"
import { t as ui } from "@/lib/locale"
import type { Session } from "@/lib/types"
import Modal from "./modal"
import { CheckCircle2, Flag } from "lucide-react"

const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

/** End-of-training modal: records the self-marked outcome and a transferable takeaway. */
export default function FinishModal({
  session,
  elapsed,
  takeaway,
  setTakeaway,
  complete,
  onClose,
}: {
  session: Session
  elapsed: number
  takeaway: string
  setTakeaway: (value: string) => void
  complete: (outcome: Session["outcome"]) => void
  onClose: () => void
}) {
  return (
    <Modal label={ui("记录训练结果")} onClose={onClose}>
      <span className="modal-icon">
        <Flag size={25} />
      </span>
      <h2>{ui("这次思考，带走什么？")}</h2>
      <p>
        {session.problem.id} · {fmt(elapsed)} ·{" "}
        {session.hints === 4
          ? ui("查看过完整解法")
          : ui("使用至 {0} 级提示", [session.hints])}
        {ui("。训练结果由你标记，不代表 CF 已通过。")}
      </p>
      <label>
        {ui("一句可以迁移的观察")}
        <textarea
          rows={4}
          value={takeaway}
          onChange={(e) => setTakeaway(e.target.value)}
          placeholder={ui("比如：遇到拆分很难维护时，试着把操作顺序倒过来。")}
        />
      </label>
      <div className="finish-options">
        <button
          className="primary"
          onClick={() => complete(session.hints ? "assisted" : "independent")}
        >
          <CheckCircle2 size={16} />
          {session.hints ? ui("提示后解出") : ui("独立解出")}
        </button>
        <button className="secondary" onClick={() => complete("review")}>
          {ui("还没走通，待重练")}
        </button>
      </div>
    </Modal>
  )
}
