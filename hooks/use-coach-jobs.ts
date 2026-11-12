"use client"
import { useEffect, useRef, useState } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import { api } from "@/lib/api-client"
import type {
  CoachJobContextResponse,
  CoachJobsResponse,
} from "@/lib/api-types"
import {
  applyJobReply,
  branchHash,
  conversationBranch,
  hasJobReply,
  recoverJobSession,
} from "@/lib/coach-job"
import type { Session } from "@/lib/types"

/**
 * Background coach-job engine: polls /api/coach-jobs, restores replies into
 * sessions (branch-safe), acknowledges completed jobs and recovers generation
 * state after reloads or reconnects. `send()` in the workspace drives the same
 * refs (generationSessionId, submittingJob, directGeneration, ...) directly.
 */
export function useCoachJobs(
  userId: string,
  loaded: boolean,
  sessionsRef: RefObject<Session[]>,
  setSessions: Dispatch<SetStateAction<Session[]>>,
  setToast: (message: string) => void,
) {
  const generationSessionId = useRef<string | null>(null)
  const sendStartedAt = useRef(0)
  const [partialReply, setPartialReply] = useState<{
    sessionId: string
    text: string
    reasoning?: string
  } | null>(null)
  const directGeneration = useRef(false),
    directAbort = useRef<AbortController | null>(null)
  useEffect(() => () => directAbort.current?.abort(), [])
  const activeJob = useRef<string | null>(null),
    submittingJob = useRef(false),
    pollJobs = useRef<() => void>(() => {})
  const sending = useRef(false)
  const [chatRequestId, setChatRequestId] = useState("")
  const [busy, setBusy] = useState(false),
    [chatError, setChatError] = useState("")
  useEffect(() => {
    if (!loaded) return
    let stopped = false,
      inFlight = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined
    const poll = async (force = false) => {
      if (stopped || (inFlight && !force)) return
      if (directGeneration.current) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void poll(), 1000)
        return
      }
      if (force) controller?.abort()
      if (timer) clearTimeout(timer)
      const attempt = new AbortController()
      controller = attempt
      inFlight = true
      try {
        const data = await api<CoachJobsResponse>("/api/coach-jobs", {
          signal: attempt.signal,
        })
        if (stopped || attempt.signal.aborted) return
        const running = data.jobs.find((job) => job.status === "running")
        if (running) {
          generationSessionId.current = running.sessionId
          if (running.requestId) setChatRequestId(running.requestId)
          activeJob.current = running.id
          sending.current = true
          setBusy(true)
          sendStartedAt.current = new Date(running.createdAt).getTime()
          setChatError("")
          setPartialReply({
            sessionId: running.sessionId,
            text: running.text,
            reasoning: running.reasoning,
          })
        }
        for (const job of data.jobs) {
          if (job.status === "running") continue
          if (job.status === "done" && job.result) {
            let snapshot = sessionsRef.current.find(
              (s) => s.id === job.sessionId,
            )
            if (!snapshot || !hasJobReply(snapshot, job.id)) {
              if (
                !snapshot ||
                (await branchHash(conversationBranch(snapshot))) !==
                  job.branchHash
              ) {
                const details = await api<CoachJobContextResponse>(
                  "/api/coach-jobs?context=" + encodeURIComponent(job.id),
                  { signal: attempt.signal },
                )
                job.context = details.job.context
                if (job.context)
                  snapshot = recoverJobSession(snapshot, job.context)
              }
              if (!snapshot) continue
              const before = conversationBranch(snapshot),
                matches = (await branchHash(before)) === job.branchHash
              if (stopped || attempt.signal.aborted) return
              setSessions((prev) => {
                const existing = prev.find((s) => s.id === job.sessionId)
                const seed = job.context
                  ? recoverJobSession(existing, job.context)
                  : existing
                if (!seed) return prev
                const next = applyJobReply(
                  seed,
                  job,
                  matches && conversationBranch(seed) === before,
                )
                return existing
                  ? prev.map((s) => (s.id === job.sessionId ? next : s))
                  : [next, ...prev]
              })
              if (!matches) setToast("对话已变化，回复已保存在历史版本中。")
            }
            if (activeJob.current === job.id) {
              setChatError("")
              if (job.result.requestId) setChatRequestId(job.result.requestId)
            }
            // Server acknowledges only after training sync has durably stored the reply.
            void api("/api/coach-jobs", {
              method: "PATCH",
              body: { id: job.id, action: "ack" },
            }).catch(() => {})
            if (!running) setPartialReply(null)
          } else {
            if (job.requestId) setChatRequestId(job.requestId)
            setChatError(job.error || "回复生成失败，请重试")
            setPartialReply({
              sessionId: job.sessionId,
              text: job.text,
              reasoning: job.reasoning,
            })
            void api("/api/coach-jobs", {
              method: "PATCH",
              body: { id: job.id, action: "ack" },
            }).catch(() => {})
          }
        }
        if (!running && !submittingJob.current) {
          activeJob.current = null
          sending.current = false
          setBusy(false)
        }
      } catch {
        if (!stopped && !attempt.signal.aborted && activeJob.current)
          setChatError("连接已断开，服务器仍会继续生成，返回页面后自动恢复。")
      } finally {
        if (controller === attempt) {
          inFlight = false
          if (!stopped)
            timer = setTimeout(
              () => void poll(),
              activeJob.current && !document.hidden ? 1000 : 2000,
            )
        }
      }
    }
    const resume = () => {
      if (document.visibilityState === "visible") void poll(true)
    }
    pollJobs.current = () => void poll(true)
    void poll()
    window.addEventListener("focus", resume)
    window.addEventListener("online", resume)
    document.addEventListener("visibilitychange", resume)
    return () => {
      stopped = true
      controller?.abort()
      if (timer) clearTimeout(timer)
      window.removeEventListener("focus", resume)
      window.removeEventListener("online", resume)
      document.removeEventListener("visibilitychange", resume)
      pollJobs.current = () => {}
    }
  }, [loaded, userId, sessionsRef, setSessions, setToast])
  async function stopGeneration() {
    if (directAbort.current) {
      directAbort.current.abort()
      return
    }
    const id = activeJob.current
    if (!id) return
    try {
      await api("/api/coach-jobs", {
        method: "PATCH",
        body: { id, action: "cancel" },
      })
      pollJobs.current()
    } catch {
      setChatError("停止请求未送达，请恢复网络后重试。")
    }
  }
  return {
    busy,
    setBusy,
    chatError,
    setChatError,
    chatRequestId,
    setChatRequestId,
    partialReply,
    setPartialReply,
    stopGeneration,
    generationSessionId,
    sendStartedAt,
    sending,
    directGeneration,
    directAbort,
    activeJob,
    submittingJob,
    pollJobs,
  }
}
