import {CODEFORCES_ORIGIN,FETCH_TIMEOUT_MS,MAX_RESPONSE_SIZE} from "./constants";
import type { StatementMetadata } from "./statement-header";
import { parse, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
function children(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}
function attr(node: Node, name: string) {
  return "attrs" in node
    ? node.attrs.find((a) => a.name === name)?.value || ""
    : "";
}
function hasClass(node: Node, name: string) {
  return attr(node, "class").split(/\s+/).includes(name);
}
function find(node: Node, predicate: (n: Node) => boolean): Node | undefined {
  if (predicate(node)) return node;
  for (const child of children(node)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
function plain(node: Node): string {
  return node.nodeName === "#text"
    ? (node as DefaultTreeAdapterMap["textNode"]).value
    : children(node).map(plain).join("");
}
function safeUrl(value: string) {
  try {
    const url = new URL(value, CODEFORCES_ORIGIN);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function preformatted(node: Node): string {
  if (node.nodeName === "#text") return plain(node);
  if (node.nodeName === "br") return "\n";
  const value = children(node).map(preformatted).join("");
  return ["div", "p", "li"].includes(node.nodeName) ? value + "\n" : value;
}
function tex(node: Node): string {
  if (node.nodeName === "#text") return plain(node);
  const value = children(node).map(tex).join("");
  if (node.nodeName === "sub") return "_{" + value + "}";
  if (node.nodeName === "sup") return "^{" + value + "}";
  return value;
}
function markdown(node: Node): string {
  if (node.nodeName === "#text") return plain(node).replace(/[\t\r\n ]+/g, " ");
  const name = node.nodeName;
  if (hasClass(node, "header")) return "";
  if (hasClass(node, "tex-span")) return "$" + tex(node) + "$";
  if (name === "script") {
    return attr(node, "type").startsWith("math/tex")
      ? "$" + plain(node) + "$"
      : "";
  }
  if (
    ["style", "button", "iframe", "noscript"].includes(name) ||
    hasClass(node, "MathJax") ||
    hasClass(node, "MathJax_Preview")
  )
    return "";
  if (name === "pre") {
    const content = preformatted(node).trim();
    const fence = content.includes("```") ? "````" : "```";
    return "\n\n" + fence + "text\n" + content + "\n" + fence + "\n\n";
  }
  if (name === "br") return "\n";
  if (name === "img") {
    const url = safeUrl(attr(node, "src"));
    return url ? "\n\n![题目插图](" + url + ")\n\n" : "";
  }
  const value = children(node).map(markdown).join("");
  if (hasClass(node, "section-title")) return "\n\n## " + value.trim() + "\n\n";
  if (hasClass(node, "title")) return "\n\n### " + value.trim() + "\n\n";
  if (name === "sup") return "^(" + value + ")";
  if (name === "sub") return "_(" + value + ")";
  if (name === "code") return "`" + plain(node).replace(/`/g, "") + "`";
  if (name === "a") {
    const url = safeUrl(attr(node, "href"));
    return url ? "[" + value.trim() + "](" + url + ")" : value;
  }
  if (["b", "strong"].includes(name)) return "**" + value.trim() + "**";
  if (name === "li") return "\n- " + value.trim() + "\n";
  if (
    ["p", "div", "ul", "ol", "table", "tr", "h1", "h2", "h3", "h4"].includes(
      name,
    )
  )
    return "\n\n" + value.trim() + "\n\n";
  if (["td", "th"].includes(name)) return value + " | ";
  return value;
}
export function htmlToMarkdown(html: string) {
  return markdown(parse(html))
    .replace(/\${6}([\s\S]*?)\${6}/g, (_, value) => "\n\n$$\n" + value.trim() + "\n$$\n\n")
    .replace(/\${3}([\s\S]*?)\${3}/g, (_, value) => "$" + value.trim() + "$")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function parseStatement(html: string) {
  const document = parse(html);
  const root = find(document, (n) => hasClass(n, "problem-statement"));
  if (!root) throw Error("Missing statement");
  const title = find(root, (n) => hasClass(n, "title"));
  const input = find(root, (n) => hasClass(n, "input-specification"));
  if (!title || !input) throw Error("Incomplete statement");
  const result = markdown(root)
    .replace(
      /\${6}([\s\S]*?)\${6}/g,
      (_, tex) => "\n\n$$\n" + tex.trim() + "\n$$\n\n",
    )
    .replace(/\${3}([\s\S]*?)\${3}/g, (_, tex) => "$" + tex.trim() + "$")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (result.length < 100 || result.length > 150000)
    throw Error("Invalid statement length");
  const header = find(root, n => hasClass(n, "header"));
  const fields = [["time-limit", "时间限制"], ["memory-limit", "内存限制"], ["input-file", "输入方式"], ["output-file", "输出方式"]];
  const details = fields.flatMap(([className, label]) => {
    const node = header && find(header, n => hasClass(n, className));
    if (!node) return [];
    // CF's property-title is a nested label; the remaining text is its value.
    const value = children(node).filter(n => !hasClass(n, "property-title")).map(plain).join("").trim();
    return value ? [{ label, value }] : [];
  });
  return {
    metadata: { title: plain(title).trim(), details },
    text: result,
    title: plain(title).trim(),
    format: "markdown" as const,
  };
}
export type Statement = {
  metadata?: StatementMetadata;
  text: string;
  title: string;
  format: "markdown";
  source: { name: string; url: string; official: boolean };
  fetchedAt: string;
  cached?: boolean;
  stale?: boolean;
};
let directBlockedUntil = 0;
export async function fetchStatement(
  contest: string,
  index: string,
): Promise<Statement> {
  const officialUrl = `https://codeforces.com/problemset/problem/${contest}/${index}?locale=en`;
  const archiveUrl = `https://codewithsathya.github.io/codeforces-problems/content/${contest}:${index}.html`;
  const sources = [
    { url: officialUrl, name: "Codeforces 原题", official: true },
    {
      url: archiveUrl,
      name: "Codeforces Pro 公共题面存档（非官方）",
      official: false,
    },
  ];
  for (const source of sources) {
    if (source.official && Date.now() < directBlockedUntil) continue;
    try {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "error",
        headers: { Accept: "text/html" },
      });
      if (source.official && [403, 429, 503].includes(response.status))
        directBlockedUntil = Date.now() + 600000;
      if (
        !response.ok ||
        Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_SIZE
      )
        continue;
      const html = await response.text();
      if (html.length > MAX_RESPONSE_SIZE) continue;
      const result = parseStatement(html);
      // Verify the statement index against the requested identity before caching it.
      if (!result.title.toUpperCase().startsWith(index.toUpperCase() + "."))
        continue;
      return { ...result, source, fetchedAt: new Date().toISOString() };
    } catch {
      continue;
    }
  }
  throw Error(
    "题面暂时无法读取。已尝试 CF 原题和公共存档，可稍后重试或手动粘贴完整题面。",
  );
}
