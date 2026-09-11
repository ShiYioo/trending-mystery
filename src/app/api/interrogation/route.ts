// 审问引擎：人设 prompt + 已出示线索卡 + 对话历史随请求注入，直答 Agent 流式输出
// 服务端无状态；矛盾检测标红由前端依据轮次对比呈现
export async function POST(request: Request) {
  await request.body?.cancel();
  return Response.json({ module: "interrogation", status: "not-implemented" });
}
