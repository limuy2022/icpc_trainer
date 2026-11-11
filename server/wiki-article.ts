import {FETCH_TIMEOUT_MS} from "../lib/constants";
import katex from "katex";
import {parse,type DefaultTreeAdapterMap} from "parse5";
import {lessonCatalog,lessonWikiUrl} from "../lib/lessons";
import {fail} from "./security";

type Node=DefaultTreeAdapterMap["childNode"];
type Element=DefaultTreeAdapterMap["element"];
const tags=new Set("h1 h2 h3 h4 h5 h6 p div span a img ul ol li dl dt dd blockquote pre code kbd samp table caption thead tbody tfoot tr th td details summary figure figcaption strong b em i s del sub sup mark br hr".split(" "));
const voidTags=new Set(["img","br","hr"]);
const discardedTags=new Set(["script","style","svg","iframe","object","embed","form","input","template"]);
const discardedClasses=new Set(["linenos","headerlink","md-content__button","giscus"]);
const codeClasses=/^(?:[ckms][a-z0-9]{0,2}|nb|bp|nf|fm|ow|cp|cpf)$/;
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const attribute=(node:Element,name:string)=>node.attrs.find(attr=>attr.name===name)?.value;
const classes=(node:Element)=>(attribute(node,"class")??"").split(/\s+/);
const isElement=(node:Node):node is Element=>"tagName" in node;
function findElement(nodes:Node[],matches:(element:Element)=>boolean):Element|undefined{
  for(const node of nodes){
    if(!isElement(node))continue;
    if(matches(node))return node;
    const nested=findElement(node.childNodes,matches);
    if(nested)return nested;
  }
}
function plainText(node:Node):string{
  if(node.nodeName==="#text"&&"value" in node)return node.value;
  return isElement(node)?node.childNodes.map(plainText).join(""):"";
}
function httpsUrl(value:string|undefined,base:string){
  if(!value)return undefined;
  try{
    const url=new URL(value,base);
    if(url.protocol==="https:"&&!url.username&&!url.password)return url.href;
  }catch{/* intentionally ignored */}
}

export function renderWikiArticle(document:string,source:string){
  const article=findElement(parse(document).childNodes,node=>node.tagName==="article"&&classes(node).includes("md-content__inner"));
  if(!article)throw Error("Missing OI Wiki article");

  function render(node:Node):string{
    if(!isElement(node))return escape(plainText(node));
    const tag=node.tagName;
    const names=classes(node);
    if(discardedTags.has(tag)||names.some(name=>discardedClasses.has(name)))return "";
    if(tag==="mjx-container"||names.includes("arithmatex")){
      const math=findElement(node.childNodes,child=>child.tagName==="mjx-math");
      const latex=math?attribute(math,"data-latex"):plainText(node).trim().replace(/^\\[([]|\\[)\]]$/g,"");
      const displayMode=attribute(node,"display")==="true"||tag==="div";
      if(!latex)return "";
      return katex.renderToString(latex,{displayMode,throwOnError:false,strict:"ignore",trust:false,maxExpand:500,maxSize:20});
    }
    if(tag==="table"&&names.includes("highlighttable")){
      const code=findElement(node.childNodes,child=>child.tagName==="td"&&classes(child).includes("code"));
      if(code)return code.childNodes.map(render).join("");
    }
    if(names.includes("tabbed-set")){
      const labels=findElement(node.childNodes,child=>classes(child).includes("tabbed-labels"));
      const body=findElement(node.childNodes,child=>classes(child).includes("tabbed-content"));
      const panels=body?.childNodes.filter(child=>isElement(child)&&classes(child).includes("tabbed-block"));
      if(labels&&panels?.length){
        const titles=labels.childNodes.filter(isElement).map(plainText);
        return panels.map((panel,index)=>`<details${index===0?" open":""}><summary>${escape(titles[index]??"代码")}</summary>${render(panel)}</details>`).join("");
      }
    }

    const children=node.childNodes.map(render).join("");
    if(!tags.has(tag)||tag==="h1")return tag==="h1"?"":children;
    if(tag==="a"){
      const href=httpsUrl(attribute(node,"href"),source);
      return href?`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${children}</a>`:children;
    }
    if(tag==="img"){
      const src=httpsUrl(attribute(node,"src"),source);
      return src?`<img src="${escape(src)}" alt="${escape(attribute(node,"alt")??"")}" loading="lazy" referrerpolicy="no-referrer">`:"";
    }
    const attrs=[];
    if(tag==="details"&&attribute(node,"open")!==undefined)attrs.push("open");
    if(tag==="span"){
      const syntax=names.find(name=>codeClasses.test(name));
      if(syntax)attrs.push(`class="wiki-code-${syntax}"`);
    }
    if(names.includes("admonition"))attrs.push('class="wiki-admonition"');
    for(const name of ["colspan","rowspan","start"]){
      const value=attribute(node,name);
      if(value&&/^\d{1,4}$/.test(value))attrs.push(`${name}="${value}"`);
    }
    const opening=`<${tag}${attrs.length?" "+attrs.join(" "):""}>`;
    return voidTags.has(tag)?opening:opening+children+`</${tag}>`;
  }

  const html=article.childNodes.map(render).join("");
  if(!html.trim())throw Error("Empty OI Wiki article");
  return html;
}

const cache=new Map<string,{expires:number;html:Promise<string>}>();
const maxBytes=4*1024*1024;
async function download(source:string){
  const response=await fetch(source,{signal:AbortSignal.timeout(FETCH_TIMEOUT_MS),redirect:"error"});
  if(!response.ok||!response.body||!response.headers.get("content-type")?.includes("text/html"))throw Error("Invalid OI Wiki response");
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,document="";
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes)throw Error("OI Wiki article too large");
      document+=decoder.decode(value,{stream:true});
    }
  }finally{await reader.cancel().catch(()=>{});}
  return renderWikiArticle(document+decoder.decode(),source);
}

export async function wikiArticle(request:Request){
  const topicId=new URL(request.url).searchParams.get("topic");
  const topic=lessonCatalog.find(item=>item.id===topicId);
  if(!topic)fail(404,"学习专题不存在");
  const source=lessonWikiUrl(topic.path);
  let entry=cache.get(source);
  if(!entry||entry.expires<=Date.now()){
    if(cache.size>=32)cache.delete(cache.keys().next().value!);
    entry={expires:Date.now()+60*60*1000,html:download(source)};
    cache.set(source,entry);
  }
  try{
    return Response.json({html:await entry.html},{headers:{"Cache-Control":"private, max-age=300"}});
  }catch{
    if(cache.get(source)===entry)cache.delete(source);
    fail(502,"暂时无法读取 OI Wiki 原文");
  }
}
