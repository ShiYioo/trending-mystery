import { describe, expect, it } from "vitest";
import { buildPersonaMessages } from "./prompts";
import type { ChatMessage } from "@/lib/types";

describe("buildPersonaMessages", () => {
  it("人设折进最后一条 user 消息，不使用 system 角色（直答端点不消费 system）", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "第一问" },
      { role: "assistant", content: "第一答" },
      { role: "user", content: "【出示证物】《某证物》\n第二问" },
    ];
    const messages = buildPersonaMessages("案情速览", "某问题是怎么回事？", ["证据甲的摘录"], history);

    expect(messages.some((m) => m.role === "system")).toBe(false);
    // 前史原样保留，只有最后一条被增强
    expect(messages[0]).toEqual(history[0]);
    expect(messages[1]).toEqual(history[1]);

    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain("刘看山"); // 身份设定在场
    expect(last.content).toContain("某问题是怎么回事？"); // 案件背景在场
    expect(last.content).toContain("证据甲的摘录"); // 出示证据在场
    expect(last.content).toContain("第二问"); // 玩家问话保留在末尾
  });

  it("空历史返回空数组（路由层保证非空后才调用）", () => {
    expect(buildPersonaMessages("案情", "标题", [], [])).toEqual([]);
  });
});
