// 案件装配纯函数：LLM 只负责语义归类，权重与卡片全部由代码计算——AI 不当裁判（README §4.5）。

import { starRating } from "../clue/stars";
import { cleanExcerpt, excerptFragment, isRelatedTo, overlapCount } from "../clue/clean";
import type { CaseBrief, ClueCard, Issue, PublicCaseBrief, SearchItem } from "../types";
import type { ClusterResult } from "./prompts";

/**
 * clusterWeight = Σ log10(1+赞同数) × (1 + 0.35×权威等级) ÷ 本争议点同类总和。
 * 权威加权：少而权威的立场可压过多而匿名的立场——读赞数不足以定位主流，必须同时看认证等级
 * （README §03 第一抉择"五星大佬 vs 一星小号信谁"由此承重）。权重仍由代码计算，LLM 只做归类。
 */
export function applyWeights(
  issues: Issue[],
  items: Array<{ votes: number; authority?: number }>,
  mapping: ClusterResult["items"],
): void {
  const itemWeight = (i: { votes: number; authority?: number }) =>
    Math.log10(1 + Math.max(0, i.votes)) * (1 + 0.35 * (i.authority ?? 0));
  for (const issue of issues) {
    for (const stance of issue.stances) stance.clusterWeight = 0;
  }
  const issueByIdx = new Map(issues.map((i) => [issues.indexOf(i), i]));
  for (const m of mapping) {
    const item = items[m.idx];
    const issue = issueByIdx.get(m.issue);
    const stance = issue?.stances.find((s) => s.id === m.stance);
    if (issue && stance && item) stance.clusterWeight += itemWeight(item);
  }
  for (const issue of issues) {
    const total = issue.stances.reduce((sum, s) => sum + s.clusterWeight, 0);
    if (total > 0) for (const s of issue.stances) s.clusterWeight /= total;
  }
}

/** 线索卡：星级来自真实三字段，立场归属来自 LLM 映射 */
export function buildClueCards(
  searchItems: SearchItem[],
  mapping: ClusterResult["items"],
): ClueCard[] {
  const stanceByIdx = new Map(mapping.map((m) => [m.idx, m.stance]));
  return searchItems.map((it, i) => ({
    id: `c_${String(i + 1).padStart(2, "0")}`,
    stars: starRating({
      rankingScore: it.RankingScore,
      authorityLevel: it.AuthorityLevel,
      voteUpCount: it.VoteUpCount,
    }),
    supportsStance: stanceByIdx.get(i) ?? "s_none",
    sourceContentId: it.ContentID,
    excerpt: cleanExcerpt(it.ContentText).slice(0, 200),
  }));
}

/** 公开视图：剥离 clusterWeight 与 supportsStance——结案翻牌前玩家不可见 */
export function toPublicBrief(brief: CaseBrief): PublicCaseBrief {
  return {
    caseId: brief.caseId,
    questionTitle: brief.questionTitle,
    questionUrl: brief.questionUrl,
    hotRank: brief.hotRank,
    briefing: brief.briefing,
    issues: brief.issues.map((i) => ({
      id: i.id,
      title: i.title,
      stances: i.stances.map((s) => ({ id: s.id, label: s.label })),
    })),
    clueCards: brief.clueCards.map((c) => ({ id: c.id, stars: c.stars, excerpt: c.excerpt })),
    suggestedKeywords: brief.suggestedKeywords,
    degraded: brief.degraded,
  };
}

/** 两段式摘抄简报：速览 + 社区风向。rankByRelevance 时按与标题的重叠度选材（安全兜底路径用） */
function extractedBriefing(
  questionTitle: string,
  summary: string,
  items: Array<{ excerpt: string; votes: number }>,
  rankByRelevance = false,
): string {
  const related = items.filter((i) => isRelatedTo(questionTitle, i.excerpt));
  let source = related.length > 0 ? related : items;
  if (rankByRelevance) {
    source = [...source].sort(
      (a, b) => overlapCount(questionTitle, b.excerpt) - overlapCount(questionTitle, a.excerpt),
    );
  }
  const views = source.slice(1, 4).map((i) => `· ${excerptFragment(i.excerpt, 76)}（${i.votes.toLocaleString()} 赞）`);
  return [
    "【档案速览】",
    excerptFragment(source[0].excerpt, 110) || excerptFragment(summary, 110) || excerptFragment(questionTitle, 110),
    "",
    "【社区风向】",
    ...(views.length ? views : ["· 暂无足够切题的高赞观点，请进入搜查取证自行研判。"]),
  ].join("\n");
}

/** LLM 简报落地校验失败后的安全兜底：纯摘抄、按相关度选材，零虚构 */
export function buildSafeBriefing(
  questionTitle: string,
  summary: string,
  items: Array<{ excerpt: string; votes: number }>,
): string {
  return extractedBriefing(questionTitle, summary, items, true);
}

/**
 * 降级聚类（直答额度不可用时）：无 LLM，按赞数中位把回答分成"多数派/少数派"两营，
 * 权重照常由真实赞数计算——玩法闭环完整，只是立场标签退化为通用命名。
 */
export function fallbackCluster(
  questionTitle: string,
  summary: string,
  items: Array<{ excerpt: string; votes: number }>, // 需已按赞数降序
): ClusterResult {
  const majority = Math.ceil(items.length / 2);
  return {
    briefing: extractedBriefing(questionTitle, summary, items),
    issues: [
      {
        title: "社区的主流判断是哪一方？",
        stances: [
          { id: "s_main", label: "多数派判断" },
          { id: "s_min", label: "少数派质疑" },
        ],
      },
    ],
    items: items.map((_, idx) => ({
      idx,
      issue: 0,
      stance: idx < majority ? "s_main" : "s_min",
    })),
    keywords: [
      questionTitle,
      "辟谣",
      "内幕",
      "当事人回应",
      "专业分析",
      "时间线",
    ].slice(0, 6),
  };
}
