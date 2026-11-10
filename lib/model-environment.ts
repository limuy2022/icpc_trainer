export type ModelEnvironment = Record<string, string | undefined>;

/** Generic Chat Completions configuration, with legacy GLM deployments preserved. */
export function environmentModel(env: ModelEnvironment) {
  if (env.AI_API_KEY?.trim()) {
    const base = env.AI_BASE_URL?.trim().replace(/\/$/, "");
    const model = env.AI_MODEL?.trim();
    if (!base || !model) throw new Error("AI_API_KEY requires AI_BASE_URL and AI_MODEL");
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443"))
      throw new Error("AI_BASE_URL must be a standard public HTTPS API base URL");
    return {id:"builtin-env",label:env.AI_MODEL_LABEL?.trim() || model,provider:env.AI_PROVIDER === "glm" ? "glm" : "openai-compatible",base_url:base,model,key:env.AI_API_KEY.trim()};
  }
  if (env.GLM_API_KEY?.trim()) return {
    id:"builtin-glm",label:"GLM 思维陪练",provider:"glm",
    base_url:"https://open.bigmodel.cn/api/coding/paas/v4",
    model:env.GLM_MODEL?.trim() || "GLM-5.3",key:env.GLM_API_KEY.trim(),
  };
  return undefined;
}

export function environmentModelKey(env: ModelEnvironment, id: string) {
  // Existing GLM rows must never silently switch to a different provider's key.
  return (id === "builtin-glm" ? env.GLM_API_KEY : env.AI_API_KEY)?.trim() || "";
}
