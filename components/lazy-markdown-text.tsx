"use client";

import {lazy,memo,Suspense} from "react";

// KaTeX styles load with the markdown chunk instead of the initial CSS,
// keeping formula-only styling off the first paint.
const MarkdownText=lazy(()=>
  Promise.all([import("./markdown-text"),import("katex/dist/katex.min.css")]).then(([m])=>m),
);

export default memo(function LazyMarkdownText(props:{text:string;allowVisuals?:boolean}){
  return <Suspense fallback={<div className="message-text markdown-loading">{props.text}</div>}>
    <MarkdownText {...props}/>
  </Suspense>;
});
