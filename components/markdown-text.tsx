"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import { Check, Copy } from "lucide-react";
import type { Element } from "hast";
const highlightOptions = {
  languages: {cpp,python,java,javascript,typescript,rust,go,bash,json},
  aliases: {cpp:["c","c++","c++17","cpp17","c++20","cpp20","c++23","cpp23","C++","CPP"], python:["py","python3"]},
  detect: false,
  plainText:["text","txt","plaintext","input","output"],
};
const languageNames: Record<string,string> = {cpp:"C++",c:"C",python:"Python",py:"Python",python3:"Python",java:"Java",javascript:"JavaScript",js:"JavaScript",typescript:"TypeScript",ts:"TypeScript",rust:"Rust",rs:"Rust",go:"Go",bash:"Shell",sh:"Shell",shell:"Shell",json:"JSON",text:"纯文本",txt:"纯文本",plaintext:"纯文本",input:"样例输入",output:"样例输出"};
function CodeBlock({children,node}: {children?:ReactNode;node?:Element}) {
  const ref=useRef<HTMLPreElement>(null);
  const [state,setState]=useState<"idle"|"copied"|"failed">("idle");
  useEffect(()=>{if(state==="idle")return;const timer=setTimeout(()=>setState("idle"),2500);return()=>clearTimeout(timer);},[state]);
  const code=node?.children.find(child=>child.type==="element"&&child.tagName==="code") as Element|undefined;
  const classes=code?.properties.className;
  const language=(Array.isArray(classes)?classes:[]).map(String).find(value=>value.startsWith("language-"))?.slice(9)||"";
  const label=languageNames[language] || (/^(cpp|c\+\+)/i.test(language)?"C++":language||"代码");
  return <figure className="code-block"><figcaption><span>{label}</span><button type="button" aria-label="复制代码" onClick={async()=>{
    try {await navigator.clipboard.writeText(ref.current?.textContent||"");setState("copied");}catch{setState("failed");}
  }}>{state==="copied"?<Check size={14}/>:<Copy size={14}/>}<span aria-live="polite">{state==="copied"?"已复制":state==="failed"?"复制失败，请手动选择":"复制"}</span></button></figcaption><pre ref={ref}>{children}</pre></figure>;
}
export default function MarkdownText({text}:{text:string}) {
  const math = (part: string) => part.replace(/\\\[/g,"\n$$\n").replace(/\\\]/g,"\n$$\n").replace(/\\\(/g,"$").replace(/\\\)/g,"$");
  let normalized = "", cursor = 0;
  // Formula delimiter normalization must never rewrite string literals in code.
  for (const match of text.matchAll(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1|(`+)[^\n]*?\2/g)) {
    normalized += math(text.slice(cursor, match.index)) + match[0];
    cursor = match.index! + match[0].length;
  }
  normalized += math(text.slice(cursor));
  return <div className="message-text"><ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex,[rehypeHighlight,highlightOptions]]} components={{
    pre:CodeBlock,
    img:({src,alt})=><img src={src} alt={alt||"题目插图"} loading="lazy" referrerPolicy="no-referrer"/>,
    a:({children,href})=><a href={href} target="_blank" rel="noreferrer">{children}</a>,
  }}>{normalized}</ReactMarkdown></div>;
}
