/** Omit an unspecified budget so default-on reasoning uses the provider's native default. */
export function outputParameters(model:{max_output_tokens?:number|null;output_token_parameter?:string}) {
  if(model.max_output_tokens==null)return {};
  if(!Number.isSafeInteger(model.max_output_tokens)||model.max_output_tokens<1||model.max_output_tokens>1048576)throw Error("输出 Token 上限必须是 1 到 1048576 的整数");
  const parameter=model.output_token_parameter||"max_tokens";
  if(!["max_tokens","max_completion_tokens"].includes(parameter))throw Error("输出 Token 参数无效");
  return {[parameter]:model.max_output_tokens};
}
