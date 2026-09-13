// 知乎开放接口 HTTP 薄封装：热榜 / 站内搜索 / 直答（唯一 LLM）。
// 字段规格照官方 http-api.md（核验 2026-07-16）；前端永不直连。

import { getZhihuAccessSecret } from "../env";
import type {
  ChatChunk,
  ChatCompletionResponse,
  ChatMessage,
  HotListData,
  SearchData,
  ZhidaModel,
} from "../types";

const BASE_URL = "https://developer.zhihu.com";

export class ZhihuApiError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(`[zhihu:${code}] ${message}`);
    this.name = "ZhihuApiError";
  }
  get rateLimited(): boolean {
    return this.code === 30001;
  }
}

function authHeaders(secret: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secret}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    "Content-Type": "application/json",
  };
}

/** 内容接口统一走 {Code,Message,Data} 信封；Code!==0 抛业务错误（30001 可联动配额计数） */
async function getEnvelope<T>(path: string, secret: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders(secret) });
  const body = (await res.json()) as { Code?: number; Message?: string; Data?: T };
  if (body.Code !== 0) {
    throw new ZhihuApiError(body.Code ?? res.status, body.Message ?? res.statusText);
  }
  return body.Data as T;
}

/** 热榜：Limit 服务端上限 30，无时间范围参数（按小时整表缓存在 redis 层做） */
export async function getHotList(limit = 30): Promise<HotListData> {
  const clamped = Math.min(Math.max(Math.trunc(limit), 1), 30);
  return getEnvelope(`/api/v1/content/hot_list?Limit=${clamped}`, getZhihuAccessSecret());
}

/** 站内搜索：单次上限 10 条、无翻页（线索墙单次 10 张候选卡的密度来源） */
export async function searchZhihu(query: string, count = 10): Promise<SearchData> {
  const clamped = Math.min(Math.max(Math.trunc(count), 1), 10);
  const path = `/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${clamped}`;
  return getEnvelope(path, getZhihuAccessSecret());
}

// ===== 直答（OpenAI 兼容消息结构，仅保证 model/messages/stream 三个字段） =====

async function postChat(body: object, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(getZhihuAccessSecret()),
    body: JSON.stringify(body),
    signal,
  });
}

/** 直答存在未标注的限频（实测 HTTP 429）——线性退避重试 */
async function postChatWithRetry(body: object, attempts = 3, signal?: AbortSignal): Promise<Response> {
  let res = await postChat(body, signal);
  for (let i = 1; i < attempts && res.status === 429; i++) {
    await new Promise((r) => setTimeout(r, 1500 * i));
    res = await postChat(body, signal);
  }
  return res;
}

async function parseChatError(res: Response): Promise<never> {
  const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  throw new ZhihuApiError(res.status, err?.error?.message ?? res.statusText);
}

/** 非流式：开局聚类（JSON 输出需配 extractJson 容错）、结案叙事等批量调用 */
export async function chat(model: ZhidaModel, messages: ChatMessage[], signal?: AbortSignal): Promise<ChatCompletionResponse> {
  const res = await postChatWithRetry({ model, messages, stream: false }, 3, signal);
  if (!res.ok) await parseChatError(res);
  return (await res.json()) as ChatCompletionResponse;
}

/** 流式：审问室打字机。错误块与 finish_reason==="error" 由调用方检查 chunk.error；
 *  signal 中止（玩家关窗/断网）时 fetch 直接以 AbortError 结束，不再拉上游 token */
export async function* chatStream(
  model: ZhidaModel,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const res = await postChatWithRetry({ model, messages, stream: true }, 3, signal);
  if (!res.ok || !res.body) await parseChatError(res);
  yield* streamSse(res.body!);
}

/** 解析单个 SSE 事件块：跳过 ": keep-alive" 心跳，data [DONE] 返回 null 结束 */
export function parseSseBlock(block: string): ChatChunk | null {
  for (const line of block.split("\n")) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith(":")) continue; // 心跳注释
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return null;
      try {
        return JSON.parse(payload) as ChatChunk;
      } catch {
        return null; // 坏块跳过，流不中断
      }
    }
  }
  return null;
}

async function* streamSse(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatChunk> {
  const reader = body.getReader();
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
      const chunk = parseSseBlock(block);
      if (chunk) yield chunk;
    }
  }
}

// ===== 社区开放能力 · 发布想法 =====
// 已移除（2026-09-13 决策）：该 API 的发帖身份绑定申请密钥的项目账号、无法代表玩家，
// 分享改走「战绩海报」客户端生成（见 lib/game/poster.ts）——复制/下载即传播，零外呼。
