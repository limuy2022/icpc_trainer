export type Problem = {
  id: string;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number;
};
export type Message = { role: "user" | "assistant"; content: string };
export type Session = {
  id: string;
  problem: Problem;
  messages: Message[];
  statement: string;
  statementFormat?: "markdown";
  statementSource?: { name: string; url: string; official: boolean };
  statementFetchedAt?: string;
  notes: string;
  hints: number;
  elapsed: number;
  startedAt: number | null;
  createdAt: string;
  outcome: "training" | "independent" | "assisted" | "review";
  takeaway: string;
};
export const tagLabels: Record<string, string> = {
  greedy: "贪心",
  math: "数学",
  "constructive algorithms": "构造",
  "binary search": "二分",
  "two pointers": "双指针",
  "data structures": "数据结构",
  dp: "动态规划",
  graphs: "图论",
  trees: "树",
  dsu: "并查集",
  combinatorics: "组合数学",
  "number theory": "数论",
  implementation: "模拟",
  sortings: "排序",
  strings: "字符串",
  "brute force": "暴力",
  bitmasks: "位运算",
  games: "博弈",
  "dfs and similar": "DFS / 搜索",
  "divide and conquer": "分治",
  "shortest paths": "最短路",
  geometry: "计算几何",
  flows: "网络流",
  "graph matchings": "图匹配",
  hashing: "哈希",
  probabilities: "概率",
  matrices: "矩阵",
  "meet-in-the-middle": "折半搜索",
  "string suffix structures": "后缀结构",
  "ternary search": "三分",
  "2-sat": "2-SAT",
  fft: "FFT",
  "chinese remainder theorem": "中国剩余定理",
  "expression parsing": "表达式解析",
  schedules: "调度",
  interactive: "交互题",
};
export const problemUrl = (p: Problem) =>
  `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
