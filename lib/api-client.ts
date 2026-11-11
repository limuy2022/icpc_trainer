export class ApiError extends Error {
  readonly status: number
  readonly data: unknown
  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}
export type ApiOptions = {
  method?: string
  body?: unknown
  signal?: AbortSignal
}
/**
 * JSON API client for the standalone backend. Throws {@link ApiError} on
 * non-2xx responses (message from the `error` field, status and raw body
 * attached) so callers can branch on conflicts such as 409.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { body, method = body ? "POST" : "GET", signal } = options
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const message = (data as { error?: string }).error || "请求失败"
    throw new ApiError(message, res.status, data)
  }
  return data as T
}
