// 共识结算（POST /api/verdict）：AI 不当裁判的落点。
// 查表算分（scoreVerdict，零 AI）→ 陈词一致系数（封顶 15%）→ ZADD 榜单 → LLM 只写结案解说。

import { buildCoherenceMessages, buildReportMessages } from "@/lib/case/prompts";
import { llmEnabled } from "@/lib/env";
import { caseKey, kvGetJson, recordScore } from "@/lib/redis";
import { chat, extractJson } from "@/lib/zhihu";
import { scoreVerdict } from "@/lib/verdict/scoring";
import type { CaseBrief, ClosingRequest } from "@/lib/types";

const QUOTA_SAFE_CLAMP = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1);

/** LLM 评分不可用时的保守兜底：只按玩家陈词与已选立场/证据的词面重合给部分分。 */
function fallbackCoherence(statement: string, labels: string[], excerpts: string[]): number {
  const text = `${statement}${labels.join("")}${excerpts.join("")}`.replace(/[\s，。！？、；：（）《》“”‘’！？,.!?;:()[\]{}<>]/g, "");
  const meaningful = [...new Set(text.match(/[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{3,}/g) ?? [])];
  if (!meaningful.length) return 0;
  const statementText = statement.replace(/[\s，。！？、；：（）《》“”‘’！？,.!?;:()[\]{}<>]/g, "");
  const hits = meaningful.filter((term) => statementText.includes(term)).length;
  const coverage = hits / meaningful.length;
  return QUOTA_SAFE_CLAMP(0.25 + coverage * 0.75);
}

export async function POST(request: Request) {
  let body: ClosingRequest;
  try {
    body = (await request.json()) as ClosingRequest;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body?.caseId || !Array.isArray(body.verdicts)) {
    return Response.json({ error: "caseId_and_verdicts_required" }, { status: 400 });
  }

  const brief = await kvGetJson<CaseBrief>(caseKey(body.caseId));
  if (!brief) {
    return Response.json({ error: "case_not_found", hint: "先 GET /api/case 生成案件" }, { status: 404 });
  }

  const issueIds = new Set(brief.issues.map((issue) => issue.id));
  const clueIds = new Set(brief.clueCards.map((card) => card.id));
  const seenIssues = new Set<string>();
  for (const verdict of body.verdicts) {
    if (!verdict || typeof verdict.issueId !== "string" || !issueIds.has(verdict.issueId)) {
      return Response.json({ error: "invalid_issue", hint: "结案包含不存在的争议点" }, { status: 400 });
    }
    if (seenIssues.has(verdict.issueId)) {
      return Response.json({ error: "duplicate_issue", hint: "每个争议点只能提交一次" }, { status: 400 });
    }
    seenIssues.add(verdict.issueId);
    const issue = brief.issues.find((item) => item.id === verdict.issueId)!;
    if (verdict.stanceId && !issue.stances.some((stance) => stance.id === verdict.stanceId)) {
      return Response.json({ error: "invalid_stance", hint: "结案包含不属于该争议点的立场" }, { status: 400 });
    }
    if (!Array.isArray(verdict.citedClueIds) || verdict.citedClueIds.some((id) => !clueIds.has(id))) {
      return Response.json({ error: "invalid_clue", hint: "结案包含不存在的证据卡" }, { status: 400 });
    }
    if (new Set(verdict.citedClueIds).size !== verdict.citedClueIds.length) {
      return Response.json({ error: "duplicate_clue", hint: "同一争议点不能重复指认证据" }, { status: 400 });
    }
  }

  // ① 陈词一致系数：唯一用 LLM 的评分项，封顶 15%，失败按 0
  let coherence = 0;
  if (llmEnabled() && body.statement && body.statement.trim()) {
    const chosenLabels = body.verdicts.flatMap((v) => {
      const issue = brief.issues.find((i) => i.id === v.issueId);
      const stance = issue?.stances.find((s) => s.id === v.stanceId);
      return stance ? [`${issue!.title}→${stance.label}`] : v.customText ? [v.customText] : [];
    });
    const citedExcerpts = body.verdicts
      .flatMap((v) => v.citedClueIds)
      .map((id) => brief.clueCards.find((c) => c.id === id)?.excerpt)
      .filter((e): e is string => !!e);
    try {
      const raw = (
        await chat("zhida-fast-1p5", buildCoherenceMessages(body.statement, chosenLabels, citedExcerpts))
      ).choices[0].message.content;
      const parsed = extractJson<{ coherence?: number | string }>(raw);
      const value = typeof parsed.coherence === "string" ? Number(parsed.coherence) : parsed.coherence;
      if (value == null || !Number.isFinite(value)) throw new Error("invalid coherence value");
      coherence = QUOTA_SAFE_CLAMP(value);
    } catch {
      coherence = fallbackCoherence(body.statement, chosenLabels, citedExcerpts);
    }
  }

  // ② 查表算分 + 榜单
  const score = scoreVerdict(brief, body.verdicts, coherence);
  await recordScore(body.caseId, body.playerId || "anonymous", score.total);

  // ③ 共识揭示（此刻才对玩家亮牌）+ 证据核查表（逐卡亮出真实归属）
  const consensus = brief.issues.map((issue) => ({
    issueId: issue.id,
    title: issue.title,
    stances: [...issue.stances]
      .sort((a, b) => b.clusterWeight - a.clusterWeight)
      .map((s) => ({ id: s.id, label: s.label, weight: Math.round(s.clusterWeight * 1000) / 10 })),
  }));
  const evidenceReview = brief.issues.map((issue) => {
    const v = body.verdicts.find((x) => x.issueId === issue.id);
    const chosen = issue.stances.find((s) => s.id === v?.stanceId);
    const cards = (v?.citedClueIds ?? [])
      .map((id) => {
        const card = brief.clueCards.find((c) => c.id === id);
        if (!card) return null;
        const actual = issue.stances.find((s) => s.id === card.supportsStance);
        return {
          id: card.id,
          excerpt: card.excerpt.slice(0, 48),
          stars: card.stars,
          hit: chosen ? card.supportsStance === chosen.id : false,
          actualStanceLabel: actual?.label ?? "未归派（不计入任何立场）",
        };
      })
      .filter((c): c is NonNullable<typeof c> => !!c);
    return {
      issueId: issue.id,
      title: issue.title,
      chosenLabel: chosen?.label ?? `自定义：${v?.customText ?? "未表述"}`,
      cards,
    };
  });

  // ④ LLM 只做数据解说；失败降级为模板文案，分数与结论不受影响
  const perIssue = brief.issues.map((issue) => {
    const v = body.verdicts.find((x) => x.issueId === issue.id);
    const stance = issue.stances.find((s) => s.id === v?.stanceId);
    return {
      issueTitle: issue.title,
      chosenLabel: stance?.label ?? `自定义：${v?.customText ?? "未表述"}`,
      weightPct: Math.round((stance?.clusterWeight ?? 0) * 1000) / 10,
    };
  });
  const citedCount = body.verdicts.reduce((n, v) => n + v.citedClueIds.length, 0);
  let report = `结案完成。总分 ${score.total}（${score.grade} 级），共识吻合 ${score.breakdown.consensus}、证据指认 ${score.breakdown.evidence}、陈词 ${score.breakdown.statement}。逐项数据见上方分项。`;
  if (llmEnabled()) {
    try {
      report = (
        await chat(
          "zhida-thinking-1p5",
          buildReportMessages({
            questionTitle: brief.questionTitle,
            briefing: brief.briefing,
            perIssue,
            evidenceScore: score.breakdown.evidence,
            citedCount,
            statementScore: score.breakdown.statement,
            hasStatement: !!(body.statement && body.statement.trim()),
            total: score.total,
            grade: score.grade,
          }),
        )
      ).choices[0].message.content.trim();
    } catch {
      // 保留模板报告
    }
  }

  return Response.json({ caseId: body.caseId, playerId: body.playerId, score, consensus, evidenceReview, report });
}
