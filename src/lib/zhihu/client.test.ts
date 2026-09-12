import { describe, expect, it } from "vitest";
import { parseSseBlock } from "./client";

describe("parseSseBlock SSE 事件块解析", () => {
  it("跳过 keep-alive 心跳注释", () => {
    expect(parseSseBlock(": keep-alive")).toBeNull();
  });

  it("解析 data JSON 块", () => {
    const block = 'data: {"id":"1","choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}';
    const chunk = parseSseBlock(block);
    expect(chunk?.choices[0].delta.content).toBe("你");
  });

  it("心跳与数据混合的块取数据行", () => {
    const block = ': keep-alive\ndata: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}';
    expect(parseSseBlock(block)?.choices[0].finish_reason).toBe("stop");
  });

  it("data: [DONE] 返回 null", () => {
    expect(parseSseBlock("data: [DONE]")).toBeNull();
  });

  it("流中错误块可被读出（调用方检查 chunk.error）", () => {
    const block =
      'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"error"}],"error":{"message":"boom","type":"server_error"}}';
    expect(parseSseBlock(block)?.error?.message).toBe("boom");
  });

  it("坏 JSON 块返回 null 不中断", () => {
    expect(parseSseBlock("data: {oops")).toBeNull();
  });
});
