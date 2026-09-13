// 登出：POST /api/oauth/logout —— 服务端会话作废 + Cookie 过期。

import { dropSession, readSessionCookie } from "@/lib/oauth";

export async function POST(request: Request) {
  dropSession(readSessionCookie(request));
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "tm_oauth_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}
