// 案件生成（GET /api/case?rank=N）：
// 热榜(小时级整表缓存) → 选问题 → 标题检索取证 → 直答聚类(简报/争议点/立场/检索词)
// → 代码用真实赞数算权重 → 装配 CaseBrief 落缓存 → 预热检索词 → 返回公开视图。
// 公开视图剥离 clusterWeight 与 supportsStance——结案翻牌前玩家不可见（README §4.5）。

import { cleanExcerpt, excerptFragment, groundedRatio, isGrounded, isRelatedTo } from "@/lib/clue/clean";
import { normalizeKeyword } from "@/lib/clue/normalize";
import { starRating } from "@/lib/clue/stars";
import { applyWeights, buildClueCards, buildSafeBriefing, fallbackCluster, toPublicBrief } from "@/lib/case/assembly";
import { buildClusterFixMessages, buildClusterMessages, type ClusterResult } from "@/lib/case/prompts";
import type { CaseBrief, ChatMessage, Issue, SearchData } from "@/lib/types";
import { llmEnabled } from "@/lib/env";
import {
  cacheAside,
  caseKey,
  consumeQuota,
  hotlistCacheKey,
  kvGetJson,
  kvSetJson,
  searchCacheKey,
} from "@/lib/redis";
import { chat, extractJson, getHotList, searchZhihu } from "@/lib/zhihu";

const HOTLIST_DAILY_LIMIT = 100;
const SEARCH_DAILY_LIMIT = 1000;
const HOTLIST_TTL = 3600;
const SEARCH_TTL = 6 * 3600;
const CASE_TTL = 24 * 3600;
/** 送入聚类的回答上限（摘要级语料，thinking 档上下文可控） */
const CLUSTER_MAX_ITEMS = 12;
/** 预热检索词数量（配额预算 ~10 次/案） */
const PREHEAT_KEYWORDS = 6;
const QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED";

const pad = (n: number) => String(n).padStart(2, "0");

async function searchWithQuota(caseId: string, keyword: string): Promise<SearchData> {
  return cacheAside(searchCacheKey(caseId, normalizeKeyword(keyword)), SEARCH_TTL, async () => {
    const quota = await consumeQuota("search", SEARCH_DAILY_LIMIT);
    if (!quota.allowed) return { HasMore: false, SearchHashId: "quota-exhausted", Items: [] };
    return searchZhihu(keyword, 10);
  });
}

export async function GET(request: Request) {
  const rank = Math.max(1, Number(new URL(request.url).searchParams.get("rank") ?? 1) || 1);
  try {
    const hot = await cacheAside(hotlistCacheKey(), HOTLIST_TTL, async () => {
      const quota = await consumeQuota("hotlist", HOTLIST_DAILY_LIMIT);
      if (!quota.allowed) throw new Error(QUOTA_EXHAUSTED);
      return getHotList(30);
    });
    const questions = hot.Items.filter((i) => i.Url.includes("/question/"));
    const picked = questions[Math.min(rank - 1, questions.length - 1)];
    if (!picked) {
      return Response.json({ error: "no_question_on_hotlist" }, { status: 502 });
    }

    const now = new Date();
    const caseId = `c${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${rank}`;

    // 当日同位次案件已生成则直接复用（省 LLM 调用与配额）
    const cached = await kvGetJson<CaseBrief>(caseKey(caseId));
    if (cached) return Response.json(toPublicBrief(cached));

    // 取证：以问题标题为首个检索词
    const searchData = await searchWithQuota(caseId, picked.Title);
    const items = [...searchData.Items]
      .sort((a, b) => b.VoteUpCount - a.VoteUpCount)
      .slice(0, CLUSTER_MAX_ITEMS);
    if (items.length < 3) {
      // 素材丰富度护栏：过薄提示换位次（README §4.4）
      return Response.json(
        { error: "thin_material", hint: "该问题回答太少，换 rank 重试" },
        { status: 422 },
      );
    }

    // 聚类：一次 thinking 调用产出简报+争议点+归属+检索词；直答不可用（或失败）时走降级聚类
    // 送入聚类前先做相关性预过滤——无关高赞回答若混入并被归派，会按赞数污染 clusterWeight；
    // 过滤后不足 3 条则放弃过滤（宁滥勿缺），下游映射/权重/线索卡统一使用 clusterItems
    const related = items.filter((it) => isRelatedTo(picked.Title, it.ContentText));
    const clusterItems = related.length >= 3 ? related : items;
    let parsed: ClusterResult | null = null;
    if (llmEnabled()) {
      const clusterInput = clusterItems.map((it, i) => ({
        idx: i,
        title: it.Title,
        excerpt: cleanExcerpt(it.ContentText).slice(0, 200),
        votes: it.VoteUpCount,
      }));
      const material =
        picked.Title +
        " " +
        clusterItems.map((it) => cleanExcerpt(it.ContentText).slice(0, 120)).join(" ");
      const ask = async (messages: ChatMessage[]) =>
        extractJson<ClusterResult>((await chat("zhida-thinking-1p5", messages)).choices[0].message.content);
      try {
        let candidate = await ask(buildClusterMessages(picked.Title, clusterInput));
        // 质检：虚构的争议点/简报 → 带审校意见返工一次（争议点仍由 LLM 出，只是打回重写）
        const badTitles = candidate.issues
          .filter((iss) => groundedRatio(iss.title, material) < 0.5)
          .map((iss) => iss.title);
        const briefingBad = !isGrounded(candidate.briefing, material);
        if (badTitles.length > 0 || briefingBad) {
          try {
            candidate = await ask(
              buildClusterFixMessages(picked.Title, clusterInput, candidate, badTitles, briefingBad),
            );
          } catch {
            // 返工调用失败则保留草稿，走下方终检兜底
          }
        }
        // 终检：返工后仍不合格的逐项兜底（简报换安全摘抄、争议点换通用题）
        if (!isGrounded(candidate.briefing, material)) {
          candidate.briefing = buildSafeBriefing(
            picked.Title,
            picked.Summary,
            clusterItems.map((it) => ({ excerpt: it.ContentText, votes: it.VoteUpCount })),
          );
        }
        candidate.issues = candidate.issues.map((iss) =>
          groundedRatio(iss.title, material) >= 0.5
            ? iss
            : { ...iss, title: `关于「${excerptFragment(picked.Title, 24)}」，社区更倾向哪一方？` },
        );
        parsed = candidate;
      } catch {
        parsed = null;
      }
    }
    const degraded = parsed === null;
    const cluster =
      parsed ??
      fallbackCluster(
        picked.Title,
        picked.Summary,
        clusterItems.map((it) => ({ excerpt: it.ContentText, votes: it.VoteUpCount })),
      );

    const issues: Issue[] = cluster.issues.map((iss, i) => ({
      id: `issue_${i + 1}`,
      title: iss.title,
      stances: iss.stances.map((s) => ({ id: s.id, label: s.label, clusterWeight: 0 })),
    }));
    applyWeights(
      issues,
      clusterItems.map((it) => ({ votes: it.VoteUpCount, authority: Number(it.AuthorityLevel) || 0 })),
      cluster.items,
    );

    const brief: CaseBrief = {
      caseId,
      questionTitle: picked.Title,
      questionUrl: picked.Url,
      hotRank: hot.Items.indexOf(picked) + 1,
      briefing: cluster.briefing,
      issues,
      clueCards: buildClueCards(clusterItems, cluster.items),
      suggestedKeywords: cluster.keywords,
      degraded,
    };
    await kvSetJson(caseKey(caseId), brief, CASE_TTL);

    // 预热检索词：玩家搜这些词时命中缓存，零配额（失败不阻断）
    await Promise.allSettled(
      cluster.keywords
        .slice(0, PREHEAT_KEYWORDS)
        .map((kw) => searchWithQuota(caseId, kw)),
    );

    return Response.json(toPublicBrief(brief));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === QUOTA_EXHAUSTED) {
      return Response.json({ error: "quota_exhausted" }, { status: 429 });
    }
    if (message.includes("ZHIHU_ACCESS_SECRET") || message.includes("REDIS_URL")) {
      return Response.json({ error: "env_missing", hint: message }, { status: 503 });
    }
    return Response.json({ error: "upstream", hint: message }, { status: 502 });
  }
}
