// 取证 / 线索卡引擎：归一化 → 缓存命中直出 → 未命中查配额 → 调 zhihu_search → 回写缓存。
// 配额按关键词计费、不按玩家计费；字段→卡面映射见 README §4.6。

import { normalizeKeyword } from "@/lib/clue/normalize";
import { searchZhihu } from "@/lib/zhihu";
import { cacheAside, consumeQuota, searchCacheKey } from "@/lib/redis";

const SEARCH_DAILY_LIMIT = 1000;
const SEARCH_CACHE_TTL_SECONDS = 6 * 3600;
const QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = normalizeKeyword(params.get("q") ?? "");
  const caseId = params.get("caseId") ?? "today";
  if (!keyword) {
    return Response.json({ error: "missing keyword" }, { status: 400 });
  }
  try {
    const data = await cacheAside(searchCacheKey(caseId, keyword), SEARCH_CACHE_TTL_SECONDS, async () => {
      const quota = await consumeQuota("search", SEARCH_DAILY_LIMIT);
      if (!quota.allowed) throw new Error(QUOTA_EXHAUSTED);
      return searchZhihu(keyword, 10);
    });
    return Response.json({ keyword, caseId, count: data.Items.length, items: data.Items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === QUOTA_EXHAUSTED) {
      return Response.json(
        { error: "quota_exhausted", hint: "档案库检索受限，请换用已有线索中的关键词" },
        { status: 429 },
      );
    }
    if (message.includes("ZHIHU_ACCESS_SECRET") || message.includes("REDIS_URL")) {
      return Response.json({ error: "env_missing", hint: message }, { status: 503 });
    }
    return Response.json({ error: "upstream", hint: message }, { status: 502 });
  }
}
