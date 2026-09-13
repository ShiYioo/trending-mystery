import { describe, expect, it } from "vitest";
import { parseMiniMarkdown, splitInline } from "./markdown";

describe("splitInline", () => {
  it("奇数段加粗、偶数段原文，空段不破坏奇偶", () => {
    expect(splitInline("前**中**后")).toEqual([
      { text: "前", bold: false },
      { text: "中", bold: true },
      { text: "后", bold: false },
    ]);
  });

  it("开头就是加粗时首段为空但不丢奇偶", () => {
    expect(splitInline("**全部**")).toEqual([{ text: "全部", bold: true }]);
  });

  it("未闭合的 ** 按原文直出（打字机半截文本常态）", () => {
    expect(splitInline("半个**加粗")).toEqual([
      { text: "半个**加粗", bold: false },
    ]);
  });
});

describe("parseMiniMarkdown", () => {
  it("标题分级、# 超三级收敛为 h3", () => {
    const blocks = parseMiniMarkdown("# 一\n## 二\n### 三\n#### 四");
    expect(blocks.map((b) => b.type)).toEqual(["h1", "h2", "h3", "h3"]);
  });

  it("列表、分隔线、空行跳过", () => {
    const blocks = parseMiniMarkdown("- 甲\n· 乙\n\n---\n普通段");
    expect(blocks.map((b) => b.type)).toEqual(["li", "li", "hr", "p"]);
  });

  it("半个标题也算标题（打字中途渲染安全）", () => {
    const blocks = parseMiniMarkdown("# 结案报");
    expect(blocks).toEqual([{ type: "h1", inlines: [{ text: "结案报", bold: false }] }]);
  });

  it("行内加粗保留到块内", () => {
    const [block] = parseMiniMarkdown("- 共识 **62%**，证据 0");
    expect(block).toEqual({
      type: "li",
      inlines: [
        { text: "共识 ", bold: false },
        { text: "62%", bold: true },
        { text: "，证据 0", bold: false },
      ],
    });
  });
});
