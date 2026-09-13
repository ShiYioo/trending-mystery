// 用户资料：GET /api/oauth/user —— 当前会话的登录身份。
// mock 模式返回模拟资料；real 模式双头鉴权调 openapi.zhihu.com/user
//（Authorization: Bearer Access Secret + X-OAuth-Token + 秒级时间戳），
// /user 无正式响应 schema——多字段名兜底解析，失败降级为通用身份，不让登录白干。

import { getZhihuAccessSecret } from "@/lib/env";
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

  try {
    const res = await fetch("https://openapi.zhihu.com/user", {
      headers: {
        Authorization: `Bearer ${getZhihuAccessSecret()}`,
        "X-OAuth-Token": token,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const source =
      ((body?.data ?? body?.Data ?? body?.user) as Record<string, unknown> | null) ?? null;
    const name = source?.name ?? source?.Fullname ?? source?.fullname;
    if (typeof name === "string" && name) {
      const headline = source?.headline ?? source?.Headline;
      return Response.json({
        loggedIn: true,
        mode: "real",
        profile: {
          name,
          headline: typeof headline === "string" ? headline : "知乎用户 · 今日值班侦探",
        },
      });
    }
  } catch {
    // /user 挂了不否定登录态——降级为通用身份
  }
  return Response.json({
    loggedIn: true,
    mode: "real",
    profile: { name: "知乎侦探", headline: "已授权 · 资料接口暂不可用" },
  });
}
