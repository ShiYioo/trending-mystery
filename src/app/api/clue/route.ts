// 取证 / 线索卡引擎（案件感知版）：
// 归一化 → 缓存 → 真实搜索 → 服务端装配视图模型：
//   星级（真实三字段）、归档匹配（命中案件底表的卡带 cardId，结案时才可指认）、线人低语（精选评论）。
// 不做自管配额：知乎侧限频（30001）透传为 zhihu_rate_limited，看到就换 ZHIHU_ACCESS_SECRET。

import { cleanExcerpt } from "@/lib/clue/clean";
import { normalizeKeyword } from "@/lib/clue/normalize";
import { starRating } from "@/lib/clue/stars";
import { caseKey, cacheAside, kvGetJson, searchCacheKey } from "@/lib/redis";
import { searchZhihu, ZhihuApiError } from "@/lib/zhihu";
import type { CaseBrief } from "@/lib/types";

// Vercel：搜索外呼 + 清洗，冷启动留余量
export const maxDuration = 30;

const SEARCH_CACHE_TTL_SECONDS = 6 * 3600;
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

    const data = await cacheAside(searchCacheKey(caseId || "global", keyword), SEARCH_CACHE_TTL_SECONDS, async () =>
      searchZhihu(keyword, 10),
    );

    const items = data.Items.map((it) => ({
      contentId: it.ContentID,
      title: it.Title,
      contentType: it.ContentType,
      excerpt: cleanExcerpt(it.ContentText),
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
        .map((c) => cleanExcerpt(c.Content))
        .filter((s) => s.length > 0) // 整条只是表情/占位符的评论清洗后为空，先过滤再取数
        .slice(0, WHISPERS_PER_CARD),
    }));

    return Response.json({ keyword, caseId, count: items.length, items });
  } catch (e) {
    if (e instanceof ZhihuApiError && e.rateLimited) {
      return Response.json(
        {
          error: "zhihu_rate_limited",
          hint: `知乎接口限频（30001）：${e.message}——更换 ZHIHU_ACCESS_SECRET 后重启服务`,
        },
        { status: 429 },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("ZHIHU_ACCESS_SECRET") || message.includes("REDIS_URL")) {
      return Response.json({ error: "env_missing", hint: message }, { status: 503 });
    }
    return Response.json({ error: "upstream", hint: message }, { status: 502 });
  }
}
