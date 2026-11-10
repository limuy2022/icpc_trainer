import type {Session,Message} from "./types";
import type {ChatReply} from "./chat-response";
export type CoachJob={id:string;sessionId:string;branchHash:string;status:"running"|"done"|"error"|"cancelled";text:string;reasoning:string;result?:ChatReply;context?:Session;error?:string;requestId?:string;createdAt:string};
export const conversationBranch=(session:Pick<Session,"messages"|"messagesVersion">)=>JSON.stringify([session.messagesVersion||"",session.messages.map(({role,content})=>({role,content}))]);
export async function branchHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");}
export function hasJobReply(session:Session,id:string):boolean {
  return session.messages.some(m=>m.generationId===id)||Boolean(session.recoveredVersions?.some(v=>v.field==="messages"&&Array.isArray(v.value)&&v.value.some((m:Message)=>m.generationId===id)));
}
export function applyJobReply(session:Session,job:CoachJob,branchMatches:boolean):Session {
  if(!job.result?.text||hasJobReply(session,job.id))return session;
  const message:Message={role:"assistant",content:job.result.text,generationId:job.id,...(job.result.sources?{sources:job.result.sources}:{}),...(job.result.reasoning?{reasoning:job.result.reasoning}:{})};
  return branchMatches?{...session,messages:[...session.messages,message],editorialReference:job.result.editorial||session.editorialReference}:{...session,recoveredVersions:[...(session.recoveredVersions||[]),{field:"messages",value:[...(job.context?.messages||[]),message],savedAt:job.createdAt}]};
}

/** Restore an unsynced user turn only when existing history is an unchanged prefix. */
export function recoverJobSession(session:Session|undefined,context:Session):Session {
  if(!session)return context;
  if((session.messagesVersion||"")!==(context.messagesVersion||"")||session.messages.length>=context.messages.length)return session;
  if(!session.messages.every((m,i)=>m.role===context.messages[i]?.role&&m.content===context.messages[i]?.content))return session;
  return {...session,messages:[...session.messages,...context.messages.slice(session.messages.length)]};
}
