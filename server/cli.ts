import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "./database";
import { hashPassword } from "./security";
if (process.argv[2] === "init-admin") {
  if (db.prepare("SELECT id FROM users WHERE role=?").get("admin"))
    throw Error("Administrator already exists. Use the admin panel.");
  const input = JSON.parse(readFileSync(0, "utf8")) as {
    username?: string;
    password?: string;
    output?: string;
  };
  const username = input.username || "admin",
    password = input.password || randomBytes(24).toString("base64url");
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw Error("Invalid username");
  const hash = await hashPassword(password);
  db.prepare(
    "INSERT INTO users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)",
  ).run(randomUUID(), username, hash, "admin", new Date().toISOString());
  if (input.output)
    writeFileSync(
      input.output,
      `用户名：${username}\n初始密码：${password}\n首次登录后必须修改密码。\n`,
      { mode: 0o600, flag: "wx" },
    );
  console.log("Administrator initialized. Password is not printed.");
} else throw Error("Usage: node admin.mjs init-admin < JSON input");
