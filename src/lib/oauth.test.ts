import { describe, expect, it } from "vitest";
import { exchangeMockToken, getMockProfile, issueMockCode, MOCK_USERS } from "./oauth";

describe("模拟授权服务（知乎 OAuth 同领域模型）", () => {
  it("授权码 → 换令牌 → 令牌换资料，全链路角色齐备", () => {
    const code = issueMockCode(MOCK_USERS[0].key);
    const token = exchangeMockToken(code);
    expect(token.token_type).toBe("Bearer");
    expect(token.expires_in).toBeGreaterThan(0);
    const profile = getMockProfile(token.access_token);
    expect(profile?.name).toBe(MOCK_USERS[0].name);
    expect(profile?.headline).toBe(MOCK_USERS[0].headline);
  });

  it("授权码一次性：用后即焚，重放被拒", () => {
    const code = issueMockCode(MOCK_USERS[1].key);
    exchangeMockToken(code);
    expect(() => exchangeMockToken(code)).toThrow();
  });

  it("伪造授权码被拒；未知用户 key 落到匿名侦探", () => {
    expect(() => exchangeMockToken("mock_auth_forged0000000000000000")).toThrow();
    const token = exchangeMockToken(issueMockCode("nonexistent-key"));
    expect(getMockProfile(token.access_token)?.name).toBe("匿名侦探");
  });

  it("无效令牌换不到资料", () => {
    expect(getMockProfile("mock_token_nope")).toBeNull();
  });
});
