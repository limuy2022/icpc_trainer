import { db, transaction } from "./database";
import { checkOrigin, fail, requireUser } from "./security";
import { selectModel, type ModelConfig } from "./models";
import { reasoningOptions, type ReasoningLevel } from "../lib/reasoning";
export type ModelPreferences={selectedModelId?:string;efforts?:Record<string,ReasoningLevel>};
export function modelPreferences(userId:string):ModelPreferences {
  const row=db.prepare("SELECT model_preferences FROM users WHERE id=?").get(userId) as {model_preferences:string}|undefined;
  return row?JSON.parse(row.model_preferences):{};
}
export function selectedReasoning(userId:string,model:ModelConfig,value?:unknown):ReasoningLevel {
  const selected=value===undefined?(modelPreferences(userId).efforts?.[model.id]||"default"):value;
  if(typeof selected!=="string"||!reasoningOptions(model).some(option=>option.value===selected))fail(400,"当前模型不支持这个推理等级，请重新选择");
  return selected as ReasoningLevel;
}
export async function saveModelPreferences(request:Request) {
  const user=requireUser(request);checkOrigin(request);
  const body=await request.json() as {modelId?:string;reasoningEffort?:unknown};
  const model=selectModel(body.modelId,user);
  const level=selectedReasoning(user.id,model,body.reasoningEffort);
  const preferences=transaction(()=>{
    const current=modelPreferences(user.id);
    const next={selectedModelId:model.id,efforts:{...current.efforts,[model.id]:level}};
    db.prepare("UPDATE users SET model_preferences=? WHERE id=?").run(JSON.stringify(next),user.id);
    return next;
  });
  return Response.json({preferences});
}
