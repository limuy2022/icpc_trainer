"use client";

import {useEffect,useState,type ReactNode} from "react";
import {ExternalLink} from "lucide-react";
import {lessonWikiUrl} from "@/lib/lessons";
import {t as ui,useLocale} from "@/lib/locale";

export default function LessonWiki({topic,children}:{topic:{id:string;name:string;path:string};children:ReactNode}){
  useLocale();
  const [showWiki,setShowWiki]=useState(true);
  const [article,setArticle]=useState<{html:string}|{failed:true}|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      try{
        const response=await fetch("/api/wiki-article?"+new URLSearchParams({topic:topic.id}),{signal:controller.signal});
        if(!response.ok)throw Error();
        const data=await response.json() as {html?:unknown};
        if(typeof data.html!=="string")throw Error();
        if(!controller.signal.aborted)setArticle({html:data.html});
      }catch{
        if(!controller.signal.aborted)setArticle({failed:true});
      }
    }
    void load();
    return ()=>controller.abort();
  },[topic.id,attempt]);

  return <section id="problem-reader" className="statement-panel lesson-reader">
    <div className="panel-heading lesson-reader-toolbar" role="group" aria-label={ui("专题内容")}>
      <button type="button" className="secondary" aria-pressed={showWiki} onClick={()=>setShowWiki(true)}>{ui("OI Wiki 原文")}</button>
      <button type="button" className="secondary" aria-pressed={!showWiki} onClick={()=>setShowWiki(false)}>{ui("学习阶段")}</button>
    </div>
    {showWiki?<div className="lesson-wiki-scroll" tabIndex={0} role="region" aria-label={ui("OI Wiki 原文")}>
      <header className="lesson-wiki-header">
        <h2>{ui(topic.name)}</h2>
        <a href={lessonWikiUrl(topic.path)} target="_blank" rel="noreferrer">{ui("在 OI Wiki 打开")} <ExternalLink size={14}/></a>
      </header>
      {article===null?<p role="status">{ui("正在读取 OI Wiki 原文…")}</p>:("failed" in article)?<div role="status">
        <p>{ui("暂时无法读取 OI Wiki 原文")}</p>
        <button type="button" className="secondary" onClick={()=>{setArticle(null);setAttempt(value=>value+1);}}>{ui("重试")}</button>
      </div>:<article className="lesson-wiki-body message-text" dangerouslySetInnerHTML={{__html:article.html}}/>}
    </div>:children}
  </section>;
}
