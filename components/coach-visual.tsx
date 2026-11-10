"use client";
import {t as ui,useLocale} from "@/lib/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { MAX_VISUAL_LENGTH, visualDocument } from "@/lib/coach-visual";

export default function CoachVisual({ source }: { source: string }) {
  useLocale();
  const frame = useRef<HTMLIFrameElement>(null);
  const [revision, setRevision] = useState(0);
  const [height, setHeight] = useState(300);
  const [failed, setFailed] = useState(false);
  const tooLarge = source.length > MAX_VISUAL_LENGTH;
  // Keep the document stable on theme changes, so the current step is preserved.
  const document = useMemo(() => tooLarge ? "" : visualDocument(source, false), [source, tooLarge]);
  useEffect(() => {
    const theme = () => frame.current?.contentWindow?.postMessage({type:"icpc-visual-theme",dark:window.document.documentElement.dataset.theme === "dark"}, "*");
    const observer = new MutationObserver(theme);
    observer.observe(window.document.documentElement, {attributes:true,attributeFilter:["data-theme"]});
    const receive = (event: MessageEvent) => {
      if (!frame.current?.contentWindow || event.source !== frame.current.contentWindow) return;
      if (event.data?.type === "icpc-visual-size" && Number.isFinite(event.data.height)) {
        setHeight(Math.max(160,Math.min(1400,event.data.height)));
        theme();
      }
      if (event.data?.type === "icpc-visual-error") setFailed(true);
    };
    window.addEventListener("message",receive);
    return () => {observer.disconnect();window.removeEventListener("message",receive);};
  }, []);
  return <section className="coach-visual" aria-label={ui("交互式算法图示")}>
    <div className="coach-visual-toolbar"><span>{ui("交互图示 · 可逐步探索")}</span><button type="button" onClick={()=>{setFailed(false);setRevision(n=>n+1);}}><RotateCcw size={14}/>{ui("重新演示")}</button></div>
    {tooLarge ? <p role="alert">{ui("图示内容过大，请让 AI 用更小的例子重新画图。")}</p> : <iframe key={revision} ref={frame} title={ui("AI 交互式算法讲解")} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document} style={{height}} onLoad={()=>frame.current?.contentWindow?.postMessage({type:"icpc-visual-theme",dark:window.document.documentElement.dataset.theme === "dark"},"*")}/>}
    {failed && <p role="alert">{ui("图示运行出错，可重新演示，或请 AI 修正图示。文字讲解仍可阅读。")}</p>}
    <details><summary>{ui("查看图示源码")}</summary><pre><code>{source}</code></pre></details>
  </section>;
}
