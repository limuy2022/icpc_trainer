import { db } from "./database";
import { checkOrigin, fail, requireUser } from "./security";
export async function records(request: Request) {
  const user = requireUser(request);
  if (request.method === "GET") {
    const row = db
      .prepare("SELECT payload,revision FROM training_data WHERE user_id=?")
      .get(user.id) as any;
    return Response.json({
      sessions: row ? JSON.parse(row.payload) : [],
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
  const payload = JSON.stringify(body.sessions);
  if (Buffer.byteLength(payload) > 10 * 1024 * 1024)
    fail(413, "记录过大，请导出归档后再保存");
  db.prepare(
    "INSERT OR IGNORE INTO training_data(user_id,payload,revision,updated_at) VALUES(?,?,0,?)",
  ).run(user.id, "[]", new Date().toISOString());
  const result = db
    .prepare(
      "UPDATE training_data SET payload=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?",
    )
    .run(payload, new Date().toISOString(), user.id, body.revision);
  if (result.changes !== 1)
    fail(409, "另一页面已更新记录。请先导出当前记录，再刷新合并，避免覆盖。");
  return Response.json({ revision: body.revision + 1 });
}
