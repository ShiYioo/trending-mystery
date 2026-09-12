// 知乎摘要文本清洗：摘掉媒体占位符、折叠空白——线索卡/简报/聚类输入统一过这一层。

const MEDIA_PLACEHOLDER = /\[(图片|视频|链接|音频|文章|想法|海报|直播)\]/g;

export function cleanExcerpt(raw: string): string {
  return raw.replace(MEDIA_PLACEHOLDER, " ").replace(/\s+/g, " ").trim();
}

/** 清洗后截取片段（尽量在句读处收尾） */
export function excerptFragment(raw: string, max = 80): string {
  const cleaned = cleanExcerpt(raw).slice(0, max);
  const cut = Math.max(
    cleaned.lastIndexOf("。"),
    cleaned.lastIndexOf("，"),
    cleaned.lastIndexOf("；"),
  );
  return cut > max * 0.5 ? cleaned.slice(0, cut + 1) : cleaned;
}

/** 降级模式的相关性判定：文本与案件问题标题的汉字二元组重叠 ≥1 视为切题（无 LLM 时的廉价过滤，宁可漏杀不可错杀） */
export function isRelatedTo(questionTitle: string, text: string): boolean {
  const bigrams = (s: string) => {
    const set = new Set<string>();
    const t = cleanExcerpt(s);
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
  };
  const title = bigrams(questionTitle);
  for (const g of bigrams(text)) {
    if (title.has(g)) return true;
  }
  return false;
}
