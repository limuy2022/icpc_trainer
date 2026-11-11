"use client";
import {useMemo,useState} from "react";
import {useLocale,t as ui} from "@/lib/locale";
import {assistantSessionTitle} from "@/lib/assistant";
import type {Session} from "@/lib/types";
export default function AssistantSessions({sessions,current,onOpen,onNew,onChange}:{sessions:Session[];current:Session;onOpen:(id:string)=>void;onNew:()=>void;onChange:(id:string,patch:Partial<Session>)=>void}){
 useLocale();const [archived,setArchived]=useState(false);
 const chats=useMemo(()=>sessions.filter(s=>s.kind==="assistant"&&!s.lesson&&Boolean(s.assistantArchived)===archived).map(s=>({session:s,title:assistantSessionTitle(s),rounds:s.messages.filter(m=>m.role==="user").length})),[sessions,archived]);
 return <div className="assistant-sessions"><div className="assistant-session-actions"><button className="primary" onClick={()=>{setArchived(false);onNew();}}>{ui("新建对话")}</button></div><div role="listbox" aria-label={ui("助教会话")} className="model-options">{chats.map(({session:s,title,rounds})=><button type="button" role="option" aria-selected={s.id===current.id} key={s.id} onClick={()=>onOpen(s.id)}><strong>{ui(title)}</strong><span>{rounds} {ui("次提问")}</span></button>)}</div><div className="assistant-session-actions"><button className="text-button" onClick={()=>{const title=window.prompt(ui("为当前会话命名"),assistantSessionTitle(current));if(title?.trim())onChange(current.id,{assistantTitle:title.trim().slice(0,80)});}}>{ui("重命名")}</button><button className="text-button" onClick={()=>{if(current.assistantArchived)setArchived(false);onChange(current.id,{assistantArchived:!current.assistantArchived});}}>{ui(current.assistantArchived?"恢复会话":"归档当前会话")}</button><button className="text-button" onClick={()=>setArchived(!archived)}>{ui(archived?"查看进行中":"查看归档")}</button></div></div>;
}
