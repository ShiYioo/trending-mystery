// 发起知乎 OAuth 登录：GET /api/oauth/authorize → 302 跳转知乎授权页。
// 凭证未配置时返回 503 与配置指引（app_id/app_key 需邮件向平台申请，见 README）。

import { authorizeUrl, getOAuthConfig } from "@/lib/oauth";

export async function GET() {
  const cfg = getOAuthConfig();
  if (!cfg) {
    return Response.json(
      {
        error: "oauth_not_configured",
        hint: "设置 ZHIHU_OAUTH_APP_ID / ZHIHU_OAUTH_APP_KEY / ZHIHU_OAUTH_REDIRECT_URI（回调须为已登记的公网 HTTPS 地址）",
      },
      { status: 503 },
    );
  }
  return Response.redirect(authorizeUrl(cfg), 302);
}
