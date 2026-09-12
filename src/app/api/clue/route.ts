// 取证 / 线索卡引擎（案件感知版）：
// 归一化 → 缓存 → 配额 → 真实搜索 → 服务端装配视图模型：
//   星级（真实三字段）、归档匹配（命中案件底表的卡带 cardId，结案时才可指认）、线人低语（精选评论）。

import { normalizeKeyword } from "@/lib/clue/normalize";
import { starRating } from "@/lib/clue/stars";
import { caseKey, cacheAside, consumeQuota, kvGetJson, searchCacheKey } from "@/lib/redis";
import { searchZhihu } from "@/lib/zhihu";
import type { CaseBrief, SearchData } from "@/lib/types";

const SEARCH_DAILY_LIMIT = 1000;
const SEARCH_CACHE_TTL_SECONDS = 6 * 3600;
const QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED";
const WHISPERS_PER_CARD = 3;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = normalizeKeyword(params.get("q") ?? "");
  const caseId = params.get("caseId") ?? "";
  if (!keyword) {
    return Response.json({ error: "missing_keyword" }, { status: 400 });
  }
  try {
    const brief = caseId ? await kvGetJson<CaseBrief>(caseKey(caseId)) : null;
    const pool = new Map((brief?.clueCards ?? []).map((c) => [c.sourceContentId, c.id]));

    const data = await cacheAside(searchCacheKey(caseId || "global", keyword), SEARCH_CACHE_TTL_SECONDS, async () => {
      const quota = await consumeQuota("search", SEARCH_DAILY_LIMIT);
      if (!quota.allowed) return { HasMore: false, SearchHashId: "quota", Items: [] } as SearchData;
      return searchZhihu(keyword, 10);
    });

    const items = data.Items.map((it) => ({
      contentId: it.ContentID,
      title: it.Title,
      contentType: it.ContentType,
      excerpt: it.ContentText,
      url: it.Url,
      votes: it.VoteUpCount,
      author: it.AuthorName,
      authorBadge: it.AuthorBadgeText,
      stars: starRating({
        rankingScore: it.RankingScore,
        authorityLevel: it.AuthorityLevel,
        voteUpCount: it.VoteUpCount,
      }),
      /** 命中案件底表 → 已归档（结案可指认）；null = 外围情报 */
      cardId: pool.get(it.ContentID) ?? null,
      whispers: (it.CommentInfoList ?? [])
        .slice(0, WHISPERS_PER_CARD)
        .map((c) => c.Content),
    }));

    return Response.json({ keyword, caseId, count: items.length, items });
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
