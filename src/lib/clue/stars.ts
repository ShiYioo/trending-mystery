// 可信度星级：三个输入全部来自 zhihu_search 真实字段（README §4.6）。
// 权重与刻度是标定常量——M0 拿到真实分布后在此调参，调用方无感。

export const STAR_TUNING = {
  /** 相关性（RankingScore）权重 */
  relevance: 0.4,
  /** 权威等级权重 */
  authority: 0.3,
  /** 赞同数权重 */
  votes: 0.3,
  /** RankingScore 归一刻度：实测为无界分数（约 2.x），非 0~1；M0 拿到分布后校准 */
  rankingScale: 3,
  /** AuthorityLevel 上界（实测见字符串 "4" 等级值，范围待更多样本确认） */
  authorityMax: 10,
  /** 赞同数 log 刻度：10^5 = 100,000 赞记满格 */
  voteLogScale: 5,
} as const;

export type StarLevel = 1 | 2 | 3 | 4 | 5;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0);

export function starRating(input: {
  rankingScore: number;
  authorityLevel: string | number;
  voteUpCount: number;
}): StarLevel {
  const relevance = clamp01(input.rankingScore / STAR_TUNING.rankingScale);
  const authority = clamp01(Number(input.authorityLevel) / STAR_TUNING.authorityMax);
  const votes = clamp01(Math.log10(1 + Math.max(0, input.voteUpCount)) / STAR_TUNING.voteLogScale);
  const combined =
    STAR_TUNING.relevance * relevance +
    STAR_TUNING.authority * authority +
    STAR_TUNING.votes * votes;
  const stars = Math.round(1 + combined * 4);
  return Math.min(Math.max(stars, 1), 5) as StarLevel;
}
