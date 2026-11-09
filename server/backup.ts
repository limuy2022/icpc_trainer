import { backup } from "node:sqlite";
import { mkdir, readdir, unlink, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { db } from "./database";
const directory = join(
  dirname(process.env.DATABASE_PATH || "data/icpc.sqlite"),
  "backups",
);
await mkdir(directory, { recursive: true, mode: 0o700 });
const path = join(
  directory,
  `icpc-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
await backup(db, path);
await chmod(path, 0o600);
const files = (await readdir(directory))
  .filter((n) => /^icpc-.*\.sqlite$/.test(n))
  .sort()
  .reverse();
for (const old of files.slice(14)) await unlink(join(directory, old));
console.log("Database backup completed. Retaining the latest 14 backups.");
