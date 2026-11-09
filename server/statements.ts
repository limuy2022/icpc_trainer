import { db } from "./database";
import { fetchStatement, type Statement } from "../lib/statements";
const pending = new Map<string, Promise<Statement>>();
export async function statement(request: Request) {
  const params = new URL(request.url).searchParams,
    contest = params.get("contest") || "",
    index = params.get("index") || "";
  if (!/^\d{1,7}$/.test(contest) || !/^[A-Z][0-9A-Z]{0,3}$/.test(index))
    return Response.json({ error: "题号无效" }, { status: 400 });
  const id = contest + index;
  const row = db
    .prepare(
      "SELECT payload,fetched_at FROM statement_cache WHERE problem_id=?",
    )
    .get(id) as { payload: string; fetched_at: string } | undefined;
  const cached: Statement | undefined = row
    ? JSON.parse(row.payload)
    : undefined;
  if (cached && Date.now() - Date.parse(row!.fetched_at) < 7 * 86400000)
    return Response.json({ ...cached, cached: true });
  let work = pending.get(id);
  if (!work) {
    work = fetchStatement(contest, index)
      .then((result) => {
        db.prepare(
          "INSERT INTO statement_cache(problem_id,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(problem_id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at",
        ).run(id, JSON.stringify(result), result.fetchedAt);
        return result;
      })
      .finally(() => pending.delete(id));
    pending.set(id, work);
  }
  try {
    return Response.json(await work);
  } catch (e) {
    if (cached) return Response.json({ ...cached, cached: true, stale: true });
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
