import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { db } from "./database";
export type User = {
  id: string;
  username: string;
  role: "admin" | "member";
  disabled: number;
  must_change_password: number;
  cf_rating: number | null;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function hashPassword(password: string) {
  if (password.length < 1 || password.length > 200)
    fail(400, "密码不能为空，且不能超过 200 个字符");
  const salt = randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (e, key) =>
      e ? reject(e) : resolve(key),
    ),
  );
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  if (typeof password !== "string" || password.length > 200) return false;
  const [, salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const hash = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (e, key) =>
      e ? reject(e) : resolve(key),
    ),
  );
  const other = Buffer.from(expected, "hex");
  return hash.length === other.length && timingSafeEqual(hash, other);
}
export function userFor(request: Request): User | null {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(/(?:^|;\s*)icpc_session=([A-Za-z0-9_-]{43})/)?.[1];
  if (!token) return null;
  return (
    (db
      .prepare(
        "SELECT u.id,u.username,u.role,u.disabled,u.must_change_password,u.cf_rating FROM login_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0",
      )
      .get(hashToken(token), Date.now()) as User) || null
  );
}
export function requireUser(request: Request, admin = false) {
  const user = userFor(request);
  if (!user) fail(401, "请先登录");
  if (admin && user.role !== "admin") fail(403, "仅管理员可操作");
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== expected) fail(403, "请求来源无效");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") fail(403, "请求来源无效");
}
export function cookie(token: string, maxAge = 604800) {
  return `icpc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
}
export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO login_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
  ).run(hashToken(token), userId, Date.now() + 604800000);
  return token;
}
export function audit(actor: string, action: string, target: string) {
  db.prepare(
    "INSERT INTO audit_log(actor_id,action,target,created_at) VALUES(?,?,?,?)",
  ).run(actor, action, target, new Date().toISOString());
}
function encryptionKey() {
  const raw = process.env.MODEL_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    fail(503, "服务端未配置模型密钥加密主密钥");
  return Buffer.from(raw, "hex");
}
export function encryptKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}
export function decryptKey(value: string) {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function throttle(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO auth_throttle(key,attempts,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END",
  ).run(key, now, now - windowMs, now - windowMs);
  const row = db
    .prepare("SELECT attempts FROM auth_throttle WHERE key=?")
    .get(key) as { attempts: number };
  if (row.attempts > limit) fail(429, "请求过于频繁，请稍后重试");
}
