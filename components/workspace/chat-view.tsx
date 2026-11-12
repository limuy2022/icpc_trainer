"use client"
import { t as ui, currentLocale, useLocale } from "@/lib/locale"
import { assistantSessionTitle } from "@/lib/assistant"
import { outcomes } from "@/lib/training-labels"
import { problemUrl } from "@/lib/types"
import type { Session } from "@/lib/types"
import { LessonProgress } from "@/components/lesson-learning"
const AssistantTools = lazy(() => import("@/components/assistant-tools"))
import ProblemStatement from "@/components/problem-statement"
import ReasoningDetails from "@/components/reasoning-details"
import RecoveredVersions from "@/components/recovered-versions"
import Text from "@/components/lazy-markdown-text"
import DifficultyBadge from "@/components/difficulty-badge"
import {
  BookOpen,
  ChevronLeft,
  ExternalLink,
  Flag,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  NotebookPen,
  Pencil,
  Play,
  Pause,
  Send,
  Sparkles,
  Target,
  Undo2,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import ElapsedClock, { ThinkingWait } from "@/components/workspace/elapsed-clock"
import type { StatementMetadata } from "@/lib/statement-header"

const renderMarkdown = (text: string) => <Text text={text} />
const renderPlain = (text: string) => text

type SendEdit = { index: number; original: string; content: string }

/** Training / assistant / lesson conversation workspace: statement panel + coach chat. */
function useDebouncedSessionText(
  sessionId: string,
  value: string,
  patch: (id: string, change: { notes?: string; statement?: string }) => void,
  field: "notes" | "statement",
  delay = 600,
) {
  const [draft, setDraft] = useState(value)
  // Follow external updates (statement fetch, session switches) while idle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived-state resync on external change
    setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync on identity change only
  }, [sessionId, value])
  // Flush unsaved input when the view unmounts (e.g. navigating away).
  const latest = useRef({ draft, value, sessionId, patch, field })
  useEffect(() => {
    latest.current = { draft, value, sessionId, patch, field }
  })
  useEffect(
    () => () => {
      const s = latest.current
      if (s.draft !== s.value && s.sessionId)
        s.patch(s.sessionId, { [s.field]: s.draft })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only flush
    [],
  )
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => patch(sessionId, { [field]: draft }), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value` compared in-line
  }, [draft])
  return [draft, setDraft] as const
}

export default function ChatView({
  view,
  isAssistant,
  isLesson,
  session,
  loaded,
  syncState,
  trainingSessions,
  resume,
  navigate,
  assistantChats,
  openAssistantConversation,
  newAssistantConversation,
  updateAssistantConversation,
  onOpenMemory,
  busy,
  chatError,
  chatRequestId,
  retryMode,
  send,
  messageEdit,
  setMessageEdit,
  recallMessage,
  partialReply,
  generationSessionId,
  stopGeneration,
  sendStartedAt,
  editor,
  setEditor,
  statementBusy,
  statementError,
  loadStatement,
  statementLanguage,
  setStatementLanguage,
  statementFont,
  setStatementFont,
  translation,
  translating,
  translationErrors,
  translateStatement,
  statementParts,
  allowUnverified,
  setAllowUnverified,
  patch,
  aiConfigured,
  setSettings,
  rememberLesson,
  quoteLesson,
  chatEnd,
  composerInput,
  draft,
  setDraft,
  onFinish,
}: {
  view: string
  isAssistant: boolean
  isLesson: boolean
  session: Session | undefined
  loaded: boolean
  syncState: string
  trainingSessions: Session[]
  resume: (session: Session) => void
  navigate: (view: import("@/lib/workspace-route").WorkspaceView) => void
  assistantChats: Session[]
  openAssistantConversation: (id: string) => void
  newAssistantConversation: () => void
  updateAssistantConversation: (id: string, change: Partial<Session>) => void
  onOpenMemory: () => void
  busy: boolean
  chatError: string
  chatRequestId: string
  retryMode: string
  send: (
    mode?: string,
    edit?: SendEdit,
    retry?: boolean,
  ) => Promise<void> | void
  messageEdit: {
    sessionId: string
    index: number
    original: string
    content: string
  } | null
  setMessageEdit: Dispatch<
    SetStateAction<{
      sessionId: string
      index: number
      original: string
      content: string
    } | null>
  >
  recallMessage: (index: number) => void
  partialReply: { sessionId: string; text: string; reasoning?: string } | null
  generationSessionId: RefObject<string | null>
  stopGeneration: () => Promise<void>
  sendStartedAt: RefObject<number>
  editor: boolean
  setEditor: Dispatch<SetStateAction<boolean>>
  statementBusy: boolean
  statementError: string
  loadStatement: (problem: Session["problem"], id: string) => Promise<void>
  statementLanguage: "original" | "zh" | "compare"
  setStatementLanguage: Dispatch<SetStateAction<"original" | "zh" | "compare">>
  statementFont: number
  setStatementFont: Dispatch<SetStateAction<number>>
  translation: { text: string; original: string; model: string } | undefined
  translating: string | null
  translationErrors: Record<string, string>
  translateStatement: (forceRefresh?: boolean) => Promise<void>
  statementParts: { metadata?: StatementMetadata }
  allowUnverified: boolean
  setAllowUnverified: Dispatch<SetStateAction<boolean>>
  patch: (id: string, change: Partial<Session>) => void
  aiConfigured: boolean
  setSettings: (open: boolean) => void
  rememberLesson: () => Promise<void>
  quoteLesson: (quote: string) => void
  chatEnd: RefObject<HTMLDivElement | null>
  composerInput: RefObject<HTMLTextAreaElement | null>
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  onFinish: () => void
}) {
  useLocale()
  // Keystrokes stay local; sessions (and their save pipeline) update on pause.
  const [statementDraft, setStatementDraft] = useDebouncedSessionText(
    session?.id ?? "",
    session?.statement ?? "",
    patch,
    "statement",
  )
  const [notesDraft, setNotesDraft] = useDebouncedSessionText(
    session?.id ?? "",
    session?.notes ?? "",
    patch,
    "notes",
  )
  return (
    <>
      {view === "training" && !loaded && (
        <div className="empty" role="status">
          <LoaderCircle className="spin" size={20} />
          <p>{ui("正在恢复训练记录…")}</p>
          <p>{ui(syncState)}</p>
        </div>
      )}
      {view === "training" && loaded && !session && (
        <main className="main-content">
          <div className="empty large-empty">
            <MessageCircle size={38} />
            <h2>{ui("从一道题，一句话开始。")}</h2>
            <p>{ui("挑一道题，把你的第一反应告诉 AI 陪练。")}</p>
            <button className="primary" onClick={() => navigate("bank")}>
              {ui("去发现题目")}
              <ArrowRight size={16} />
            </button>
            {trainingSessions
              .filter((s) => s.outcome === "training")
              .map((s) => (
                <button
                  className="resume-button"
                  key={s.id}
                  onClick={() => resume(s)}
                >
                  {ui("继续")}
                  {s.problem.id} · {s.problem.name}
                  <ArrowRight size={14} />
                </button>
              ))}
          </div>
        </main>
      )}
      {(view === "training" || view === "assistant" || isLesson) && session && (
        <main
          className={
            view === "assistant"
              ? "training-content assistant-workspace"
              : "training-content"
          }
        >
          <div className="training-heading">
            <div>
              <button
                className="back-button"
                onClick={() => navigate(isLesson ? "lessons" : "bank")}
              >
                <ChevronLeft size={15} />
                {ui(isLesson ? "专题列表" : "题库")}
              </button>
              <h1>
                {!isAssistant && <span>{session.problem.id}</span>}
                {isLesson
                  ? ui("专题学习") + " · " + ui(session.problem.name)
                  : isAssistant
                    ? ui(assistantSessionTitle(session))
                    : session.problem.name}
              </h1>
              {!isAssistant && (
                <div className="training-meta">
                  <span className="rating">
                    <span />
                    {session.problem.rating}
                  </span>
                  <DifficultyBadge rating={session.problem.rating} />
                  <a
                    href={problemUrl(session.problem)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ui("打开 CF 原题")}
                    <ExternalLink size={13} />
                  </a>
                  <span>{ui(outcomes[session.outcome])}</span>
                </div>
              )}
            </div>
            {view === "assistant" && (
              <Suspense fallback={null}>
                <AssistantTools
                  sessions={assistantChats}
                  current={session}
                  onOpen={openAssistantConversation}
                  onNew={newAssistantConversation}
                  onChange={updateAssistantConversation}
                  onMemory={onOpenMemory}
                />
              </Suspense>
            )}
            {!isAssistant && (
              <div className="training-actions">
                <button
                  className="timer"
                  onClick={() =>
                    session.startedAt
                      ? patch(session.id, {
                          elapsed:
                            session.elapsed +
                            Math.max(
                              0,
                              Math.floor(
                                (Date.now() - session.startedAt) / 1000,
                              ),
                            ),
                          startedAt: null,
                        })
                      : patch(session.id, { startedAt: Date.now() })
                  }
                >
                  {session.startedAt ? <Pause size={15} /> : <Play size={15} />}
                  <ElapsedClock
                    elapsedBase={session.elapsed}
                    startedAt={session.startedAt}
                  />
                </button>
                <button className="primary" disabled={busy} onClick={onFinish}>
                  <Flag size={15} />
                  {ui("结束并记录")}
                </button>
              </div>
            )}
          </div>
          {view !== "assistant" && (
            <nav className="mobile-training-jump" aria-label={ui("训练区域")}>
              <a
                href="#problem-reader"
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById("problem-reader")
                    ?.scrollIntoView({ block: "start" })
                }}
              >
                {ui(isLesson ? "专题内容" : "阅读题目")}
              </a>
              <a
                href="#ai-coach"
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById("ai-coach")
                    ?.scrollIntoView({ block: "start" })
                }}
              >
                {ui("与 AI 讨论")}
              </a>
            </nav>
          )}
          <div
            className={
              view === "assistant"
                ? "training-grid assistant-chat-grid"
                : "training-grid"
            }
          >
            {isLesson ? (
              <LessonProgress
                session={session}
                busy={busy}
                onChange={(change) => patch(session.id, change)}
                onExplain={() => void send("lesson")}
                onRemember={() => void rememberLesson()}
                onQuote={quoteLesson}
              />
            ) : isAssistant ? null : (
              <section id="problem-reader" className="statement-panel">
                <div className="panel-heading">
                  <h2>
                    <BookOpen size={17} />
                    {ui("题目工作区")}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setEditor(!editor)}
                  >
                    {editor ? ui("保存题面") : ui("编辑 / 粘贴题面")}
                  </button>
                </div>
                <div className="statement-help">
                  {ui(
                    "题面会自动读取并缓存，来源显示在正文下方。可编辑或粘贴修正。",
                  )}
                </div>
                {statementBusy && (
                  <div className="inline-loading">
                    <LoaderCircle size={16} className="spin" />
                    {ui("正在读取 CF 题面…")}
                  </div>
                )}
                {statementError && (
                  <div className="warning">
                    {ui(statementError)}
                    <button onClick={() => setEditor(true)}>
                      {ui("粘贴题面")}
                    </button>
                    <button
                      onClick={() => loadStatement(session.problem, session.id)}
                    >
                      {ui("重试读取")}
                    </button>
                  </div>
                )}
                {editor ? (
                  <textarea
                    className="statement-editor"
                    aria-label={ui("题面内容")}
                    value={statementDraft}
                    onChange={(e) => setStatementDraft(e.target.value)}
                    placeholder={ui(
                      "粘贴完整题面、输入输出约束与样例。AI 会基于这里的内容陪练。",
                    )}
                  />
                ) : session.statement ? (
                  <>
                    <div className="statement-toolbar">
                      <div
                        className="statement-language"
                        role="group"
                        aria-label={ui("题面语言")}
                      >
                        <button
                          className={
                            statementLanguage === "original" ? "selected" : ""
                          }
                          onClick={() => setStatementLanguage("original")}
                        >
                          {ui("英文原文")}
                        </button>
                        <button
                          className={
                            statementLanguage === "zh" ? "selected" : ""
                          }
                          onClick={() => {
                            setStatementLanguage("zh")
                            void translateStatement()
                          }}
                        >
                          {ui("中文译文")}
                        </button>
                        <button
                          className={
                            statementLanguage === "compare" ? "selected" : ""
                          }
                          onClick={() => {
                            setStatementLanguage("compare")
                            void translateStatement()
                          }}
                        >
                          {ui("中英对照")}
                        </button>
                      </div>
                      <div className="statement-font">
                        <button
                          aria-label={ui("缩小题面字体")}
                          onClick={() =>
                            setStatementFont((v) => Math.max(15, v - 1))
                          }
                        >
                          A−
                        </button>
                        <span>{statementFont}px</span>
                        <button
                          aria-label={ui("放大题面字体")}
                          onClick={() =>
                            setStatementFont((v) => Math.min(22, v + 1))
                          }
                        >
                          A＋
                        </button>
                      </div>
                    </div>
                    <div
                      className={
                        "statement-text " +
                        (statementLanguage === "compare"
                          ? "statement-columns"
                          : "")
                      }
                      style={{ fontSize: statementFont }}
                    >
                      {statementLanguage !== "zh" && (
                        <section>
                          {statementLanguage === "compare" && (
                            <h3 className="statement-column-label">
                              {ui("英文原文")}
                            </h3>
                          )}
                          <ProblemStatement
                            text={session.statement}
                            metadata={statementParts.metadata}
                            render={
                              session.statementFormat === "markdown"
                                ? renderMarkdown
                                : renderPlain
                            }
                          />
                        </section>
                      )}
                      {statementLanguage !== "original" && (
                        <section>
                          {statementLanguage === "compare" && (
                            <h3 className="statement-column-label">
                              {ui("中文译文")}
                            </h3>
                          )}
                          {translation ? (
                            <>
                              <div className="translation-notice">
                                {ui("AI 译文 ·")}
                                {translation.model} {ui("· 公式与样例保持原样")}
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={translating === session.id}
                                  onClick={() => void translateStatement(true)}
                                >
                                  {ui(
                                    translating === session.id
                                      ? "正在重新翻译…"
                                      : "用当前模型重新翻译",
                                  )}
                                </button>
                              </div>
                              {translationErrors[session.id] && (
                                <div className="form-error" role="alert">
                                  {ui(translationErrors[session.id])}
                                </div>
                              )}
                              <ProblemStatement
                                metadata={statementParts.metadata}
                                text={translation.text}
                                render={renderMarkdown}
                              />
                            </>
                          ) : (
                            <div className="translation-empty">
                              {translating === session.id ? (
                                <>
                                  <LoaderCircle size={19} className="spin" />
                                  <p>
                                    {ui("正在准备中文译文，原文仍可随时查看…")}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p>
                                    {ui(
                                      "优先读取已有译文；没有译文时才使用当前模型生成。切换陪练模型不会重新翻译。",
                                    )}
                                  </p>
                                  {translationErrors[session.id] && (
                                    <div className="form-error" role="alert">
                                      {translationErrors[session.id]}
                                    </div>
                                  )}
                                  <button
                                    className="primary"
                                    onClick={() => void translateStatement()}
                                  >
                                    <Sparkles size={16} />
                                    {translationErrors[session.id]
                                      ? ui("重试翻译")
                                      : ui("查看中文译文")}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                    {session.statementSource && (
                      <div className="statement-source">
                        {ui("来源：")}
                        <a
                          href={session.statementSource.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ui(session.statementSource.name)}
                          <ExternalLink size={11} />
                        </a>
                        {session.statementFetchedAt && (
                          <span>
                            {ui("读取于")}{" "}
                            {new Date(
                              session.statementFetchedAt,
                            ).toLocaleDateString(currentLocale())}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : !statementBusy && !statementError ? (
                  <div className="empty">
                    <p>{ui("请从 CF 原题复制题面到这里。")}</p>
                    <button onClick={() => setEditor(true)}>
                      {ui("粘贴题面")}
                    </button>
                  </div>
                ) : null}
                <div className="notes-heading">
                  <NotebookPen size={16} />
                  {ui("我的观察与草稿")}
                  <span>{ui(syncState)}</span>
                </div>
                <RecoveredVersions versions={session.recoveredVersions} />
                <textarea
                  className="notes-editor"
                  aria-label={ui("观察草稿")}
                  placeholder={ui(
                    "暴力怎么做？最小例子是什么？哪个量不会变？\n先留住一个可以确定的事实。",
                  )}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
              </section>
            )}
            <section id="ai-coach" className="coach-panel">
              <div className="panel-heading">
                <h2>
                  <span className="coach-avatar">
                    <Sparkles size={16} />
                  </span>
                  {ui(isAssistant ? "算法助教" : "AI 思维陪练")}
                </h2>
                <span className="coach-state">
                  {aiConfigured ? (
                    <>
                      <span className="connection on" />
                      {ui("按需调用")}
                    </>
                  ) : (
                    <button onClick={() => setSettings(true)}>
                      {ui("连接 AI")}
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </span>
              </div>
              <div className="coach-principle">
                <Lightbulb size={15} />
                {ui(
                  isAssistant
                    ? "按问题选择讲法，也可以请求交互图示或练习推荐。"
                    : "每次只推进一小步，先把你的想法说出来。",
                )}
              </div>
              {!isAssistant && (
                <div className="editorial-reference">
                  {session.editorialReference?.status === "ready" ? (
                    <span>
                      {ui("最近回复已参考官方题解")}
                      {session.editorialReference.stale
                        ? ui("（旧缓存）")
                        : ""}{" "}
                      ·{" "}
                      <a
                        href={session.editorialReference.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {ui("来源链接（含剧透）")}
                      </a>
                    </span>
                  ) : (
                    <span>
                      {session.editorialReference?.status === "unavailable"
                        ? ui("官方题解暂不可用；独立推导尚未核验")
                        : ui("回复前会获取当前题目的官方题解，仅供教练核验")}
                    </span>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={allowUnverified}
                      disabled={busy}
                      onChange={(e) => setAllowUnverified(e.target.checked)}
                    />
                    {ui("允许无题解推导")}
                  </label>
                </div>
              )}
              <div className="chat-messages" aria-live="polite">
                {!session.messages.length && (
                  <div className="coach-intro">
                    <span className="intro-symbol">
                      <MessageCircle size={24} />
                    </span>
                    <h3>
                      {ui(
                        isAssistant
                          ? "今天想弄懂什么？"
                          : "你读完后的第一反应是什么？",
                      )}
                    </h3>
                    <p>
                      {ui(
                        isAssistant
                          ? "可以问概念区别、证明缺口、复杂度，或贴一段不理解的代码。"
                          : "一个猜想、一个暴力，甚至一句「我卡在这里」，都可以作为起点。",
                      )}
                    </p>
                    <div>
                      <span>{ui("举例观察")}</span>
                      <span>{ui("检验猜想")}</span>
                      <span>{ui("证明与建模")}</span>
                    </div>
                  </div>
                )}
                {session.messages.map((m, i) => (
                  <div key={i} className={"chat-message " + m.role}>
                    <div className="message-label">
                      {m.role === "user"
                        ? ui("你 · 正在思考")
                        : ui("AI · 陪你推一步")}
                    </div>
                    {m.role === "assistant" && m.reasoning && (
                      <ReasoningDetails text={m.reasoning} />
                    )}
                    {messageEdit?.sessionId === session.id &&
                    messageEdit.index === i ? (
                      <div className="message-edit">
                        <textarea
                          autoFocus
                          aria-label={ui("编辑已发送消息")}
                          value={messageEdit.content}
                          disabled={busy}
                          onChange={(e) =>
                            setMessageEdit({
                              ...messageEdit,
                              content: e.target.value,
                            })
                          }
                        />
                        <p>
                          {ui(
                            "保存后将从这里重新生成回复，后续对话会移入历史版本。",
                          )}
                        </p>
                        <div>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setMessageEdit(null)}
                          >
                            {ui("取消")}
                          </button>
                          <button
                            className="primary"
                            disabled={
                              busy ||
                              !messageEdit.content.trim() ||
                              messageEdit.content.trim() ===
                                messageEdit.original
                            }
                            onClick={() => void send("discuss", messageEdit)}
                          >
                            {ui("保存并重新生成")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Text
                        text={m.content}
                        allowVisuals={m.role === "assistant"}
                      />
                    )}
                    {Boolean(m.sources?.length) && (
                      <div className="assistant-sources">
                        {m.sources?.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title}
                            <ExternalLink size={12} />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.role === "user" &&
                      !(
                        messageEdit?.sessionId === session.id &&
                        messageEdit.index === i
                      ) && (
                        <div className="message-actions">
                          <button
                            disabled={busy}
                            aria-label={ui("编辑第 {0} 条消息", [i + 1])}
                            onClick={() =>
                              setMessageEdit({
                                sessionId: session.id,
                                index: i,
                                original: m.content,
                                content: m.content,
                              })
                            }
                          >
                            <Pencil size={13} />
                            {ui("编辑")}
                          </button>
                          <button
                            disabled={busy}
                            aria-label={ui("撤回第 {0} 条消息", [i + 1])}
                            onClick={() => recallMessage(i)}
                          >
                            <Undo2 size={13} />
                            {ui("撤回")}
                          </button>
                        </div>
                      )}
                  </div>
                ))}
                {partialReply?.sessionId === session.id &&
                  (partialReply.text || partialReply.reasoning) && (
                    <div className="chat-message assistant partial-reply">
                      <div className="message-label">
                        {ui(
                          busy
                            ? "正在生成，完成后自动保存"
                            : "未完成的回复（未写入历史）",
                        )}
                      </div>
                      {partialReply.reasoning && (
                        <ReasoningDetails text={partialReply.reasoning} live />
                      )}
                      {partialReply.text && <Text text={partialReply.text} />}
                    </div>
                  )}
                {busy && generationSessionId.current === session.id && (
                  <div className="thinking">
                    <LoaderCircle size={15} className="spin" />
                    <ThinkingWait startedAt={sendStartedAt.current} />
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void stopGeneration()}
                    >
                      {ui("停止生成")}
                    </button>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              {chatError && (
                <div className="chat-error" role="alert">
                  {ui(chatError)}
                  {chatRequestId && (
                    <small>
                      {ui("请求编号")} · {chatRequestId}
                    </small>
                  )}
                  {session.messages.at(-1)?.role === "user" && (
                    <button
                      disabled={busy}
                      onClick={() => void send(retryMode, undefined, true)}
                    >
                      {ui("重试回复")}
                    </button>
                  )}
                </div>
              )}
              {busy && generationSessionId.current !== session.id && (
                <p className="muted">
                  {ui("另一个会话正在生成，完成后即可继续提问。")}
                </p>
              )}
              <div className="coach-controls">
                <div className="hint-buttons">
                  {!isAssistant && (
                    <button disabled={busy} onClick={() => navigate("lessons")}>
                      {ui("专题补课")}
                    </button>
                  )}
                  {isAssistant && (
                    <button disabled={busy} onClick={() => send("practice")}>
                      {ui("推荐练习")}
                    </button>
                  )}
                  <button disabled={busy} onClick={() => send("visualize")}>
                    <Sparkles size={13} />
                    {ui("画图讲解")}
                  </button>
                  {(isAssistant ? [] : [1, 2, 3]).map((level) => (
                    <button
                      key={level}
                      disabled={busy}
                      className={session.hints >= level ? "used-hint" : ""}
                      onClick={() => send("hint" + level)}
                    >
                      <Lightbulb size={13} />
                      {level} {ui("级提示")}
                    </button>
                  ))}
                  <button
                    disabled={busy || !session.messages.length}
                    onClick={() => send("counterexample")}
                  >
                    <Target size={13} />
                    {ui("检验猜想")}
                  </button>
                </div>
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault()
                    send()
                  }}
                >
                  <textarea
                    ref={composerInput}
                    aria-label={ui(
                      isAssistant ? "你的算法问题" : "你的解题思路",
                    )}
                    placeholder={ui(
                      isAssistant
                        ? "输入算法问题、证明或代码…"
                        : "写下你的想法，点击发送…",
                    )}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing &&
                        !window.matchMedia("(pointer: coarse)").matches
                      ) {
                        e.preventDefault()
                        send()
                      }
                    }}
                  />
                  <div>
                    <span>
                      {ui(
                        isAssistant
                          ? "根据需要讲解，也可以要求逐步提示"
                          : "先尝试表达，再获得提示",
                      )}
                    </span>
                    <button
                      aria-label={ui("发送思路")}
                      className="send-button"
                      type="submit"
                      disabled={busy || !draft.trim()}
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Send size={17} />
                      )}
                    </button>
                  </div>
                </form>
                <div className="coach-bottom">
                  <button
                    disabled={busy || !session.messages.length}
                    onClick={() => send("review")}
                  >
                    <NotebookPen size={13} />
                    {ui("复盘这次思考")}
                  </button>
                  {!isAssistant && (
                    <button disabled={busy} onClick={() => send("solution")}>
                      {ui("查看完整解法")}
                      <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      )}
    </>
  )
}
