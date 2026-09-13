// OAuth 回调：GET /api/oauth/callback?authorization_code=...
// 协议以 authorization_code 为主路径、兼容 code（官方 Skill 2026-05-14 实测）。
// real 模式调 openapi.zhihu.com/access_token；mock 模式走本地模拟换令牌——回调代码零差别。
// 授权在新标签页进行：这里渲染结果页种下 HttpOnly Cookie（只带 sessionId），
// 游戏窗口在原地轮询身份自动亮牌，不再跳转回首页打断游戏。

import {
  createSession,
  exchangeMockToken,
  exchangeToken,
  consumeOAuthState,
  getOAuthConfig,
  getOAuthMode,
} from "@/lib/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("authorization_code") ?? url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return new Response(resultPage(false, "回调缺少授权码（authorization_code）"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  if (state && !consumeOAuthState(state)) {
    return new Response(resultPage(false, "授权状态无效或已过期，请重新发起登录"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  try {
    const mode = getOAuthMode();
    const cfg = getOAuthConfig();
    const token =
      mode === "real" && cfg ? await exchangeToken(cfg, code) : exchangeMockToken(code);
    const { sessionId, maxAge } = createSession(token);
    return new Response(
      resultPage(true, undefined, mode === "mock" ? "（本地模拟授权）" : undefined),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Set-Cookie": `tm_oauth_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
        },
      },
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 200) : "exchange_failed";
    return new Response(resultPage(false, reason), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

/** 授权结果落地页：与 TM-01 同色系，成功页尝试自动关闭标签页 */
function resultPage(ok: boolean, reason?: string, note?: string): string {
  const title = ok ? "授权成功" : "授权失败";
  const body = ok
    ? `<p class="ok">✔ ${title}${note ?? ""}</p><p>回到原来的游戏窗口即可，身份牌约 3 秒内自动亮起。本页可关闭。</p>`
    : `<p class="fail">✘ ${title}</p><p class="reason">${reason ?? ""}</p><a href="/">回到首页重试 →</a>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>${title} · 热搜疑云</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070b0d;color:#e8e2d0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.card{width:min(420px,92vw);border:1px solid #d4a24e55;padding:32px;text-align:center;line-height:1.9}
.ok{color:#8fe4d2;font-size:20px;margin:0 0 10px}.fail{color:#e05e5e;font-size:20px;margin:0 0 10px}
.reason{color:#9a9484;font-size:13px;word-break:break-all}a{color:#d4a24e;text-decoration:none}</style></head>
<body><div class="card">${body}</div>${ok ? "<script>window.close()</script>" : ""}</body></html>`;
}
