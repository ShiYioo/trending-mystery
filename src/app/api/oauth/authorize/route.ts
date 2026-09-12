// 发起知乎 OAuth 登录：GET /api/oauth/authorize → 302 跳转授权页。
// real 模式跳 openapi.zhihu.com；mock 模式跳本地模拟授权页（同协议形状）。

import { authorizeUrl, getOAuthConfig, getOAuthMode } from "@/lib/oauth";

export async function GET(request: Request) {
  const mode = getOAuthMode();
  const cfg = getOAuthConfig();
  const fallbackCallback = new URL("/api/oauth/callback", new URL(request.url).origin).toString();

  if (mode === "real" && cfg) {
    return Response.redirect(authorizeUrl(cfg), 302);
  }
  if (mode === "real") {
    return Response.json(
      {
        error: "oauth_not_configured",
        hint: "ZHIHU_OAUTH_MODE=real 但缺少凭证——补全 ZHIHU_OAUTH_APP_ID / APP_KEY / REDIRECT_URI，或改用 mock 模式",
      },
      { status: 503 },
    );
  }
  const params = new URLSearchParams({
    redirect_uri: cfg?.redirectUri ?? fallbackCallback,
    app_id: "mock",
    response_type: "code",
  });
  return Response.redirect(`/api/mock-oauth/authorize?${params.toString()}`, 302);
}
