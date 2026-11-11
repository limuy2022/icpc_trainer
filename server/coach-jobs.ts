import { db } from "./database"
import { POST as coach } from "./coach"
import { readChatResponse } from "../lib/chat-response"
import { hasJobReply, type CoachJob } from "../lib/coach-job"
import type { Session } from "../lib/types"
import { selectModel } from "./models"
import { checkOrigin, fail, requireUser, throttle } from "./security"
const running = new Map<string, AbortController>()
export function initCoachJobs() {
  db.prepare(
    "UPDATE coach_jobs SET status='error',error=?,updated_at=? WHERE status='running'",
  ).run("服务重启中断了生成，请重试。", new Date().toISOString())
  db.prepare(
    "DELETE FROM coach_jobs WHERE acknowledged=1 AND updated_at<?",
  ).run(new Date(Date.now() - 30 * 86400000).toISOString())
}
type JobRecord = {
  id: string
  session_id: string
  branch_hash: string
  status: CoachJob["status"] | string
  text: string
  reasoning: string
  result: string | null
  error: string | null
  request_id: string | null
  created_at: string
  context: string | null
}
/** Running jobs are polled every second; cap their growing text so each poll
 *  transfers a bounded tail instead of the full accumulation. */
const RUNNING_TEXT_CAP = 16 * 1024
function capRunningText(job: CoachJob): CoachJob {
  if (job.status !== "running") return job
  const cap = (text: string) =>
    text.length > RUNNING_TEXT_CAP ? "…" + text.slice(-RUNNING_TEXT_CAP) : text
  return { ...job, text: cap(job.text), reasoning: cap(job.reasoning) }
}
function jobFor(row: JobRecord, includeContext = false): CoachJob {
  return {
    id: row.id,
    sessionId: row.session_id,
    branchHash: row.branch_hash,
    status: row.status as CoachJob["status"],
    text: row.text,
    reasoning: row.reasoning,
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error || undefined,
    requestId: row.request_id || undefined,
    createdAt: row.created_at,
    ...(includeContext && row.context
      ? { context: JSON.parse(row.context) }
      : {}),
  }
}
type GenerateBody = {
  jobId?: string
  sessionId?: string
  branchHash?: string
  modelId?: string
  problemId?: string
  sessionSnapshot?: {
    id: string
    problem?: { id: string }
    messages: unknown[]
    notes: string
  }
  id?: string
  action?: string
}
async function generate(id: string, request: Request, body: GenerateBody) {
  const controller = new AbortController()
  running.set(id, controller)
  let text = "",
    reasoning = "",
    timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    timer = undefined
    db.prepare(
      "UPDATE coach_jobs SET text=?,reasoning=?,updated_at=? WHERE id=? AND status='running'",
    ).run(text, reasoning, new Date().toISOString(), id)
  }
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, 250)
  }
  try {
    const response = await coach(
      new Request(request.url.replace(/coach-jobs(?:\?.*)?$/, "coach"), {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ ...body, stream: true }),
        signal: controller.signal,
      }),
    )
    const result = await readChatResponse(response, {
      delta: (value) => {
        text += value
        schedule()
      },
      reasoning: (value) => {
        reasoning += value
        schedule()
      },
      status: (data) => {
        if (data.requestId)
          db.prepare("UPDATE coach_jobs SET request_id=? WHERE id=?").run(
            data.requestId,
            id,
          )
      },
    })
    if (!controller.signal.aborted)
      db.prepare(
        "UPDATE coach_jobs SET status='done',text=?,reasoning=?,result=?,updated_at=? WHERE id=? AND status='running'",
      ).run(
        result.text,
        result.reasoning || "",
        JSON.stringify(result),
        new Date().toISOString(),
        id,
      )
  } catch (error) {
    if (!controller.signal.aborted)
      db.prepare(
        "UPDATE coach_jobs SET status='error',text=?,reasoning=?,error=?,updated_at=? WHERE id=? AND status='running'",
      ).run(
        text,
        reasoning,
        (error as Error).message || "回复生成失败，请重试",
        new Date().toISOString(),
        id,
      )
  } finally {
    if (timer) clearTimeout(timer)
    running.delete(id)
  }
}
export async function coachJobs(request: Request) {
  const user = requireUser(request)
  if (request.method === "GET") {
    const id = new URL(request.url).searchParams.get("context")
    if (id) {
      const row = db
        .prepare("SELECT * FROM coach_jobs WHERE id=? AND user_id=?")
        .get(id, user.id)
      if (!row) fail(404, "生成任务不存在")
      return Response.json({ job: jobFor(row as JobRecord, true) })
    }
    const rows = db
      .prepare(
        "SELECT id,session_id,branch_hash,status,text,reasoning,result,error,request_id,created_at FROM coach_jobs WHERE user_id=? AND acknowledged=0 ORDER BY created_at LIMIT 50",
      )
      .all(user.id)
    return Response.json({
      jobs: rows.map((row) => capRunningText(jobFor(row as JobRecord))),
    })
  }
  type CoachJobRow = {
    id: string
    user_id: string
    session_id: string
    branch_hash: string
    status: string
    text: string
    reasoning: string
    result: string | null
    error: string | null
    request_id: string | null
    created_at: string
    context: string | null
  }
  checkOrigin(request)
  const body = (await request.json()) as {
    jobId?: string
    sessionId?: string
    branchHash?: string
    modelId?: string
    problemId?: string
    sessionSnapshot?: {
      id: string
      problem?: { id: string }
      messages: unknown[]
      notes: string
    }
    id?: string
    action?: string
  }
  if (request.method === "POST") {
    if (
      typeof body.jobId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(body.jobId) ||
      typeof body.sessionId !== "string" ||
      body.sessionId.length > 200 ||
      typeof body.branchHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.branchHash)
    )
      fail(400, "生成任务格式无效")
    const old = db
      .prepare("SELECT * FROM coach_jobs WHERE id=?")
      .get(body.jobId) as CoachJobRow | undefined
    if (old) {
      if (old.user_id !== user.id) fail(404, "生成任务不存在")
      return Response.json({ job: jobFor(old) })
    }
    selectModel(body.modelId, user)
    if (
      db
        .prepare(
          "SELECT id FROM coach_jobs WHERE user_id=? AND status='running'",
        )
        .get(user.id)
    )
      fail(409, "已有回复正在生成，请等待或停止当前任务。")
    throttle("coach:" + user.id, 60, 3600000)
    let context: string | null = null
    if (body.sessionSnapshot) {
      const snapshot = body.sessionSnapshot
      if (
        snapshot.id !== body.sessionId ||
        snapshot.problem?.id !== body.problemId ||
        !Array.isArray(snapshot.messages) ||
        typeof snapshot.notes !== "string"
      )
        fail(400, "生成任务格式无效")
      context = JSON.stringify(snapshot)
      if (Buffer.byteLength(context) > 4 * 1024 * 1024)
        fail(413, "训练上下文过大，请先归档部分对话。")
    }
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO coach_jobs(id,user_id,session_id,branch_hash,status,created_at,updated_at,context) VALUES(?,?,?,?,'running',?,?,?)",
    ).run(
      body.jobId,
      user.id,
      body.sessionId,
      body.branchHash,
      now,
      now,
      context,
    )
    void generate(body.jobId, request, body).catch(() =>
      console.error("coach_job_persistence_failed"),
    )
    return Response.json(
      {
        job: jobFor(
          db
            .prepare("SELECT * FROM coach_jobs WHERE id=?")
            .get(body.jobId) as JobRecord,
        ),
      },
      { status: 202 },
    )
  }
  if (request.method !== "PATCH") fail(405, "不支持的操作")
  const row = db
    .prepare("SELECT * FROM coach_jobs WHERE id=? AND user_id=?")
    .get(String(body.id), user.id) as CoachJobRow | undefined
  if (!row) fail(404, "生成任务不存在")
  if (body.action === "cancel") {
    running.get(row.id)?.abort()
    db.prepare(
      "UPDATE coach_jobs SET status='cancelled',error=?,updated_at=? WHERE id=? AND status='running'",
    ).run(
      "已停止生成，未完成内容未写入历史。",
      new Date().toISOString(),
      row.id,
    )
  } else if (body.action === "ack") {
    if (row.status === "running") fail(409, "回复仍在生成")
    if (row.status === "done") {
      const stored = db
        .prepare("SELECT payload FROM training_data WHERE user_id=?")
        .get(user.id) as { payload: string } | undefined
      if (
        !stored ||
        !(JSON.parse(stored.payload) as Session[]).some(
          (s) => s.id === row.session_id && hasJobReply(s, row.id),
        )
      )
        fail(409, "回复尚未保存到训练记录")
    }
    db.prepare(
      "UPDATE coach_jobs SET acknowledged=1,text='',reasoning='',result=NULL,context=NULL WHERE id=?",
    ).run(row.id)
  } else fail(400, "任务操作无效")
  return Response.json({ ok: true })
}
