/** Repair common model delimiters without changing formulas or code literals. */
export function normalizeMarkdownMath(text:string):string {
  const math=(part:string)=>part
    .replace(/\\\[/g,()=>"\n$$\n").replace(/\\\]/g,()=>"\n$$\n")
    .replace(/\\\(/g,"$").replace(/\\\)/g,"$")
    .replace(/(^|\n)([ \t]{0,3})\$[ \t]*\r?\n([\s\S]*?)\r?\n\2\$[ \t]*(?=\r?$)/gm,(original,prefix,indent,body)=>{
      // Require a recognizable formula; do not guess at prices or unfinished streams.
      const formula=body.trim();
      if(!formula||formula.includes("$")||!(/\\[a-zA-Z]+|[=<>_^]/.test(formula)))return original;
      return `${prefix}${indent}$$\n${formula}\n${indent}$$`;
    });
  let normalized="",cursor=0;
  // Keep fenced/inline code intact, including a fence still arriving in a stream.
  for(const match of text.matchAll(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\1|$)|(`+)[^\n]*?\2/g)) {
    normalized+=math(text.slice(cursor,match.index))+match[0];
    cursor=match.index!+match[0].length;
  }
  return normalized+math(text.slice(cursor));
}
