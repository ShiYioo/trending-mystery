// 案件生成：拉取当日热榜 → 筛选可做案的问题 → 直答生成案情/争议点/立场牌底表（含共识聚类）
// 设计见 README §4.4 核心模块与 §4.5 结案管线
export async function GET() {
  return Response.json({ module: "case", status: "not-implemented" });
}
