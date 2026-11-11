import { fetchPersonalModel } from "./personal-fetch"
import { db } from "./database"
import type { ModelConfig } from "./models"
import { randomUUID } from "node:crypto"
import {
  answerText,
  readModelStream,
  ModelStreamError,
} from "../lib/model-stream"

/** Log each actual upstream attempt once, including network failures. Never estimate missing usage. */
export async function requestModel(
  userId: string,
  model: ModelConfig,
  kind: "coach" | "translation",
  input: RequestInfo | URL,
  init: RequestInit,
  options?: {
    onDelta?: (text: string) => void
    onReasoning?: (text: string) => void
    requestId?: string
  },
) {
  let response: Response | undefined
  type ChatPayload = {
    choices?: { finish_reason?: string; message?: { content?: unknown } }[]
    usage?: {
      prompt_tokens?: unknown
      completion_tokens?: unknown
      total_tokens?: unknown
    }
  }
  let data: ChatPayload | undefined
  const createdAt = new Date().toISOString()
  const start = Date.now(),
    requestId = options?.requestId || randomUUID()
  let errorCode: string | null = null
  try {
    response = await (model.owner_user_id ? fetchPersonalModel : fetch)(
      input,
      init,
    )
    if (response.ok) {
      data = options?.onDelta
        ? await readModelStream(response, options.onDelta, options.onReasoning)
        : await response.json()
      if (data?.choices?.[0]?.finish_reason === "length")
        errorCode = "output_limit"
      else if (
        Array.isArray(data?.choices) &&
        !answerText(data.choices?.[0]?.message?.content).trim()
      )
        errorCode = "empty_response"
    } else errorCode = "upstream_http_" + response.status
    return { response, data, requestId }
  } catch (error) {
    errorCode =
      init.signal?.reason?.name === "TimeoutError"
        ? "timeout"
        : error instanceof ModelStreamError
          ? error.code
          : (error as Error).name === "TimeoutError"
            ? "timeout"
            : (error as Error).name === "AbortError"
              ? "aborted"
              : error instanceof SyntaxError
                ? "invalid_json"
                : "network_error"
    throw error
  } finally {
    const count = (value: unknown) =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : undefined
    const usage = data?.usage
    const prompt = count(usage?.prompt_tokens),
      completion = count(usage?.completion_tokens)
    const total =
      count(usage?.total_tokens) ??
      (prompt !== undefined && completion !== undefined
        ? prompt + completion
        : undefined)
    db.prepare(
      "INSERT INTO usage_log(user_id,model_id,status,input_tokens,output_tokens,created_at,kind,model_name,total_tokens,usage_reported,request_id,duration_ms,error_code,finish_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      userId,
      model.id,
      response?.status || 0,
      prompt || 0,
      completion || 0,
      createdAt,
      kind,
      model.model,
      total || 0,
      total !== undefined && prompt !== undefined && completion !== undefined
        ? 1
        : 0,
      requestId,
      Date.now() - start,
      errorCode,
      data?.choices?.[0]?.finish_reason || null,
    )
    console.info(
      JSON.stringify({
        event: "model_request",
        requestId,
        kind,
        status: response?.status || 0,
        durationMs: Date.now() - start,
        errorCode,
        finishReason: data?.choices?.[0]?.finish_reason || null,
      }),
    )
  }
}
