export class ModelStreamError extends Error {
  constructor(public code:string){super(code);}
}
export function answerText(content:unknown):string {
  if(typeof content==="string")return content;
  if(Array.isArray(content))return content.map(part=>part?.type==="text"&&typeof part.text==="string"?part.text:"").join("");
  return "";
}
/** Consume only final-answer deltas. Never expose reasoning_content to callers. */
export async function readModelStream(response:Response,onDelta:(text:string)=>void) {
  if(!response.headers.get("content-type")?.includes("text/event-stream")) {
    const data:any=await response.json();
    const text=answerText(data.choices?.[0]?.message?.content);if(text)onDelta(text);
    return data;
  }
  if(!response.body)throw new ModelStreamError("empty_response");
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer="",event:string[]=[],content="",finish:string|undefined,usage:any,done=false;
  const dispatch=()=>{
    if(!event.length)return;const raw=event.join("\n");event=[];
    if(raw.trim()==="[DONE]"){done=true;return;}
    let data:any;try{data=JSON.parse(raw);}catch{throw new ModelStreamError("invalid_stream");}
    if(data.error)throw new ModelStreamError("upstream_stream_error");
    if(data.usage)usage=data.usage;
    const choice=data.choices?.find((item:any)=>item.index===0)||data.choices?.[0];
    if(choice?.finish_reason)finish=choice.finish_reason;
    const text=answerText(choice?.delta?.content);
    if(text){content+=text;if(content.length>200000)throw new ModelStreamError("output_too_large");onDelta(text);}
  };
  const line=(value:string)=>{const clean=value.replace(/\r$/,"");if(!clean){dispatch();return;}if(clean.startsWith("data:"))event.push(clean.slice(5).replace(/^ /,""));};
  try {
    while(!done){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>1000000)throw new ModelStreamError("invalid_stream");let end;while(!done&&(end=buffer.indexOf("\n"))>=0){line(buffer.slice(0,end));buffer=buffer.slice(end+1);}}
    if(!done){buffer+=decoder.decode();if(buffer)line(buffer);dispatch();}
  } finally {await reader.cancel().catch(()=>{});}
  if(!finish && !done)throw new ModelStreamError("incomplete_stream");
  return {choices:[{message:{content},finish_reason:finish}],usage};
}
