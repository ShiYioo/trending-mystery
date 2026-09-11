// 取证 / 线索卡引擎：代理玩家搜索，关键词归一化 → Redis 缓存命中则直出，未命中调 zhihu_search（配额 INCR）
// 星级 = f(RankingScore, AuthorityLevel, VoteUpCount)，字段映射见 README §4.6
export async function GET(request: Request) {
  const keyword = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ module: "clue", keyword, status: "not-implemented" });
}
