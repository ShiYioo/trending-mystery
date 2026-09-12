// OAuth 回调：GET /api/oauth/callback?authorization_code=...
// 协议以 authorization_code 为主路径、兼容 code（官方 Skill 2026-05-14 实测）。
// real 模式调 openapi.zhihu.com/access_token；mock 模式走本地模拟换令牌——回调代码零差别。
// 成功后 302 回首页（HttpOnly Cookie 只携带 sessionId），失败带错误参数回首页。

import {
  createSession,
  exchangeMockToken,
  exchangeToken,
  getOAuthConfig,
  getOAuthMode,
} from "@/lib/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
  const home = new URL("/", url.origin).toString();
  if (!code) {
    return Response.redirect(`${home}?oauth=fail&reason=missing_code`, 302);
  }
  try {
    const mode = getOAuthMode();
    const cfg = getOAuthConfig();
    const token =
      mode === "real" && cfg ? await exchangeToken(cfg, code) : exchangeMockToken(code);
    const { sessionId, maxAge } = createSession(token);
    const headers = new Headers({
      Location: `${home}?oauth=ok`,
      "Set-Cookie": `tm_oauth_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    });
    return new Response(null, { status: 302, headers });
  } catch (e) {
    const reason = encodeURIComponent(e instanceof Error ? e.message.slice(0, 120) : "exchange_failed");
    return Response.redirect(`${home}?oauth=fail&reason=${reason}`, 302);
  }
}
