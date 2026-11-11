import { envAppOrigin, envPort } from "./env"
import { xcpcSettings } from "./xcpc-profile"
import { memorySettings } from "./learner-memory"
import { coachJobs, initCoachJobs } from "./coach-jobs"
import { saveModelPreferences } from "./model-preferences"
import { profile } from "./profile"
import { statistics } from "./statistics"
import { discoverModels } from "./model-discovery"
import { configResponse } from "./config"
import { createServer } from "node:http"
import { Readable } from "node:stream"
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web"
import { pipeline } from "node:stream/promises"
import { readFile, stat } from "node:fs/promises"
import { resolve, extname } from "node:path"
import { auth, register, changePassword, usersAdmin } from "./accounts"
import { records } from "./records"
import { initModels, modelsAdmin } from "./models"
import { adminStatus, downloadBackup } from "./admin"
import { checkOrigin, fail, HttpError, requireUser, throttle } from "./security"
import { problems } from "./problems"
import { statement } from "./statements"
import { POST as coach } from "./coach"
import { translate } from "./translate"
import { wikiArticle } from "./wiki-article"
initModels()
initCoachJobs()
const root = resolve("public")
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
}
/** Reject non-matching HTTP methods with the standard 405 payload. */
function expectMethod(req: { method?: string | null }, method: string) {
  if (req.method !== method) fail(405, "不支持的操作")
}
const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost"
    const configuredOrigin = envAppOrigin()
    const origin = configuredOrigin || `http://${host}`
    const url = new URL(req.url || "/", origin)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value)
    }
    let body: Buffer | undefined
    if (!["GET", "HEAD"].includes(req.method || "GET")) {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 12 * 1024 * 1024) fail(413, "请求内容过大")
        chunks.push(chunk)
      }
      body = Buffer.concat(chunks)
    }
    const disconnect = new AbortController()
    res.once("close", () => {
      if (!res.writableFinished) disconnect.abort()
    })
    const request = new Request(url, {
      signal: disconnect.signal,
      method: req.method,
      headers,
      body: body as BodyInit,
    })
    let response: Response
    if (url.pathname === "/api/health") response = Response.json({ ok: true })
    else if (url.pathname === "/api/register")
      response = await register(request)
    else if (url.pathname === "/api/auth") response = await auth(request)
    else if (url.pathname.startsWith("/api/")) {
      const user = requireUser(request)
      if (!["GET", "HEAD"].includes(req.method || "")) checkOrigin(request)
      if (
        user.must_change_password &&
        !["/api/account", "/api/auth"].includes(url.pathname)
      )
        fail(403, "首次登录请先修改密码")
      switch (url.pathname) {
        case "/api/model-preferences":
          expectMethod(req, "PATCH")
          response = await saveModelPreferences(request)
          break
        case "/api/learner-memory":
          response = await memorySettings(request)
          break
        case "/api/xcpc-profile":
          if (req.method === "PATCH")
            throttle("xcpc-profile:" + user.id, 10, 60000)
          response = await xcpcSettings(request, user.id)
          break
        case "/api/profile":
          response = await profile(request)
          break
        case "/api/account":
          expectMethod(req, "PATCH")
          response = await changePassword(request)
          break
        case "/api/config":
          response = configResponse(request)
          break
        case "/api/stats":
          expectMethod(req, "GET")
          response = statistics(request)
          break
        case "/api/sessions":
          response = await records(request)
          break
        case "/api/problems":
          expectMethod(req, "GET")
          response = await problems(request)
          break
        case "/api/statement":
          expectMethod(req, "GET")
          response = await statement(request)
          break
        case "/api/wiki-article":
          expectMethod(req, "GET")
          throttle("wiki-article:" + user.id, 120, 60000)
          response = await wikiArticle(request)
          break
        case "/api/translate":
          expectMethod(req, "POST")
          throttle("translate:" + user.id, 30, 3600000)
          response = await translate(request)
          break
        case "/api/coach-jobs":
          response = await coachJobs(request)
          break
        case "/api/coach":
          expectMethod(req, "POST")
          throttle("coach:" + user.id, 60, 3600000)
          response = await coach(request)
          break
        case "/api/personal/models":
          fail(410, "个人密钥已改为仅本机保存，请刷新页面后重新配置")
          break
        case "/api/personal/models/discover":
          fail(410, "个人模型目录改为浏览器直接查询，请刷新页面")
          break
        case "/api/admin/users":
          response = await usersAdmin(request)
          break
        case "/api/admin/models":
          response = await modelsAdmin(request)
          break
        case "/api/admin/models/discover":
          response = await discoverModels(request)
          break
        case "/api/admin/status":
          response = adminStatus(request)
          break
        case "/api/admin/backup":
          response = await downloadBackup(request)
          break
        default:
          fail(404, "接口不存在")
      }
    } else {
      if (!["GET", "HEAD"].includes(req.method || "")) fail(405, "不支持的操作")
      let path
      try {
        path = resolve(root, "." + decodeURIComponent(url.pathname))
      } catch {
        fail(400, "路径无效")
      }
      if (path !== root && !path.startsWith(root + "/")) fail(403, "路径无效")
      let file = path
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html")
      } catch {
        if (extname(path)) fail(404, "文件不存在")
        file = resolve(root, "index.html")
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
      )
    }
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Referrer-Policy", "same-origin")
    res.setHeader("X-Frame-Options", "DENY")
    if (url.pathname.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store")
    if (
      response.headers.get("content-type")?.includes("application/x-ndjson") &&
      response.body
    ) {
      res.flushHeaders()
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeWebReadableStream),
        res,
      )
    } else res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    if (res.headersSent || res.destroyed) {
      if (!res.destroyed) res.destroy()
      return
    }
    const status = e instanceof HttpError ? e.status : 500
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    res.end(
      JSON.stringify({
        error:
          e instanceof HttpError ? e.message : "服务暂时不可用，请稍后重试",
      }),
    )
    if (status === 500)
      console.error(
        "Request failed:",
        (e as Error).name,
        (e as Error).message.replace(/Bearer\s+\S+/g, "Bearer [REDACTED]"),
      )
  }
})
server.requestTimeout = 120000
server.headersTimeout = 30000
const port = envPort()
server.listen(port, "127.0.0.1", () =>
  console.log(`ICPC listening on 127.0.0.1:${port}`),
)
process.on("SIGTERM", () => server.close(() => process.exit(0)))
