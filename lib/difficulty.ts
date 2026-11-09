/** Site estimates, not Luogu's per-problem ratings. Checked 2026-11-09.
 * Community ranges overlap; use lower-inclusive, upper-exclusive boundaries.
 * https://www.luogu.com/article/my22kz4j
 * https://help.luogu.com.cn/manual/luogu/problem/difficulty
 */
export const difficultyLevels = [
  { min: 800, max: 899, name: "入门", color: "red", range: "800" },
  { min: 900, max: 1199, name: "普及-", color: "orange", range: "900–1100" },
  { min: 1200, max: 1599, name: "普及", color: "yellow", range: "1200–1500" },
  { min: 1600, max: 1999, name: "普及+/提高-", color: "green", range: "1600–1900" },
  { min: 2000, max: 2299, name: "提高", color: "cyan", range: "2000–2200" },
  { min: 2300, max: 2699, name: "提高+/省选-", color: "blue", range: "2300–2600" },
  { min: 2700, max: 3099, name: "省选/NOI-", color: "purple", range: "2700–3000" },
  { min: 3100, max: Infinity, name: "NOI/NOI+/CTS", color: "black", range: "3100+" },
] as const;
export function estimatedDifficulty(rating: number) {
  if (!Number.isFinite(rating) || rating < 800) return undefined;
  return difficultyLevels.find(level => rating >= level.min && rating <= level.max);
}
