import { db } from "./database";
import { requireUser } from "./security";
import { trainingStats } from "../lib/training-stats";
const metrics = `COUNT(*) AS calls,
 COALESCE(SUM(CASE WHEN status BETWEEN 200 AND 299 THEN 1 ELSE 0 END),0) AS successfulCalls,
 COALESCE(SUM(input_tokens),0) AS inputTokens,
 COALESCE(SUM(output_tokens),0) AS outputTokens,
 COALESCE(SUM(total_tokens),0) AS totalTokens,
 COALESCE(SUM(CASE WHEN usage_reported=0 THEN 1 ELSE 0 END),0) AS unknownUsageCalls`;
export function accountStatistics(userId: string) {
  const row = db.prepare("SELECT payload FROM training_data WHERE user_id=?").get(userId) as {payload: string} | undefined;
  return { ...trainingStats(row ? JSON.parse(row.payload) : []),
    ...db.prepare(`SELECT ${metrics} FROM usage_log WHERE user_id=?`).get(userId) };
}
export function statistics(request: Request) {
  const user = requireUser(request);
  return Response.json({
    totals: accountStatistics(user.id),
    models: db.prepare(`SELECT COALESCE(l.model_name,m.model,'历史模型') AS model, l.model_id AS modelId, ${metrics.replaceAll('status', 'l.status')} FROM usage_log l LEFT JOIN models m ON m.id=l.model_id WHERE l.user_id=? GROUP BY l.model_id,COALESCE(l.model_name,m.model,'历史模型') ORDER BY calls DESC`).all(user.id),
    kinds: db.prepare(`SELECT kind, ${metrics} FROM usage_log WHERE user_id=? GROUP BY kind`).all(user.id),
    daily: db.prepare(`SELECT date(created_at,'+8 hours') AS day, ${metrics} FROM usage_log WHERE user_id=? AND date(created_at,'+8 hours') >= date('now','+8 hours','-29 days') GROUP BY day ORDER BY day DESC`).all(user.id),
    updatedAt: new Date().toISOString(),
  });
}
