import { difficultyLevels, estimatedDifficulty } from "@/lib/difficulty";

export default function DifficultyBadge({rating}: {rating: number}) {
  const level = estimatedDifficulty(rating);
  if (!level) return null;
  return <span className={`luogu-difficulty luogu-${level.color}`} title={`洛谷风格估算：${level.name}；由 CF 题目评分 ${rating} 换算，并非洛谷对本题的实际评级。`}>
    <span className="difficulty-dot" aria-hidden="true" />
    {level.name}<small>估</small>
  </span>;
}

export function DifficultyGuide() {
  return <details className="difficulty-guide">
    <summary>CF 评分 ↔ 洛谷风格难度（估算）</summary>
    <p>使用洛谷现行八档名称与配色，按 CF 题目评分估算，非选手 Rating，也非洛谷对该题的实际评级。思维与实现侧重点不同，同档题目的体感可能差异很大。</p>
    <div className="difficulty-legend">{difficultyLevels.map(level => <div key={level.color}>
      <DifficultyBadge rating={level.min} /><span>CF {level.range}</span>
    </div>)}</div>
    <p>参考区间存在重叠，本站统一使用 900 / 1200 / 1600 / 2000 / 2300 / 2700 / 3100 作为分界。可继续用原始 CF 评分精确筛选。</p>
    <p>来源：<a href="https://help.luogu.com.cn/manual/luogu/problem/difficulty" target="_blank" rel="noreferrer">洛谷难度体系</a> · <a href="https://www.luogu.com/article/my22kz4j" target="_blank" rel="noreferrer">社区难度对照表</a> · 核验于 2026-11-09</p>
  </details>;
}
