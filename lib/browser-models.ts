import {reasoningOptions,type ReasoningLevel,reasoningParameters} from "./reasoning";
import {outputParameters} from "./model-output";
import {answerText,readModelStream,reasoningText,ModelStreamError} from "./model-stream";
export type BrowserModel={id:string;label:string;model:string;provider:string;base_url:string;key:string;max_output_tokens:number|null;output_token_parameter:string;remember:boolean};
const bucket=(userId:string)=>"icpc-browser-models:"+userId;
export function readBrowserModels(userId:string):BrowserModel[]{
 try{return [...JSON.parse(localStorage.getItem(bucket(userId))||"[]"),...JSON.parse(sessionStorage.getItem(bucket(userId))||"[]")].filter((m:any)=>m&&typeof m.id==="string"&&m.id.startsWith("browser-")&&typeof m.key==="string");}catch{return [];}
}
export function saveBrowserModels(userId:string,models:BrowserModel[]){
 localStorage.setItem(bucket(userId),JSON.stringify(models.filter(m=>m.remember)));
 sessionStorage.setItem(bucket(userId),JSON.stringify(models.filter(m=>!m.remember)));
 window.dispatchEvent(new Event("icpc-browser-models"));
}
export function browserModelMetadata(model:BrowserModel){const {id,label,model:name,provider,max_output_tokens,output_token_parameter}=model;return {id,label,model:name,provider,max_output_tokens,output_token_parameter,scope:"browser",is_default:0,reasoningOptions:reasoningOptions(model)};}
export function browserEndpoint(base:string){
 const url=new URL(base.trim());
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.origin===window.location.origin)throw Error("本机模型需要外部 HTTPS 接口地址，不可使用本站地址");
 return url.href.replace(/\/+$/,"");
}
export function browserModelPayload(model:BrowserModel,effort:ReasoningLevel){return {model:model.model,...outputParameters(model),...reasoningParameters(model,effort)};}
export async function browserModelList(model:BrowserModel,signal?:AbortSignal){
 const response=await fetch(browserEndpoint(model.base_url)+"/models",{headers:{Authorization:`Bearer ${model.key}`},credentials:"omit",redirect:"error",signal});
 if(!response.ok)throw Error("模型目录不可用，请检查密钥或手动填写模型 ID");
 const data=await response.json() as any;
 return [...new Set<string>((data.data||[]).flatMap((v:any)=>typeof v.id==="string"&&v.id.length<=120?[v.id]:[]))].sort().slice(0,5000);
}
export async function browserCompletion(userId:string,model:BrowserModel,payload:Record<string,unknown>,options:{signal?:AbortSignal;delta?:(text:string)=>void;reasoning?:(text:string)=>void}={}){
 let data:any;
 try{
  const response=await fetch(browserEndpoint(model.base_url)+"/chat/completions",{method:"POST",credentials:"omit",redirect:"error",headers:{"Content-Type":"application/json",Authorization:`Bearer ${model.key}`},body:JSON.stringify({...payload,model:model.model,stream:true,stream_options:{include_usage:true}}),signal:options.signal});
  if(!response.ok)throw Error(response.status===401?"模型密钥无效，请检查本机配置":`模型服务返回错误（${response.status}）`);
  data=await readModelStream(response,options.delta||(()=>{}),options.reasoning);
  if(data.choices?.[0]?.finish_reason==="length")throw Error("模型输出达到上限，请调整本机输出预算后重试");
  const text=answerText(data.choices?.[0]?.message?.content).trim();if(!text)throw Error("模型没有返回最终回答，请重试。");
  return {text:text.replaceAll(model.key,"[API Key 已隐藏]"),reasoning:reasoningText(data.choices?.[0]?.message).replaceAll(model.key,"[API Key 已隐藏]")||undefined,model:model.model};
 }catch(error){
  if(error instanceof ModelStreamError)throw Error("服务商回复连接中断或数据无效，已有内容已保留，请手动重试。");
  if((error as Error).name==="TypeError")throw Error("浏览器直连失败：接口可能未允许跨域（CORS），或网络连接已中断。Key 未转发到网站服务器。");
  throw error;
 }finally{
  try{const key="icpc-browser-usage:"+userId,rows=JSON.parse(localStorage.getItem(key)||"{}");const old=rows[model.id]||{calls:0,tokens:0,unknown:0};const tokens=data?.usage?.total_tokens;rows[model.id]={calls:old.calls+1,tokens:old.tokens+(Number.isSafeInteger(tokens)&&tokens>=0?tokens:0),unknown:old.unknown+(Number.isSafeInteger(tokens)&&tokens>=0?0:1)};localStorage.setItem(key,JSON.stringify(rows));}catch{}
 }
}
