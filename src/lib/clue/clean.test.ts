import { describe, expect, it } from "vitest";
import { cleanExcerpt, excerptFragment, groundedRatio, isGrounded, isRelatedTo } from "./clean";

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

describe("isGrounded 落地校验（反虚构）", () => {
  const material = "店主发现馆藏文物失踪后立即报警投诉。监管部门随后对全行业展开密集检查。多方认为失踪事件是检查的直接原因。";

  it("逐句有据的简报通过", () => {
    expect(isGrounded("店主投诉文物失踪。随后引来密集检查。", material)).toBe(true);
  });

  it("骑在真实语境上夹带私货的句子（真词+虚构词混合）被判虚构", () => {
    expect(
      isGrounded("店主投诉文物失踪。监管部门怀疑存在恶意投诉与打击报复，展开密集检查以甄别。", material),
    ).toBe(false);
  });

  it("空文本不通过", () => {
    expect(isGrounded("", material)).toBe(false);
  });
});

describe("groundedRatio 争议点标题落地率", () => {
  const material = "店主发现馆藏文物失踪后立即报警投诉。监管部门随后对全行业展开密集检查。多方认为失踪事件是检查的直接原因。";

  it("虚构型标题（密集检查是否存在恶意投诉与打击报复）低于阈值", () => {
    expect(groundedRatio("密集检查是否存在恶意投诉与打击报复？", material)).toBeLessThan(0.5);
  });

  it("事实型标题通过阈值", () => {
    expect(groundedRatio("文物失踪是否与监管疏漏有关？", material)).toBeGreaterThanOrEqual(0.5);
  });
});
