"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Session } from "@/lib/types";
function snapshot(sessions: Session[]) {
  return sessions.map((s) => ({
    ...s,
    elapsed:
      s.elapsed +
      (s.startedAt
        ? Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000))
        : 0),
    startedAt: null,
  }));
}
export function useTrainingSync(userId: string) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [loaded, setLoaded] = useState(false),
    [syncState, setSyncState] = useState("正在加载云端记录…"),
    [conflict, setConflict] = useState(false);
  const refs = useRef({
    sessions,
    revision: 0,
    lastSaved: "[]",
    busy: false,
    queued: false,
    blocked: false,
    ready: false,
  });
  refs.current.sessions = sessions;
  const cacheKey = "icpc-account-v2:" + userId;
  const save = useCallback(async () => {
    const r = refs.current;
    if (!r.ready || r.blocked) return;
    if (r.busy) {
      r.queued = true;
      return;
    }
    const data = snapshot(r.sessions),
      payload = JSON.stringify(data);
    if (payload === r.lastSaved) return;
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ sessions: data, revision: r.revision, pending: true }),
      );
    } catch {}
    r.busy = true;
    setSyncState("正在保存到服务器…");
    try {
      const response = await fetch("/api/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: data, revision: r.revision }),
      });
      const result = (await response.json()) as any;
      if (response.status === 409) {
        r.blocked = true;
        setConflict(true);
        throw Error(result.error);
      }
      if (!response.ok) throw Error(result.error || "保存失败");
      r.revision = result.revision;
      r.lastSaved = payload;
      setSyncState("已保存到服务器");
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            sessions: snapshot(r.sessions),
            revision: r.revision,
            pending: JSON.stringify(snapshot(r.sessions)) !== payload,
          }),
        );
      } catch {}
    } catch (e) {
      setSyncState((e as Error).message + " · 本机备份保留");
    } finally {
      r.busy = false;
      if (r.queued) {
        r.queued = false;
        void save();
      }
    }
  }, [cacheKey]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions")
      .then(async (response) => {
        const data = (await response.json()) as any;
        if (!response.ok) throw Error(data.error);
        if (cancelled) return;
        const server = (data.sessions || []) as Session[];
        let initial = server;
        let pending: any;
        try {
          pending = JSON.parse(localStorage.getItem(cacheKey) || "null");
        } catch {}
        const r = refs.current;
        r.revision = data.revision;
        r.lastSaved = JSON.stringify(snapshot(server));
        if (pending?.pending && Array.isArray(pending.sessions)) {
          initial = pending.sessions;
          if (pending.revision !== data.revision) {
            r.blocked = true;
            setConflict(true);
            setSyncState("本机未保存记录与云端版本冲突，请先导出再刷新");
          } else setSyncState("正在恢复本机未同步记录…");
        } else setSyncState("已保存到服务器");
        r.ready = true;
        setSessions(initial.map((s) => ({ ...s, startedAt: null })));
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled)
          setSyncState(e.message + " · 请刷新重试，未覆盖本机记录");
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);
  useEffect(() => {
    if (!loaded) return;
    try {
      const data = snapshot(sessions);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          sessions: data,
          revision: refs.current.revision,
          pending: JSON.stringify(data) !== refs.current.lastSaved,
        }),
      );
    } catch {}
    const timer = setTimeout(() => void save(), 1000);
    return () => clearTimeout(timer);
  }, [sessions, loaded, save]);
  useEffect(() => {
    const timer = setInterval(() => void save(), 10000);
    const flush = () => {
      if (document.visibilityState === "hidden") void save();
    };
    const cacheOnExit = () => {
      const r = refs.current;
      if (!r.ready) return;
      try {
        const data = snapshot(r.sessions);
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            sessions: data,
            revision: r.revision,
            pending: JSON.stringify(data) !== r.lastSaved,
          }),
        );
      } catch {}
    };
    window.addEventListener("pagehide", cacheOnExit);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", cacheOnExit);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [save]);
  function useServerVersion() {
    localStorage.removeItem(cacheKey);
    window.location.reload();
  }
  return {
    sessions,
    setSessions,
    loaded,
    syncState,
    conflict,
    save,
    useServerVersion,
  };
}
