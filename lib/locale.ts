"use client";
import { useSyncExternalStore } from "react";
import {translate,type Locale} from "./i18n";
let locale:Locale="zh-CN";
try {if(typeof window!=="undefined"){const saved=localStorage.getItem("icpc-language");locale=saved==="en"||saved==="zh-CN"?saved:navigator.language.toLowerCase().startsWith("en")?"en":"zh-CN";}}catch{/* intentionally ignored */}
const listeners=new Set<()=>void>();
export const currentLocale=()=>locale;
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function apply(){if(typeof document!=="undefined"){document.documentElement.lang=locale;document.title=locale==="en"?"ICPC Thinking Lab · AI Coach":"思维练习场 · ICPC Coach";}}
export function setLocale(next:Locale){locale=next;try{localStorage.setItem("icpc-language",next);}catch{/* intentionally ignored */}apply();listeners.forEach(listener=>listener());}
export function useLocale(){return useSyncExternalStore(subscribe,currentLocale,()=>"zh-CN" as Locale);}
export function t(text:string,params?:unknown[]):string {return translate(text,locale,params);}
if(typeof window!=="undefined")apply();
