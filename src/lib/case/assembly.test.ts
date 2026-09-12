import { describe, expect, it } from "vitest";
import { applyWeights, buildClueCards, toPublicBrief } from "./assembly";
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
