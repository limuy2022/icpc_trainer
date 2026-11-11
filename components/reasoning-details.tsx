"use client";
import {memo,useState} from "react";
import {t as ui,useLocale} from "@/lib/locale";
import Text from "./lazy-markdown-text";
export default memo(function ReasoningDetails({text,live=false}:{text:string;live?:boolean}) {
  useLocale();const [open,setOpen]=useState(false);
  if(!text)return null;
  return <details className="reasoning-details" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{ui(live?"正在思考":"推理过程")} <span>· {text.length.toLocaleString()} {ui("字符")}</span></summary>
    {open&&(live?<pre>{text}</pre>:<Text text={text}/>)}
  </details>;
});
