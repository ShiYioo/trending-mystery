// 知乎 OAuth（Authorization Code Flow，协议见官方 Skill references/oauth.md，整理 2026-07-22）：
//   GET  openapi.zhihu.com/authorize?redirect_uri&app_id&response_type=code
//   回调参数为 authorization_code（兼容 code）→ POST openapi.zhihu.com/access_token 换 token
// 已知协议缺口：回调不返 state——仅适合临时联调，正式上线需平台支持 state 后补请求关联校验。
// 边界：app_key 与 token 只在服务端；token 存进程内存会话，不入库、不进前端。
//
// 模拟模式（ZHIHU_OAUTH_MODE=mock 或未配置真实凭证时）：
// 同一领域模型的本地实现——授权页 / 授权码 / 换令牌 / 用户资料，端点形状与真实协议一一对应，
// 换真实凭证后切 real，前端与回调代码零改动。

export interface OAuthConfig {
  appId: string;
  appKey: string;
  redirectUri: string;
}

export interface OAuthProfile {
  name: string;
  headline: string;
}

const AUTHORIZE_URL = "https://openapi.zhihu.com/authorize";
const TOKEN_URL = "https://openapi.zhihu.com/access_token";

export function getOAuthConfig(): OAuthConfig | null {
  const appId = process.env.ZHIHU_OAUTH_APP_ID;
  const appKey = process.env.ZHIHU_OAUTH_APP_KEY;
  const redirectUri = process.env.ZHIHU_OAUTH_REDIRECT_URI;
  if (!appId || !appKey || !redirectUri) return null;
  return { appId, appKey, redirectUri };
}

/** real：走 openapi.zhihu.com；mock：本地模拟授权服务（显式 ZHIHU_OAUTH_MODE 优先，缺省按凭证自动判定） */
export type OAuthMode = "real" | "mock";

export function getOAuthMode(): OAuthMode {
  const explicit = process.env.ZHIHU_OAUTH_MODE;
  if (explicit === "real") return "real";
  if (explicit === "mock") return "mock";
  return getOAuthConfig() ? "real" : "mock";
}

export function authorizeUrl(cfg: OAuthConfig): string {
  const params = new URLSearchParams({
    redirect_uri: cfg.redirectUri,
    app_id: cfg.appId,
    response_type: "code",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** 真实模式换 token：app_id/app_key 仅在此处使用，表单提交 */
export async function exchangeToken(cfg: OAuthConfig, code: string): Promise<OAuthToken> {
  const params = new URLSearchParams({
    app_id: cfg.appId,
    app_key: cfg.appKey,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = (await res.json().catch(() => null)) as (OAuthToken & { error?: unknown }) | null;
  if (!res.ok || !body?.access_token) {
    throw new Error(`[oauth] token exchange failed: HTTP ${res.status}`);
  }
  return body;
}

// ===== 模拟授权服务（与真实协议同领域模型） =====

export const MOCK_USERS: Array<OAuthProfile & { key: string }> = [
  { key: "sherlock", name: "夏洛克·知乎", headline: "咨询侦探 · 贝克街 221B 分部" },
  { key: "poirot", name: "赫丘勒·知乎", headline: "退休警官 · 比利时裔 · 讲究秩序" },
  { key: "marple", name: "马普尔·知乎", headline: "乡村侦探 · 观人于微" },
  { key: "anon", name: "匿名侦探", headline: "不愿透露身份的线人" },
];

const MOCK_CODE_TTL_MS = 5 * 60 * 1000;
const MOCK_TOKEN_TTL_MS = 60 * 60 * 1000;

const mockCodes = new Map<string, { key: string; exp: number }>();
const mockTokens = new Map<string, { profile: OAuthProfile; exp: number }>();

const uuid = () => crypto.randomUUID().replace(/-/g, "");

/** 模拟授权页"同意授权"后签发一次性 authorization_code（5 分钟有效，用后即焚）；只接受 ASCII 用户 key，杜绝编码事故 */
export function issueMockCode(userKey: string): string {
  const code = `mock_auth_${uuid()}`;
  mockCodes.set(code, { key: userKey, exp: Date.now() + MOCK_CODE_TTL_MS });
  return code;
}

/** 模拟 /access_token：校验授权码，签发 Bearer 令牌 */
export function exchangeMockToken(code: string): OAuthToken {
  const entry = mockCodes.get(code);
  if (!entry || entry.exp < Date.now()) {
    throw new Error("[oauth:mock] 授权码无效或已过期");
  }
  mockCodes.delete(code);
  const accessToken = `mock_token_${uuid()}`;
  const profile =
    MOCK_USERS.find((u) => u.key === entry.key) ?? { name: "匿名侦探", headline: "知乎用户" };
  mockTokens.set(accessToken, { profile, exp: Date.now() + MOCK_TOKEN_TTL_MS });
  return { access_token: accessToken, token_type: "Bearer", expires_in: MOCK_TOKEN_TTL_MS / 1000 };
}

/** 模拟用户数据接口：令牌 → 资料 */
export function getMockProfile(token: string): OAuthProfile | null {
  const entry = mockTokens.get(token);
  if (!entry || entry.exp < Date.now()) {
    mockTokens.delete(token);
    return null;
  }
  return entry.profile;
}

// ===== 会话：token 只存进程内存（重启即失效，黑客松临时联调可接受） =====

const sessions = new Map<string, { token: string; exp: number }>();

export function createSession(token: OAuthToken): { sessionId: string; maxAge: number } {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { token: token.access_token, exp: Date.now() + token.expires_in * 1000 });
  return { sessionId, maxAge: token.expires_in };
}

export function getSessionToken(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (s.exp < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return s.token;
}

/** 登出：服务端会话即刻作废（token 本体不落地，无需撤销） */
export function dropSession(sessionId: string | null | undefined): void {
  if (sessionId) sessions.delete(sessionId);
}

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)tm_oauth_session=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}
