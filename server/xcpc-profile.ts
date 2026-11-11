import {createHash} from "node:crypto";
import {db} from "./database";
import {fail} from "./security";
import {xcpcCategories,xcpcReviewTopics,type XcpcCategory,type XcpcProfile} from "../lib/xcpc-profile";

const categories=Object.keys(xcpcCategories) as XcpcCategory[];
const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);

function savedProfile(userId:string):XcpcProfile|null{
  const row=db.prepare("SELECT xcpc_profile FROM users WHERE id=?").get(userId) as {xcpc_profile:string|null}|undefined;
  return row?.xcpc_profile?JSON.parse(row.xcpc_profile):null;
}

async function fetchProfile(key:string):Promise<XcpcProfile|null>{
  const shard=createHash("md5").update(key).digest("hex").slice(0,2);
  const response=await fetch("https://heimaom.cn/data/players/"+shard+".json",{
    redirect:"error",signal:AbortSignal.timeout(10000),
  });
  if(!response.ok||!response.body)throw Error("XCPC data unavailable");
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,json="";
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>8*1024*1024)throw Error("XCPC shard too large");
      json+=decoder.decode(value,{stream:true});
    }
  }finally{await reader.cancel().catch(()=>{});}
  const player=JSON.parse(json+decoder.decode())[key];
  if(!player)return null;
  if(player.key!==key)throw Error("Invalid XCPC player");
  const panel=player.skillPanel?.official?.overall;
  const axes=categories.flatMap((category,index)=>{
    const source=panel?.axes;
    if(Array.isArray(source)&&source.length!==categories.length)return [];
    const axis=Array.isArray(source)?source[index]:source?.[category];
    const [score,problems,evidence]=Array.isArray(axis)?[axis[0],axis[5],axis[13]]:[axis?.score,axis?.uniqueProblems,axis?.evidenceLevel];
    return finite(score)&&finite(problems)?[{category,score,problems,established:evidence==="established"}]:[];
  });
  const contests=Array.isArray(player.history)?player.history.filter((event:{ratedOfficial?:boolean})=>event.ratedOfficial===true).length:0;
  return {key,rating:finite(player.officialRating)?player.officialRating:null,contests,fetchedAt:new Date().toISOString(),axes};
}

export async function xcpcSettings(request:Request,userId:string){
  if(request.method==="GET")return Response.json({profile:savedProfile(userId)});
  if(request.method!=="PATCH")fail(405,"不支持的操作");
  const {key}=await request.json() as {key?:unknown};
  if(key===null){
    db.prepare("UPDATE users SET xcpc_profile=NULL WHERE id=?").run(userId);
    return Response.json({profile:null});
  }
  if(typeof key!=="string"||key.length>120||!/^\s*[^@\s][^@\r\n]*@[^@\s][^@\r\n]*\s*$/.test(key))fail(400,"请输入 XCPC Rating 上的姓名@学校");
  const previous=db.prepare("SELECT xcpc_profile FROM users WHERE id=?").get(userId) as {xcpc_profile:string|null};
  const profile=await fetchProfile(key.trim()).catch(()=>fail(502,"暂时无法读取 XCPC Rating，请稍后重试"));
  if(!profile)fail(404,"未找到该选手，请核对姓名和学校");
  const result=db.prepare("UPDATE users SET xcpc_profile=? WHERE id=? AND xcpc_profile IS ?").run(JSON.stringify(profile),userId,previous.xcpc_profile);
  if(!result.changes)fail(409,"XCPC 档案已更新，请重新打开后再试");
  return Response.json({profile});
}

export function xcpcCoachContext(userId:string){
  const profile=savedProfile(userId);
  if(!profile)return "";
  const evidence=xcpcReviewTopics(profile).map(axis=>({topic:xcpcCategories[axis.category],score:axis.score,samples:axis.problems}));
  return "\nXCPC Rating 正式赛数据（第三方依据队伍成绩估计，和 CF Rating 是不同量表）："+
    JSON.stringify({rating:profile.rating,ratedContests:profile.contests,reviewTopics:evidence})+
    "。题型低分只用于提出复盘或诊断建议。优先依据用户的个人解题记录和当前回答调整训练。";
}
