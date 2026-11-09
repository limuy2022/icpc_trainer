function decode(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
export async function GET(request: Request) {
  const u = new URL(request.url),
    contest = u.searchParams.get("contest"),
    index = u.searchParams.get("index");
  if (
    !/^\d{1,7}$/.test(contest || "") ||
    !/^[A-Z][0-9A-Z]{0,3}$/.test(index || "")
  )
    return Response.json({ error: "题号无效" }, { status: 400 });
  try {
    const res = await fetch(
      `https://codeforces.com/problemset/problem/${contest}/${index}?locale=en`,
      { signal: AbortSignal.timeout(15000) },
    );
    const html = await res.text();
    const start = html.indexOf('<div class="problem-statement"');
    const end = html.indexOf("<script", start);
    if (!res.ok || start < 0) throw new Error("unavailable");
    let section = html.slice(start, end > start ? end : start + 90000);
    const footer = section.indexOf('<div class="second-level-menu"');
    if (footer > 0) section = section.slice(0, footer);
    const text = decode(
      section
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<sup[^>]*>(.*?)<\/sup>/gi, "^($1)")
        .replace(/<sub[^>]*>(.*?)<\/sub>/gi, "_($1)")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(?:p|div|pre|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\${3}/g, "")
        .replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n"),
    )
      .trim()
      .slice(0, 26000);
    if (text.length < 100) throw new Error("empty");
    return Response.json(
      { text },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "CF 暂时无法读取题面。请打开原题，将题面、约束和样例粘贴到这里，再开始陪练。",
      },
      { status: 502 },
    );
  }
}
