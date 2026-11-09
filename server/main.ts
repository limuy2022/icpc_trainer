import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { auth, changePassword, usersAdmin } from "./accounts";
import { records } from "./records";
import {
  availableModels,
  initModels,
  modelsAdmin,
  selectModel,
} from "./models";
import { adminStatus, downloadBackup } from "./admin";
import {
  checkOrigin,
  fail,
  HttpError,
  requireUser,
  throttle,
} from "./security";
import { GET as problems } from "../app/api/problems/route";
import { GET as statement } from "../app/api/statement/route";
import { POST as coach } from "./coach";
initModels();
const root = resolve("public");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const origin = process.env.APP_ORIGIN || `http://${host}`;
    const url = new URL(req.url || "/", origin);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    let body: Buffer | undefined;
    if (!["GET", "HEAD"].includes(req.method || "GET")) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 12 * 1024 * 1024) fail(413, "请求内容过大");
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body as any,
    });
    let response: Response;
    if (url.pathname === "/api/health") response = Response.json({ ok: true });
    else if (url.pathname === "/api/auth") response = await auth(request);
    else if (url.pathname.startsWith("/api/")) {
      const user = requireUser(request);
      if (!["GET", "HEAD"].includes(req.method || "")) checkOrigin(request);
      if (
        user.must_change_password &&
        !["/api/account", "/api/auth"].includes(url.pathname)
      )
        fail(403, "首次登录请先修改密码");
      switch (url.pathname) {
        case "/api/account":
          if (req.method !== "PATCH") fail(405, "不支持的操作");
          response = await changePassword(request);
          break;
        case "/api/config": {
          const models = availableModels();
          const m = models[0] as any;
          response = Response.json({
            configured: models.length > 0,
            provider: "管理员配置",
            model: m?.model || "",
            models,
            user,
          });
          break;
        }
        case "/api/sessions":
          response = await records(request);
          break;
        case "/api/problems":
          if (req.method !== "GET") fail(405, "不支持的操作");
          response = await problems(request);
          break;
        case "/api/statement":
          if (req.method !== "GET") fail(405, "不支持的操作");
          response = await statement(request);
          break;
        case "/api/coach":
          if (req.method !== "POST") fail(405, "不支持的操作");
          throttle("coach:" + user.id, 60, 3600000);
          response = await coach(request);
          break;
        case "/api/admin/users":
          response = await usersAdmin(request);
          break;
        case "/api/admin/models":
          response = await modelsAdmin(request);
          break;
        case "/api/admin/status":
          response = adminStatus(request);
          break;
        case "/api/admin/backup":
          response = await downloadBackup(request);
          break;
        default:
          fail(404, "接口不存在");
      }
    } else {
      if (!["GET", "HEAD"].includes(req.method || ""))
        fail(405, "不支持的操作");
      let path;
      try {
        path = resolve(root, "." + decodeURIComponent(url.pathname));
      } catch {
        fail(400, "路径无效");
      }
      if (path !== root && !path.startsWith(root + "/")) fail(403, "路径无效");
      let file = path;
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
      } catch {
        if (extname(path)) fail(404, "文件不存在");
        file = resolve(root, "index.html");
      }
      response = new Response(
        req.method === "HEAD" ? null : await readFile(file),
        {
          headers: {
            "Content-Type": mime[extname(file)] || "application/octet-stream",
            "Cache-Control": file.includes("/assets/")
              ? "public,max-age=31536000,immutable"
              : "no-cache",
          },
        },
      );
    }
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (url.pathname.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        error:
          e instanceof HttpError ? e.message : "服务暂时不可用，请稍后重试",
      }),
    );
    if (status === 500)
      console.error(
        "Request failed:",
        (e as Error).name,
        (e as Error).message.replace(/Bearer\s+\S+/g, "Bearer [REDACTED]"),
      );
  }
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;
server.listen(Number(process.env.PORT || 5180), "127.0.0.1", () =>
  console.log(`ICPC listening on 127.0.0.1:${process.env.PORT || 5180}`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
