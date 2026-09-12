import { describe, expect, it } from "vitest";
import { starRating } from "./stars";

describe("starRating 可信度星级", () => {
  it("全满格输入 → 5 星", () => {
    expect(starRating({ rankingScore: 1, authorityLevel: "10", voteUpCount: 100_000 })).toBe(5);
  });

  it("全零输入 → 1 星", () => {
    expect(starRating({ rankingScore: 0, authorityLevel: "0", voteUpCount: 0 })).toBe(1);
  });

  it("2 万赞五星技术帖与 300 赞匿名帖拉开档位", () => {
    const expert = starRating({ rankingScore: 0.98, authorityLevel: "8", voteUpCount: 21_000 });
    const anon = starRating({ rankingScore: 0.55, authorityLevel: "0", voteUpCount: 300 });
    expect(expert).toBeGreaterThan(anon);
    expect(expert).toBeGreaterThanOrEqual(4);
    expect(anon).toBeLessThanOrEqual(2);
  });

  it("非法输入按 0 处理，不抛错（线上数据脏值兜底）", () => {
    expect(starRating({ rankingScore: NaN, authorityLevel: "abc", voteUpCount: -5 })).toBe(1);
  });
});
