import { translationInstructions } from "../lib/translation-prompt"
import { outputParameters } from "../lib/model-output"
import { selectedReasoning } from "./model-preferences"
import { reasoningParameters } from "../lib/reasoning"
import { splitStatement } from "../lib/statement-header"
import { requestModel } from "./model-request"
import { createHash } from "node:crypto"
import { db } from "./database"
import { requireUser, fail } from "./security"
import { selectModel, modelKey, validateEndpoint } from "./models"
import { protectStatement, restoreStatement } from "../lib/translation-format"
import { translationSource } from "../lib/translation-source"
import { reasoningOptions } from "../lib/reasoning"
const pending = new Map<
  string,
  Promise<{ text: string; model: string; createdAt: string }>
>()
export async function translate(request: Request) {
  const user = requireUser(request),
    body = (await request.json()) as {
      modelId?: string
      text?: string
      problemId?: string
      reasoningEffort?: string
      forceRefresh?: boolean
    }
  const model = selectModel(body.modelId, user)
  const originalText = splitStatement(
    typeof body.text === "string" ? body.text : "",
  ).text
  const text = translationSource(originalText),
    problemId = String(body.problemId || "")
  if (
    text.length < 60 ||
    text.length > 60000 ||
    !/^\d{1,7}[A-Z][A-Z0-9]{0,3}$/.test(problemId)
  )
    fail(400, "题面格式无效，或长度超过当前翻译上限")
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(["statement-zh-v1", text]))
    .digest("hex")
  if (body.forceRefresh !== true) {
    let cached = db
      .prepare(
        "SELECT translation,created_at,model_name FROM statement_translations WHERE problem_id=? AND source_hash=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
      )
      .get(problemId, sourceHash) as
      | { translation: string; created_at: string; model_name: string | null }
      | undefined
    if (!cached) {
      // Old rows lack source hashes: reuse only if the original recipe proves an exact body match.
      const legacy = db
        .prepare(
          "SELECT cache_key,translation,created_at,model_name FROM statement_translations WHERE problem_id=? AND source_hash IS NULL ORDER BY created_at DESC,rowid DESC",
        )
        .all(problemId) as {
        cache_key: string
        translation: string
        created_at: string
        model_name: string | null
      }[]
      if (legacy.length) {
        const recipes = new Map<string, string>()
        for (const candidate of db
          .prepare("SELECT id,model,base_url,provider FROM models")
          .all() as {
          id: string
          model: string
          base_url: string
          provider: string
        }[])
          for (const source of new Set([originalText, text]))
            for (const effort of reasoningOptions(candidate))
              recipes.set(
                createHash("sha256")
                  .update(
                    JSON.stringify([
                      "body-only-v3",
                      source,
                      candidate.id,
                      candidate.model,
                      candidate.base_url,
                      effort.value,
                    ]),
                  )
                  .digest("hex"),
                candidate.model,
              )
        const match = legacy.find((row) => recipes.has(row.cache_key))
        if (match) {
          cached = {
            ...match,
            model_name: match.model_name || recipes.get(match.cache_key)!,
          }
          db.prepare(
            "UPDATE statement_translations SET source_hash=?,model_name=? WHERE cache_key=?",
          ).run(sourceHash, cached.model_name, match.cache_key)
        }
      }
    }
    if (cached)
      return Response.json({
        text: cached.translation,
        model: cached.model_name || "Cached translation",
        createdAt: cached.created_at,
        cached: true,
      })
  }
  const effort = selectedReasoning(user.id, model, body.reasoningEffort)
  const reasoning = reasoningParameters(model, effort)
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        "translation-zh-v4",
        problemId,
        sourceHash,
        model.id,
        model.model,
        model.base_url,
        effort,
      ]),
    )
    .digest("hex")
  const pendingKey =
    body.forceRefresh === true
      ? "refresh:" + hash
      : problemId + ":" + sourceHash
  let work = pending.get(pendingKey)
  if (!work) {
    work = (async () => {
      await validateEndpoint(model.base_url)
      const key = modelKey(model),
        { masked, kept } = protectStatement(text)
      const { response: res, data: result } = await requestModel(
        user.id,
        model,
        "translation",
        model.base_url.replace(/\/$/, "") + "/chat/completions",
        {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: model.model,
            messages: [
              {
                role: "system",
                content: translationInstructions,
              },
              { role: "user", content: masked },
            ],
            ...outputParameters(model),
            ...reasoning,
          }),
          signal: AbortSignal.timeout(90000),
        },
      )
      if (!res.ok) {
        throw Error(
          res.status === 429
            ? "模型额度不足或请求过于频繁，请稍后重试"
            : `翻译服务暂时不可用（${res.status}）`,
        )
      }
      if (result?.choices?.[0]?.finish_reason === "length")
        throw Error("译文未生成完整，请稍后重试或选择其他模型")
      const output = result?.choices?.[0]?.message?.content
      if (typeof output !== "string" || output.length < 30)
        throw Error("模型没有返回完整译文")
      const translation = restoreStatement(output.trim(), kept),
        createdAt = new Date().toISOString()
      db.prepare(
        "INSERT OR REPLACE INTO statement_translations(cache_key,problem_id,model_id,translation,created_at,source_hash,model_name) VALUES(?,?,?,?,?,?,?)",
      ).run(
        hash,
        problemId,
        model.id,
        translation,
        createdAt,
        sourceHash,
        model.model,
      )
      return { text: translation, model: model.model, createdAt }
    })().finally(() => pending.delete(pendingKey))
    pending.set(pendingKey, work)
  }
  try {
    return Response.json(await work)
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "翻译失败，请重试" },
      { status: 502 },
    )
  }
}
