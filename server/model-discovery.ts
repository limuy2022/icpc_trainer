import {db} from "./database";
import {modelKey,validateEndpoint,type ModelConfig} from "./models";
import {checkOrigin,fail,requireUser,throttle} from "./security";
const MAX_MODEL_LIST_BYTES=8*1024*1024;
export async function discoverModels(request:Request) {
  const actor=requireUser(request,true);
  if(request.method!=="POST")fail(405,"不支持的操作");
  checkOrigin(request);throttle("model-discovery:"+actor.id,20,60000);
  const body=await request.json() as any;
  const old=body.id ? db.prepare("SELECT * FROM models WHERE id=?").get(String(body.id)) as ModelConfig|undefined : undefined;
  if(body.id&&!old)fail(404,"模型不存在");
  const base=await validateEndpoint(String(body.base_url??old?.base_url??""));
  let key=String(body.key||"").trim();
  if(key.length>4096)fail(400,"密钥过长");
  if(!key){
    if(!old)fail(400,"请先填写 API Key，再获取模型列表");
    if(old.base_url.replace(/\/+$/,"")!==base)fail(400,"更换模型接口地址时需要重新填写密钥");
    key=modelKey(old);
  }
  let response:Response;
  try{response=await fetch(base+"/models",{method:"GET",redirect:"error",headers:{Authorization:`Bearer ${key}`,Accept:"application/json"},signal:AbortSignal.timeout(12000)});}catch{fail(502,"获取模型列表失败，请检查接口地址或稍后重试；也可手动填写模型 ID");}
  if([401,403].includes(response!.status))fail(400,"密钥无效或没有模型列表访问权限");
  if([404,405,501].includes(response!.status))fail(400,"该接口不支持自动获取模型列表，请手动填写模型 ID");
  if(response!.status===429)fail(429,"模型列表请求过于频繁，请稍后重试");
  if(!response!.ok)fail(502,"获取模型列表失败，请检查接口地址或稍后重试；也可手动填写模型 ID");
  const reader=response!.body?.getReader();
  if(!reader || Number(response!.headers.get("content-length")||0)>MAX_MODEL_LIST_BYTES){await reader?.cancel();fail(502,"模型列表格式无效或内容过大，请手动填写模型 ID");}
  let data:any;
  try{
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const chunk=await reader!.read();if(chunk.done)break;size+=chunk.value.length;if(size>MAX_MODEL_LIST_BYTES)throw Error("size");chunks.push(chunk.value);}
    data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }catch{fail(502,"模型列表格式无效或内容过大，请手动填写模型 ID");}finally{await reader!.cancel().catch(()=>{});}
  if(!Array.isArray(data?.data))fail(502,"模型列表格式无效或内容过大，请手动填写模型 ID");
  const models=[...new Set<string>(data.data.flatMap((item:any)=>typeof item?.id==="string"&&item.id.trim().length>0&&item.id.length<=120?[item.id.trim()]:[]))].sort().slice(0,5000);
  return Response.json({models},{headers:{"Cache-Control":"no-store"}});
}
