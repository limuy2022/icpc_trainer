"use client";
import {useState} from "react";
import LessonWiki from "./lesson-wiki";
import {t as ui,useLocale} from "@/lib/locale";
import {lessonCatalog,lessonChapters,lessonStages,completeLessonStage,isLessonMastered} from "@/lib/lessons";
import type {Session} from "@/lib/types";
export function LessonLibrary({sessions,ready,onStart,onMasteryChange}:{
  sessions:Session[];
  ready:boolean;
  onStart:(topicId:string)=>void;
  onMasteryChange:(topicId:string,mastered:boolean)=>void;
}){
  useLocale();
  const [mastered,setMastered]=useState(false);
  const [chapter,setChapter]=useState("");
  const [search,setSearch]=useState("");
  const saved=new Map(sessions.flatMap(session=>session.lesson?[[session.lesson.topicId,session] as const]:[]));
  const masteredCount=lessonCatalog.filter(topic=>isLessonMastered(saved.get(topic.id)?.lesson)).length;
  const query=search.trim().toLowerCase();
  const visible=lessonCatalog.filter(topic=>
    isLessonMastered(saved.get(topic.id)?.lesson)===mastered &&
    (!chapter||topic.chapter===chapter) &&
    [topic.name,ui(topic.name),topic.path].some(value=>value.toLowerCase().includes(query)),
  );

  return <main className="main-content lesson-library">
    <div className="section-title">
      <div><h1>{ui("专题学习")}</h1><p>{ui("按 OI Wiki 目录学习，随时标记已掌握的专题。")}</p></div>
      <a className="secondary" href="https://oi-wiki.org/" target="_blank" rel="noreferrer">OI Wiki ↗</a>
    </div>
    <div className="lesson-library-controls">
      <div className="lesson-status-filter" role="group" aria-label={ui("掌握状态")}>
        <button type="button" className="secondary" aria-pressed={!mastered} onClick={()=>setMastered(false)}>{ui("未掌握")} <span>{lessonCatalog.length-masteredCount}</span></button>
        <button type="button" className="secondary" aria-pressed={mastered} onClick={()=>setMastered(true)}>{ui("已掌握")} <span>{masteredCount}</span></button>
      </div>
      <select aria-label={ui("OI Wiki 栏目")} value={chapter} onChange={event=>setChapter(event.target.value)}>
        <option value="">{ui("全部栏目")}</option>
        {lessonChapters.map(name=><option key={name} value={name}>{ui(name)}</option>)}
      </select>
      <input type="search" aria-label={ui("搜索专题")} placeholder={ui("搜索专题")} value={search} onChange={event=>setSearch(event.target.value)}/>
    </div>
    {ready&&visible.length===0&&<p className="muted" role="status">{ui("没有符合条件的专题")}</p>}
    {ready&&lessonChapters.map(name=>{
      const topics=visible.filter(topic=>topic.chapter===name);
      if(!topics.length)return null;
      return <section key={name} className="lesson-chapter">
        <h2>{ui(name)} <small>{topics.length}</small></h2>
        <ul>{topics.map(topic=>{
          const session=saved.get(topic.id);
          const count=session?.lesson?.completed.length??0;
          return <li key={topic.id} className="lesson-row">
            <div className="lesson-row-title">
              <button type="button" onClick={()=>onStart(topic.id)}>{ui(topic.name)}</button>
              {count>0&&<small aria-label={ui("学习进度")}>{count} / {lessonStages.length}</small>}
            </div>
            <button type="button" className="secondary" onClick={()=>onMasteryChange(topic.id,!mastered)}>
              {ui(mastered?"标记为未掌握":"标记为已掌握")}
            </button>
          </li>;
        })}</ul>
      </section>;
    })}
  </main>;
}
export function LessonProgress({session,busy,onChange,onExplain,onRemember}:{session:Session;busy:boolean;onChange:(change:Partial<Session>)=>void;onExplain:()=>void;onRemember:()=>void}){
 useLocale();const lesson=session.lesson!,topic=lessonCatalog.find(t=>t.id===lesson.topicId)!,stage=lessonStages.find(s=>s.id===lesson.stage)!;
 const hasReply=session.messages.some(m=>m.role==="assistant"&&m.lessonStage===lesson.stage);
 return <LessonWiki key={topic.id} topic={topic}><div className="assistant-preferences lesson-progress"><h2>{ui(topic.name)}</h2><p>{ui(topic.goal)}</p><p className="muted">{ui("建议前置")}: {ui(topic.prerequisites)}</p><div className="lesson-stages" aria-label={ui("学习阶段")}>{lessonStages.map((item,index)=><button type="button" aria-current={item.id===lesson.stage?"step":undefined} key={item.id} disabled={busy} onClick={()=>onChange({lesson:{...lesson,stage:item.id}})}><span>{lesson.completed.includes(item.id)?"✓":index+1}</span>{ui(item.name)}</button>)}</div><h3>{ui("当前阶段")}: {ui(stage.name)}</h3><button className="primary" disabled={busy} onClick={onExplain}>{ui("讲解本节")}</button><button className="secondary" disabled={busy||!hasReply||lesson.completed.includes(lesson.stage)} onClick={()=>{const next=completeLessonStage(session);onChange({lesson:next.lesson});}}>{ui("本节已学，进入下一节")}</button><small>{ui("进度由你确认，不代表已经通过测验或代码判题。可以回到任意阶段复习。")}</small><label>{ui("掌握情况（自评）")}<select value={lesson.mastery} onChange={e=>onChange({lesson:{...lesson,mastery:e.target.value as "learning"|"explain"|"implement"}})}><option value="learning">{ui("正在学习")}</option><option value="explain">{ui("能解释原理")}</option><option value="implement">{ui("能独立实现并说明边界")}</option></select></label><button type="button" className="secondary" onClick={onRemember}>{ui("将此专题掌握情况存入学习记忆")}</button><label>{ui("我的疑问与总结")}<textarea value={session.notes} onChange={e=>onChange({notes:e.target.value})}/></label></div></LessonWiki>;
}
