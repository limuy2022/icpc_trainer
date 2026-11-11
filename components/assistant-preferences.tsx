"use client";
import {useLocale,t as ui} from "@/lib/locale";
import type {Session} from "@/lib/types";
import {assistantTopics} from "@/lib/assistant";
export default function AssistantPreferences({session,onChange}:{session:Session;onChange:(change:Partial<Session>)=>void}){
 useLocale();const profile=session.assistantProfile||{style:"auto",known:"",goal:"",topic:"auto"};
 const update=(key:string,value:string)=>onChange({assistantProfile:{...profile,[key]:value}});
 return <div className="assistant-preferences"><p>{ui("自由讨论概念、证明、复杂度和代码。此处偏好只影响本会话；跨会话信息请放在学习记忆。")}</p>
 <label>{ui("讲解方式")}<select value={profile.style} onChange={e=>update("style",e.target.value)}>{[["auto","按问题自动选择"],["examples","先举例，再推导"],["socratic","逐步提问"],["direct","系统讲解"]].map(([value,label])=><option key={value} value={value}>{ui(label)}</option>)}</select></label>
 <label>{ui("当前学习目标")}<textarea maxLength={1500} value={profile.goal} placeholder={ui("例如：补齐贪心证明，提高区域赛读题后的观察能力")} onChange={e=>update("goal",e.target.value)}/></label>
 <label>{ui("OI Wiki 参考专题")}<select value={profile.topic} onChange={e=>update("topic",e.target.value)}><option value="auto">{ui("根据问题匹配")}</option>{assistantTopics.map(topic=><option key={topic.id} value={topic.id}>{ui(topic.name)}</option>)}</select></label>
 <p className="muted">{ui("只标注实际取得的资料；CF 推荐先按标签和等级分筛选候选，仍需核对题面。")}</p><label>{ui("随手记下的问题")}<textarea value={session.notes} onChange={e=>onChange({notes:e.target.value})}/></label>
 <label className="assistant-memory-toggle"><input type="checkbox" checked={session.useLearningMemory!==false} onChange={e=>onChange({useLearningMemory:e.target.checked})}/>{ui("此会话使用学习记忆")}</label>
 </div>;
}
