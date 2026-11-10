import { accountStatistics } from "./statistics";
import { backup } from "node:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "./database";
import { audit, requireUser } from "./security";
export function adminStatus(request: Request) {
  requireUser(request, true);
  return Response.json({
    stats: {
      users: (db.prepare("SELECT COUNT(*) AS n FROM users").get() as any).n,
      records: (
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM training_data,json_each(training_data.payload) entry WHERE COALESCE(json_extract(entry.value,'$.kind'),'training')!='assistant'",
          )
          .get() as any
      ).n,
      calls: (db.prepare("SELECT COUNT(*) AS n FROM usage_log").get() as any).n,
    },
    userStats: (db.prepare("SELECT id,username FROM users ORDER BY created_at").all() as {id:string;username:string}[]).map(user => ({ ...user, ...accountStatistics(user.id) })),
    usage: db
      .prepare(
        "SELECT l.id,u.username,l.model_id,l.status,l.input_tokens,l.output_tokens,l.total_tokens,l.usage_reported,l.kind,l.model_name,l.created_at,l.request_id,l.duration_ms,l.error_code,l.finish_reason FROM usage_log l JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 50",
      )
      .all(),
    audit: db
      .prepare(
        "SELECT a.action,a.target,a.created_at,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 30",
      )
      .all(),
  });
}
export async function downloadBackup(request: Request) {
  const user = requireUser(request, true);
  const dir = await mkdtemp(join(tmpdir(), "icpc-backup-"));
  try {
    const file = join(dir, "backup.sqlite");
    await backup(db, file);
    const data = await readFile(file);
    audit(user.id, "database-backup", "site");
    return new Response(data, {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="icpc-backup-${new Date().toISOString().slice(0, 10)}.sqlite"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
