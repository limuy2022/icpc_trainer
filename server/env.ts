import { resolve } from "node:path"

/**
 * Central reads of server environment variables. All values keep their
 * historical optional semantics: unset entries fall back to the same defaults
 * the individual modules used before, so startup never fails on config alone.
 */
export function envPort(): number {
  const value = Number(process.env.PORT || 5180)
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : 5180
}
/** Origin allowed by CSRF checks; empty means "derive from the request". */
export function envAppOrigin(): string {
  return process.env.APP_ORIGIN?.trim() || ""
}
/** SQLite database location, relative to the server working directory. */
export function envDatabasePath(): string {
  return process.env.DATABASE_PATH || resolve("data/icpc.sqlite")
}
export function envCookieSecure(): boolean {
  return process.env.COOKIE_SECURE === "true"
}
/** 64-char hex key for encrypting stored provider keys (see security.ts). */
export function envModelEncryptionKey(): string | undefined {
  return process.env.MODEL_ENCRYPTION_KEY
}
