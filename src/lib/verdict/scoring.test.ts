import { describe, expect, it } from "vitest";
import { scoreVerdict } from "./scoring";
import type { CaseBrief, ClueCard, Issue } from "../types";

// 与 README §4.5 示例同构的测试案件：三立场 45/35/20，四张线索卡
const issues: Issue[] = [
  {
    id: "issue_1",
    title: "事故的直接原因是什么？",
    stances: [
      { id: "s_a", label: "设备老化失修", clusterWeight: 0.45 },
      { id: "s_b", label: "调度违规操作", clusterWeight: 0.35 },
      { id: "s_c", label: "第三方施工责任", clusterWeight: 0.2 },
    ],
  },
];

const clueCards: ClueCard[] = [
  { id: "c_03", stars: 5, supportsStance: "s_a", sourceContentId: "111" },
  { id: "c_07", stars: 4, supportsStance: "s_a", sourceContentId: "112" },
  { id: "c_11", stars: 2, supportsStance: "s_c", sourceContentId: "113" },
  { id: "c_15", stars: 5, supportsStance: "s_b", sourceContentId: "114" },
];

const brief: Pick<CaseBrief, "issues" | "clueCards"> = { issues, clueCards };

describe("scoreVerdict 结案算分", () => {
  it("押主流 + 双命中 → 满共识满分证据，无陈词 85 分 A 级", () => {
    const r = scoreVerdict(brief, [
      { issueId: "issue_1", stanceId: "s_a", citedClueIds: ["c_03", "c_07"] },
    ]);
    expect(r.issues[0].consensusScore).toBe(100);
    expect(r.issues[0].evidenceScore).toBe(100);
    expect(r.total).toBe(85);
    expect(r.grade).toBe("A");
  });

  it("陈词系数满格 → 封顶 15% 补齐，100 分 S 级", () => {
    const r = scoreVerdict(
      brief,
      [{ issueId: "issue_1", stanceId: "s_a", citedClueIds: ["c_03", "c_07"] }],
      1,
    );
    expect(r.total).toBe(100);
    expect(r.grade).toBe("S");
  });

  it("押 20% 少数派 → 共识分如实只有 44.4", () => {
    const r = scoreVerdict(brief, [
      { issueId: "issue_1", stanceId: "s_c", citedClueIds: ["c_11"] },
    ]);
    expect(r.issues[0].consensusScore).toBe(44.4);
  });

  it("指认不支持所押立场的卡 → 倒扣（5 命中 2 误指 → 57.1）", () => {
    const r = scoreVerdict(brief, [
      { issueId: "issue_1", stanceId: "s_a", citedClueIds: ["c_03", "c_11"] },
    ]);
    expect(r.issues[0].evidenceScore).toBe(57.1);
  });

  it("零证据提交 → 证据分 0", () => {
    const r = scoreVerdict(brief, [{ issueId: "issue_1", stanceId: "s_a", citedClueIds: [] }]);
    expect(r.issues[0].evidenceScore).toBe(0);
    expect(r.total).toBe(50); // 只有共识分，50 < 60 → C 级
    expect(r.grade).toBe("C");
  });

  it("独狼路线（不押立场）→ 共识与证据均 0，分数判你输", () => {
    const r = scoreVerdict(brief, [
      { issueId: "issue_1", customText: "他们都没说到点子上", citedClueIds: ["c_03"] },
    ]);
    expect(r.issues[0].chosenStanceId).toBeNull();
    expect(r.issues[0].consensusScore).toBe(0);
    expect(r.issues[0].evidenceScore).toBe(0);
    expect(r.total).toBe(0);
    expect(r.grade).toBe("C");
  });

  it("引用不存在的卡 id 按缺席处理，不抛错", () => {
    const r = scoreVerdict(brief, [
      { issueId: "issue_1", stanceId: "s_a", citedClueIds: ["ghost"] },
    ]);
    expect(r.issues[0].evidenceScore).toBe(0);
  });
});
