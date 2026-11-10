// Model-authored documents run only in an opaque-origin, network-disabled iframe.
export const VISUAL_LANGUAGE = "icpc-visual";
export const MAX_VISUAL_LENGTH = 100_000;

export function visualDocument(fragment: string, dark: boolean): string {
  if (fragment.length > MAX_VISUAL_LENGTH) throw new Error("图示内容过大");
  return `<!doctype html><html lang="zh-CN" data-theme="${dark ? "dark" : "light"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<style>
:root{color-scheme:light;--background:#fff;--foreground:#263b33;--muted:#f1f4ef;--muted-foreground:#59685f;--border:#dce4dd;--primary:#275b47;--primary-foreground:#fff;--viz-series-1:#34765b;--viz-series-2:#9b651f;--viz-series-3:#586cad}
:root[data-theme=dark]{color-scheme:dark;--background:#1b2820;--foreground:#e1e9df;--muted:#25382b;--muted-foreground:#b1beb0;--border:#425245;--primary:#aed8c3;--primary-foreground:#15251b;--viz-series-1:#a4d3bb;--viz-series-2:#e6bc76;--viz-series-3:#b5bfea}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--background);color:var(--foreground);font:16px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}body{padding:12px}button,input,select{font:inherit}button{min-height:40px;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--muted);color:var(--foreground);cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary);outline-offset:2px}input,select{max-width:100%;color:var(--foreground);background:var(--muted);border:1px solid var(--border);border-radius:6px;padding:6px}svg,canvas{max-width:100%}svg text{fill:var(--foreground)}.controls,.viz-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0}.muted{color:var(--muted-foreground)}@media(pointer:coarse){button{min-height:44px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style>
<script>
(()=>{const send=()=>parent.postMessage({type:'icpc-visual-size',height:Math.ceil(document.body.getBoundingClientRect().height)},'*');
addEventListener('DOMContentLoaded',()=>{new ResizeObserver(send).observe(document.body);send()});
addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='icpc-visual-theme')document.documentElement.dataset.theme=e.data.dark?'dark':'light'});
addEventListener('error',()=>parent.postMessage({type:'icpc-visual-error'},'*'));
addEventListener('unhandledrejection',()=>parent.postMessage({type:'icpc-visual-error'},'*'));
})();
</script></head><body>${fragment}</body></html>`;
}

export const visualInstructions = `

交互式图示讲解能力：
- 可以在回复中使用一个 icpc-visual 代码围栏，内容是自包含的 HTML 片段（可含内联 style、SVG 和原生 JavaScript）。网站会把该围栏渲染成可交互图示，不是展示源码。不要使用普通 html 围栏替代。
- 当数组/窗口移动、区间覆盖、图与树、并查集合并、状态转移或反例能通过图示明显更易理解时，主动使用；普通问题用文字即可。用户要求画图时优先提供图示。
- 图示只解释当前问题和当前允许的提示层级。不要借图示提前揭晓算法或完整答案。先用一句话说明观察目标，图后最多问一个引导问题。
- 用一个小而准确的具体例子，标清下标、数值、当前选择和变化。需要过程时提供「上一步 / 下一步」按钮，在同一幅图上更新，禁止自动循环播放。必要时允许点击元素或调整一个输入，交互必须实际改变图示。
- 片段只含图示、必要标签与控件，不要复制整段文字解释。无需 doctype/html/head/body，不要使用 Markdown 包裹片段内部。JS 放在片段末尾，通过 getElementById 绑定实际存在的元素。不要依赖 React、Mermaid、外部库、网络请求、CDN、图片地址、父页面、存储或 window.openai；只能使用本片段 DOM 和本地数据。
- 宿主提供 CSS 变量 --background、--foreground、--muted、--muted-foreground、--border、--primary、--primary-foreground、--viz-series-1/2/3。所有颜色使用这些变量；必要的图形可用原生 SVG，但文字必须保持可读。布局填满容器，支持 300px 窄屏，flex-wrap、可换行，不要固定整体宽度和高度，不要产生横向溢出。SVG 必须根据容器宽度安排文字，不能把大图直接缩成小字。
- 原生按钮带文字，range/select/input 有 label；动态说明用 aria-live="polite"。不要仅靠颜色表示状态。图中用简短可读标签，复杂 LaTeX 公式放在围栏外（图内不支持 LaTeX 渲染）。
- 控制内容长度，尽量在 6000 字符内完成一个图示。检查按钮边界、数组索引和每步数值与讲解一致，保证首屏有内容。
示例格式（仅展示交互协议，不要每题重复这个例子）：

\`\`\`icpc-visual
<div id="demo"><div id="cells" style="display:flex;flex-wrap:wrap;gap:8px"></div><div class="controls"><button id="prev">上一步</button><button id="next">下一步</button></div><div id="status" aria-live="polite"></div></div>
<script>
const values=[2,1,3];let step=0;
function draw(){document.getElementById('cells').replaceChildren(...values.map((v,i)=>{const cell=document.createElement('span');cell.textContent=(i===step?'当前：':'')+v;cell.style.cssText='padding:8px;background:var(--muted);border-radius:6px';return cell}));document.getElementById('status').textContent='正在观察位置 '+(step+1);document.getElementById('prev').disabled=step===0;document.getElementById('next').disabled=step===values.length-1;}
document.getElementById('prev').onclick=()=>{step--;draw()};document.getElementById('next').onclick=()=>{step++;draw()};draw();
</script>
\`\`\`
`;
