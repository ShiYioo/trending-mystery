import { describe, expect, it } from "vitest";
import { normalizeKeyword } from "./normalize";

describe("normalizeKeyword 关键词归一化", () => {
  it("去除井号与首尾空格", () => {
    expect(normalizeKeyword("  #信号系统  ")).toBe("信号系统");
  });

  it("折叠连续空白", () => {
    expect(normalizeKeyword("地铁追尾\t 事故 原因")).toBe("地铁追尾 事故 原因");
  });

  it("统一小写（英文变体归一）", () => {
    expect(normalizeKeyword("Signal System")).toBe("signal system");
  });

  it("中文原样保留", () => {
    expect(normalizeKeyword("#检修记录#")).toBe("检修记录");
  });

  it("空串与纯符号归一为空", () => {
    expect(normalizeKeyword("   #   ")).toBe("");
  });
});
