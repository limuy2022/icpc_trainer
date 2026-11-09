export function protectStatement(text: string) {
  const kept: string[] = [];
  const masked = text.replace(
    /(`{3,})[^\n]*\n[\s\S]*?\1|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?\$|!\[[^\]]*\]\([^\n)]+\)/g,
    (value) => {
      const token = `⟦ICPC_KEEP_${kept.length}⟧`;
      kept.push(value);
      return token;
    },
  );
  return { masked, kept };
}
export function restoreStatement(text: string, kept: string[]) {
  for (let i = 0; i < kept.length; i++) {
    const token = `⟦ICPC_KEEP_${i}⟧`;
    if (text.split(token).length !== 2)
      throw Error("译文未完整保留公式或样例，请重试");
  }
  return text.replace(/⟦ICPC_KEEP_(\d+)⟧/g, (_, index) => {
    if (!kept[Number(index)]) throw Error("译文标记无效");
    return kept[Number(index)];
  });
}

/** Keep the statement header readable without spreading its metadata over eight paragraphs. */
export function compactStatementMetadata(text: string) {
  const parts = text.split(/\n\s*\n/);
  if (
    parts.length < 10 ||
    !/^#{1,3}\s/.test(parts[0]) ||
    !/(time limit|时间.*限制)/i.test(parts[1]) ||
    !/(memory limit|内存.*限制)/i.test(parts[3]) ||
    !/^(input|输入)$/i.test(parts[5]) ||
    !/^(output|输出)$/i.test(parts[7])
  )
    return text;
  const chinese = /[\u4e00-\u9fff]/.test(parts[1]);
  return [
    parts[0],
    `**${chinese ? "时间限制" : "Time limit"}** ${parts[2]} · **${chinese ? "内存限制" : "Memory limit"}** ${parts[4]}`,
    `**${chinese ? "输入" : "Input"}** ${parts[6]} · **${chinese ? "输出" : "Output"}** ${parts[8]}`,
    ...parts.slice(9),
  ].join("\n\n");
}
