"use client";
import {t as ui,useLocale} from "@/lib/locale";
import {lessonCatalog,lessonStages,completeLessonStage} from "@/lib/lessons";
import type {Session} from "@/lib/types";
export function LessonLibrary({sessions,onStart}:{sessions:Session[];onStart:(topicId:string)=>void}){
 useLocale();return <main className="main-content lesson-library"><div className="section-title"><div><div className="eyebrow">ALGORITHM LEARNING</div><h1>{ui("从理解一个新算法开始。")}</h1><p>{ui("先补前置，再建立直觉、证明与实现，最后用小测和练习检验。")}</p></div></div><div className="lesson-cards">{lessonCatalog.map(topic=>{
 const saved=sessions.find(s=>s.lesson?.topicId===topic.id),count=saved?.lesson?.completed.length||0;
 return <article key={topic.id} className="lesson-card"><h2>{ui(topic.name)}</h2><p>{ui(topic.goal)}</p><small>{ui("建议前置")}: {ui(topic.prerequisites)}</small><div><progress max={lessonStages.length} value={count} aria-label={ui("学习进度")}/><span>{count} / {lessonStages.length}</span></div><button className="primary" onClick={()=>onStart(topic.id)}>{ui(saved?"继续学习":"开始学习")}</button></article>;
 })}</div></main>;
}
export function LessonProgress({session,busy,onChange,onExplain}:{session:Session;busy:boolean;onChange:(change:Partial<Session>)=>void;onExplain:()=>void}){
 useLocale();const lesson=session.lesson!,topic=lessonCatalog.find(t=>t.id===lesson.topicId)!,stage=lessonStages.find(s=>s.id===lesson.stage)!;
 const hasReply=session.messages.some(m=>m.role==="assistant"&&m.lessonStage===lesson.stage);
 return <section id="problem-reader" className="statement-panel assistant-preferences lesson-progress"><h2>{ui(topic.name)}</h2><p>{ui(topic.goal)}</p><p className="muted">{ui("建议前置")}: {ui(topic.prerequisites)}</p><div className="lesson-stages" aria-label={ui("学习阶段")}>{lessonStages.map((item,index)=><button type="button" aria-current={item.id===lesson.stage?"step":undefined} key={item.id} disabled={busy} onClick={()=>onChange({lesson:{...lesson,stage:item.id}})}><span>{lesson.completed.includes(item.id)?"✓":index+1}</span>{ui(item.name)}</button>)}</div><h3>{ui("当前阶段")}: {ui(stage.name)}</h3><button className="primary" disabled={busy} onClick={onExplain}>{ui("讲解本节")}</button><button className="secondary" disabled={busy||!hasReply||lesson.completed.includes(lesson.stage)} onClick={()=>{const next=completeLessonStage(session);onChange({lesson:next.lesson});}}>{ui("本节已学，进入下一节")}</button><small>{ui("进度由你确认，不代表已经通过测验或代码判题。可以回到任意阶段复习。")}</small><label>{ui("掌握情况（自评）")}<select value={lesson.mastery} onChange={e=>onChange({lesson:{...lesson,mastery:e.target.value as "learning"|"explain"|"implement"}})}><option value="learning">{ui("正在学习")}</option><option value="explain">{ui("能解释原理")}</option><option value="implement">{ui("能独立实现并说明边界")}</option></select></label><label>{ui("我的疑问与总结")}<textarea value={session.notes} onChange={e=>onChange({notes:e.target.value})}/></label></section>;
}
