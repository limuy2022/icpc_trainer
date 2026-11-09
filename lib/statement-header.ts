export type StatementHeader = {
  title?: string;
  details: { label: string; value: string }[];
  body: string;
};

/** Only consume a contiguous, recognizable CF header; never scan the body. */
export function parseStatementHeader(text: string): StatementHeader {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const clean = (s: string) => s.trim().replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "");
  let cursor = 0;
  const skip = () => { while (cursor < lines.length && !lines[cursor].trim()) cursor++; };
  skip();
  let title: string | undefined;
  if (/^(?:#{1,3}\s+|[A-Z]\d?\.\s)/.test(lines[cursor] || "")) {
    title = clean(lines[cursor++]);
    skip();
  }
  const fields = [
    { label: "时间限制", pattern: /^(?:time limit(?: per test)?|时间限制|每组测试时间限制)\s*[:：]?\s*(.*)$/i },
    { label: "内存限制", pattern: /^(?:memory limit(?: per test)?|内存限制|每组测试内存限制)\s*[:：]?\s*(.*)$/i },
    { label: "输入方式", pattern: /^(?:input|输入)\s*[:：]?\s*(.*)$/i },
    { label: "输出方式", pattern: /^(?:output|输出)\s*[:：]?\s*(.*)$/i },
  ];
  const details: StatementHeader["details"] = [];
  for (const field of fields) {
    const match = clean(lines[cursor] || "").match(field.pattern);
    if (!match) break;
    cursor++;
    skip();
    const inline = match[1].trim();
    const value = inline || clean(lines[cursor] || "");
    // A header value must be short and must not be another field or section.
    if (!value || value.length > 100 || fields.some(f => f.pattern.test(value))) break;
    if (!inline) { cursor++; skip(); }
    details.push({ label: field.label, value });
  }
  // Require both limits: a heading or an Input section alone isn't a CF header.
  if (details.length < 2) return { details: [], body: text };
  return { title, details, body: lines.slice(cursor).join("\n").trimStart() };
}
