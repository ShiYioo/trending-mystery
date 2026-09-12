// 结案算分（README §4.5③）：纯查表算术，零 AI 参与——"AI 不当裁判"的承诺落在这一文件。
// 陈词一致分由直答在别处判定为 0~1 系数后传入（封顶 15%，离谱也翻不了盘）。
// clusterWeight 由案件生成时用真实点赞数算好，本函数只做查表与加权。

import type {
  CaseBrief,
  ClueCard,
  Grade,
  IssueScore,
  ScoreResult,
  VerdictSubmission,
} from "../types";

export const SCORE_WEIGHTS = { consensus: 0.5, evidence: 0.35, statement: 0.15 } as const;
/** 指认不支持所押立场的线索卡，其星值按此比例倒扣 */
export const MISCITE_PENALTY = 0.5;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp100 = (n: number) => Math.min(Math.max(n, 0), 100);

function gradeOf(total: number): Grade {
  if (total >= 90) return "S";
  if (total >= 75) return "A";
  if (total >= 60) return "B";
  return "C";
}

function evidenceScore(
  cards: Map<string, ClueCard>,
  citedClueIds: string[],
  chosenStanceId: string | null,
): number {
  const cited = citedClueIds.map((id) => cards.get(id)).filter((c): c is ClueCard => !!c);
  const totalStars = cited.reduce((sum, c) => sum + c.stars, 0);
  if (totalStars === 0) return 0;
  const hitStars = cited
    .filter((c) => chosenStanceId !== null && c.supportsStance === chosenStanceId)
    .reduce((sum, c) => sum + c.stars, 0);
  const missStars = totalStars - hitStars;
  return clamp100(((hitStars - MISCITE_PENALTY * missStars) / totalStars) * 100);
}

export function scoreVerdict(
  brief: Pick<CaseBrief, "issues" | "clueCards">,
  verdicts: VerdictSubmission[],
  statementCoherence = 0,
): ScoreResult {
  const cards = new Map(brief.clueCards.map((c) => [c.id, c]));
  const byIssue = new Map(verdicts.map((v) => [v.issueId, v]));

  const issueScores: IssueScore[] = brief.issues.map((issue) => {
    const v = byIssue.get(issue.id);
    const stance = v?.stanceId ? issue.stances.find((s) => s.id === v.stanceId) : undefined;
    const chosenStanceId = stance?.id ?? null;
    const maxWeight = Math.max(...issue.stances.map((s) => s.clusterWeight), 0);
    const consensus =
      stance && maxWeight > 0 ? (stance.clusterWeight / maxWeight) * 100 : 0; // 独狼 = 0
    return {
      issueId: issue.id,
      chosenStanceId,
      consensusScore: round1(consensus),
      evidenceScore: round1(evidenceScore(cards, v?.citedClueIds ?? [], chosenStanceId)),
    };
  });

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const consensus = avg(issueScores.map((i) => i.consensusScore));
  const evidence = avg(issueScores.map((i) => i.evidenceScore));
  const statement = clamp100(statementCoherence * 100);

  const total = round1(
    SCORE_WEIGHTS.consensus * consensus +
      SCORE_WEIGHTS.evidence * evidence +
      SCORE_WEIGHTS.statement * statement,
  );

  return {
    total,
    grade: gradeOf(total),
    issues: issueScores,
    breakdown: { consensus: round1(consensus), evidence: round1(evidence), statement: round1(statement) },
  };
}
