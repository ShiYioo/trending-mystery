import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildPinSignature, parseSseBlock } from "./client";

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

describe("buildPinSignature（发布想法 HMAC 签名）", () => {
  it("签名串按官方格式拼接，HMAC-SHA256 后 base64", () => {
    const got = buildPinSignature("token-abc", "secret-xyz", 1757769600, "log-1", "");
    const want = createHmac("sha256", "secret-xyz")
      .update("app_key:token-abc|ts:1757769600|logid:log-1|extra_info:")
      .digest("base64");
    expect(got).toBe(want);
  });

  it("extra_info 参与签名串", () => {
    const empty = buildPinSignature("t", "s", 1, "l", "");
    const extra = buildPinSignature("t", "s", 1, "l", "campaign=tm01");
    expect(empty).not.toBe(extra);
  });

  it("确定性：同输入同签名；换密钥即变", () => {
    expect(buildPinSignature("t", "s1", 1, "l")).toBe(buildPinSignature("t", "s1", 1, "l"));
    expect(buildPinSignature("t", "s1", 1, "l")).not.toBe(buildPinSignature("t", "s2", 1, "l"));
  });
});
