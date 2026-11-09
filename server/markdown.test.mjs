import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'icpc-markdown-'));
try {
 const result=await build({stdin:{contents:`
 import {createElement} from 'react';
 import {renderToStaticMarkup} from 'react-dom/server';
 import {parse} from 'parse5';
 import assert from 'node:assert/strict';
 import Text from './components/markdown-text';
 const render=text=>renderToStaticMarkup(createElement(Text,{text}));
 const code='#include <iostream>\\nint main() { // test\\n  std::cout << "hello" << 42;\\n}\\n';
 const cpp=render('\\x60\\x60\\x60cpp\\n'+code+'\\x60\\x60\\x60');
 assert.ok(cpp.includes('hljs-keyword'));assert.ok(cpp.includes('hljs-string'));assert.ok(cpp.includes('hljs-number'));assert.ok(cpp.includes('复制代码'));
 const nodes=[];function walk(n){if(n.tagName==='pre')nodes.push(n);for(const c of n.childNodes||[])walk(c);}walk(parse(cpp));
 function plain(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(plain).join('');}
 assert.equal(plain(nodes[0]),code);
 for(const language of ['c++17','python','java','js','typescript','rust','go','bash','json']) assert.ok(render('\\x60\\x60\\x60'+language+'\\n'+(language==='python'?'def f(): return 1':'int main() { return 0; }')+'\\n\\x60\\x60\\x60').includes('hljs'));
 const sample=render('\\x60\\x60\\x60text\\n3 4\\n1 2 3\\n\\x60\\x60\\x60');assert.ok(!sample.includes('hljs-number'));
 assert.ok(render('\\x60\\x60\\x60unknown-language\\nx < y\\n\\x60\\x60\\x60').includes('x &lt; y'));
 const escaped=render('\\x60\\x60\\x60cpp\\nconst char* x = "\\\\[";\\n\\x60\\x60\\x60');assert.ok(escaped.includes('['));assert.ok(!escaped.includes('katex'));
 const math=render('$a_i^2$ and \\x60inline\\x60');assert.ok(math.includes('katex'));assert.ok(math.includes('<code>inline</code>'));
 assert.ok(!render('\\x60\\x60\\x60html\\n<script>alert(1)</script>\\n\\x60\\x60\\x60').includes('<script>'));
 console.log('PASS: syntax tokens, C++ aliases, exact copy text, plain samples, unknown languages, math, inline code and escaped markup');
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:join(dir,'test.mjs'),packages:'bundle',external:['node:*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
 await import(join(dir,'test.mjs'));
} finally {await rm(dir,{recursive:true,force:true});}
