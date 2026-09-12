import { describe, expect, it } from "vitest";
import { extractJson, JsonParseError } from "./json";

describe("extractJson 容错解析", () => {
  it("直接解析纯 JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("提取 ```json fenced 块", () => {
    const raw = '好的，结果如下：\n```json\n{"stances":[{"id":"s_a"}]}\n```\n以上。';
    expect(extractJson<{ stances: unknown[] }>(raw).stances).toHaveLength(1);
  });

  it("提取散落在散文中的对象跨度", () => {
    const raw = '分析完成，结论是 {"ok":true,"n":2} 请查收。';
    expect(extractJson(raw)).toEqual({ ok: true, n: 2 });
  });

  it("对象与数组同时出现时优先先出现的括号类型", () => {
    const raw = '[1,2] 然后 {"a":1}';
    expect(extractJson<number[]>(raw)).toEqual([1, 2]);
  });

  it("彻底无 JSON 时抛 JsonParseError", () => {
    expect(() => extractJson("拒绝回答，无可奉告。")).toThrow(JsonParseError);
  });
});
