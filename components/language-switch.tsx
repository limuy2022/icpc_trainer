"use client";
import {Languages} from "lucide-react";
import {setLocale,useLocale,t} from "@/lib/locale";
export default function LanguageSwitch(){
 const locale=useLocale();
 return <label className="language-switch"><Languages size={16}/><select aria-label={t("界面语言")} value={locale} onChange={e=>setLocale(e.target.value as "zh-CN"|"en")}><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>;
}
