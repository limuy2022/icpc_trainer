"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { api, ApiError } from "@/lib/api-client"
import type { SessionsResponse } from "@/lib/api-types"
import type { Session } from "@/lib/types"
import { mergeTraining, snapshotTraining, serializeSessions } from "@/lib/training-merge"
import { createCheckpointScheduler } from "@/lib/checkpoint-scheduler"
type Checkpoint = {
  sessions: Session[]
  base?: Session[]
  revision: number
  pending: boolean
}
export function useTrainingSync(userId: string) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [loaded, setLoaded] = useState(false),
    [syncState, setSyncState] = useState("正在加载服务器记录…")
  const state = useRef({
    sessions,
    base: [] as Session[],
    revision: 0,
    busy: false,
    queued: false,
    ready: false,
  })
  // Mirror the latest sessions into the ref from an effect so render stays pure.
  useEffect(() => {
    state.current.sessions = sessions
  }, [sessions])
  const key = "icpc-account-v2:" + userId
  const checkpoint = useCallback(() => {
    const r = state.current
    if (!r.ready) return
    const data = snapshotTraining(r.sessions)
    try {
      const serialized = serializeSessions(data)
      const baseSerialized = serializeSessions(r.base)
      localStorage.setItem(
        key,
        `{"sessions":${serialized},"base":${baseSerialized},"revision":${r.revision},"pending":${serialized !== baseSerialized}}`,
      )
    } catch {
      /* intentionally ignored */
    }
  }, [key])
  // The workspace is keyed by user id, so one scheduler per mount is enough.
  const checkpointsRef = useRef<ReturnType<typeof createCheckpointScheduler> | undefined>(undefined)
  useEffect(() => {
    const scheduler = createCheckpointScheduler(checkpoint)
    checkpointsRef.current = scheduler
    return () => scheduler.cancel()
  }, [checkpoint])
  const checkpoints = {
    schedule: () => checkpointsRef.current?.schedule(),
    flush: () => checkpointsRef.current?.flush(),
  }
  // Stable identity: the interval/pagehide effect and external callers reuse this.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const save = useCallback(async () => {
    const r = state.current
    if (!r.ready) return
    if (r.busy) {
      r.queued = true
      return
    }
    r.busy = true
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const data = snapshotTraining(r.sessions)
        const serialized = serializeSessions(data)
        if (serialized === serializeSessions(r.base)) {
          setSyncState("已保存到服务器")
          return
        }
        checkpoint()
        setSyncState("正在保存到服务器…")
        let result: SessionsResponse
        try {
          result = await api<SessionsResponse>("/api/sessions", {
            method: "PUT",
            bodyText: `{"sessions":${serialized},"revision":${r.revision}}`,
          })
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 409) throw e
          let latest = e.data as SessionsResponse
          if (!Array.isArray(latest.sessions)) {
            latest = await api<SessionsResponse>("/api/sessions")
          }
          const raw = r.sessions,
            now = Date.now()
          const merged = mergeTraining(
            r.base,
            snapshotTraining(raw, now),
            latest.sessions || [],
          )
          const active = new Set(
            raw.filter((s) => s.startedAt).map((s) => s.id),
          )
          r.sessions = merged.map((s) =>
            active.has(s.id) ? { ...s, startedAt: now } : s,
          )
          r.base = latest.sessions || []
          r.revision = latest.revision
          setSessions(r.sessions)
          checkpoint()
          setSyncState("已合并另一页面的记录，正在保存…")
          continue
        }
        r.base = data
        r.revision = result.revision
        checkpoint()
        setSyncState(
          serializeSessions(snapshotTraining(r.sessions)) === serialized
            ? "已保存到服务器"
            : "正在保存新改动…",
        )
        return
      }
      setSyncState("已保留本机改动，稍后自动重试同步")
    } catch (e) {
      setSyncState((e as Error).message + " · 本机备份保留，将自动重试")
    } finally {
      r.busy = false
      if (r.queued) {
        r.queued = false
        void save()
      }
    }
  }, [checkpoint])
  useEffect(() => {
    let cancelled = false
    api<SessionsResponse>("/api/sessions")
      .then((data) => {
        if (cancelled) return
        let pending: Checkpoint | undefined
        try {
          pending = JSON.parse(localStorage.getItem(key) || "null")
        } catch {
          /* intentionally ignored */
        }
        const remote = snapshotTraining(data.sessions || [])
        let initial = remote
        if (pending?.pending && Array.isArray(pending.sessions))
          initial = mergeTraining(
            pending.base || [],
            snapshotTraining(pending.sessions),
            remote,
          )
        const r = state.current
        r.base = remote
        r.revision = data.revision
        r.sessions = initial
        r.ready = true
        setSessions(initial)
        setLoaded(true)
        checkpoint()
        setSyncState(
          serializeSessions(initial) === serializeSessions(remote)
            ? "已保存到服务器"
            : "已恢复本机改动，正在同步…",
        )
      })
      .catch((e) => {
        if (!cancelled)
          setSyncState(e.message + " · 请刷新重试，本机记录未被覆盖")
      })
    return () => {
      cancelled = true
    }
  }, [key, checkpoint])
  useEffect(() => {
    if (!loaded) return
    checkpoints.schedule()
    const timer = setTimeout(() => void save(), 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkpoints is a stable forwarder
  }, [sessions, loaded, save])
  useEffect(() => {
    const timer = setInterval(() => void save(), 10000)
    const flush = () => {
      if (document.visibilityState === "hidden") {
        checkpoints.flush()
        void save()
      }
    }
    window.addEventListener("pagehide", checkpoints.flush)
    document.addEventListener("visibilitychange", flush)
    return () => {
      clearInterval(timer)
      checkpoints.flush()
      window.removeEventListener("pagehide", checkpoints.flush)
      document.removeEventListener("visibilitychange", flush)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkpoints is a stable forwarder
  }, [save])
  return { sessions, setSessions, loaded, syncState, save }
}
