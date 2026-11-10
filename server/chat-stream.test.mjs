import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-stream-'));
try {
 await build({entryPoints:['lib/model-stream.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'model.mjs')});
 await build({entryPoints:['lib/chat-response.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'chat.mjs')});
 const {readModelStream,answerText}=await import(join(dir,'model.mjs'));
 const {readChatResponse}=await import(join(dir,'chat.mjs'));
 const encoder=new TextEncoder();
 const stream=(text,type,step=1)=>{const bytes=encoder.encode(text);let offset=0;return new Response(new ReadableStream({pull(c){if(offset>=bytes.length){c.close();return;}c.enqueue(bytes.slice(offset,offset+step));offset+=step;}}),{headers:{'Content-Type':type}})};
 const event=data=>'data: '+JSON.stringify(data)+'\r\n\r\n';
 const transcript=event({choices:[{index:0,delta:{reasoning_content:'PRIVATE_REASONING'}}]})+event({choices:[{index:0,delta:{content:'窗口'}}]})+event({choices:[{index:0,delta:{content:'向右移动。'},finish_reason:'stop'}],usage:{prompt_tokens:3,completion_tokens:4,total_tokens:7}})+'data: [DONE]\n\n';
 for(const step of [1,7,4096]){let seen='';const data=await readModelStream(stream(transcript,'text/event-stream',step),s=>seen+=s);assert.equal(seen,'窗口向右移动。');assert.equal(data.choices[0].message.content,seen);assert.equal(data.usage.total_tokens,7);assert.ok(!JSON.stringify(data).includes('PRIVATE_REASONING'));}
 await assert.rejects(()=>readModelStream(stream(event({choices:[{delta:{content:'partial'}}]}),'text/event-stream'),()=>{}),/incomplete_stream/);
 await assert.rejects(()=>readModelStream(stream('data: invalid\n\n','text/event-stream'),()=>{}),/invalid_stream/);
 await assert.rejects(()=>readModelStream(stream(event({error:{message:'private-error'}}),'text/event-stream'),()=>{}),/upstream_stream_error/);
 assert.equal(answerText([{type:'text',text:'answer'},{type:'reasoning',text:'private'}]),'answer');
 let release;const gate=new Promise(r=>release=r);let first;const firstDelta=new Promise(r=>first=r);
 const slow=new Response(new ReadableStream({async start(c){c.enqueue(encoder.encode(event({choices:[{delta:{content:'early'}}]})));await gate;c.enqueue(encoder.encode(event({choices:[{delta:{content:' later'},finish_reason:'stop'}]})));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 let completed=false;const reading=readModelStream(slow,()=>first()).then(data=>{completed=true;return data});await firstDelta;assert.equal(completed,false);release();assert.equal((await reading).choices[0].message.content,'early later');
 const ndjson=[{type:'status',requestId:'test-id',editorial:{status:'ready'}},{type:'heartbeat'},{type:'delta',text:'分段'},{type:'delta',text:'回答'},{type:'done',text:'分段回答',model:'test',requestId:'test-id'}].map(x=>JSON.stringify(x)+'\n').join('');
 let visible='',status;const reply=await readChatResponse(stream(ndjson,'application/x-ndjson'),{delta:s=>visible+=s,status:s=>status=s});assert.equal(visible,'分段回答');assert.equal(reply.text,visible);assert.equal(status.requestId,'test-id');
 await assert.rejects(()=>readChatResponse(stream('{"type":"delta","text":"partial"}\n','application/x-ndjson'),{delta:()=>{},status:()=>{}}),/回复连接中断/);
 await assert.rejects(()=>readChatResponse(new Response('<html>Gateway Timeout</html>',{status:504}),{delta:()=>{},status:()=>{}}),/服务器等待模型响应超时/);
 await assert.rejects(()=>readChatResponse(stream('{"type":"error","error":"specific failure","requestId":"id"}\n','application/x-ndjson'),{delta:()=>{},status:()=>{}}),/specific failure/);
 console.log('PASS: fragmented UTF-8 SSE/NDJSON, reasoning privacy, usage, live first delta, EOF interruption, provider error, proxy HTML errors and explicit completion');
}finally{await rm(dir,{recursive:true,force:true});}
