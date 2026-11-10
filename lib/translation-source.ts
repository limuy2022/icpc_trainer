import {splitStatement} from "./statement-header";
/** Reading an existing translation must not depend on the coaching model. */
export function translationSource(text:string):string {
  return splitStatement(text).text.replace(/\r\n?/g,"\n").trim();
}
