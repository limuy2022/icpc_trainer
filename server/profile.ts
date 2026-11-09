import { db } from "./database";
import { checkOrigin, fail, requireUser } from "./security";
import { ratingRange } from "../lib/rating-range";
export async function profile(request: Request) {
  const user = requireUser(request);
  if (request.method === "GET") return Response.json({cfRating:user.cf_rating,range:ratingRange(user.cf_rating)});
  if (request.method !== "PATCH") fail(405,"不支持的操作");
  checkOrigin(request);
  const body=await request.json() as {cfRating:unknown};
  if (body.cfRating !== null && (typeof body.cfRating !== "number" || !Number.isInteger(body.cfRating) || body.cfRating<0 || body.cfRating>5000)) fail(400,"等级分必须是 0–5000 的整数，或清空为未设置");
  db.prepare("UPDATE users SET cf_rating=? WHERE id=?").run(body.cfRating as number|null,user.id);
  return Response.json({cfRating:body.cfRating,range:ratingRange(body.cfRating as number|null)});
}
