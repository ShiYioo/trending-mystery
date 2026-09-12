// OAuth 回调：GET /api/oauth/callback?authorization_code=...
// 协议以 authorization_code 为主路径、兼容 code（官方 Skill 2026-05-14 实测）。
// 换取的 token 存进程内存会话，HttpOnly Cookie 只携带 sessionId。

import { createSession, exchangeToken, getOAuthConfig } from "@/lib/oauth";

export async function GET(request: Request) {
  const cfg = getOAuthConfig();
  if (!cfg) {
    return Response.json({ error: "oauth_not_configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing_authorization_code" }, { status: 400 });
  }
  try {
    const token = await exchangeToken(cfg, code);
    const { sessionId, maxAge } = createSession(token);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Set-Cookie": `tm_oauth_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
    });
    return new Response(
      JSON.stringify({
        status: "ok",
        tokenType: token.token_type,
        expiresIn: token.expires_in,
        warning: "知乎回调暂不返回 state 参数，本流程仅适合临时联调，不是生产级安全",
      }),
      { headers },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "token_exchange_failed", hint: message }, { status: 502 });
  }
}
