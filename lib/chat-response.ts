import type { EditorialReference } from "./editorials";
export type ChatReply={text:string;model?:string;editorial?:EditorialReference;requestId?:string};
class ChatReplyError extends Error {}
export async function readChatResponse(response:Response,callbacks:{delta:(text:string)=>void;status:(data:Partial<ChatReply>)=>void}):Promise<ChatReply> {
  const type=response.headers.get("content-type")||"";
  if(!type.includes("application/x-ndjson")) {
    let data:any;
    try{data=await response.json();}catch{throw Error(response.status===504?"服务器等待模型响应超时。你的输入已保留，请重试。":"服务返回了无法解析的数据。你的输入已保留，请重试。");}
    if(!data || typeof data!=="object")throw new ChatReplyError("服务返回了无法解析的数据。你的输入已保留，请重试。");
    callbacks.status(data);
    if(!response.ok)throw Error(data.error||"回复生成失败，请重试");
    if(typeof data.text!=="string"||!data.text.trim())throw Error("模型没有返回最终回答，请重试。");
    return data;
  }
  if(!response.body)throw Error("回复连接中断，尚未收到完整回答。你的输入已保留，请重试。");
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",result:ChatReply|undefined;
  const line=(value:string)=>{
    if(!value.trim())return;
    let event:any;try{event=JSON.parse(value);}catch{throw new ChatReplyError("回复连接返回了无效数据，请重试。");}
    if(!event || typeof event!=="object")throw new ChatReplyError("回复连接返回了无效数据，请重试。");
    if(event.type==="status")callbacks.status(event);
    else if(event.type==="delta"&&typeof event.text==="string")callbacks.delta(event.text);
    else if(event.type==="error"){callbacks.status(event);throw new ChatReplyError(event.error||"回复生成失败，请重试");}
    else if(event.type==="done"){
      if(typeof event.text!=="string"||!event.text.trim())throw new ChatReplyError("模型没有返回最终回答，请重试。");
      result=event;callbacks.status(event);
    }
  };
  try{
    while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>1000000)throw Error("回复数据异常，请重试。");let i;while((i=buffer.indexOf("\n"))>=0){line(buffer.slice(0,i));buffer=buffer.slice(i+1);}}
    buffer+=decoder.decode();if(buffer.trim())line(buffer);
  }catch(error){if(error instanceof ChatReplyError)throw error;throw new ChatReplyError("回复连接中断，尚未收到完整回答。你的输入已保留，请重试。");}finally{await reader.cancel().catch(()=>{});}
  if(!result)throw Error("回复连接中断，尚未收到完整回答。你的输入已保留，请重试。");
  return result;
}
