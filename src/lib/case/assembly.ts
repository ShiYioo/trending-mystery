// 案件装配纯函数：LLM 只负责语义归类，权重与卡片全部由代码计算——AI 不当裁判（README §4.5）。

import { starRating } from "../clue/stars";
import type { CaseBrief, ClueCard, Issue, PublicCaseBrief, SearchItem } from "../types";
import type { ClusterResult } from "./prompts";

/** clusterWeight = 该立场获得的赞同数 ÷ 本争议点总赞同数（真实点赞数算权重，与模型无关） */
export function applyWeights(
  issues: Issue[],
  items: Array<{ votes: number }>,
  mapping: ClusterResult["items"],
): void {
  for (const issue of issues) {
    for (const stance of issue.stances) stance.clusterWeight = 0;
  }
  const issueByIdx = new Map(issues.map((i) => [issues.indexOf(i), i]));
  for (const m of mapping) {
    const votes = items[m.idx]?.votes ?? 0;
    const issue = issueByIdx.get(m.issue);
    const stance = issue?.stances.find((s) => s.id === m.stance);
    if (issue && stance) stance.clusterWeight += votes;
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
    excerpt: it.ContentText.slice(0, 200),
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

/**
 * 降级聚类（直答额度不可用时）：无 LLM，按赞数中位把回答分成"多数派/少数派"两营，
 * 权重照常由真实赞数计算——玩法闭环完整，只是立场标签退化为通用命名。
 */
export function fallbackCluster(
  questionTitle: string,
  summary: string,
  items: Array<{ Title: string; VoteUpCount: number }>, // 需已按赞数降序
): ClusterResult {
  const majority = Math.ceil(items.length / 2);
  const top = items.slice(0, 3);
  return {
    briefing:
      `【档案速览】${questionTitle}\n` +
      (summary ? `${summary}\n` : "") +
      "社区高赞观点速览：\n" +
      top.map((i) => `· ${i.Title.slice(0, 40)}（${i.VoteUpCount} 赞）`).join("\n") +
      "\n（注：分析引擎今日离线，本简报由档案科速记拼装，立场牌为通用分派。）",
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
