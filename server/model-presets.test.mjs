import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'icpc-presets-'));
try {
 await build({entryPoints:['lib/model-presets.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'presets.mjs')});
 const {modelPresets,detectModelPreset,applyModelPreset}=await import(join(dir,'presets.mjs'));
 assert.equal(new Set(modelPresets.map(p=>p.id)).size,modelPresets.length);
 for(const preset of modelPresets){assert.equal(new URL(preset.base_url).protocol,'https:');assert.equal(new URL(preset.docs).protocol,'https:');assert.ok(!preset.base_url.endsWith('/chat/completions'));assert.equal(detectModelPreset({...preset,base_url:preset.base_url+'/'}),preset.id);}
 const form={label:'My custom name',model:'old-model',key:'old-key',provider:'glm',base_url:'https://open.bigmodel.cn/api/coding/paas/v4',is_default:true};
 const changed=applyModelPreset(form,'deepseek');assert.equal(changed.key,'');assert.equal(changed.model,'');assert.equal(changed.label,form.label);assert.equal(changed.provider,'openai-compatible');assert.equal(changed.is_default,true);
 assert.equal(applyModelPreset(form,'glm-coding').key,'old-key');assert.equal(applyModelPreset(form,'custom'),form);
 const labelled=applyModelPreset({...form,label:'',base_url:''},'deepseek');assert.equal(labelled.label,'DeepSeek');assert.equal(applyModelPreset(labelled,'kimi').label,'Moonshot / Kimi');
 assert.equal(detectModelPreset({...form,base_url:'https://custom.example/v1'}),'custom');assert.notEqual(modelPresets.find(p=>p.id==='glm').base_url,modelPresets.find(p=>p.id==='glm-coding').base_url);
 console.log('PASS: provider presets, HTTPS/doc links, exact matching, distinct GLM plans, editable names and credential reset on endpoint changes');
}finally{await rm(dir,{recursive:true,force:true});}
