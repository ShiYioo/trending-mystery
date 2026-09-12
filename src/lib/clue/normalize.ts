// 关键词归一化：搜索配额"按关键词计费、不按玩家计费"的前提——
// 同一关键词的任何变体（空格/#/大小写）必须命中同一个缓存键（README §4.6）。
// 键名拼装只在 lib/redis.ts，本函数只负责把词本身标准化。

export function normalizeKeyword(raw: string): string {
  return raw
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
