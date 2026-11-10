import type {Session} from "./types";
export const assistantId="algorithm-assistant";
export const assistantTopics=[{id:"dsu",name:"并查集",path:"ds/dsu",tag:"dsu",match:/并查集|\bdsu\b|union.find|disjoint/i},{id:"binary-search",name:"二分",path:"basic/binary",tag:"binary search",match:/二分|binary.search/i},{id:"greedy",name:"贪心",path:"basic/greedy",tag:"greedy",match:/贪心|greedy/i},{id:"dp",name:"动态规划",path:"dp/basic",tag:"dp",match:/动态规划|\bdp\b|dynamic.program/i},{id:"seg",name:"线段树",path:"ds/seg",tag:"data structures",match:/线段树|segment.tree/i},{id:"shortest",name:"最短路",path:"graph/shortest-path",tag:"shortest paths",match:/最短路|dijkstra|shortest.path/i},{id:"prefix",name:"前缀和与差分",path:"basic/prefix-sum",tag:"data structures",match:/前缀和|差分|prefix.sum/i},{id:"kmp",name:"KMP",path:"string/kmp",tag:"strings",match:/kmp|前缀函数/i}];
assistantTopics.push(
 {id:"fenwick",name:"树状数组",path:"ds/fenwick",tag:"data structures",match:/树状数组|fenwick|binary.indexed.tree/i},
 {id:"hld",name:"树链剖分",path:"graph/hld",tag:"trees",match:/树链剖分|重链剖分|\bhld\b|heavy.light/i},
 {id:"max-flow",name:"网络流：最大流",path:"graph/flow/max-flow",tag:"flows",match:/网络流|最大流|max.flow|dinic/i},
 {id:"persistent-seg",name:"可持久化线段树",path:"ds/persistent-seg",tag:"data structures",match:/可持久化|主席树|persistent.segment/i},
);
export function assistantSessionTitle(session:Session){return session.assistantTitle||session.messages.find(m=>m.role==="user")?.content.slice(0,36)||"新对话";}
export function newAssistantSession():Session{const id="assistant-"+crypto.randomUUID();return {id,assistantTitle:"新对话",useLearningMemory:true,kind:"assistant",problem:{id,contestId:0,index:"",name:"算法助教",rating:0,tags:[],solvedCount:0},messages:[],statement:"",notes:"",hints:0,elapsed:0,startedAt:null,createdAt:new Date().toISOString(),outcome:"training",takeaway:"",assistantProfile:{style:"auto",known:"",goal:"",topic:"auto"}};}
