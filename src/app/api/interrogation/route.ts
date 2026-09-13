// 审问引擎（POST /api/interrogation）：
// 人设 prompt + 已出示线索卡摘要 + 对话历史（随请求携带，服务端无状态）
// → 直答 fast 档流式输出，SSE 原样转发增量块（前端打字机直接消费）。

import { buildPersonaMessages } from "@/lib/case/prompts";
import { llmEnabled } from "@/lib/env";
import { caseKey, kvGetJson } from "@/lib/redis";
import { chatStream } from "@/lib/zhihu";
import type { CaseBrief, ChatMessage } from "@/lib/types";

// Vercel：SSE 流式长回答需要足够运行时长
export const maxDuration = 60;

/** 直答多轮上下文截断：只带最近 12 条，控制长度与延迟 */
const MAX_HISTORY = 12;

interface InterrogationRequest {
  caseId: string;
  history: ChatMessage[];
  /** 本轮出示的线索卡摘要（前端从公开视图的 excerpt 取） */
  shownExcerpts?: string[];
}

export async function POST(request: Request) {
  let body: InterrogationRequest;
  try {
    body = (await request.json()) as InterrogationRequest;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.caseId || !Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "caseId_and_history_required" }, { status: 400 });
  }

  const brief = await kvGetJson<CaseBrief>(caseKey(body.caseId));
  if (!brief) {
    return Response.json({ error: "case_not_found", hint: "先 GET /api/case 生成案件" }, { status: 404 });
  }
  if (!llmEnabled()) {
    return Response.json(
      { error: "llm_disabled", hint: "当事人今日不接待审问（分析引擎额度耗尽，明日恢复）" },
      { status: 503 },
    );
  }

  const messages = buildPersonaMessages(
    brief.briefing,
    brief.questionTitle,
    body.shownExcerpts ?? [],
    body.history.slice(-MAX_HISTORY),
  );

  const encoder = new TextEncoder();
  // 玩家关窗/断网 → request.signal 中止 → 上游 fetch 立刻断开，不再白拉 token
  const ac = new AbortController();
  request.signal.addEventListener("abort", () => ac.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chatStream("zhida-fast-1p5", messages, ac.signal)) {
          if (chunk.error || chunk.choices.some((c) => c.finish_reason === "error")) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: chunk.error ?? { message: "stream error" } })}\n\n`,
              ),
            );
            break;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        // 主动中止不算错误：客户端已经走了，别再往死流里写
        if (!ac.signal.aborted) {
          const message = e instanceof Error ? e.message : String(e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message } })}\n\n`));
        }
      } finally {
        try {
          controller.close();
        } catch {
          // 流已被下游取消时 close 会抛，吞掉即可
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
