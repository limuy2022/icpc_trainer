"use client";
import {useState} from "react";
import {t as ui,useLocale} from "@/lib/locale";
import {readBrowserModels,saveBrowserModels,browserEndpoint,browserModelList,type BrowserModel} from "@/lib/browser-models";
import {modelPresets} from "@/lib/model-presets";
const empty=():BrowserModel=>({id:"browser-"+crypto.randomUUID(),label:"",model:"",provider:"openai-compatible",base_url:"",key:"",max_output_tokens:null,output_token_parameter:"max_tokens",remember:false});
export default function BrowserModelManager({userId}:{userId:string}){
 useLocale();const [models,setModels]=useState(()=>readBrowserModels(userId)),[form,setForm]=useState<BrowserModel|null>(null),[error,setError]=useState(""),[available,setAvailable]=useState<string[]>([]),[busy,setBusy]=useState(false),[search,setSearch]=useState("");
 let usage:any={};try{usage=JSON.parse(localStorage.getItem("icpc-browser-usage:"+userId)||"{}");}catch{}
 const save=(next:BrowserModel[])=>{saveBrowserModels(userId,next);setModels(next);};
 return <div className="browser-model-manager"><h2>{ui("本机 API 模型")}</h2><p>{ui("Key 仅保存在此浏览器，直接发送给你选择的模型服务商，不上传本站。默认仅本次浏览器会话保存。")}</p><p className="muted">{ui("服务商必须允许浏览器跨域访问。直连模式不能保证切屏后继续生成，调用与 Token 统计仅保存在本机。")}</p>
 {models.map(model=><article className="model-card" key={model.id}><div><strong>{model.label}</strong><p>{model.model}</p><small>{ui("本机调用 {0} 次 · 已报告 {1} Token",[usage[model.id]?.calls||0,usage[model.id]?.tokens||0])}</small></div><button className="text-button" onClick={()=>{setForm({...model});setAvailable([]);setError("");}}>{ui("编辑")}</button><button className="text-button" onClick={()=>{if(window.confirm(ui("删除这个本机模型？")))save(models.filter(m=>m.id!==model.id));}}>{ui("删除")}</button></article>)}
 {!form?<button className="primary" onClick={()=>{setForm(empty());setError("");setAvailable([]);}}>{ui("添加本机模型")}</button>:<form className="account-form" onSubmit={e=>{e.preventDefault();try{const base_url=browserEndpoint(form.base_url);if(!form.key.trim()||!form.model.trim()||!form.label.trim())throw Error("请填写名称、模型 ID 和 Key");save([...models.filter(m=>m.id!==form.id),{...form,base_url,key:form.key.trim()}]);setForm(null);setError("");}catch(error){setError((error as Error).message);}}}>
 <label>{ui("常用厂商")}<select defaultValue="" onChange={e=>{const preset=modelPresets.find(p=>p.id===e.target.value);if(preset){setForm({...form,label:form.label||preset.label,base_url:preset.base_url,provider:preset.provider,model:"",key:""});setAvailable([]);}}}><option value="">{ui("自定义兼容接口")}</option>{modelPresets.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
 <label>{ui("显示名称")}<input required maxLength={80} value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label>
 <label>Base URL<input required type="url" value={form.base_url} onChange={e=>{setForm({...form,base_url:e.target.value,key:""});setAvailable([]);}}/></label>
 <label>{ui("接口类型")}<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value})}><option value="openai-compatible">OpenAI Chat Completions</option><option value="glm">GLM</option></select></label>
 <label>API Key<input required type="password" autoComplete="off" maxLength={4096} value={form.key} onChange={e=>{setForm({...form,key:e.target.value});setAvailable([]);}}/></label>
 <label>{ui("模型 ID")}<input required maxLength={120} value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label>
 <button type="button" className="secondary" disabled={busy||!form.key||!form.base_url} onClick={async()=>{setBusy(true);setError("");try{setAvailable(await browserModelList(form,AbortSignal.timeout(12000)));}catch{setError(ui("浏览器无法获取模型列表；可能不支持 CORS，请手动填写模型 ID。"));}finally{setBusy(false);}}}>{ui("获取模型列表")}</button>
 {available.length>0&&<div><label>{ui("筛选模型列表")}<input value={search} onChange={e=>setSearch(e.target.value)}/></label><div role="listbox" aria-label={ui("可用模型 ID")} className="model-options">{available.filter(id=>id.toLowerCase().includes(search.toLowerCase())).slice(0,100).map(id=><button type="button" role="option" aria-selected={form.model===id} key={id} onClick={()=>setForm({...form,model:id})}>{id}</button>)}</div></div>}
 <label>{ui("输出 Token 上限")}<input type="number" min="1" max="1048576" value={form.max_output_tokens??""} placeholder={ui("留空使用服务商默认值")} onChange={e=>setForm({...form,max_output_tokens:e.target.value?Number(e.target.value):null})}/></label>
 <label>{ui("输出 Token 参数")}<select value={form.output_token_parameter} onChange={e=>setForm({...form,output_token_parameter:e.target.value})}><option value="max_tokens">max_tokens</option><option value="max_completion_tokens">max_completion_tokens</option></select></label>
 <label className="remember-browser-key"><input type="checkbox" checked={form.remember} onChange={e=>setForm({...form,remember:e.target.checked})}/>{ui("记住在本浏览器（不会同步到其他设备）")}</label>
 {error&&<div className="form-error" role="alert">{ui(error)}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setForm(null)}>{ui("取消")}</button><button className="primary">{ui("仅保存到本机")}</button></div></form>}
 </div>;
}
