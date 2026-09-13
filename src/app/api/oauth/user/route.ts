// 用户资料：GET /api/oauth/user —— 当前会话的登录身份。
// real 模式按 quickstart 规格（核验 2026-09-13）：GET openapi.zhihu.com/user，
// 鉴权只需 Authorization: Bearer {用户 OAuth access_token}；响应顶层平铺 fullname/headline/avatar_path。
// 注意与 developer.zhihu.com 五个用户数据接口的双头方案（Bearer Access Secret + X-OAuth-Token）是两套面。
// 解析失败降级为通用身份并附诊断字段，不让登录白干。

import { getMockProfile, getOAuthMode, getSessionToken, readSessionCookie } from "@/lib/oauth";

export async function GET(request: Request) {
  const token = getSessionToken(readSessionCookie(request));
  if (!token) {
    return Response.json({ loggedIn: false }, { status: 401 });
  }
  if (getOAuthMode() === "mock") {
    const profile = getMockProfile(token);
    if (!profile) return Response.json({ loggedIn: false }, { status: 401 });
    return Response.json({ loggedIn: true, mode: "mock", profile });
  }

  let status: number | null = null;
  let body: Record<string, unknown> | null = null;
  try {
    const res = await fetch("https://openapi.zhihu.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    status = res.status;
    body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    // 网络异常也走降级
  }

  const fullname = body?.fullname;
  if (status === 200 && typeof fullname === "string" && fullname) {
    const headline = body?.headline;
    return Response.json({
      loggedIn: true,
      mode: "real",
      profile: {
        name: fullname,
        headline: typeof headline === "string" && headline ? headline : "知乎用户 · 今日值班侦探",
      },
    });
  }
  return Response.json({
    loggedIn: true,
    mode: "real",
    profile: { name: "知乎侦探", headline: "已授权 · 资料接口暂不可用" },
    // 非敏感诊断：/user 原始 HTTP 状态与业务码，定位鉴权/解析问题
    diag: { userApiStatus: status, userApiCode: body?.code ?? null },
  });
}
