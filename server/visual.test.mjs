import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'icpc-visual-'));
try {
 await build({stdin:{contents:`
 import {createElement} from 'react';
 import {renderToStaticMarkup} from 'react-dom/server';
 import {parse} from 'parse5';
 import assert from 'node:assert/strict';
 import Text from './components/markdown-text';
 import {visualDocument,visualInstructions,MAX_VISUAL_LENGTH} from './lib/coach-visual';
 const fence=String.fromCharCode(96).repeat(3);
 const fragment='<div id="value">2 &lt; 3</div><script>document.getElementById("value").textContent="step 1";</script>';
 const text='先观察这里。\\n\\n'+fence+'icpc-visual\\n'+fragment+'\\n'+fence+'\\n\\n接下来呢？';
 const render=allowVisuals=>renderToStaticMarkup(createElement(Text,{text,allowVisuals}));
 assert.ok(!render(false).includes('<iframe'));
 const parsed=parse(render(true));let iframe;function walk(n){if(n.tagName==='iframe')iframe=n;for(const c of n.childNodes||[])walk(c)}walk(parsed);
 assert.ok(iframe);const attrs=Object.fromEntries(iframe.attrs.map(a=>[a.name,a.value]));
 assert.equal(attrs.sandbox,'allow-scripts');assert.equal(attrs.referrerpolicy,'no-referrer');
 assert.ok(attrs.srcdoc.includes(fragment));assert.ok(attrs.srcdoc.includes("connect-src 'none'"));assert.ok(attrs.srcdoc.includes("form-action 'none'"));assert.ok(!attrs.sandbox.includes('allow-same-origin'));
 assert.ok(render(true).includes('接下来呢？'));assert.ok(render(true).includes('查看图示源码'));
 const doc=visualDocument(fragment,true);assert.ok(doc.includes('data-theme="dark"'));assert.ok(doc.includes('icpc-visual-size'));assert.ok(doc.includes("e.source===parent"));
 assert.throws(()=>visualDocument('x'.repeat(MAX_VISUAL_LENGTH+1),false));
 const oversized=renderToStaticMarkup(createElement(Text,{allowVisuals:true,text:fence+'icpc-visual\\n'+'x'.repeat(MAX_VISUAL_LENGTH+1)+'\\n'+fence}));assert.ok(oversized.includes('图示内容过大'));assert.ok(!oversized.includes('<iframe'));
 const sample=visualInstructions.match(/\x60\x60\x60icpc-visual\\n([\\s\\S]*?)\x60\x60\x60/)[1];assert.ok(sample.includes('下一步'));assert.doesNotThrow(()=>new Function(sample.match(/<script>([\\s\\S]*?)<\\/script>/)[1]));
 console.log('PASS: assistant-only visual fences, opaque sandbox, restrictive CSP, exact source, theme bridge, size limit and prompt example');
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:join(dir,'test.mjs'),external:['node:*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
 await import(join(dir,'test.mjs'));
} finally {await rm(dir,{recursive:true,force:true});}
