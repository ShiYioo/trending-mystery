// 共识结算（POST /api/verdict）：AI 不当裁判的落点。
// 查表算分（scoreVerdict，零 AI）→ 陈词一致系数（封顶 15%）→ ZADD 榜单 → LLM 只写结案解说。

import { buildCoherenceMessages, buildReportMessages } from "@/lib/case/prompts";
import { caseKey, kvGetJson, recordScore } from "@/lib/redis";
import { chat, extractJson } from "@/lib/zhihu";
import { scoreVerdict } from "@/lib/verdict/scoring";
import type { CaseBrief, ClosingRequest } from "@/lib/types";

const QUOTA_SAFE_CLAMP = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1);

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

  // ① 陈词一致系数：唯一用 LLM 的评分项，封顶 15%，失败按 0
  let coherence = 0;
  if (body.statement && body.statement.trim()) {
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
      coherence = QUOTA_SAFE_CLAMP(extractJson<{ coherence: number }>(raw).coherence);
    } catch {
      coherence = 0; // 评分不因 LLM 抖动而失败
    }
  }

  // ② 查表算分 + 榜单
  const score = scoreVerdict(brief, body.verdicts, coherence);
  await recordScore(body.caseId, body.playerId || "anonymous", score.total);

  // ③ 共识揭示（此刻才对玩家亮牌）
  const consensus = brief.issues.map((issue) => ({
    issueId: issue.id,
    title: issue.title,
    stances: [...issue.stances]
      .sort((a, b) => b.clusterWeight - a.clusterWeight)
      .map((s) => ({ id: s.id, label: s.label, weight: Math.round(s.clusterWeight * 1000) / 10 })),
  }));

  // ④ LLM 只做解说；失败降级为模板文案，分数与结论不受影响
  const chosenLabels = body.verdicts.map((v) => {
    const issue = brief.issues.find((i) => i.id === v.issueId);
    const stance = issue?.stances.find((s) => s.id === v.stanceId);
    return stance ? stance.label : `自定义结论：${v.customText ?? "（未表述）"}`;
  });
  let report = `结案完成。总分 ${score.total}，评级 ${score.grade}。你的结论：${chosenLabels.join("；")}。对比社区共识，见上方权重分布。`;
  try {
    report = (
      await chat(
        "zhida-thinking-1p5",
        buildReportMessages({
          questionTitle: brief.questionTitle,
          briefing: brief.briefing,
          grades: brief.issues.map((i) => i.title),
          chosenLabels,
          consensusLines: consensus.flatMap((c) => c.stances.map((s) => `${s.label} ${s.weight}%`)),
          total: score.total,
          grade: score.grade,
        }),
      )
    ).choices[0].message.content.trim();
  } catch {
    // 保留模板报告
  }

  return Response.json({ caseId: body.caseId, playerId: body.playerId, score, consensus, report });
}
