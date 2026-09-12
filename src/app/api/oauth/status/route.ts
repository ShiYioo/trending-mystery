// OAuth 状态：GET /api/oauth/status —— 前端登录入口据此展示；mode 字段标明真实/模拟。

import { getOAuthConfig, getOAuthMode, getSessionToken, readSessionCookie } from "@/lib/oauth";

export async function GET(request: Request) {
  const mode = getOAuthMode();
  const cfg = getOAuthConfig();
  return Response.json({
    mode,
    configured: !!cfg,
    authorizePath: "/api/oauth/authorize",
    callbackUrl: cfg?.redirectUri ?? null,
    loggedIn: !!getSessionToken(readSessionCookie(request)),
    warning:
      mode === "mock"
        ? "当前为模拟授权（同协议领域模型的本地实现），配置真实凭证后自动切 real"
        : "知乎回调暂不返回 state 参数，仅适合临时联调",
  });
}
