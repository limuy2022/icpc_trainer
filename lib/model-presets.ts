/** Chat Completions endpoints checked against official docs on 2026-11-10. */
export const modelPresets = [
  {id:"openai",label:"OpenAI",provider:"openai-compatible",base_url:"https://api.openai.com/v1",docs:"https://developers.openai.com/api/reference/resources/chat"},
  {id:"deepseek",label:"DeepSeek",provider:"openai-compatible",base_url:"https://api.deepseek.com",docs:"https://api-docs.deepseek.com/"},
  {id:"glm",label:"智谱 GLM · 普通 API",provider:"glm",base_url:"https://open.bigmodel.cn/api/paas/v4",docs:"https://docs.bigmodel.cn/cn/guide/develop/openai/introduction"},
  {id:"glm-coding",label:"智谱 GLM · Coding Plan",provider:"glm",base_url:"https://open.bigmodel.cn/api/coding/paas/v4",docs:"https://docs.bigmodel.cn/cn/coding-plan/overview"},
  {id:"qwen-cn",label:"阿里云百炼 · 北京",provider:"openai-compatible",base_url:"https://dashscope.aliyuncs.com/compatible-mode/v1",docs:"https://help.aliyun.com/zh/model-studio/base-url"},
  {id:"qwen-intl",label:"阿里云百炼 · 新加坡",provider:"openai-compatible",base_url:"https://dashscope-intl.aliyuncs.com/compatible-mode/v1",docs:"https://help.aliyun.com/zh/model-studio/base-url"},
  {id:"kimi",label:"Moonshot / Kimi",provider:"openai-compatible",base_url:"https://api.moonshot.cn/v1",docs:"https://platform.kimi.com/docs/get-api-key"},
  {id:"siliconflow",label:"硅基流动 SiliconFlow",provider:"openai-compatible",base_url:"https://api.siliconflow.cn/v1",docs:"https://docs.siliconflow.cn/docs/usercases/use-siliconcloud-in-openmanus"},
  {id:"openrouter",label:"OpenRouter",provider:"openai-compatible",base_url:"https://openrouter.ai/api/v1",docs:"https://openrouter.ai/developers"},
] as const;
const normalized=(value:string)=>value.trim().replace(/\/+$/,"");
export function detectModelPreset(form:{base_url:string;provider:string}):string {
  return modelPresets.find(p=>p.base_url===normalized(form.base_url)&&p.provider===form.provider)?.id||"custom";
}
export function applyModelPreset<T extends {base_url:string;provider:string;label:string;key:string;model:string}>(form:T,id:string):T {
  const preset=modelPresets.find(p=>p.id===id);if(!preset)return form;
  const changed=normalized(form.base_url)!==preset.base_url;
  const autoLabel=!form.label.trim()||modelPresets.some(p=>p.label===form.label);
  return {...form,base_url:preset.base_url,provider:preset.provider,label:autoLabel?preset.label:form.label,...(changed?{key:"",model:""}:{})};
}
