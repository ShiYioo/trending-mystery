// 用户资料：GET /api/oauth/user —— 当前会话的登录身份。
// mock 模式返回模拟资料；real 模式的用户数据接口待真实凭证联调（X-OAuth-Token + Bearer 双头）。

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
  // real 模式：用户数据 API 需 X-OAuth-Token + Access Secret 双头调用，凭证就绪后在此接入
  return Response.json(
    { loggedIn: true, mode: "real", profile: null, hint: "真实用户资料接口待凭证联调" },
    { status: 200 },
  );
}
