"use client"
import { t as ui, useLocale } from "@/lib/locale"
import DifficultyBadge, { DifficultyGuide } from "@/components/difficulty-badge"
import { difficultyOptions } from "@/lib/rating-range"
import { tagLabels, problemUrl } from "@/lib/types"
import type { Problem } from "@/lib/types"
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  Search,
  Shuffle,
  Target,
  TrendingUp,
} from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { ProblemsResponse } from "@/lib/api-types"

/** Problem discovery: hero, stats, filters, paginated problem table. */
export default function BankView({
  bank,
  loading,
  bankError,
  cfRating,
  preset,
  min,
  setMin,
  max,
  setMax,
  tags,
  setTags,
  query,
  setQuery,
  sort,
  setSort,
  page,
  setPage,
  hideTags,
  setHideTags,
  exclude,
  setExclude,
  summaryCompleted,
  summaryIndependent,
  totalMinutes,
  doneIds,
  random,
  start,
  setRatingModal,
}: {
  bank: ProblemsResponse | null
  loading: boolean
  bankError: string
  cfRating: number | null
  preset: { min: number; max: number }
  min: number
  setMin: Dispatch<SetStateAction<number>>
  max: number
  setMax: Dispatch<SetStateAction<number>>
  tags: string[]
  setTags: Dispatch<SetStateAction<string[]>>
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  sort: string
  setSort: Dispatch<SetStateAction<string>>
  page: number
  setPage: Dispatch<SetStateAction<number>>
  hideTags: boolean
  setHideTags: Dispatch<SetStateAction<boolean>>
  exclude: boolean
  setExclude: Dispatch<SetStateAction<boolean>>
  summaryCompleted: number
  summaryIndependent: number
  totalMinutes: number
  doneIds: Set<string>
  random: () => Promise<void> | void
  start: (problem: Problem) => void
  setRatingModal: (open: boolean) => void
}) {
  useLocale()
  return (
    <main className="main-content">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span />
            {ui("从 OI 到 ICPC，每次多一个观察")}
          </div>
          <h1>
            {ui("把「没思路」，")}
            <br />
            {ui("练成")}
            <span>{ui("「再想一步」。")}</span>
          </h1>
          <p>
            {ui("找到刚好有挑战的题。把第一反应说出来，")}
            <br className="desktop-break" />
            {ui("让 AI 陪你举例、找反例、推导，直到自己走通。")}
          </p>
          <button className="primary" onClick={random} disabled={loading}>
            <Shuffle size={17} />
            {ui("为我挑一道题")}
            <ArrowRight size={17} />
          </button>
          <span className="hero-caption">
            {ui("当前筛选 ·")}
            {min}–{max}
            {tags.length ? ui(" · {0} 个标签", [tags.length]) : ""}
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-label">THE THINKING PROCESS</div>
          <svg viewBox="0 0 380 180">
            <defs>
              <pattern
                id="dots"
                width="17"
                height="17"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="1" fill="#d4ddd1" />
              </pattern>
            </defs>
            <rect width="380" height="180" fill="url(#dots)" />
            <path
              d="M35 133 C90 133 64 45 130 58 S183 165 225 110 S271 28 334 43"
              fill="none"
              stroke="#a3bca5"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <circle cx="35" cy="133" r="8" fill="#dce6d5" stroke="#6b8b71" />
            <circle cx="130" cy="58" r="9" fill="#dce6d5" stroke="#6b8b71" />
            <circle cx="225" cy="110" r="9" fill="#dce6d5" stroke="#6b8b71" />
            <circle cx="334" cy="43" r="18" fill="#245645" />
            <path
              d="m327 43 5 5 8-10"
              fill="none"
              stroke="#e3f5b0"
              strokeWidth="2.5"
            />
            <text x="14" y="162">
              {ui("观察")}
            </text>
            <text x="110" y="33">
              {ui("猜想")}
            </text>
            <text x="206" y="143">
              {ui("验证")}
            </text>
            <text x="314" y="83">
              {ui("突破")}
            </text>
          </svg>
          <div className="art-foot">
            <span>{ui("01 — 不是每条路都笔直")}</span>
            <span>↗</span>
          </div>
        </div>
      </section>
      <section className="stats-grid">
        <div>
          <span className="stat-icon">
            <Target size={19} />
          </span>
          <div>
            <span>{ui("已完成训练")}</span>
            <strong>
              {summaryCompleted}
              <small>{ui("道")}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <Clock3 size={19} />
          </span>
          <div>
            <span>{ui("累计思考时间")}</span>
            <strong>
              {totalMinutes}
              <small>{ui("分钟")}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <Lightbulb size={19} />
          </span>
          <div>
            <span>{ui("独立解出")}</span>
            <strong>
              {summaryIndependent}
              <small>{ui("道")}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon">
            <TrendingUp size={19} />
          </span>
          <div>
            <span>{ui("我的起步区间")}</span>
            <strong className="rating-stat">
              {min}
              <span>—</span>
              {max}
            </strong>
          </div>
        </div>
      </section>
      <div className="section-title">
        <div>
          <h2>
            {ui("找到你的下一道题")}
            <span>PROBLEM EXPLORER</span>
          </h2>
          <p>{ui("难一点点，刚好能让思考发生。")}</p>
        </div>
        <div className="bank-indicator">
          <span className="connection on" />
          {bank
            ? ui("{0} 道 CF 题目", [bank.bankTotal.toLocaleString()])
            : ui("正在连接 Codeforces")}
        </div>
      </div>
      <div className="rating-preset">
        <div>
          <strong>
            {cfRating == null
              ? ui("尚未设置个人等级分")
              : ui("我的 CF 等级分 · {0}", [cfRating])}
          </strong>
          <span>
            {ui("默认难度")}
            {preset.min}–{preset.max}
            {cfRating == null ? "" : ui(" · 等级分 −100 / +300")}
          </span>
        </div>
        <div>
          <button className="text-button" onClick={() => setRatingModal(true)}>
            {cfRating == null ? ui("设置等级分") : ui("修改等级分")}
          </button>
          {(min !== preset.min || max !== preset.max) && (
            <button
              className="secondary"
              onClick={() => {
                setMin(preset.min)
                setMax(preset.max)
                setPage(1)
              }}
            >
              {ui("应用个人预设")}
            </button>
          )}
        </div>
      </div>
      <section className="filter-panel">
        <div className="filter-top">
          <label className="range-label">
            {ui("难度范围")}
            <select
              aria-label={ui("最低难度")}
              value={min}
              onChange={(e) => {
                const v = Number(e.target.value)
                setMin(v)
                if (v > max) setMax(v)
                setPage(1)
              }}
            >
              {difficultyOptions(min).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <span>—</span>
            <select
              aria-label={ui("最高难度")}
              value={max}
              onChange={(e) => {
                const v = Number(e.target.value)
                setMax(v)
                if (v < min) setMin(v)
                setPage(1)
              }}
            >
              {difficultyOptions(max).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label={ui("搜索题目")}
              placeholder={ui("搜索题号或题名")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
            className="sort-select"
            aria-label={ui("排序方式")}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
          >
            <option value="popular">{ui("最多人通过")}</option>
            <option value="rating">{ui("难度从低到高")}</option>
            <option value="recent">{ui("最近的比赛")}</option>
          </select>
        </div>
        <div className="tag-filter">
          <span className="filter-label">{ui("训练标签")}</span>
          <button
            className={!tags.length ? "tag selected" : "tag"}
            onClick={() => {
              setTags([])
              setPage(1)
            }}
          >
            {ui("全部")}
          </button>
          {Object.entries(tagLabels)
            .slice(0, 12)
            .map(([tag, label]) => (
              <button
                className={tags.includes(tag) ? "tag selected" : "tag"}
                key={tag}
                onClick={() => {
                  setTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag],
                  )
                  setPage(1)
                }}
              >
                {ui(label)}
              </button>
            ))}
          <select
            aria-label={ui("更多标签")}
            value=""
            onChange={(e) => {
              if (e.target.value)
                setTags((prev) => [...new Set([...prev, e.target.value])])
              setPage(1)
            }}
          >
            <option value="">{ui("更多标签 ＋")}</option>
            {Object.entries(tagLabels)
              .slice(12)
              .map(([v, l]) => (
                <option key={v} value={v}>
                  {ui(l)}
                </option>
              ))}
          </select>
        </div>
        {tags.some((t) => !Object.keys(tagLabels).slice(0, 12).includes(t)) && (
          <div className="extra-tags">
            {tags
              .filter((t) => !Object.keys(tagLabels).slice(0, 12).includes(t))
              .map((t) => (
                <button
                  className="tag selected"
                  key={t}
                  onClick={() => {
                    setTags(tags.filter((x) => x !== t))
                    setPage(1)
                  }}
                >
                  {ui(tagLabels[t])} ×
                </button>
              ))}
          </div>
        )}
        <div className="filter-bottom">
          <label>
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => {
                setExclude(e.target.checked)
                setPage(1)
              }}
            />
            {ui("排除已完成训练的题")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={hideTags}
              onChange={(e) => setHideTags(e.target.checked)}
            />
            <EyeOff size={14} />
            {ui("隐藏题目标签，保留思考空间")}
          </label>
          <span>{ui("多标签按「全部符合」筛选")}</span>
        </div>
      </section>
      <div className="result-heading">
        <span>
          {loading
            ? ui("正在筛选…")
            : ui("找到 {0} 道题目", [bank?.total.toLocaleString() || 0])}
          <span className="result-sub">
            {bank?.source === "snapshot"
              ? ui("CF 暂不可用 · 使用 {0} 快照", [
                  new Date(bank.updatedAt).toLocaleDateString("zh-CN"),
                ])
              : ui("来自 Codeforces 官方题库")}
          </span>
        </span>
        <button className="text-button" onClick={random} disabled={loading}>
          <Shuffle size={14} />
          {ui("随机挑一题")}
        </button>
      </div>
      <DifficultyGuide />
      <div className="problem-table">
        <div className="table-head">
          <span>{ui("题目 / PROBLEM")}</span>
          <span>{ui("难度")}</span>
          <span>{ui("通过人数")}</span>
          <span>{ui("开始训练")}</span>
        </div>
        {bankError ? (
          <div className="empty">
            <CircleHelp />
            <h3>{ui("题库暂时没加载出来")}</h3>
            <p>{bankError}</p>
            <button onClick={() => setPage((p) => (p === 1 ? 2 : 1))}>
              {ui("重新加载")}
            </button>
          </div>
        ) : loading ? (
          <div className="empty">
            <LoaderCircle className="spin" />
            <p>{ui("正在寻找下一道挑战…")}</p>
          </div>
        ) : !bank?.items.length ? (
          <div className="empty">
            <Search />
            <h3>{ui("暂时没有匹配的题目")}</h3>
            <p>{ui("试试放宽难度范围，或减少标签。")}</p>
            <button
              onClick={() => {
                setTags([])
                setQuery("")
                setMin(preset.min)
                setMax(preset.max)
                setPage(1)
              }}
            >
              {ui("重置筛选")}
            </button>
          </div>
        ) : (
          bank.items.map((p) => (
            <div className="problem-row" key={p.id}>
              <div className="problem-name">
                <span className="problem-id">{p.id}</span>
                <div>
                  <a href={problemUrl(p)} target="_blank" rel="noreferrer">
                    {p.name}
                    <ArrowUpRight size={13} />
                  </a>
                  <DifficultyBadge rating={p.rating} />
                  <div className="problem-tags">
                    {hideTags ? (
                      <span>
                        <EyeOff size={11} />
                        {ui("标签已隐藏")}
                      </span>
                    ) : (
                      p.tags.map((t) => (
                        <span key={t}>{ui(tagLabels[t] || t)}</span>
                      ))
                    )}
                    {doneIds.has(p.id) && (
                      <span className="done-tag">{ui("已训练")}</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <span className={p.rating >= 1900 ? "rating orange" : "rating"}>
                  <span />
                  {p.rating}
                </span>
              </div>
              <span className="solved-count">
                {p.solvedCount.toLocaleString()}
              </span>
              <button className="row-start" onClick={() => start(p)}>
                {ui("去思考")}
                <ArrowUpRight size={15} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="pagination">
        <span>{ui("CF Rating 用于选题参考 · 完成记录由你手动标记")}</span>
        <div>
          <button
            aria-label={ui("上一页")}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil((bank?.total || 0) / 12))}
          </span>
          <button
            aria-label={ui("下一页")}
            disabled={page * 12 >= (bank?.total || 0) || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <footer>
        <Code2 size={15} />
        {ui("训练的是走向答案的过程。")}
        <span>BUILT FOR THE NEXT OBSERVATION</span>
      </footer>
    </main>
  )
}
