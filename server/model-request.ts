import { db } from "./database";
import type { ModelConfig } from "./models";

/** Log each actual upstream attempt once, including network failures. Never estimate missing usage. */
export async function requestModel(userId: string, model: ModelConfig, kind: "coach" | "translation", input: RequestInfo | URL, init: RequestInit) {
  let response: Response | undefined;
  let data: any;
  const createdAt = new Date().toISOString();
  try {
    response = await fetch(input, init);
    if (response.ok) data = await response.json();
    return { response, data };
  } finally {
    const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
    const usage = data?.usage;
    const prompt = count(usage?.prompt_tokens), completion = count(usage?.completion_tokens);
    const total = count(usage?.total_tokens) ?? (prompt !== undefined && completion !== undefined ? prompt + completion : undefined);
    db.prepare("INSERT INTO usage_log(user_id,model_id,status,input_tokens,output_tokens,created_at,kind,model_name,total_tokens,usage_reported) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(userId, model.id, response?.status || 0, prompt || 0, completion || 0, createdAt, kind, model.model, total || 0, total !== undefined && prompt !== undefined && completion !== undefined ? 1 : 0);
  }
}
