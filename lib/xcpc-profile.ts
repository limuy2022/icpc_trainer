export const xcpcCategories={
  adhoc:"思维与模拟",technique:"基础技巧",search:"搜索",offline:"分治与离线",
  random:"随机与近似",dataStructure:"数据结构",graph:"图论",flow:"网络流与匹配",
  dp:"动态规划",string:"字符串",math:"数学",probability:"概率与博弈",geometry:"计算几何",
} as const;
export type XcpcCategory=keyof typeof xcpcCategories;
export type XcpcProfile={
  key:string;
  rating:number|null;
  contests:number;
  fetchedAt:string;
  axes:{category:XcpcCategory;score:number;problems:number;established:boolean}[];
};
export function xcpcReviewTopics(profile:XcpcProfile){
  return profile.axes.filter(axis=>axis.established&&axis.problems>=5)
    .sort((left,right)=>left.score-right.score)
    .filter((_,index,axes)=>axes.length>=3&&index<2);
}
