import type { Session } from "./types";
export function trainingStats(sessions: Session[]) {
  sessions=sessions.filter(s=>s.kind!=="assistant");
  const solved = sessions.filter(s => s.outcome === "independent" || s.outcome === "assisted");
  const ids = (items: Session[]) => new Set(items.map(s => s.problem.id)).size;
  return {
    sessions: sessions.length,
    completedProblems: ids(solved),
    completedSessions: solved.length,
    independentProblems: ids(sessions.filter(s => s.outcome === "independent")),
    pendingSessions: sessions.length - solved.length,
    thinkingSeconds: sessions.reduce((sum, s) => sum + Math.max(0, Number(s.elapsed) || 0), 0),
    discussionRounds: sessions.reduce((sum, s) => sum + s.messages.filter(m => m.role === "user").length, 0),
  };
}
