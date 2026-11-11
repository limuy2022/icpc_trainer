"use client";

import {lazy,memo,Suspense} from "react";

const MarkdownText=lazy(()=>import("./markdown-text"));

export default memo(function LazyMarkdownText(props:{text:string;allowVisuals?:boolean}){
  return <Suspense fallback={<div className="message-text markdown-loading">{props.text}</div>}>
    <MarkdownText {...props}/>
  </Suspense>;
});
