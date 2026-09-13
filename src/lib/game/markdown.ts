// 迷你 Markdown 解析（书记官报告用）：只认 LLM 实际会产出的子集——
// 标题 #/##/###、加粗 **x**、无序列表 -/*/·、分隔线 ---。其余按段落原文直出。
// 纯函数、行级解析：打字机每帧喂半截文本也能安全渲染（半个标题算标题，未闭合加粗按原文）。

export interface MdInline {
  text: string;
  bold: boolean;
}

export type MdBlock =
  | { type: "h1" | "h2" | "h3" | "li" | "p"; inlines: MdInline[] }
  | { type: "hr" };

/** 行内切分：**加粗** 成段；split 捕获组的奇数位是加粗内容，空段丢弃前先定奇偶 */
export function splitInline(text: string): MdInline[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  const out: MdInline[] = [];
  parts.forEach((p, i) => {
    if (p) out.push({ text: p, bold: i % 2 === 1 });
  });
  return out;
}

export function parseMiniMarkdown(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: (["h1", "h2", "h3"] as const)[level - 1], inlines: splitInline(heading[2]) });
      continue;
    }
    if (/^([-*_]\s*){3,}$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      continue;
    }
    const bullet = line.match(/^\s*[-*·]\s+(.*)$/);
    if (bullet) {
      blocks.push({ type: "li", inlines: splitInline(bullet[1]) });
      continue;
    }
    blocks.push({ type: "p", inlines: splitInline(line) });
  }
  return blocks;
}
