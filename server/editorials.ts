import {
  CODEFORCES_API_BLOG_ENTRY,
  MAX_RESPONSE_SIZE,
  REFERENCE_CACHE_TTL_MS,
} from "../lib/constants"
import { db } from "./database"
import {
  editorialSection,
  tutorialLinks,
  type Editorial,
} from "../lib/editorials"
const pending = new Map<string, Promise<Editorial>>()
const failures = new Map<string, number>()
async function read(url: string, json = false, deadline = Date.now() + 7000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(
      Math.max(1, Math.min(7000, deadline - Date.now())),
    ),
    redirect: "error",
    headers: { Accept: json ? "application/json" : "text/html" },
  })
  if (
    !response.ok ||
    Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_SIZE
  )
    throw Error("官方题解来源不可用")
  const reader = response.body?.getReader()
  if (!reader) throw Error("题解正文为空")
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.length
      if (size > MAX_RESPONSE_SIZE) throw Error("题解响应过大")
      parts.push(chunk.value)
    }
  } finally {
    await reader.cancel()
  }
  return Buffer.concat(parts).toString("utf8")
}
async function retrieve(contest: string, index: string): Promise<Editorial> {
  const deadline = Date.now() + 18000
  const pages = [
    `https://codeforces.com/problemset/problem/${contest}/${index}?locale=en`,
    `https://codewithsathya.github.io/codeforces-problems/content/${contest}:${index}.html`,
  ]
  for (const discoveryUrl of pages) {
    let links: string[]
    try {
      links = tutorialLinks(await read(discoveryUrl, false, deadline))
    } catch {
      continue
    }
    for (const url of links) {
      try {
        const id = url.split("/").at(-1)!
        const data = JSON.parse(
          await read(
            `${CODEFORCES_API_BLOG_ENTRY}?blogEntryId=${id}`,
            true,
            deadline,
          ),
        )
        if (
          data.status !== "OK" ||
          data.result?.id !== Number(id) ||
          typeof data.result.content !== "string"
        )
          continue
        const text = editorialSection(data.result.content, contest, index)
        return { text, url, discoveryUrl, fetchedAt: new Date().toISOString() }
      } catch {
        continue
      }
    }
  }
  throw Error("未能获取或确认当前题目的官方题解")
}
export async function getEditorial(
  contest: string,
  index: string,
): Promise<Editorial> {
  if (!/^\d{1,7}$/.test(contest) || !/^[A-Z][A-Z0-9]{0,3}$/.test(index))
    throw Error("题号无效")
  const id = contest + index
  const row = db
    .prepare(
      "SELECT payload,fetched_at FROM editorial_cache WHERE problem_id=?",
    )
    .get(id) as { payload: string; fetched_at: string } | undefined
  const cached = row ? (JSON.parse(row.payload) as Editorial) : undefined
  if (
    cached &&
    Date.now() - Date.parse(row!.fetched_at) < REFERENCE_CACHE_TTL_MS
  )
    return cached
  if ((failures.get(id) || 0) > Date.now()) {
    if (cached) return { ...cached, stale: true }
    throw Error("题解获取暂不可用，请稍后重试")
  }
  let work = pending.get(id)
  if (!work) {
    work = retrieve(contest, index)
      .then((result) => {
        db.prepare(
          "INSERT INTO editorial_cache(problem_id,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(problem_id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at",
        ).run(id, JSON.stringify(result), result.fetchedAt)
        failures.delete(id)
        return result
      })
      .catch((error) => {
        failures.set(id, Date.now() + 300000)
        if (failures.size > 1000) failures.delete(failures.keys().next().value!)
        if (cached) return { ...cached, stale: true }
        throw error
      })
      .finally(() => pending.delete(id))
    pending.set(id, work)
  }
  return work
}
