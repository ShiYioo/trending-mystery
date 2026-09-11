// 共识结算（结案管线）：玩家押立场 + 指认证据 → 查表算分（零 AI）→ 直答生成结案叙事 → 海报数据
// AI 不当裁判：clusterWeight 由代码用真实点赞数计算，LLM 只做开局归类与赛后解说
export async function POST(request: Request) {
  await request.body?.cancel();
  return Response.json({ module: "verdict", status: "not-implemented" });
}
