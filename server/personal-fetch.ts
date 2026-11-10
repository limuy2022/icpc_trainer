import {lookup} from "node:dns";
import {request as httpsRequest} from "node:https";
import {Readable} from "node:stream";
import {isIP,type LookupFunction} from "node:net";
export function publicModelAddress(address:string):boolean {
  if(!isIP(address))return false;
  if(address.includes(":"))return /^[23][0-9a-f]{3}:/i.test(address);
  const [a,b]=address.split(".").map(Number);
  return Number.isInteger(a)&&a>0&&a<224&&a!==10&&a!==127&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127)&&!(a===198&&b>=18&&b<=19)&&!(a===192&&b===0);
}
/** Validate the actual connection lookup, not just a separate preflight DNS result. */
export const publicModelLookup:LookupFunction=(hostname,options,callback)=>{
  lookup(hostname,{all:true,family:options.family||0},(error,addresses)=>{
    if(error){callback(error,"",0);return;}
    if(!addresses.length||addresses.some(item=>!publicModelAddress(item.address))){callback(Error("Model endpoint resolved to a non-public address"),"",0);return;}
    if(options.all)(callback as Function)(null,addresses);
    else callback(null,addresses[0].address,addresses[0].family);
  });
};
/** Personal endpoints cannot redirect or rebind a hostname into the server's network. */
export async function fetchPersonalModel(input:RequestInfo|URL,init:RequestInit={}):Promise<Response> {
  const url=new URL(String(input));
  if(isIP(url.hostname.replace(/^\[|\]$/g,""))||url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443"))throw Error("Invalid model endpoint");
  if(init.body!=null&&typeof init.body!=="string")throw Error("Invalid model request body");
  return new Promise((resolve,reject)=>{
    const requestHeaders=new Headers(init.headers);requestHeaders.set("accept-encoding","identity");
    const req=httpsRequest(url,{method:init.method||"GET",headers:Object.fromEntries(requestHeaders),signal:init.signal||undefined,agent:false,lookup:publicModelLookup},res=>{
      const status=res.statusCode||502;
      if(status>=300&&status<400){res.destroy();reject(Error("Model endpoint redirects are not allowed"));return;}
      const headers=new Headers();for(const [name,value] of Object.entries(res.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(","):value);
      const noBody=[204,205,304].includes(status);if(noBody)res.resume();
      resolve(new Response(noBody?null:Readable.toWeb(res) as ReadableStream<Uint8Array>,{status,headers}));
    });
    req.on("error",reject);req.end(init.body||undefined);
  });
}
