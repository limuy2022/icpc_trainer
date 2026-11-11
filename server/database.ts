import { envDatabasePath } from "./env"
import {
  normalizeSessionStatement,
  splitStatement,
} from "../lib/statement-header"
import { DatabaseSync } from "node:sqlite"
import { chmodSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
const path = envDatabasePath()
mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
export const db = new DatabaseSync(path)
chmodSync(path, 0o600)
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
)
db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)")
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
}
/** Apply pending `server/migrations/*.sql` files, each inside one transaction. */
function runSqlMigrations() {
  for (const name of readdirSync(resolve("server/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      !db.prepare("SELECT name FROM schema_migrations WHERE name=?").get(name)
    ) {
      db.exec("BEGIN IMMEDIATE")
      try {
        db.exec(readFileSync(resolve("server/migrations", name), "utf8"))
        db.prepare("INSERT INTO schema_migrations(name) VALUES(?)").run(name)
        db.exec("COMMIT")
      } catch (e) {
        db.exec("ROLLBACK")
        throw e
      }
    }
  }
}

// Upgrade legacy JSON payloads atomically; bump revisions so stale browser tabs merge.
const metadataMigration = "statement-metadata-v1"
/** One-shot JSON upgrade of stored statement metadata; tracked in schema_migrations so it runs once. */
function runStatementMetadataMigration() {
  if (
    !db
      .prepare("SELECT name FROM schema_migrations WHERE name=?")
      .get(metadataMigration)
  ) {
    transaction(() => {
      for (const row of db
        .prepare("SELECT user_id,payload FROM training_data")
        .all() as { user_id: string; payload: string }[]) {
        const payload = JSON.stringify(
          JSON.parse(row.payload).map(normalizeSessionStatement),
        )
        if (payload !== row.payload)
          db.prepare(
            "UPDATE training_data SET payload=?,revision=revision+1 WHERE user_id=?",
          ).run(payload, row.user_id)
      }
      for (const row of db
        .prepare("SELECT problem_id,payload FROM statement_cache")
        .all() as { problem_id: string; payload: string }[]) {
        const previous = JSON.parse(row.payload)
        const payload = JSON.stringify({
          ...previous,
          ...splitStatement(previous.text, previous.metadata),
        })
        if (payload !== row.payload)
          db.prepare(
            "UPDATE statement_cache SET payload=? WHERE problem_id=?",
          ).run(payload, row.problem_id)
      }
      db.prepare("INSERT INTO schema_migrations(name) VALUES(?)").run(
        metadataMigration,
      )
    })
  }
}
// Migrations run on import so every module touching `db` sees a migrated schema.
runSqlMigrations()
runStatementMetadataMigration()
