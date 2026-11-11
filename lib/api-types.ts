import type { CoachJob } from "./coach-job"
import type { ReasoningLevel } from "./reasoning"
import type { LearnerMemory } from "./learner-memory"
import type { Problem, Session } from "./types"

export type ReasoningOption = { value: string; label: string }
export type ModelOption = {
  id: string
  label: string
  model: string
  provider: string
  is_default?: number
  scope?: "site" | "personal" | "browser"
  max_output_tokens?: number | null
  output_token_parameter?: string
  reasoningOptions?: ReasoningOption[]
}
export type ModelPreferences = {
  selectedModelId?: string
  efforts?: Record<string, ReasoningLevel>
}
export type ConfigResponse = {
  configured: boolean
  preferences: ModelPreferences
  provider: string
  model: string
  models: ModelOption[]
}
export type ProblemsResponse = {
  items: Problem[]
  total: number
  bankTotal: number
  source: string
  updatedAt: string
}
export type SessionsResponse = {
  sessions?: Session[]
  revision: number
}
export type StatementResponse = {
  text: string
  metadata?: Session["statementMetadata"]
  format?: "markdown"
  source?: Session["statementSource"]
  fetchedAt?: string
}
export type TranslateResponse = { text: string; model: string }
export type WikiArticleResponse = { html?: unknown }
export type LearnerMemoryResponse = { memory: LearnerMemory; revision: number }
export type CoachJobsResponse = { jobs: CoachJob[] }
export type CoachJobContextResponse = { job: CoachJob }
/** Response of `POST /api/coach` with `prepareOnly: true` (browser-side models). */
export type PreparedCoachRequest = {
  payload: Record<string, unknown>
  model: string
  editorial?: import("./types").Session["editorialReference"]
  sources?: { title: string; url: string }[]
  lesson?: { topicId: string; stage: string }
}
export type ModelPreferencesResponse = {
  preferences: { efforts: Record<string, ReasoningLevel> }
}
export type AdminUserRow = {
  id: string
  username: string
  role: "admin" | "member"
  disabled: number
  must_change_password: number
  site_model_access: number
  created_at: string
  last_login: string | null
}
export type AdminModelRow = {
  id: string
  label: string
  provider: string
  base_url: string
  model: string
  env_key: number
  enabled: number
  is_default: number
  created_at: string
  max_output_tokens?: number | null
  output_token_parameter?: string
  has_key?: number
}
export type AdminUsageRow = {
  id: string
  username: string
  status: number
  input_tokens: number
  output_tokens: number
  usage_reported: number
  kind: string
  created_at: string
  request_id: string | null
  duration_ms: number | null
  error_code: string | null
  finish_reason: string | null
}
export type AdminAuditRow = {
  action: string
  target?: string
  created_at: string
  username: string | null
}
export type AdminAccountStats = {
  id: string
  username: string
  completedProblems: number
  independentProblems: number
  sessions: number
  calls: number
  successfulCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  unknownUsageCalls: number
}
export type AdminStatus = {
  stats: { users: number; records: number; calls: number }
  userStats: AdminAccountStats[]
  usage: AdminUsageRow[]
  audit: AdminAuditRow[]
}
/** Editable form state for the admin model editor modal. */
export type AdminModelForm = {
  id?: string
  label: string
  provider: string
  base_url: string
  model: string
  key: string
  enabled: boolean
  is_default: boolean
  original_base_url?: string
  max_output_tokens?: string | number | null
  output_token_parameter?: string
}
export type UsageMetricsRow = {
  calls: number
  successfulCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  unknownUsageCalls: number
}
/** GET /api/stats — per-user training and usage statistics. */
export type StatsResponse = {
  totals: {
    completedProblems: number
    completedSessions: number
    independentProblems: number
    calls: number
    successfulCalls: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    thinkingSeconds: number
    sessions: number
    pendingSessions: number
    discussionRounds: number
    unknownUsageCalls: number
  }
  trend: { points: import("./time-trend").SolvePoint[]; excluded: number }
  models: (UsageMetricsRow & { model: string; modelId: string })[]
  kinds: (UsageMetricsRow & { kind: string })[]
  daily: (UsageMetricsRow & { day: string })[]
  updatedAt: string
}
