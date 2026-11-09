import { normalizeSessionStatement } from "../lib/statement-header";
import { db } from "./database";
import { checkOrigin, fail, requireUser } from "./security";
export async function records(request: Request) {
  const user = requireUser(request);
  if (request.method === "GET") {
    const row = db
      .prepare("SELECT payload,revision FROM training_data WHERE user_id=?")
      .get(user.id) as any;
    return Response.json({
      sessions: row ? JSON.parse(row.payload).map(normalizeSessionStatement) : [],
      revision: row?.revision || 0,
    });
  }
  checkOrigin(request);
  if (request.method !== "PUT") fail(405, "不支持的操作");
  const body = (await request.json()) as any;
  if (
    !Array.isArray(body.sessions) ||
    body.sessions.length > 2000 ||
    !Number.isSafeInteger(body.revision)
  )
    fail(400, "训练记录格式不正确");
  for (const s of body.sessions) {
    if (
      typeof s.id !== "string" ||
      !s.problem?.id ||
      !Array.isArray(s.messages) ||
      typeof s.notes !== "string"
    )
      fail(400, "训练记录缺少必要字段");
  }
  const payload = JSON.stringify(body.sessions.map(normalizeSessionStatement));
  if (Buffer.byteLength(payload) > 10 * 1024 * 1024)
    fail(413, "记录过大，请导出归档后再保存");
  db.prepare(
    "INSERT OR IGNORE INTO training_data(user_id,payload,revision,updated_at) VALUES(?,?,0,?)",
  ).run(user.id, "[]", new Date().toISOString());
  const latest = db
    .prepare("SELECT payload,revision FROM training_data WHERE user_id=?")
    .get(user.id) as { payload: string; revision: number };
  // A retry after a lost response must acknowledge the write already committed.
  if (latest.payload === payload)
    return Response.json({ revision: latest.revision });
  const result = db
    .prepare(
      "UPDATE training_data SET payload=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?",
    )
    .run(payload, new Date().toISOString(), user.id, body.revision);
  if (result.changes !== 1) {
    const current = db
      .prepare("SELECT payload,revision FROM training_data WHERE user_id=?")
      .get(user.id) as { payload: string; revision: number };
    return Response.json(
      {
        error: "记录已更新，正在自动合并",
        sessions: JSON.parse(current.payload).map(normalizeSessionStatement),
        revision: current.revision,
      },
      { status: 409 },
    );
  }
  return Response.json({ revision: body.revision + 1 });
}
