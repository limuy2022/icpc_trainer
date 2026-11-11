import {CODEFORCES_ORIGIN} from "./constants";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { htmlToMarkdown } from "./statements";
type Node = DefaultTreeAdapterMap["node"];
const children = (n:Node):Node[] => "childNodes" in n ? n.childNodes : [];
const attr = (n:Node,name:string) => "attrs" in n ? n.attrs.find(a=>a.name===name)?.value || "" : "";
function text(n:Node):string {return n.nodeName==="#text" ? (n as DefaultTreeAdapterMap["textNode"]).value : children(n).map(text).join("");}
function walk(n:Node,visit:(n:Node)=>void) {visit(n);children(n).forEach(c=>walk(c,visit));}
function problemLink(href:string) {
  try {
    const u=new URL(href,CODEFORCES_ORIGIN);
    if(u.hostname!=="codeforces.com" || !["http:","https:"].includes(u.protocol))return;
    const m=u.pathname.match(/^\/(?:contest\/(\d+)\/problem\/([A-Z][A-Z0-9]*)|problemset\/problem\/(\d+)\/([A-Z][A-Z0-9]*))\/?$/i);
    if(m)return (m[1]||m[3])+(m[2]||m[4]).toUpperCase();
  } catch {return;}
}
/** Discover only links explicitly labelled Tutorial/Editorial in contest materials. */
export function tutorialLinks(html:string):string[] {
  const result:{url:string;english:boolean}[]=[];
  walk(parse(html),n=>{
    if(n.nodeName!=="a" || !/tutorial|editorial|题解|разбор/i.test(text(n)))return;
    let container:Node|undefined="parentNode" in n ? n.parentNode || undefined : undefined;
    while(container && !attr(container,"class").split(/\s+/).includes("sidebox"))container="parentNode" in container ? container.parentNode || undefined : undefined;
    if(!container || !/Contest materials|Материалы соревнования|比赛资料/i.test(text(container)))return;
    try {
      const u=new URL(attr(n,"href"),CODEFORCES_ORIGIN);
      const m=u.pathname.match(/^\/blog\/entry\/(\d+)\/?$/);
      if(u.hostname==="codeforces.com" && m)result.push({url:`https://codeforces.com/blog/entry/${m[1]}`,english:/\(en\)|english/i.test(text(n))});
    } catch { /* Ignore unrelated links. */ }
  });
  return [...new Set(result.sort((a,b)=>Number(b.english)-Number(a.english)).map(r=>r.url))].slice(0,3);
}
/** Only accept an explicit problem link in a heading; never substitute an entire round. */
export function editorialSection(html:string,contest:string,index:string) {
  const document=parse(html,{sourceCodeLocationInfo:true});
  const markers=new Map<number,{start:number;end:number;ids:Set<string>}>();
  walk(document,n=>{
    if(n.nodeName!=="a")return;
    const id=problemLink(attr(n,"href"));if(!id)return;
    let parent:Node|undefined="parentNode" in n ? n.parentNode || undefined : undefined;
    let block:Node|undefined;
    while(parent && parent.nodeName!=="body") {
      if(/^h[1-6]$/.test(parent.nodeName)){block=parent;break;}
      if(parent.nodeName==="p" && (children(parent).some(c=>["strong","b"].includes(c.nodeName)) || text(parent).trim()===text(n).trim())){block=parent;break;}
      parent="parentNode" in parent ? parent.parentNode || undefined : undefined;
    }
    const location=block && "sourceCodeLocation" in block ? block.sourceCodeLocation : undefined;
    if(!location)return;
    const marker=markers.get(location.startOffset)||{start:location.startOffset,end:location.endOffset,ids:new Set<string>()};
    marker.ids.add(id);markers.set(marker.start,marker);
  });
  walk(document,n=>{
    if(!/^h[1-6]$/.test(n.nodeName))return;
    const match=text(n).trim().match(/^(\d{1,7})([A-Z][A-Z0-9]{0,3})(?:\s|[.\-–—:])/);
    const location="sourceCodeLocation" in n ? n.sourceCodeLocation : undefined;
    if(match && location && !markers.has(location.startOffset))markers.set(location.startOffset,{start:location.startOffset,end:location.endOffset,ids:new Set([match[1]+match[2]])});
  });
  const ordered=[...markers.values()].sort((a,b)=>a.start-b.start);
  const target=ordered.findIndex(m=>m.ids.has(contest+index));
  if(target<0)throw Error("官方题解未找到可确认题号的小节");
  const start=ordered[target].start,end=ordered[target+1]?.start ?? html.length;
  const result=htmlToMarkdown(html.slice(start,end));
  if(result.length<80 || result.length>40000)throw Error("官方题解小节长度异常");
  return result;
}
export type EditorialReference = {status:"ready"|"unavailable";url?:string;fetchedAt?:string;stale?:boolean};
export type Editorial = {text:string;url:string;fetchedAt:string;discoveryUrl:string;stale?:boolean};
