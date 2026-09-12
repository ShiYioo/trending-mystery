import { describe, expect, it } from "vitest";
import { cleanExcerpt, excerptFragment } from "./clean";

describe("cleanExcerpt 摘要清洗", () => {
  it("摘掉媒体占位符并折叠空白", () => {
    expect(cleanExcerpt("TBC Racing老板不满事故救援 [图片] 宣布退出 [视频] 中国GT赛")).toBe(
      "TBC Racing老板不满事故救援 宣布退出 中国GT赛",
    );
  });

  it("普通文本原样（仅折叠多余空白）", () => {
    expect(cleanExcerpt("事故发生后  救援延迟。")).toBe("事故发生后 救援延迟。");
  });
});

describe("excerptFragment 片段截取", () => {
  it("优先在句读处收尾", () => {
    const out = excerptFragment("一句话已经结束了。后续内容很长很长很长很长很长很长", 10);
    expect(out.endsWith("。")).toBe(true);
  });

  it("无合适句读时按长度截断", () => {
    expect(excerptFragment("纯文字没有句读", 4)).toBe("纯文字没");
  });
});
