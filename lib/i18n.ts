import english from "./locales/en.json";
export type Locale = "zh-CN" | "en";
const catalog:Record<string,string>=english;
const patterns=Object.entries(catalog).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>{
 const slots:number[]=[];
 const source=key.split(/(\{\d+\})/).map(part=>{const m=part.match(/^\{(\d+)\}$/);if(m){slots.push(Number(m[1]));return "([\\s\\S]*?)";}return part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}).join("");
 return {pattern:new RegExp("^"+source+"$"),value,slots};
});
export function translate(text:string,locale:Locale,params:unknown[]=[]):string {
 let result=locale==="en" ? catalog[text] : text;
 if(result===undefined && locale==="en") {
   for(const {pattern,value,slots} of patterns){const match=text.match(pattern);if(match){const values:unknown[]=[];slots.forEach((slot,i)=>values[slot]=match[i+1]);return value.replace(/\{(\d+)\}/g,(token,index)=>String(values[Number(index)]??token));}}
 }
 result ??= text;
 return result.replace(/\{(\d+)\}/g,(token,index)=>String(params[Number(index)]??token));
}
