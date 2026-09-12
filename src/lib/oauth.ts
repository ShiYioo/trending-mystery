// 知乎 OAuth（Authorization Code Flow，协议见官方 Skill references/oauth.md，整理 2026-07-22）：
//   GET  openapi.zhihu.com/authorize?redirect_uri&app_id&response_type=code
//   回调参数为 authorization_code（兼容 code）→ POST openapi.zhihu.com/access_token 换 token
// 已知协议缺口：回调不返 state——仅适合临时联调，正式上线需平台支持 state 后补请求关联校验。
// 边界：app_key 与 token 只在服务端；token 存进程内存会话，不入库、不进前端。

export interface OAuthConfig {
  appId: string;
  appKey: string;
  redirectUri: string;
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

/** 换 token：app_id/app_key 仅在此处使用，表单提交 */
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

export function readSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)tm_oauth_session=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}
