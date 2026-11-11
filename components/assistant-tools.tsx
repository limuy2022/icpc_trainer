"use client";

import {useState,type ReactNode} from "react";
import {Dialog} from "radix-ui";
import {List,Settings2,X} from "lucide-react";
import {t as ui,useLocale} from "@/lib/locale";
import type {Session} from "@/lib/types";
import AssistantPreferences from "./assistant-preferences";
import AssistantSessions from "./assistant-sessions";

function AssistantDialog({title,icon,open,onOpenChange,children}:{
  title:string;
  icon:ReactNode;
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  children:ReactNode;
}){
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger className="secondary">{icon}{title}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="modal-overlay assistant-dialog-overlay">
        <Dialog.Content className="modal assistant-dialog" aria-describedby={undefined}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close className="modal-close" aria-label={ui("关闭")}><X size={20}/></Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>;
}

export default function AssistantTools({sessions,current,onOpen,onNew,onChange,onMemory}:{
  sessions:Session[];
  current:Session;
  onOpen:(id:string)=>void;
  onNew:()=>void;
  onChange:(id:string,change:Partial<Session>)=>void;
  onMemory:()=>void;
}){
  useLocale();
  const [panel,setPanel]=useState<"sessions"|"settings"|null>(null);

  return <div className="assistant-tools">
    <AssistantDialog title={ui("对话列表")} icon={<List size={16}/>} open={panel==="sessions"} onOpenChange={open=>setPanel(open?"sessions":null)}>
      <AssistantSessions
        sessions={sessions}
        current={current}
        onOpen={id=>{setPanel(null);onOpen(id);}}
        onNew={()=>{setPanel(null);onNew();}}
        onChange={onChange}
      />
    </AssistantDialog>
    <AssistantDialog title={ui("会话设置")} icon={<Settings2 size={16}/>} open={panel==="settings"} onOpenChange={open=>setPanel(open?"settings":null)}>
      <AssistantPreferences session={current} onChange={change=>onChange(current.id,change)}/>
      <button type="button" className="secondary" onClick={()=>{setPanel(null);onMemory();}}>{ui("学习记忆")}</button>
    </AssistantDialog>
  </div>;
}
