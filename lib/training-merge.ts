import { normalizeSessionStatement } from "./statement-header"
import type { Session, Message } from "./types"
export type RecoveredVersion = {
  field: string
  value: unknown
  savedAt: string
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b)

// Sessions are immutable updates, so per-object caches make repeated
// snapshot/serialize passes O(changed) instead of re-walking every statement
// and message. WeakMap entries vanish with their session objects.
const snapshotCache = new WeakMap<Session, Session>()
const serializeCache = new WeakMap<Session, string>()

function snapshotSession(s: Session, now: number): Session {
  if (s.startedAt === null) {
    // Stopped sessions have a fixed elapsed; the snapshot never changes.
    let cached = snapshotCache.get(s)
    if (!cached) {
      cached = {
        ...normalizeSessionStatement(s),
        elapsed: s.elapsed,
        startedAt: null,
      }
      snapshotCache.set(s, cached)
    }
    return cached
  }
  // A running timer changes with `now`; compute fresh (at most one per view).
  return {
    ...normalizeSessionStatement(s),
    elapsed: s.elapsed + Math.max(0, Math.floor((now - s.startedAt) / 1000)),
    startedAt: null,
  }
}

export function snapshotTraining(
  sessions: Session[],
  now = Date.now(),
): Session[] {
  return sessions.map((s) => snapshotSession(s, now))
}

/** Serialize a session list by concatenating per-session cached strings. */
export function serializeSessions(sessions: Session[]): string {
  return (
    "[" +
    sessions
      .map((s) => {
        let serialized = serializeCache.get(s)
        if (serialized === undefined) {
          serialized = JSON.stringify(s)
          serializeCache.set(s, serialized)
        }
        return serialized
      })
      .join(",") +
    "]"
  )
}
function mergeMessages(local: Message[], remote: Message[]) {
  let common = 0
  while (
    common < local.length &&
    common < remote.length &&
    equal(local[common], remote[common])
  )
    common++
  if (common === local.length) return remote
  if (common === remote.length) return local
  // Retain both appended branches. Do not discard repeated messages within a branch.
  const left = local.slice(common),
    right = remote.slice(common)
  const taken = new Map<string, number>()
  for (const m of left) {
    const key = JSON.stringify(m)
    taken.set(key, (taken.get(key) || 0) + 1)
  }
  const remaining = right.filter((m) => {
    const key = JSON.stringify(m),
      n = taken.get(key) || 0
    if (n) {
      taken.set(key, n - 1)
      return false
    }
    return true
  })
  return [...local.slice(0, common), ...left, ...remaining]
}
export function mergeTraining(
  base: Session[],
  local: Session[],
  remote: Session[],
): Session[] {
  const baseline = new Map(base.map((s) => [s.id, s])),
    ours = new Map(local.map((s) => [s.id, s])),
    theirs = new Map(remote.map((s) => [s.id, s]))
  const ids = [
    ...new Set([...local.map((s) => s.id), ...remote.map((s) => s.id)]),
  ]
  return ids.map((id) => {
    const l = ours.get(id),
      r = theirs.get(id),
      b = baseline.get(id)
    if (!l) return r!
    if (!r) return l
    const result = { ...r, ...l } as Session
    const versions: RecoveredVersion[] = []
    const recover = (v: RecoveredVersion) => {
      if (
        !versions.some(
          (old) => old.field === v.field && equal(old.value, v.value),
        )
      )
        versions.push(v)
    }
    for (const v of [
      ...(r.recoveredVersions || []),
      ...(l.recoveredVersions || []),
    ])
      recover(v)
    type SessionKey = Exclude<keyof Session, symbol>
    const keys = new Set<SessionKey>([
      ...(Object.keys(l) as SessionKey[]),
      ...(Object.keys(r) as SessionKey[]),
    ])
    for (const key of keys) {
      if (
        (
          [
            "id",
            "elapsed",
            "startedAt",
            "hints",
            "messages",
            "messagesVersion",
            "recoveredVersions",
          ] as SessionKey[]
        ).includes(key)
      )
        continue
      const lv = l[key],
        rv = r[key],
        bv = b?.[key]
      if (equal(lv, rv) || (b && equal(rv, bv))) {
        result[key] = lv as never
        continue
      }
      if ((b && equal(lv, bv)) || lv === undefined) {
        result[key] = rv as never
        continue
      }
      if (rv === undefined) continue
      if (
        key === "lesson" &&
        (lv as NonNullable<Session["lesson"]>)?.topicId ===
          (rv as NonNullable<Session["lesson"]>)?.topicId &&
        Array.isArray((lv as NonNullable<Session["lesson"]>)?.completed) &&
        Array.isArray((rv as NonNullable<Session["lesson"]>)?.completed)
      ) {
        const localLesson = lv as NonNullable<Session["lesson"]>,
          remoteLesson = rv as NonNullable<Session["lesson"]>,
          baseLesson = bv as NonNullable<Session["lesson"]> | undefined
        result.lesson = {
          ...remoteLesson,
          ...localLesson,
          topicId: localLesson.topicId,
          stage:
            localLesson.stage === (baseLesson?.stage ?? "prerequisites")
              ? remoteLesson.stage
              : localLesson.stage,
          mastery:
            localLesson.mastery === (baseLesson?.mastery ?? "learning")
              ? remoteLesson.mastery
              : localLesson.mastery,
          mastered:
            localLesson.mastered === baseLesson?.mastered
              ? remoteLesson.mastered
              : localLesson.mastered,
          completed: [
            ...new Set([...remoteLesson.completed, ...localLesson.completed]),
          ],
        }
        continue
      }
      if (key === "notes" && typeof lv === "string" && typeof rv === "string") {
        if (lv.includes(rv)) {
          result.notes = lv
          continue
        }
        if (rv.includes(lv)) {
          result.notes = rv
          continue
        }
        result.notes = lv + "\n\n——另一页面保留的草稿——\n" + rv
      } else if (!b && (!lv || equal(lv, []))) {
        result[key] = rv as never
        continue
      }
      recover({ field: key, value: rv, savedAt: new Date().toISOString() })
    }
    const lv = l.messagesVersion || "",
      rv = r.messagesVersion || ""
    if (lv !== rv) {
      // An edit/recall creates a new branch. Never append stale replies to it.
      const winner = lv > rv ? l : r,
        loser = winner === l ? r : l
      result.messages = winner.messages
      result.messagesVersion = winner.messagesVersion
      if (!equal(winner.messages, loser.messages) && loser.messages.length)
        recover({
          field: "messages",
          value: loser.messages,
          savedAt: new Date().toISOString(),
        })
    } else {
      result.messages = mergeMessages(l.messages || [], r.messages || [])
      result.messagesVersion = l.messagesVersion || r.messagesVersion
      if (!result.messagesVersion) delete result.messagesVersion
    }
    result.elapsed = Math.max(l.elapsed || 0, r.elapsed || 0)
    result.hints = Math.max(l.hints || 0, r.hints || 0)
    result.startedAt = null
    if (result.outcome === "independent" && result.hints > 0)
      result.outcome = "assisted"
    if (versions.length) result.recoveredVersions = versions
    return result
  })
}
