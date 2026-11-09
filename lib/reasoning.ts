export type ReasoningLevel="default"|"off"|"on"|"low"|"medium"|"high"|"max";
export const reasoningLabels:Record<ReasoningLevel,string>={default:"模型默认",off:"关闭思考",on:"开启思考",low:"轻度推理",medium:"中等推理",high:"增强推理",max:"深度推理"};
export function reasoningOptions(model:{model:string;provider?:string}) {
  const name=model.model.toLowerCase();
  const levels:ReasoningLevel[]=/glm-5\.3/.test(name)?["default","low","high","max"]:/glm-5\.2/.test(name)?["default","off","high","max"]:/glm-/.test(name)||model.provider==="glm"?["default","off","on"]:["default","low","medium","high"];
  return levels.map(value=>({value,label:reasoningLabels[value]}));
}
export function reasoningParameters(model:{model:string;provider?:string},level:ReasoningLevel) {
  if(!reasoningOptions(model).some(option=>option.value===level))throw Error("当前模型不支持这个推理等级，请重新选择");
  const glm=/glm-/i.test(model.model)||model.provider==="glm";
  if(glm) {
    if(/glm-5\.3/i.test(model.model))return {thinking:{type:"enabled"},...(level!=="default"?{reasoning_effort:level}:{})};
    if(level==="default")return {};
    return {thinking:{type:level==="off"?"disabled":"enabled"},...(!["off","on"].includes(level)?{reasoning_effort:level}:{})};
  }
  return level==="default"?{}:{reasoning_effort:level};
}
