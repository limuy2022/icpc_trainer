import { xcpcCoachContext } from "./xcpc-profile"
import { db } from "./database"
import { checkOrigin, fail, requireUser } from "./security"
import {
  memoryDefaults,
  validateLearnerMemory,
  memoryContext,
  type LearnerMemory,
} from "../lib/learner-memory"
export function learnerMemory(userId: string) {
  const row = db
    .prepare(
      "SELECT learner_memory,learner_memory_revision FROM users WHERE id=?",
    )
    .get(userId) as
    { learner_memory: string; learner_memory_revision: number } | undefined
  return {
    memory: row ? JSON.parse(row.learner_memory) : memoryDefaults(),
    revision: row?.learner_memory_revision || 0,
  }
}
export function learnerMemoryContext(
  userId: string,
  question: string,
  topic?: string,
) {
  const { memory } = learnerMemory(userId)
  return (
    memoryContext(memory, question, topic) +
    (memory.enabled ? xcpcCoachContext(userId) : "")
  )
}
export async function memorySettings(request: Request) {
  const user = requireUser(request)
  if (request.method === "GET") return Response.json(learnerMemory(user.id))
  if (request.method !== "PATCH") fail(405, "不支持的操作")
  checkOrigin(request)
  const body = (await request.json()) as { memory?: unknown; revision?: number }
  let memory: LearnerMemory
  try {
    memory = validateLearnerMemory(body.memory)
  } catch (error) {
    fail(400, (error as Error).message)
  }
  if (!Number.isSafeInteger(body.revision) || (body.revision as number) < 0)
    fail(400, "学习记忆版本无效")
  const revision = body.revision as number
  const changed = db
    .prepare(
      "UPDATE users SET learner_memory=?,learner_memory_revision=learner_memory_revision+1 WHERE id=? AND learner_memory_revision=?",
    )
    .run(JSON.stringify(memory), user.id, revision)
  if (!changed.changes)
    return Response.json(
      {
        error: "学习记忆已在其他页面更新，请重新加载后编辑",
        ...learnerMemory(user.id),
      },
      { status: 409 },
    )
  return Response.json({ memory, revision: revision + 1 })
}
