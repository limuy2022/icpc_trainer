import { getBank, filterProblems } from "../lib/problem-bank"
export async function problems(request: Request) {
  const u = new URL(request.url)
  const min = Number(u.searchParams.get("min") || 1400),
    max = Number(u.searchParams.get("max") || 1800)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max)
    return Response.json({ error: "难度范围无效" }, { status: 400 })
  const bank = await getBank()
  const excluded = new Set(
    (u.searchParams.get("exclude") || "").split(",").slice(0, 2000),
  )
  const problemsList = filterProblems(bank.problems, {
    min,
    max,
    tags: (u.searchParams.get("tags") || "").split(";").filter(Boolean),
    query: u.searchParams.get("q") || "",
    sort: u.searchParams.get("sort") || "popular",
    excluded,
  })
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1)
  const items =
    u.searchParams.get("random") === "1"
      ? problemsList.length
        ? [problemsList[Math.floor(Math.random() * problemsList.length)]]
        : []
      : problemsList.slice((page - 1) * 12, page * 12)
  return Response.json(
    {
      items,
      total: problemsList.length,
      bankTotal: bank.problems.length,
      source: bank.source,
      updatedAt: bank.updatedAt,
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  )
}
