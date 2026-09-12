import { describe, expect, it } from "vitest";
import { starRating } from "./stars";

describe("starRating 可信度星级", () => {
  it("全满格输入 → 5 星（RankingScore 以实测刻度 3 为满）", () => {
    expect(starRating({ rankingScore: 3, authorityLevel: "10", voteUpCount: 100_000 })).toBe(5);
  });

  it("全零输入 → 1 星", () => {
    expect(starRating({ rankingScore: 0, authorityLevel: "0", voteUpCount: 0 })).toBe(1);
  });

  it("真实分布样例：2 千赞权威 4 回答与 300 赞匿名回答拉开档位", () => {
    const expert = starRating({ rankingScore: 2.35, authorityLevel: "4", voteUpCount: 21_000 });
    const anon = starRating({ rankingScore: 1.5, authorityLevel: "0", voteUpCount: 300 });
    expect(expert).toBeGreaterThan(anon);
    expect(expert).toBeGreaterThanOrEqual(4);
    expect(anon).toBeLessThanOrEqual(2);
  });

  it("非法输入按 0 处理，不抛错（线上数据脏值兜底）", () => {
    expect(starRating({ rankingScore: NaN, authorityLevel: "abc", voteUpCount: -5 })).toBe(1);
  });
});
