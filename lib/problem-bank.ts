import snapshot from "./cf-snapshot.json";
import type { Problem } from "./types";
let cached:
  | { problems: Problem[]; updatedAt: string; source: string }
  | undefined;
let fetchedAt = 0;
let pending: Promise<ReturnType<typeof fallback>> | undefined;
function fallback() {
  return {
    problems: snapshot.problems as Problem[],
    updatedAt: snapshot.updatedAt,
    source: "snapshot",
  };
}
export async function getBank() {
  if (cached && Date.now() - fetchedAt < 600_000) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch(
        "https://codeforces.com/api/problemset.problems",
        { signal: AbortSignal.timeout(12000) },
      );
      if (!res.ok) throw new Error("Codeforces unavailable");
      const data = (await res.json()) as any;
      if (data.status !== "OK" || !Array.isArray(data.result?.problems))
        throw new Error("Invalid response");
      const counts = new Map(
        data.result.problemStatistics.map((p: any) => [
          `${p.contestId}${p.index}`,
          p.solvedCount,
        ]),
      );
      cached = {
        source: "live",
        updatedAt: new Date().toISOString(),
        problems: data.result.problems
          .filter((p: any) => p.contestId && p.rating)
          .map((p: any) => ({
            id: `${p.contestId}${p.index}`,
            contestId: p.contestId,
            index: p.index,
            name: p.name,
            rating: p.rating,
            tags: p.tags,
            solvedCount: counts.get(`${p.contestId}${p.index}`) || 0,
          })),
      };
    } catch {
      cached = fallback();
    }
    fetchedAt = Date.now();
    return cached!;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
export function filterProblems(
  problems: Problem[],
  options: {
    min: number;
    max: number;
    tags: string[];
    query: string;
    sort: string;
    excluded?: Set<string>;
  },
) {
  const { min, max, tags, query, sort, excluded } = options;
  const q = query.toLowerCase().trim();
  return problems
    .filter(
      (p) =>
        p.rating >= min &&
        p.rating <= max &&
        tags.every((t) => p.tags.includes(t)) &&
        (!q || `${p.id} ${p.name}`.toLowerCase().includes(q)) &&
        !excluded?.has(p.id),
    )
    .sort((a, b) =>
      sort === "rating"
        ? a.rating - b.rating || b.solvedCount - a.solvedCount
        : sort === "recent"
          ? b.contestId - a.contestId || a.index.localeCompare(b.index)
          : b.solvedCount - a.solvedCount,
    );
}
