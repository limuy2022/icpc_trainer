"use client";
import {useEffect,useState} from "react";
import {api} from "./account-gate";
import {t as ui,useLocale} from "@/lib/locale";
import {xcpcCategories,xcpcReviewTopics,type XcpcProfile} from "@/lib/xcpc-profile";

export default function XcpcProfileForm(){
  useLocale();
  const [profile,setProfile]=useState<XcpcProfile|null>(null);
  const [key,setKey]=useState("");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void api("/api/xcpc-profile").then(({profile})=>{
      if(active){setProfile(profile);setKey(profile?.key??"");setReady(true);}
    }).catch(error=>{if(active)setError(error.message);});
    return ()=>{active=false;};
  },[]);
  async function save(value:string|null){
    setBusy(true);
    setError("");
    try{
      const {profile}=await api("/api/xcpc-profile",{key:value},"PATCH");
      setProfile(profile);
      setKey(profile?.key??"");
    }catch(error){
      setError((error as Error).message);
    }finally{
      setBusy(false);
    }
  }
  const review=profile?xcpcReviewTopics(profile):[];
  return <form className="account-form" onSubmit={event=>{event.preventDefault();void save(key.trim());}}>
    <h2>XCPC Rating</h2>
    <p>{ui("关联公开选手档案。开启学习记忆时，助教可以参考正式赛积分和待复盘题型。")}</p>
    <label>{ui("姓名@学校")}<input value={key} onChange={event=>setKey(event.target.value)} required maxLength={120} disabled={!ready||busy}/></label>
    <div>
      <button className="primary" disabled={!ready||busy||!key.trim()}>{ui(profile?.key===key.trim()?"刷新成绩":"关联档案")}</button>{" "}
      {profile&&<button type="button" className="secondary" disabled={busy} onClick={()=>void save(null)}>{ui("解除关联")}</button>}
    </div>
    {error&&<p role="alert" className="form-error">{ui(error)}</p>}
    {profile&&<div>
      <p>{ui("正式赛等级分")} <strong>{profile.rating?.toFixed(2)??"—"}</strong> · {ui("计分场次")} {profile.contests}</p>
      <p>{ui("待复盘题型")} {review.length?review.map(axis=>ui(xcpcCategories[axis.category])).join(" · "):ui("样本不足")}</p>
      {profile.axes.length>0&&<details>
        <summary>{ui("查看题型分和样本数")}</summary>
        <ul>{profile.axes.map(axis=><li key={axis.category}>{ui(xcpcCategories[axis.category])} · {axis.score.toFixed(2)} · {ui("{0} 道题",[axis.problems])}{axis.established?"":" · "+ui("样本不足")}</li>)}</ul>
      </details>}
      <p><a href={"https://heimaom.cn/#/player/"+encodeURIComponent(profile.key)} target="_blank" rel="noreferrer">{ui("查看 XCPC 来源")}</a> · {new Date(profile.fetchedAt).toLocaleDateString()}</p>
    </div>}
  </form>;
}
