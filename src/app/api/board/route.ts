// 今日神探榜：GET /api/board?caseId=... —— ZSET 倒序出榜

import { topDetectives } from "@/lib/redis";

export async function GET(request: Request) {
  const caseId = new URL(request.url).searchParams.get("caseId");
  if (!caseId) {
    return Response.json({ error: "caseId_required" }, { status: 400 });
  }
  const top = await topDetectives(caseId, 10);
  return Response.json({ caseId, top });
}
