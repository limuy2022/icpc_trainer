import { randomUUID } from "node:crypto";
import { db, transaction } from "./database";
import {
  audit,
  checkOrigin,
  cookie,
  createSession,
  fail,
  hashPassword,
  hashToken,
  requireUser,
  throttle,
  userFor,
  verifyPassword,
} from "./security";
export async function auth(request: Request) {
  if (request.method === "GET") {
    const user = userFor(request);
    if (!user) return Response.json({ user: null }, { status: 401 });
    return Response.json({ user });
  }
  checkOrigin(request);
  if (request.method === "DELETE") {
    const token = (request.headers.get("cookie") || "").match(
      /icpc_session=([^;]+)/,
    )?.[1];
    if (token)
      db.prepare("DELETE FROM login_sessions WHERE token_hash=?").run(
        hashToken(token),
      );
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": cookie("", 0) } },
    );
  }
  if (request.method !== "POST") fail(405, "不支持的操作");
  const body = (await request.json()) as any;
  const username = String(body.username || "")
      .trim()
      .toLowerCase(),
    password = String(body.password || "");
  throttle(
    "login-ip:" + (request.headers.get("x-real-ip") || "local"),
    30,
    900000,
  );
  throttle("login-user:" + username, 12, 900000);
  const row = db
    .prepare("SELECT * FROM users WHERE username=?")
    .get(username) as any;
  const dummy = "scrypt:00000000000000000000000000000000:" + "00".repeat(32);
  const valid = await verifyPassword(password, row?.password_hash || dummy);
  if (!row || !valid || row.disabled) fail(401, "账号或密码错误，或账号已停用");
  const token = createSession(row.id);
  db.prepare("UPDATE users SET last_login=? WHERE id=?").run(
    new Date().toISOString(),
    row.id,
  );
  const { password_hash, ...user } = row;
  return Response.json({ user }, { headers: { "Set-Cookie": cookie(token) } });
}
export async function changePassword(request: Request) {
  checkOrigin(request);
  const user = requireUser(request);
  const body = (await request.json()) as any;
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(user.id) as { password_hash: string };
  if (
    !(await verifyPassword(
      String(body.currentPassword || ""),
      row.password_hash,
    ))
  )
    fail(400, "当前密码错误");
  const hash = await hashPassword(String(body.newPassword || ""));
  transaction(() => {
    db.prepare(
      "UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?",
    ).run(hash, user.id);
    db.prepare("DELETE FROM login_sessions WHERE user_id=?").run(user.id);
  });
  const token = createSession(user.id);
  audit(user.id, "password-change", user.id);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie(token) } },
  );
}
export async function usersAdmin(request: Request) {
  const actor = requireUser(request, true);
  if (request.method === "GET")
    return Response.json({
      users: db
        .prepare(
          "SELECT id,username,role,disabled,must_change_password,created_at,last_login FROM users ORDER BY created_at",
        )
        .all(),
    });
  checkOrigin(request);
  const body = (await request.json()) as any;
  if (request.method === "POST") {
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(username))
      fail(400, "用户名需为 3–40 位字母、数字或 _ . -");
    if (db.prepare("SELECT id FROM users WHERE username=?").get(username))
      fail(409, "用户名已存在");
    const hash = await hashPassword(String(body.password || ""));
    const id = randomUUID();
    db.prepare(
      "INSERT INTO users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)",
    ).run(
      id,
      username,
      hash,
      body.role === "admin" ? "admin" : "member",
      new Date().toISOString(),
    );
    audit(actor.id, "user-create", id);
    return Response.json({ ok: true });
  }
  if (request.method === "PATCH") {
    const target = db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(String(body.id || "")) as any;
    if (!target) fail(404, "账号不存在");
    if (
      target.id === actor.id &&
      (body.disabled === true || body.role === "member")
    )
      fail(400, "不能停用自己或移除自己的管理员权限");
    const role = ["admin", "member"].includes(body.role)
      ? body.role
      : target.role;
    const disabled =
      typeof body.disabled === "boolean"
        ? Number(body.disabled)
        : target.disabled;
    const hash = body.password
      ? await hashPassword(String(body.password))
      : null;
    transaction(() => {
      if (
        target.role === "admin" &&
        !target.disabled &&
        (disabled || role !== "admin")
      ) {
        const count = db
          .prepare(
            "SELECT COUNT(*) AS n FROM users WHERE role='admin' AND disabled=0",
          )
          .get() as { n: number };
        if (count.n <= 1) fail(409, "必须保留至少一个启用的管理员");
      }

      db.prepare(
        "UPDATE users SET role=?,disabled=?,password_hash=?,must_change_password=? WHERE id=?",
      ).run(
        role,
        disabled,
        hash || target.password_hash,
        hash ? 1 : target.must_change_password,
        target.id,
      );
      if (hash || disabled || role !== target.role)
        db.prepare("DELETE FROM login_sessions WHERE user_id=?").run(target.id);
    });
    audit(actor.id, hash ? "user-password-reset" : "user-update", target.id);
    return Response.json({ ok: true });
  }
  fail(405, "不支持的操作");
}
