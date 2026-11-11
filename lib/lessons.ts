import {OI_WIKI_ORIGIN} from "./constants";
import {assistantTopics,newAssistantSession} from "./assistant";
import oiWiki from "./oi-wiki-topics.json";
import type {Session} from "./types";
export const lessonStages=[
 {id:"prerequisites",name:"前置知识",instruction:"先用一个具体小问题检查前置知识，一次只问一个问题。根据回答补齐缺口，不要求用户做完测试才有资格学习。"},
 {id:"intuition",name:"建立直觉",instruction:"先给一个足够小的例子，让用户看出朴素办法的瓶颈及新算法解决的问题。适合时提供 icpc-visual 交互演示或逐步表格，再引入术语。"},
 {id:"algorithm",name:"算法与不变量",instruction:"逐步建立状态定义、关键操作和不变量，说明每一步为什么合法。用小例子手工执行完整过程，避免直接丢模板。"},
 {id:"proof",name:"证明与复杂度",instruction:"解释正确性依据和时间、空间复杂度，区分必要性与充分性、均摊与单次代价；给适用前提及一个不适用的边界例子。证明不要跳过关键步骤。"},
 {id:"implementation",name:"实现与边界",instruction:"结合当前用户熟悉的语言讲实现，默认 C++。先解释接口与状态，再给简洁完整代码，逐项检查下标、初始化和边界。不得声称已经编译或提交运行。"},
 {id:"quiz",name:"理解小测",instruction:"先出一道必须推理而非背模板的小测，等待用户回答，不提前泄露答案。答后指出具体依据、反例或证明缺口，再决定是否补一个边界或迁移问题。不要虚构分数，不因一句听懂了就宣布掌握。"},
 {id:"practice",name:"迁移练习",instruction:"从实际提供的 CF 候选中建议练习顺序，说明标签筛选只是相关性线索。未读取题面就不能断言解法或难度适配。让用户说出把知识迁移到新题时首先检查的条件，不直接给完整题解。"},
] as const;
const goals:Record<string,{prerequisites:string;goal:string}>={
 fenwick:{prerequisites:"前缀和、二进制与位运算",goal:"理解 lowbit 管辖区间、前缀查询与单点修改，再从差分推导区间修改的常见用法。"},
 hld:{prerequisites:"树的 DFS、子树大小、线段树",goal:"理解轻重儿子与 DFS 序，将树上路径分解为区间，并证明轻边数量的对数界。"},
 "max-flow":{prerequisites:"图的存储、BFS、DFS",goal:"理解容量、流量、残量网络和反向边，掌握增广思想，再学习分层图与 Dinic。"},
 "persistent-seg":{prerequisites:"线段树、前缀和、离散化",goal:"理解路径复制与历史版本，推导两版本差分查询区间第 k 小，并核算节点空间。"},
 dsu:{prerequisites:"数组、树的基本概念、递归",goal:"理解集合合并与代表元，独立实现路径压缩和按大小合并，知道并查集不能直接处理拆分。"},
 "binary-search":{prerequisites:"数组、循环、布尔条件",goal:"从单调性建立二分判定，写清不变量，独立处理边界、无解和整数溢出。"},
 greedy:{prerequisites:"排序、基本复杂度分析",goal:"区分直觉与证明，用交换论证或局部最优性质解释选择，并主动寻找反例。"},
 dp:{prerequisites:"递归、枚举、数组",goal:"从暴力搜索建立状态和转移，说明状态含义、计算顺序与初始化，避免把记忆模板当作建模。"},
 seg:{prerequisites:"二叉树、递归、区间",goal:"理解区间合并、查询和修改，独立实现基础线段树，再判断是否需要懒标记。"},
 shortest:{prerequisites:"图的存储、队列与堆",goal:"理解松弛与最短路前提，区分 BFS、Dijkstra 等方法，知道负权会破坏哪些结论。"},
 prefix:{prerequisites:"数组、加减运算",goal:"从区间查询建立前缀和，从区间修改建立差分，独立处理下标、端点与数据范围。"},
 kmp:{prerequisites:"字符串、数组、基本循环",goal:"理解前缀函数与失配跳转，手动构造并独立实现 KMP，解释为什么无需回退文本指针。"},
};
export const lessonChapters=Object.keys(oiWiki.chapters);
const chapterTags:Record<string,string>={
 "搜索":"dfs and similar","动态规划":"dp","字符串":"strings","数学":"math",
 "数据结构":"data structures","图论":"graphs","计算几何":"geometry",
};
export const lessonCatalog=Object.entries(oiWiki.chapters).flatMap(([chapter,pages])=>
 pages.map(([name,path])=>{
  const curated=assistantTopics.find(topic=>topic.path===path);
  const id=curated?.id??"wiki-"+path.replaceAll("/","_");
  return {
   id,name,path,chapter,tag:curated?.tag??chapterTags[chapter],
   memoryName:curated?.name??name,
   ...(goals[id]??{prerequisites:"根据专题内容检查前置知识",goal:"理解本专题的核心概念、适用条件与典型用法。"}),
  };
 }),
);
export function lessonWikiUrl(path:string){
 return OI_WIKI_ORIGIN+"/"+path.replace(/\/index$/,"")+"/";
}
export function isLessonMastered(lesson:Session["lesson"]){
 return lesson?.mastered??(lesson?.mastery==="implement");
}
export function setLessonMastered(sessions:Session[],topicId:string,mastered:boolean):Session[]{
 const index=sessions.findIndex(session=>session.lesson?.topicId===topicId);
 if(index<0){
  const session=newLessonSession(topicId);
  return [{...session,lesson:{...session.lesson!,mastered}},...sessions];
 }
 return sessions.map((session,i)=>i===index?{...session,lesson:{...session.lesson!,mastered}}:session);
}
export function lessonDefinition(value:unknown){const input=value as {topicId?:string;stage?:string}|undefined;if(!input)return undefined;const topic=lessonCatalog.find(t=>t.id===input.topicId),stage=lessonStages.find(s=>s.id===input.stage);return topic&&stage?{topic,stage}:undefined;}
export function newLessonSession(topicId:string,profile?:Session["assistantProfile"]):Session{
 const topic=lessonCatalog.find(t=>t.id===topicId);if(!topic)throw Error("学习专题不存在");
 const session=newAssistantSession();return {...session,id:"lesson-"+topic.id,problem:{...session.problem,id:"lesson-"+topic.id,name:topic.name},lesson:{topicId,stage:"prerequisites",completed:[],mastery:"learning"},assistantProfile:{style:profile?.style||"auto",known:profile?.known||"",goal:topic.goal,topic:topic.id}};
}
export function completeLessonStage(session:Session):Session {
 if(!session.lesson||!lessonDefinition(session.lesson))return session;
 const completed=[...new Set([...session.lesson.completed,session.lesson.stage])];
 const index=lessonStages.findIndex(s=>s.id===session.lesson!.stage);
 return {...session,lesson:{...session.lesson,completed,stage:lessonStages[Math.min(index+1,lessonStages.length-1)].id}};
}
