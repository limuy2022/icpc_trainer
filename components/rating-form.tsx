"use client";
import { useState } from "react";
import { api } from "./account-gate";
import { ratingRange } from "@/lib/rating-range";
export default function RatingForm({rating,onSaved}:{rating:number|null;onSaved:(rating:number|null)=>void}) {
  const [value,setValue]=useState(rating==null?"":String(rating)),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const parsed=value.trim()===""?null:Number(value);
  const valid=parsed===null || (Number.isInteger(parsed)&&parsed>=0&&parsed<=5000);
  const range=ratingRange(valid?parsed:null);
  return <form className="account-form" onSubmit={async e=>{
    e.preventDefault();if(!valid){setError("请输入 0–5000 的整数");return;}
    setBusy(true);setError("");
    try{const data=await api("/api/profile",{cfRating:parsed},"PATCH");onSaved(data.cfRating);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }}><h2>我的 CF 等级分</h2><p>填写自己的 Codeforces Rating，或用一个估计分数作为训练起点。保存后按等级分 −100 到 +300 预设选题。</p>
    <label>个人等级分<input aria-label="个人 CF 等级分" type="number" inputMode="numeric" min={0} max={5000} step={1} value={value} onChange={e=>setValue(e.target.value)} placeholder="例如 1600" disabled={busy}/></label>
    <div className="rating-preview">{valid?`默认题目难度：${range.min}–${range.max}`:"请输入有效的整数等级分"}<small>题库范围为 800–3500，超出部分按边界截取；留空使用 1400–1800。</small></div>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <button className="primary" disabled={busy||!valid}>{busy?"正在保存…":"保存并应用预设"}</button>
  </form>;
}
