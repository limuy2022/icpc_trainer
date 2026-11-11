import type { Session } from "./types"

/** Chinese labels for self-marked training outcomes. */
export const outcomes: Record<Session["outcome"], string> = {
  training: "训练中",
  independent: "独立解出",
  assisted: "提示后解出",
  review: "待重练",
}
/** mm:ss for accumulated thinking time. */
export const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
