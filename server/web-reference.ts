import { parse, type DefaultTreeAdapterMap } from "parse5"
import { fetchPersonalModel } from "./personal-fetch"

type Node = DefaultTreeAdapterMap["node"]
const skipped = new Set(["script", "style", "noscript", "template", "nav", "footer", "aside", "svg", "iframe"])
const blocks = new Set(["p", "div", "section", "article", "h1", "h2", "h3", "h4", "li", "pre", "tr", "br"])

function extractText(node: Node): string {
  if ("value" in node) return node.value
  if (skipped.has(node.nodeName) || !("childNodes" in node)) return ""
  const content = node.childNodes.map(extractText).join("")
  return blocks.has(node.nodeName) ? "\n" + content + "\n" : content
}

function findNode(node: Node, names: string[]): Node | undefined {
  if (names.includes(node.nodeName)) return node
  if (!("childNodes" in node)) return
  for (const child of node.childNodes) {
    const match = findNode(child, names)
    if (match) return match
  }
}

function requestedLinks(message: string) {
  const links = new Set<string>()
  for (const match of message.matchAll(/https?:\/\/[^\s<>"'`，。；！？、）】》]+/gi)) {
    const candidate = match[0].replace(/[.,;!?)\]]+$/, "")
    if (candidate.length > 2000) continue
    try {
      const url = new URL(candidate)
      if (url.username || url.password) continue
      links.add(url.href)
      if (links.size >= 3) break
    } catch {
      // Ignore malformed links.
    }
  }
  return [...links]
}

async function readPage(link: string) {
  const url = new URL(link)
  url.hash = ""
  const response = await fetchPersonalModel(url, {
    headers: { accept: "text/html, text/plain, text/markdown" },
    signal: AbortSignal.timeout(5500),
  })
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
  if (!response.ok || !response.body || !["text/html", "text/plain", "text/markdown"].includes(contentType ?? "")) {
    await response.body?.cancel()
    throw Error("Unsupported page")
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0, raw = "", truncated = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = 512 * 1024 - bytes
      raw += decoder.decode(value.subarray(0, remaining), { stream: true })
      bytes += value.byteLength
      if (bytes > 512 * 1024) {
        truncated = true
        break
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  raw += decoder.decode()
  const document = contentType === "text/html" ? parse(raw) : null
  const title = document ? extractText(findNode(document, ["title"]) ?? document).trim().slice(0, 120) : ""
  const text = (document
    ? extractText(findNode(document, ["main", "article"]) ?? findNode(document, ["body"]) ?? document)
    : raw).trim().replace(/\n[ \t]*\n(?:[ \t]*\n)*/g, "\n\n")
  if (!text) throw Error("Empty page")
  return { title: title || url.hostname, url: link, text: text.slice(0, 8000), truncated: truncated || text.length > 8000 }
}

export async function webReferences(message: string) {
  const links = requestedLinks(message)
  const results = await Promise.allSettled(links.map(readPage))
  return {
    sources: results.flatMap(result => result.status === "fulfilled" ? [{ title: result.value.title, url: result.value.url }] : []),
    context: links.length ? JSON.stringify(results.map((result, index) => result.status === "fulfilled"
      ? result.value : { url: links[index], unavailable: true })) : "",
  }
}
