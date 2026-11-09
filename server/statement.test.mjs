import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'icpc-statement-test-'));
try{
 await build({entryPoints:['lib/statements.ts'],bundle:true,platform:'node',format:'esm',outfile:join(temp,'parser.mjs')});
 const {parseStatement,fetchStatement}=await import(join(temp,'parser.mjs'));
 const html='<div>EDITORIAL OUTSIDE</div><div class="problem-statement"><div class="header"><div class="title">B. Test</div></div><p>There are $$$a_i \\leq 10^5$$$ objects. This deliberately long sentence describes the complete problem statement.</p><p><span class="tex-span">b<sub>j</sub><sup>2</sup></span></p><div class="input-specification"><div class="section-title">Input</div><p>Two numbers.</p></div><div class="output-specification"><div class="section-title">Output</div><p>A number.</p></div><div class="sample-test"><div class="input"><div class="title">Input</div><pre><div>4 5</div><div>3 1 2 1</div></pre></div></div><script>BAD_SCRIPT</script><img src="javascript:alert(1)"></div><div>EDITORIAL OUTSIDE</div>';
 const p=parseStatement(html);assert.ok(p.text.includes('$a_i \\leq 10^5$'));assert.ok(p.text.includes('$b_{j}^{2}$'));assert.ok(p.text.includes('4 5\n3 1 2 1'));assert.ok(!p.text.includes('BAD_SCRIPT'));assert.ok(!p.text.includes('EDITORIAL'));assert.ok(!p.text.includes('javascript:'));assert.throws(()=>parseStatement('<html>Just a moment...</html>'));
 let calls=0;globalThis.fetch=async url=>{calls++;return url.includes('github.io')?new Response(html,{status:200}):new Response('blocked',{status:403});};
 const statement=await fetchStatement('279','B');assert.equal(statement.source.official,false);assert.equal(calls,2);await fetchStatement('280','B');assert.equal(calls,3);
 globalThis.fetch=async()=>new Response(html.replace('B. Test','C. Wrong problem'),{status:200});await assert.rejects(fetchStatement('279','B'));
 console.log('PASS: statement boundary, LaTeX and legacy math, multiline samples, unsafe markup filtering, challenge rejection, source fallback, cooldown and problem index validation.');
}finally{await rm(temp,{recursive:true,force:true});}
