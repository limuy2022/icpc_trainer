import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {build} from "esbuild";

const dir=await mkdtemp(join(tmpdir(),"icpc-wiki-"));
try{
  const bundle=join(dir,"wiki.mjs");
  await build({
    entryPoints:["server/wiki-article.ts"],outfile:bundle,bundle:true,platform:"node",format:"esm",
    plugins:[{name:"http-errors",setup(builder){
      builder.onResolve({filter:/^\.\/security$/},()=>({path:"security",namespace:"test"}));
      builder.onLoad({filter:/.*/,namespace:"test"},()=>({
        contents:"export function fail(status,message){throw Object.assign(new Error(message),{status});}",
      }));
    }}],
  });
  const {renderWikiArticle,wikiArticle}=await import(bundle);
  const source="https://oi-wiki.org/ds/dsu/";
  const document=`<nav>navigation</nav><article class="md-content__inner">
    <h1>Repeated title</h1><h2>Union</h2><p><strong>Find</strong> a root.</p>
    <mjx-container display="true"><mjx-math data-latex="x^2"></mjx-math></mjx-container>
    <span class="arithmatex">\\(y^2\\)</span>
    <table class="highlighttable"><tr><td class="linenos">lineno</td><td class="code"><pre><code><span class="kt">int</span> x;</code></pre></td></tr></table>
    <a href="../fenwick/">Tree</a><img src="../images/disjoint-set.svg" onerror="attack()">
    <a href="javascript:attack()">Unsafe URL</a><script>attack()</script><iframe src="https://example.com"></iframe>
    <details open><summary>Proof</summary><p>By induction.</p></details>
    </article>`;
  const html=renderWikiArticle(document,source);
  assert.match(html,/<h2>Union<\/h2>/);
  assert.match(html,/katex-display/);
  assert.match(html,/application\/x-tex">y\^2/);
  assert.match(html,/<pre><code><span class="wiki-code-kt">int<\/span> x;<\/code><\/pre>/);
  assert.match(html,/https:\/\/oi-wiki.org\/ds\/fenwick\//);
  assert.match(html,/https:\/\/oi-wiki.org\/ds\/images\/disjoint-set.svg/);
  assert.match(html,/<details open><summary>Proof<\/summary>/);
  assert.doesNotMatch(html,/navigation|Repeated title|lineno|javascript:|attack\(\)|<iframe|onerror=/);
  assert.throws(()=>renderWikiArticle("<article>unrelated page</article>",source));
  if(process.env.ICPC_WIKI_TEST_FIXTURE){
    const real=renderWikiArticle(await readFile(process.env.ICPC_WIKI_TEST_FIXTURE,"utf8"),source);
    assert.match(real,/<h2>合并<\/h2>/);
    assert.match(real,/katex/);
    assert.match(real,/disjoint-set\.svg/);
    assert.match(real,/CC BY-SA 4\.0/);
  }

  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,source);
    assert.equal(options.redirect,"error");
    return new Response(document,{headers:{"content-type":"text/html; charset=utf-8"}});
  };
  const request=id=>new Request("http://localhost/api/wiki-article?"+new URLSearchParams({topic:id}));
  await assert.rejects(wikiArticle(request("https://example.com")),{status:404});
  assert.equal(calls,0);
  const responses=await Promise.all([wikiArticle(request("dsu")),wikiArticle(request("dsu"))]);
  assert.deepEqual(await responses[0].json(),{html});
  assert.equal(responses[1].status,200);
  assert.equal(calls,1);
}finally{await rm(dir,{recursive:true,force:true});}
