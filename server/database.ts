import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const path = process.env.DATABASE_PATH || resolve("data/icpc.sqlite");
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(path);
chmodSync(path, 0o600);
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
);
db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)");
for (const name of readdirSync(resolve("server/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  if (
    !db.prepare("SELECT name FROM schema_migrations WHERE name=?").get(name)
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(readFileSync(resolve("server/migrations", name), "utf8"));
      db.prepare("INSERT INTO schema_migrations(name) VALUES(?)").run(name);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
