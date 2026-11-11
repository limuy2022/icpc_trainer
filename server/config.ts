import { availableModels } from "./models"
import { modelPreferences } from "./model-preferences"
import { requireUser } from "./security"

/** GET /api/config — model catalogue plus per-user preferences for the workspace. */
export function configResponse(request: Request) {
  const user = requireUser(request)
  const models = availableModels(user)
  return Response.json({
    configured: models.length > 0,
    preferences: modelPreferences(user.id),
    provider: "管理员配置",
    model: models[0]?.model || "",
    models,
    user,
  })
}
