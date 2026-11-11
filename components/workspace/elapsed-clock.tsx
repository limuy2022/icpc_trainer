"use client";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/training-labels";

/**
 * Self-ticking elapsed display. Isolates the once-per-second state update in
 * this leaf so the workspace tree does not re-render for the clock.
 */
export default function ElapsedClock({
  elapsedBase,
  startedAt,
}: {
  elapsedBase: number;
  startedAt: number | null;
}) {
  const [now, setNow] = useState(() => (startedAt != null ? Date.now() : 0));
  useEffect(() => {
    if (startedAt == null) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [startedAt]);
  const seconds =
    elapsedBase +
    (startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0);
  return <span>{fmt(seconds)}</span>;
}

/** Seconds since a generation started; ticks once per second in place. */
export function ThinkingSeconds({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{Math.max(0, Math.floor((now - startedAt) / 1000))}</>;
}
