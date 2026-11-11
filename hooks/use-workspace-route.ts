"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {normalizeRoute,parseWorkspaceHash,workspaceHash,type WorkspaceRoute,type WorkspaceView} from "@/lib/workspace-route";
export function useWorkspaceRoute(userId:string,admin:boolean) {
  const key="icpc-workspace-route:"+userId;
  const [route,setRoute]=useState<WorkspaceRoute>(()=>{
    if(typeof window==="undefined")return {view:"bank",current:null};
    let saved:WorkspaceRoute={view:"bank",current:null};
    try{saved=normalizeRoute(JSON.parse(localStorage.getItem(key)||"null"),admin);}catch{/* intentionally ignored */}
    return window.location.hash?parseWorkspaceHash(window.location.hash,admin,saved):saved;
  });
  const active=useRef(route);
  const persist=useCallback((next:WorkspaceRoute,replace=false)=>{
    const hash=workspaceHash(next);
    if(window.location.hash!==hash)window.history[replace?"replaceState":"pushState"](null,"",window.location.pathname+window.location.search+hash);
    try{localStorage.setItem(key,JSON.stringify(next));}catch{/* intentionally ignored */}
  },[key]);
  useEffect(()=>{
    persist(active.current,true);
    const restore=()=>{
      const next=parseWorkspaceHash(window.location.hash,admin,active.current);
      active.current=next;setRoute(next);persist(next,true);
    };
    window.addEventListener("popstate",restore);window.addEventListener("hashchange",restore);
    return()=>{window.removeEventListener("popstate",restore);window.removeEventListener("hashchange",restore);};
  },[key,admin,persist]);
  const open=useCallback((view:WorkspaceView,current?:string|null,replace=false)=>{
    const next=normalizeRoute({view,current:current===undefined?active.current.current:current},admin);
    active.current=next;persist(next,replace);setRoute(next);
  },[admin,persist]);
  return {view:route.view,current:route.current,open};
}
