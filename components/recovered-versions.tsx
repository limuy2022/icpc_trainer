"use client";
import {memo,useMemo,useState} from "react";
import {t as ui,useLocale,currentLocale} from "@/lib/locale";
import type {Session} from "@/lib/types";
type Version=NonNullable<Session["recoveredVersions"]>[number];
function VersionContent({value}:{value:unknown}) {
  const content=useMemo(()=>typeof value==="string"?value:JSON.stringify(value,null,2),[value]);
  return <pre>{content}</pre>;
}
function VersionDetails({version}:{version:Version}) {
  useLocale();const [open,setOpen]=useState(false);
  const labels:Record<string,string>={notes:ui("草稿"),statement:ui("题面"),takeaway:ui("复盘"),outcome:ui("训练结果"),messages:ui("对话历史")};
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>{labels[version.field]||version.field} · {new Date(version.savedAt).toLocaleString(currentLocale())}</summary>{open&&<VersionContent value={version.value}/>}</details>;
}
export default memo(function RecoveredVersions({versions}:{versions:Session["recoveredVersions"]}) {
  useLocale();const [open,setOpen]=useState(false);
  if(!versions?.length)return null;
  return <details className="recovered-versions" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{ui("查看保留的历史版本（")}{versions.length} {ui("个）")}</summary>{open&&versions.map((v,i)=><VersionDetails key={i} version={v}/>)}</details>;
});
