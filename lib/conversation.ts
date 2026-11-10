import type { Session } from "./types";
export function matchesConversation(session:Session,messages:Session["messages"],version?:string) {
  return (session.messagesVersion||"")===(version||"") && session.messages.length===messages.length && session.messages.every((m,i)=>m.role===messages[i].role&&m.content===messages[i].content);
}
/** Replacing a user turn invalidates every response derived from it. */
export function reviseConversation(session: Session, index: number, replacement?: string): Session {
  if (!Number.isInteger(index) || index < 0 || session.messages[index]?.role !== "user") throw Error("只能修改已发送的用户消息");
  if (replacement !== undefined && !replacement.trim()) throw Error("消息不能为空");
  const previousTime = Number(session.messagesVersion?.split("-")[0]) || 0;
  return {
    ...session,
    messages: [...session.messages.slice(0,index), ...(replacement === undefined ? [] : [{role:"user" as const, content:replacement.trim()}])],
    messagesVersion: `${Math.max(Date.now(),previousTime+1)}-${crypto.randomUUID()}`,
    recoveredVersions: [...(session.recoveredVersions || []), {field:"messages",value:session.messages,savedAt:new Date().toISOString()}],
  };
}
