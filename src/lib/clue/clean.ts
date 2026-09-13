// 知乎摘要文本清洗：解码 HTML 实体、知乎表情短码映射 emoji、摘掉媒体占位符、折叠空白
// ——线索卡/简报/聚类输入统一过这一层。
// 白名单纪律（2026-09-13 缓存语料普查）：方括号短码只映射已知表情、媒体占位符只摘已知名单；
// 普查实见 [pʰ][tɕ] 等国际音标与 [1][2] 脚注——绝不能按"短方括号一律清除"处理。

const MEDIA_PLACEHOLDER = /\[(图片|视频|链接|音频|文章|想法|海报|直播)\]/g;

/** 知乎表情短码 → emoji 近似（真·表情图片无法还原：接口只给纯文本，无表情图 URL） */
const ZHIHU_EMOTES: Record<string, string> = {
  赞: "👍", 赞同: "👍", 感谢: "🙏", 拜托: "🙏", 鼓掌: "👏",
  捂脸: "🤦", 捂嘴: "🤭", 大笑: "😄", 笑哭: "😂", 飙泪笑: "😂",
  大哭: "😭", 泪: "😢", 爱: "❤️", 爱心: "❤️", 害羞: "😳",
  思考: "🤔", 好奇: "🤔", 发呆: "😶", 惊讶: "😮", 哇: "😲",
  生气: "😠", 白眼: "🙄", 微笑: "🙂", 再见: "👋", 吃瓜: "🍉",
  doge: "🐶", 狗头: "🐶", 手动狗头: "🐶", 看看你: "👀",
};
const EMOTE_RE = new RegExp(`\\[(${Object.keys(ZHIHU_EMOTES).join("|")})\\]`, "g");

/** 常用命名实体表 + 数字实体通用解码；二次转义（&amp;gt;）递归再解一层 */
const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  middot: "·", bull: "•", copy: "©", reg: "®", trade: "™", deg: "°", times: "×", divide: "÷",
};

function decodeEntities(s: string): string {
  const once = s.replace(
    /&([a-zA-Z][a-zA-Z0-9]{1,10});|&#(\d{1,6});|&#[xX]([0-9a-fA-F]{1,6});/g,
    (m, name: string, dec: string, hex: string) => {
      if (name && HTML_ENTITIES[name] !== undefined) return HTML_ENTITIES[name];
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return m;
    },
  );
  return once === s ? once : decodeEntities(once);
}

export function cleanExcerpt(raw: string): string {
  return decodeEntities(raw)
    .replace(EMOTE_RE, (m, name: string) => ZHIHU_EMOTES[name] ?? m)
    .replace(MEDIA_PLACEHOLDER, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  return overlapCount(questionTitle, text) >= 1;
}

/** 二元组重叠计数：用于相关度排序与落地校验 */
export function overlapCount(a: string, b: string): number {
  const bigrams = (s: string) => {
    const set = new Set<string>();
    const t = cleanExcerpt(s);
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
  };
  const setA = bigrams(a);
  let hit = 0;
  for (const g of bigrams(b)) {
    if (setA.has(g)) hit++;
  }
  return hit;
}

/** 虚词字符：参与构成的二元组不计入落地率（否则"是什么/随后"会稀释判定） */
const STOP_CHARS = new Set("的是了在和与或也很都就便却把被这那有无人可什么为以及于从中向前后此该随但因此所虽然然而不未已经否否来");

/**
 * 落地率：过滤虚词后，文本二元组中能在素材里找到依据的比例。
 * 虚构句的典型形态是"骑在真实语境上夹带私货"（复用监管/检查等真词 + 发明报复等假词），
 * 逐句 ≥1 重叠拦不住——按无据占比 > 40% 判虚构才能拦住。
 */
export function groundedRatio(text: string, material: string): number {
  const mat = new Set<string>();
  const m = cleanExcerpt(material);
  for (let i = 0; i < m.length - 1; i++) mat.add(m.slice(i, i + 2));
  const t = cleanExcerpt(text);
  let total = 0;
  let hit = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    if (STOP_CHARS.has(g[0]) || STOP_CHARS.has(g[1])) continue;
    total++;
    if (mat.has(g)) hit++;
  }
  return total === 0 ? 0 : hit / total;
}

/**
 * 落地校验：逐句检查落地率（< 0.5 视为虚构句），虚构句占比超过 maxFailRatio 判整段不落地。
 */
export function isGrounded(text: string, material: string, maxFailRatio = 0.3): boolean {
  const sentences = text
    .split(/[。\n；！？]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);
  if (sentences.length === 0) return false;
  const ungrounded = sentences.filter((s) => groundedRatio(s, material) < 0.5).length;
  return ungrounded / sentences.length <= maxFailRatio;
}
