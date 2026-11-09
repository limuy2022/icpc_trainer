import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db, transaction } from "./database";
import {
  audit,
  checkOrigin,
  decryptKey,
  encryptKey,
  fail,
  requireUser,
} from "./security";
export type ModelConfig = {
  id: string;
  label: string;
  provider: string;
  base_url: string;
  model: string;
  encrypted_key: string | null;
  env_key: number;
  enabled: number;
  is_default: number;
};
export function initModels() {
  if (
    process.env.GLM_API_KEY &&
    !db.prepare("SELECT id FROM models LIMIT 1").get()
  )
    db.prepare(
      "INSERT INTO models(id,label,provider,base_url,model,env_key,enabled,is_default,created_at) VALUES(?,?,?,?,?,1,1,1,?)",
    ).run(
      "builtin-glm",
      "GLM 思维陪练",
      "glm",
      "https://open.bigmodel.cn/api/coding/paas/v4",
      process.env.GLM_MODEL || "GLM-5.3",
      new Date().toISOString(),
    );
}
export async function validateEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(400, "接口地址格式无效");
  }
  if (
    url!.protocol !== "https:" ||
    url!.username ||
    url!.password ||
    url!.search ||
    url!.hash ||
    (url!.port && url!.port !== "443")
  )
    fail(400, "模型接口必须是标准 HTTPS 地址，不可附带账号或查询参数");
  const host = url!.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    isIP(host) ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    fail(400, "模型接口不能指向本地或内网");
  let ips;
  try {
    ips = await lookup(host, { all: true });
  } catch {
    fail(400, "无法解析接口域名");
  }
  for (const { address } of ips!) {
    if (address.includes(":")) {
      if (!/^[23][0-9a-f]{3}:/i.test(address)) fail(400, "接口必须指向公网");
    } else {
      const [a, b] = address.split(".").map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
      )
        fail(400, "接口必须指向公网");
    }
  }
  return url!.toString().replace(/\/$/, "");
}
export function availableModels() {
  return db
    .prepare(
      "SELECT id,label,model,is_default FROM models WHERE enabled=1 ORDER BY is_default DESC,created_at",
    )
    .all();
}
export function selectModel(id?: string) {
  const model = (
    id
      ? db.prepare("SELECT * FROM models WHERE id=? AND enabled=1").get(id)
      : db
          .prepare(
            "SELECT * FROM models WHERE enabled=1 ORDER BY is_default DESC,created_at LIMIT 1",
          )
          .get()
  ) as ModelConfig | undefined;
  if (!model) fail(400, "没有可用模型，请联系管理员配置");
  return model;
}
export function modelKey(model: ModelConfig) {
  const key = model.env_key
    ? process.env.GLM_API_KEY
    : model.encrypted_key
      ? decryptKey(model.encrypted_key)
      : "";
  if (!key) fail(503, "该模型未配置可用密钥");
  return key;
}
export async function modelsAdmin(request: Request) {
  const actor = requireUser(request, true);
  if (request.method === "GET") {
    return Response.json({
      models: db
        .prepare(
          "SELECT id,label,provider,base_url,model,env_key,enabled,is_default,created_at,(encrypted_key IS NOT NULL OR env_key=1) AS has_key FROM models ORDER BY created_at",
        )
        .all(),
    });
  }
  checkOrigin(request);
  const body = (await request.json()) as any;
  if (request.method === "DELETE") {
    const old = db
      .prepare("SELECT * FROM models WHERE id=?")
      .get(String(body.id)) as ModelConfig;
    if (!old) fail(404, "模型不存在");
    if (old.is_default) fail(400, "请先将其他模型设为默认，再删除此模型");
    db.prepare("DELETE FROM models WHERE id=?").run(old.id);
    audit(actor.id, "model-delete", old.id);
    return Response.json({ ok: true });
  }
  if (!["POST", "PATCH"].includes(request.method)) fail(405, "不支持的操作");
  const old =
    request.method === "PATCH"
      ? (db
          .prepare("SELECT * FROM models WHERE id=?")
          .get(String(body.id)) as ModelConfig)
      : undefined;
  if (request.method === "PATCH" && !old) fail(404, "模型不存在");
  const label = String(body.label ?? old?.label ?? "").trim(),
    model = String(body.model ?? old?.model ?? "").trim();
  if (!label || label.length > 80 || !model || model.length > 120)
    fail(400, "名称与模型 ID 必须填写");
  const base = await validateEndpoint(
    String(body.base_url ?? old?.base_url ?? ""),
  );
  const key = String(body.key || "").trim();
  if (key.length > 4096) fail(400, "密钥过长");
  if (!old && !key) fail(400, "添加模型时需要填写密钥");
  const id = old?.id || randomUUID(),
    encrypted = key ? encryptKey(key) : old?.encrypted_key || null,
    envKey = key ? 0 : old?.env_key || 0;
  const enabled =
    body.enabled === undefined
      ? (old?.enabled ?? 1)
      : Number(Boolean(body.enabled));
  const isDefault =
    body.is_default === undefined
      ? (old?.is_default ?? 0)
      : Number(Boolean(body.is_default));
  if (isDefault && !enabled) fail(400, "默认模型不能停用，请先切换默认模型");
  transaction(() => {
    if (isDefault)
      db.prepare("UPDATE models SET is_default=0 WHERE is_default=1").run();
    db.prepare(
      "INSERT INTO models(id,label,provider,base_url,model,encrypted_key,env_key,enabled,is_default,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,provider=excluded.provider,base_url=excluded.base_url,model=excluded.model,encrypted_key=excluded.encrypted_key,env_key=excluded.env_key,enabled=excluded.enabled,is_default=excluded.is_default",
    ).run(
      id,
      label,
      body.provider === "glm" ? "glm" : "openai-compatible",
      base,
      model,
      encrypted,
      envKey,
      enabled,
      isDefault,
      new Date().toISOString(),
    );
  });
  audit(actor.id, old ? "model-update" : "model-create", id);
  return Response.json({ ok: true });
}
