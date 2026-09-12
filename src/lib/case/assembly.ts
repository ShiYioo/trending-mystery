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
  };
}
