/**
 * Shared tuning constants for outbound fetches, upstream response caps and
 * external service origins. Server code imports these via the relative path,
 * so keep this module free of browser-only APIs.
 */
/** Timeout for outbound problem-bank / model-directory / wiki fetches. */
export const FETCH_TIMEOUT_MS = 12_000
/** Guard rail for upstream response bodies (statements, editorials, streams). */
export const MAX_RESPONSE_SIZE = 2_000_000
/** Server-side cache lifetime for fetched statements and editorials. */
export const REFERENCE_CACHE_TTL_MS = 7 * 86_400_000
export const CODEFORCES_ORIGIN = "https://codeforces.com"
export const CODEFORCES_API_PROBLEMS =
  CODEFORCES_ORIGIN + "/api/problemset.problems"
export const CODEFORCES_API_BLOG_ENTRY =
  CODEFORCES_ORIGIN + "/api/blogEntry.view"
export const OI_WIKI_ORIGIN = "https://oi-wiki.org"
/** Raw markdown source of OI Wiki articles, addressed by docs path. */
export const OI_WIKI_RAW_DOCS =
  "https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/"
