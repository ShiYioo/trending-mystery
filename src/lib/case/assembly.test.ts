import { describe, expect, it } from "vitest";
import { applyWeights, buildClueCards, fallbackCluster, toPublicBrief } from "./assembly";
import type { CaseBrief, SearchItem } from "../types";

const mkItem = (over: Partial<SearchItem>): SearchItem => ({
  Title: "t",
  ContentType: "Answer",
  ContentID: "id",
  ContentText: "x".repeat(300),
  Url: "u",
  CommentCount: 0,
  VoteUpCount: 0,
  AuthorName: "a",
  AuthorAvatar: "",
  AuthorBadge: "",
  AuthorBadgeText: "",
  EditTime: 0,
  AuthorityLevel: "4",
  RankingScore: 2,
  ...over,
});

describe("applyWeights 权重来自真实赞数", () => {
  it("按赞数份额计算 clusterWeight，与模型输出无关", () => {
    const issues = [
      {
        id: "i1",
        title: "q",
        stances: [
          { id: "s1", label: "A", clusterWeight: 0 },
          { id: "s2", label: "B", clusterWeight: 0 },
        ],
      },
    ];
    applyWeights(
      issues,
      [{ votes: 600 }, { votes: 300 }, { votes: 100 }],
      [
        { idx: 0, issue: 0, stance: "s1" },
        { idx: 1, issue: 0, stance: "s1" },
        { idx: 2, issue: 0, stance: "s2" },
      ],
    );
    expect(issues[0].stances[0].clusterWeight).toBeCloseTo(0.9);
    expect(issues[0].stances[1].clusterWeight).toBeCloseTo(0.1);
  });

  it("未映射到任何回答的立场权重为 0，不产生 NaN", () => {
    const issues = [
      { id: "i1", title: "q", stances: [{ id: "s1", label: "A", clusterWeight: 0 }] },
    ];
    applyWeights(issues, [{ votes: 100 }], []);
    expect(issues[0].stances[0].clusterWeight).toBe(0);
  });
});

describe("buildClueCards 星级与归属", () => {
  it("星级来自真实字段、归属来自映射、摘要截断 200", () => {
    const cards = buildClueCards([mkItem({ VoteUpCount: 21_000, RankingScore: 2.35 })], [
      { idx: 0, issue: 0, stance: "s1" },
    ]);
    expect(cards[0].stars).toBeGreaterThanOrEqual(4);
    expect(cards[0].supportsStance).toBe("s1");
    expect(cards[0].excerpt.length).toBe(200);
    expect(cards[0].id).toBe("c_01");
  });
});

describe("fallbackCluster 降级简报的可读性", () => {
  const title = "多车队宣布永久退出China GT，上海站赛车起火救援不力带来的影响有多大？";
  const items = [
    { excerpt: "这个尴尬场面的含金量还在上升。主持人已经尽力了，她听到婶婶两个字的时候抢回了话筒。", votes: 9048 },
    { excerpt: "赛车运动能从前那种“死人很正常”，发展到今天靠的就是把安全一层层往上堆。", votes: 2806 },
    { excerpt: "赛事应急救援存在漏洞，车手放弃比赛去救人，多车队宣布退出是行业用脚投票。", votes: 1200 },
    { excerpt: "坐等调查结果，不急着站队。", votes: 255 },
  ];

  it("两段式排版；不相关的高赞病毒回答被相关性过滤挡掉", () => {
    const r = fallbackCluster(title, "多车队相继宣布退出。", items);
    expect(r.briefing).toContain("【档案速览】");
    expect(r.briefing).toContain("【社区风向】");
    expect(r.briefing).not.toContain("主持人"); // 9048 赞但不切题
    expect(r.briefing).toContain("1,200 赞"); // 切题条目带赞数入风向
    expect(r.briefing.split("\n").length).toBeGreaterThanOrEqual(5);
  });

  it("媒体占位符被清洗；不含暴露内部实现的注释", () => {
    const r = fallbackCluster(title, "", [
      { excerpt: "救援迟迟不到 [图片] 车手自己下车救人。赛车起火后救援不力。", votes: 100 },
    ]);
    expect(r.briefing).not.toContain("[图片]");
    expect(r.briefing).not.toContain("分析引擎");
  });

  it("全部不切题时降级回原始条目，不输出空风向", () => {
    const r = fallbackCluster("甲乙丙丁戊己庚", "", [{ excerpt: "子丑寅卯辰巳午", votes: 5 }]);
    expect(r.briefing).toContain("暂无足够切题");
  });

  it("按赞数中位分派两营（分派用全量，不受过滤影响）", () => {
    const r = fallbackCluster(title, "", items);
    expect(r.items.filter((m) => m.stance === "s_main")).toHaveLength(2);
    expect(r.items.filter((m) => m.stance === "s_min")).toHaveLength(2);
  });
});

describe("toPublicBrief 保密剥离", () => {
  it("公开视图不含 clusterWeight 与 supportsStance", () => {
    const brief: CaseBrief = {
      caseId: "c1",
      questionTitle: "q",
      questionUrl: "u",
      hotRank: 1,
      briefing: "b",
      issues: [
        {
          id: "i1",
          title: "q",
          stances: [
            { id: "s1", label: "A", clusterWeight: 0.9 },
            { id: "s2", label: "B", clusterWeight: 0.1 },
          ],
        },
      ],
      clueCards: [
        { id: "c_01", stars: 5, supportsStance: "s1", sourceContentId: "x", excerpt: "e" },
      ],
      suggestedKeywords: ["k"],
    };
    const pub = toPublicBrief(brief);
    expect(JSON.stringify(pub)).not.toContain("clusterWeight");
    expect(JSON.stringify(pub)).not.toContain("supportsStance");
    expect(pub.issues[0].stances[0]).toEqual({ id: "s1", label: "A" });
    expect(pub.clueCards[0]).toEqual({ id: "c_01", stars: 5, excerpt: "e" });
  });
});
