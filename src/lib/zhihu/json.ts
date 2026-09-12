// 直答接口仅保证 model/messages/stream 三个字段，response_format 不保证生效——
// 立场聚类的 JSON 输出统一走本容错解析：原文 → fenced 提取 → 括号跨度，三级降级（README §4.5）。

export class JsonParseError extends Error {
  constructor(readonly rawPreview: string) {
    super(`[json] 无法从模型输出中提取 JSON：${rawPreview.slice(0, 120)}`);
    this.name = "JsonParseError";
  }
}

export function extractJson<T = unknown>(raw: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1];
  const firstBrace = raw.indexOf("{");
  const firstBracket = raw.indexOf("[");
  const open = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const span =
    open === firstBrace && open >= 0
      ? raw.slice(firstBrace, raw.lastIndexOf("}") + 1)
      : open === firstBracket && open >= 0
        ? raw.slice(firstBracket, raw.lastIndexOf("]") + 1)
        : null;

  for (const candidate of [raw, fenced, span]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // 降级到下一候选
    }
  }
  throw new JsonParseError(raw);
}
