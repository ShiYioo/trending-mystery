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

  it("解码 HTML 实体（命名 / 十进制 / 十六进制）", () => {
    expect(cleanExcerpt("A &gt; B &lt; C &amp; D")).toBe("A > B < C & D");
    expect(cleanExcerpt("温度 &#8722;5&#x2103;")).toBe("温度 −5℃");
  });

  it("二次转义递归解码（&amp;gt; → >）", () => {
    expect(cleanExcerpt("&amp;gt;")).toBe(">");
    expect(cleanExcerpt("&amp;amp;")).toBe("&");
  });

  it("知乎表情短码映射 emoji（普查实测样本）", () => {
    expect(cleanExcerpt("[赞][赞] 说得太对了")).toBe("👍👍 说得太对了");
    expect(cleanExcerpt("[doge] 你细品[看看你]")).toBe("🐶 你细品👀");
    expect(cleanExcerpt("[捂脸][飙泪笑]")).toBe("🤦😂");
  });

  it("白名单外的方括号原样保留（国际音标与脚注是正经内容）", () => {
    expect(cleanExcerpt("送气音 [pʰ] 与 [tɕ] 对立，见 [1][2]")).toBe(
      "送气音 [pʰ] 与 [tɕ] 对立，见 [1][2]",
    );
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
