"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ExternalLink } from "lucide-react"
import { lessonWikiUrl } from "@/lib/lessons"
import { t as ui, useLocale } from "@/lib/locale"
import { api } from "@/lib/api-client"
import type { WikiArticleResponse } from "@/lib/api-types"

export default function LessonWiki({
  topic,
  children,
  onQuote,
}: {
  topic: { id: string; name: string; path: string }
  children: ReactNode
  onQuote: (quote: string) => void
}) {
  useLocale()
  const [showWiki, setShowWiki] = useState(true)
  const [article, setArticle] = useState<
    { html: string } | { failed: true } | null
  >(null)
  const markup = useMemo(
    () => (article && "html" in article ? { __html: article.html } : undefined),
    [article],
  )
  // Wiki HTML ships server-rendered KaTeX whose `.katex-mathml` copy is only
  // hidden by katex.min.css — load it with the article instead of the first paint.
  useEffect(() => {
    if (article && "html" in article) void import("katex/dist/katex.min.css")
  }, [article])
  const [attempt, setAttempt] = useState(0)
  const articleRef = useRef<HTMLElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  useEffect(() => {
    function trackSelection() {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      selectionRef.current =
        range &&
        !range.collapsed &&
        articleRef.current?.contains(range.commonAncestorContainer)
          ? range.cloneRange()
          : null
      setHasSelection(Boolean(selectionRef.current))
    }
    document.addEventListener("selectionchange", trackSelection)
    trackSelection()
    return () => document.removeEventListener("selectionchange", trackSelection)
  }, [showWiki, article])

  function quoteSelection() {
    const range = selectionRef.current
    if (!range || !articleRef.current?.contains(range.commonAncestorContainer))
      return
    const excerpt = range.cloneContents()
    for (const formula of excerpt.querySelectorAll(".katex")) {
      const latex = formula.querySelector(
        'annotation[encoding="application/x-tex"]',
      )?.textContent
      if (latex) formula.replaceWith(document.createTextNode("$" + latex + "$"))
    }
    for (const block of excerpt.querySelectorAll(
      "h2,h3,h4,h5,h6,p,li,pre,tr,summary,br",
    )) {
      block.after("\n")
    }
    const text = excerpt.textContent?.trim()
    if (!text) return
    const limited =
      text.length > 3500 ? text.slice(0, 3500).trimEnd() + "…" : text
    const source = lessonWikiUrl(topic.path)
    const quote = limited
      .split("\n")
      .map((line) => "> " + line)
      .join("\n")
    onQuote("OI Wiki · " + topic.name + " · <" + source + ">\n\n" + quote)
    window.getSelection()?.removeAllRanges()
  }
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const data = await api<WikiArticleResponse>(
          "/api/wiki-article?" + new URLSearchParams({ topic: topic.id }),
          { signal: controller.signal },
        )
        if (typeof data.html !== "string") throw Error()
        if (!controller.signal.aborted) setArticle({ html: data.html })
      } catch {
        if (!controller.signal.aborted) setArticle({ failed: true })
      }
    }
    void load()
    return () => controller.abort()
  }, [topic.id, attempt])

  return (
    <section id="problem-reader" className="statement-panel lesson-reader">
      <div
        className="panel-heading lesson-reader-toolbar"
        role="group"
        aria-label={ui("专题内容")}
      >
        <button
          type="button"
          className="secondary"
          aria-pressed={showWiki}
          onClick={() => setShowWiki(true)}
        >
          {ui("OI Wiki 原文")}
        </button>
        <button
          type="button"
          className="secondary"
          aria-pressed={!showWiki}
          onClick={() => setShowWiki(false)}
        >
          {ui("学习阶段")}
        </button>
        {showWiki && article && "html" in article && (
          <button
            type="button"
            className="secondary lesson-quote-button"
            disabled={!hasSelection}
            onPointerDown={(event) => event.preventDefault()}
            onClick={quoteSelection}
          >
            {ui("引用并提问")}
          </button>
        )}
      </div>
      {showWiki ? (
        <div
          className="lesson-wiki-scroll"
          tabIndex={0}
          role="region"
          aria-label={ui("OI Wiki 原文")}
        >
          <header className="lesson-wiki-header">
            <h2>{ui(topic.name)}</h2>
            <a
              href={lessonWikiUrl(topic.path)}
              target="_blank"
              rel="noreferrer"
            >
              {ui("在 OI Wiki 打开")} <ExternalLink size={14} />
            </a>
          </header>
          {article === null ? (
            <p role="status">{ui("正在读取 OI Wiki 原文…")}</p>
          ) : "failed" in article ? (
            <div role="status">
              <p>{ui("暂时无法读取 OI Wiki 原文")}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setArticle(null)
                  setAttempt((value) => value + 1)
                }}
              >
                {ui("重试")}
              </button>
            </div>
          ) : (
            <article
              ref={articleRef}
              className="lesson-wiki-body message-text"
              dangerouslySetInnerHTML={markup}
            />
          )}
        </div>
      ) : (
        children
      )}
    </section>
  )
}
