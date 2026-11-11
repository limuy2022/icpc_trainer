import type {Session} from "./types";

export type WorkspaceView="lessons"|"lesson"|"assistant"|"bank"|"training"|"history"|"statistics"|"admin";
export type WorkspaceRoute={view:WorkspaceView;current:string|null};
export function sessionView(session:Pick<Session,"kind"|"lesson">):"training"|"assistant"|"lesson"{
  if(session.lesson)return "lesson";
  return session.kind==="assistant"?"assistant":"training";
}
const views:WorkspaceView[]=["lessons","lesson","assistant","bank","training","history","statistics","admin"];
export function normalizeRoute(value:unknown,admin:boolean):WorkspaceRoute {
  const route=value as Partial<WorkspaceRoute>|null;
  const view=route && views.includes(route.view as WorkspaceView) && (route.view!=="admin"||admin)?route.view!:"bank";
  const current=typeof route?.current==="string"&&route.current.length>0&&route.current.length<=200?route.current:null;
  return {view,current};
}
export function parseWorkspaceHash(hash:string,admin:boolean,previous?:WorkspaceRoute):WorkspaceRoute {
  const match=hash.match(/^#\/(lessons|lesson|assistant|bank|training|history|statistics|admin)(?:\/([^/?#]+))?$/);
  if(!match || (!["training","lesson","assistant"].includes(match[1])&&match[2]))return {view:"bank",current:previous?.current||null};
  let current=previous?.current||null;
  if(["training","lesson","assistant"].includes(match[1])&&match[2]){
    try{current=decodeURIComponent(match[2]);}catch{return {view:match[1] as WorkspaceView,current:null};}
  }
  return normalizeRoute({view:match[1],current},admin);
}
export function workspaceHash(route:WorkspaceRoute):string {
  return "#/"+route.view+(["training","lesson","assistant"].includes(route.view)&&route.current?"/"+encodeURIComponent(route.current):"");
}
