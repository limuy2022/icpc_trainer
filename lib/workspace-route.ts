export type WorkspaceView="bank"|"training"|"history"|"statistics"|"admin";
export type WorkspaceRoute={view:WorkspaceView;current:string|null};
const views:WorkspaceView[]=["bank","training","history","statistics","admin"];
export function normalizeRoute(value:unknown,admin:boolean):WorkspaceRoute {
  const route=value as Partial<WorkspaceRoute>|null;
  const view=route && views.includes(route.view as WorkspaceView) && (route.view!=="admin"||admin)?route.view!:"bank";
  const current=typeof route?.current==="string"&&route.current.length>0&&route.current.length<=200?route.current:null;
  return {view,current};
}
export function parseWorkspaceHash(hash:string,admin:boolean,previous?:WorkspaceRoute):WorkspaceRoute {
  const match=hash.match(/^#\/(bank|training|history|statistics|admin)(?:\/([^/?#]+))?$/);
  if(!match || (match[1]!=="training"&&match[2]))return {view:"bank",current:previous?.current||null};
  let current=previous?.current||null;
  if(match[1]==="training"&&match[2]){
    try{current=decodeURIComponent(match[2]);}catch{return {view:"training",current:null};}
  }
  return normalizeRoute({view:match[1],current},admin);
}
export function workspaceHash(route:WorkspaceRoute):string {
  return "#/"+route.view+(route.view==="training"&&route.current?"/"+encodeURIComponent(route.current):"");
}
