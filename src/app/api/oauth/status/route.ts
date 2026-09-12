// OAuth 状态：GET /api/oauth/status —— 前端登录入口据此决定展示"绑定知乎身份"还是已登录态。

import { getOAuthConfig, getSessionToken, readSessionCookie } from "@/lib/oauth";

export async function GET(request: Request) {
  const cfg = getOAuthConfig();
  return Response.json({
    configured: !!cfg,
    authorizePath: "/api/oauth/authorize",
    callbackUrl: cfg?.redirectUri ?? null,
    loggedIn: !!getSessionToken(readSessionCookie(request)),
    warning: cfg
      ? "知乎回调暂不返回 state 参数，仅适合临时联调"
      : "未配置 OAuth 凭证——app_id/app_key 需向 product-platform@zhihu.com 申请，回调须公网 HTTPS",
  });
}
