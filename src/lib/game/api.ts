// 前端 API 客户端：四个房间的全部后端交互，含审问室 SSE 流式消费。

import type { ClosingRequest } from "@/lib/types";
import type { CollectedCard, VerdictResponse } from "./store";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string; hint?: string }) | null;
  if (!res.ok) {
    throw new Error(body?.hint ?? body?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchCase(rank = 1): Promise<import("@/lib/types").PublicCaseBrief> {
  return jsonOrThrow(await fetch(`/api/case?rank=${rank}`));
}

export async function searchClue(caseId: string, q: string): Promise<CollectedCard[]> {
  const data = await jsonOrThrow<{ items: CollectedCard[] }>(
    await fetch(`/api/clue?caseId=${encodeURIComponent(caseId)}&q=${encodeURIComponent(q)}`),
  );
  return data.items ?? [];
}

export async function submitVerdict(body: ClosingRequest): Promise<VerdictResponse> {
  return jsonOrThrow(
    await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchBoard(
  caseId: string,
): Promise<Array<{ playerId: string; score: number }>> {
  const data = await jsonOrThrow<{ top: Array<{ playerId: string; score: number }> }>(
    await fetch(`/api/board?caseId=${encodeURIComponent(caseId)}`),
  );
  return data.top ?? [];
}

/** 审问：POST SSE，逐段 yield 当事人吐字；错误以 {error} 抛出式交付 */
export async function* interrogate(
  caseId: string,
  history: import("@/lib/types").ChatMessage[],
  shownExcerpts: string[],
): AsyncGenerator<{ delta?: string; error?: string }> {
  const res = await fetch("/api/interrogation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, history, shownExcerpts }),
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { hint?: string; error?: string } | null;
    yield { error: body?.hint ?? body?.error ?? `审问室连接失败（HTTP ${res.status}）` };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            error?: { message?: string };
          };
          if (chunk.error) {
            yield { error: chunk.error.message ?? "当事人陷入了沉默" };
            return;
          }
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield { delta };
        } catch {
          // 坏块跳过
        }
      }
    }
  }
}
