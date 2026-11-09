"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Session } from "@/lib/types";
import { mergeTraining, snapshotTraining } from "@/lib/training-merge";
type Checkpoint = {
  sessions: Session[];
  base?: Session[];
  revision: number;
  pending: boolean;
};
export function useTrainingSync(userId: string) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [loaded, setLoaded] = useState(false),
    [syncState, setSyncState] = useState("正在加载服务器记录…");
  const state = useRef({
    sessions,
    base: [] as Session[],
    revision: 0,
    busy: false,
    queued: false,
    ready: false,
  });
  state.current.sessions = sessions;
  const key = "icpc-account-v2:" + userId;
  const checkpoint = useCallback(() => {
    const r = state.current;
    if (!r.ready) return;
    const data = snapshotTraining(r.sessions);
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          sessions: data,
          base: r.base,
          revision: r.revision,
          pending: JSON.stringify(data) !== JSON.stringify(r.base),
        } satisfies Checkpoint),
      );
    } catch {}
  }, [key]);
  const save = useCallback(async () => {
    const r = state.current;
    if (!r.ready) return;
    if (r.busy) {
      r.queued = true;
      return;
    }
    r.busy = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const data = snapshotTraining(r.sessions);
        if (JSON.stringify(data) === JSON.stringify(r.base)) {
          setSyncState("已保存到服务器");
          return;
        }
        checkpoint();
        setSyncState("正在保存到服务器…");
        const response = await fetch("/api/sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions: data, revision: r.revision }),
        });
        const result = (await response.json()) as {
          error?: string;
          revision: number;
          sessions?: Session[];
        };
        if (response.status === 409) {
          let latest = result;
          if (!Array.isArray(latest.sessions)) {
            const res = await fetch("/api/sessions");
            if (!res.ok) throw Error("读取最新记录失败");
            latest = (await res.json()) as typeof result;
          }
          const raw = r.sessions,
            now = Date.now();
          const merged = mergeTraining(
            r.base,
            snapshotTraining(raw, now),
            latest.sessions || [],
          );
          const active = new Set(
            raw.filter((s) => s.startedAt).map((s) => s.id),
          );
          r.sessions = merged.map((s) =>
            active.has(s.id) ? { ...s, startedAt: now } : s,
          );
          r.base = latest.sessions || [];
          r.revision = latest.revision;
          setSessions(r.sessions);
          checkpoint();
          setSyncState("已合并另一页面的记录，正在保存…");
          continue;
        }
        if (!response.ok) throw Error(result.error || "保存失败");
        r.base = data;
        r.revision = result.revision;
        checkpoint();
        setSyncState(
          JSON.stringify(snapshotTraining(r.sessions)) === JSON.stringify(data)
            ? "已保存到服务器"
            : "正在保存新改动…",
        );
        return;
      }
      setSyncState("已保留本机改动，稍后自动重试同步");
    } catch (e) {
      setSyncState((e as Error).message + " · 本机备份保留，将自动重试");
    } finally {
      r.busy = false;
      if (r.queued) {
        r.queued = false;
        void save();
      }
    }
  }, [checkpoint]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions")
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          sessions: Session[];
          revision: number;
        };
        if (!response.ok) throw Error(data.error || "读取记录失败");
        if (cancelled) return;
        let pending: Checkpoint | undefined;
        try {
          pending = JSON.parse(localStorage.getItem(key) || "null");
        } catch {}
        const remote = snapshotTraining(data.sessions || []);
        let initial = remote;
        if (pending?.pending && Array.isArray(pending.sessions))
          initial = mergeTraining(
            pending.base || [],
            snapshotTraining(pending.sessions),
            remote,
          );
        const r = state.current;
        r.base = remote;
        r.revision = data.revision;
        r.sessions = initial;
        r.ready = true;
        setSessions(initial);
        setLoaded(true);
        checkpoint();
        setSyncState(
          JSON.stringify(initial) === JSON.stringify(remote)
            ? "已保存到服务器"
            : "已恢复本机改动，正在同步…",
        );
      })
      .catch((e) => {
        if (!cancelled)
          setSyncState(e.message + " · 请刷新重试，本机记录未被覆盖");
      });
    return () => {
      cancelled = true;
    };
  }, [key, checkpoint]);
  useEffect(() => {
    if (!loaded) return;
    checkpoint();
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [sessions, loaded, checkpoint, save]);
  useEffect(() => {
    const timer = setInterval(() => void save(), 10000);
    const flush = () => {
      if (document.visibilityState === "hidden") void save();
    };
    window.addEventListener("pagehide", checkpoint);
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", checkpoint);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [checkpoint, save]);
  return { sessions, setSessions, loaded, syncState, save };
}
