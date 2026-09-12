// 模拟知乎授权页（GET 渲染 / POST 确认授权）：
// 与真实协议同形状——确认后签发 authorization_code，302 回 redirect_uri?authorization_code=...
// 页面明确标注"模拟授权页"，避免与真实知乎登录混淆。

import { issueMockCode, MOCK_USERS } from "@/lib/oauth";

function authorizePage(redirectUri: string): string {
  const users = MOCK_USERS.map(
    (u, i) => `
    <label class="user${i === 0 ? " checked" : ""}">
      <input type="radio" name="user" value="${u.key}" ${i === 0 ? "checked" : ""} />
      <span class="avatar">${u.name[0]}</span>
      <span class="meta"><strong>${u.name}</strong><small>${u.headline}</small></span>
    </label>`,
  ).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>知乎 · 授权</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f6f6f6; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:#121212; }
  .card { width:min(400px,92vw); background:#fff; border-radius:8px; padding:32px;
          box-shadow:0 4px 20px rgba(0,0,0,.08); }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand .z { width:36px;height:36px;border-radius:6px;background:#056de8;color:#fff;
              display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px; }
  .brand small { color:#999; }
  h1 { font-size:18px; margin:22px 0 6px; }
  .scope { color:#666; font-size:13px; line-height:1.7; }
  .user { display:flex; align-items:center; gap:12px; padding:10px 12px; margin-top:10px;
          border:1px solid #eee; border-radius:6px; cursor:pointer; }
  .user:hover { border-color:#056de8; }
  .user.checked, .user:has(input:checked) { border-color:#056de8; background:#f0f6ff; }
  .user input { display:none; }
  .avatar { width:36px;height:36px;border-radius:50%;background:#056de8;color:#fff;
            display:flex;align-items:center;justify-content:center; }
  .meta { display:flex; flex-direction:column; }
  .meta small { color:#999; }
  button { width:100%; margin-top:22px; padding:11px; border:0; border-radius:6px;
           background:#056de8; color:#fff; font-size:15px; cursor:pointer; }
  button:hover { background:#0457c0; }
  .ribbon { margin-top:14px; text-align:center; font-size:11px; color:#c00; }
  form { margin:0; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="z">知</span><div>知乎<br/><small>模拟授权服务</small></div></div>
    <h1>「热搜疑云」请求获得你的授权</h1>
    <p class="scope">授权后，应用将获得你的公开昵称与简介，用于结案报告与今日神探榜留名。</p>
    <form method="post" action="/api/mock-oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${redirectUri.replace(/"/g, "&quot;")}" />
      ${users}
      <button type="submit">同意并授权</button>
    </form>
    <p class="ribbon">⚠ 模拟授权页（开发联调用，非真实知乎登录）</p>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri =
    url.searchParams.get("redirect_uri") ?? new URL("/api/oauth/callback", url.origin).toString();
  return new Response(authorizePage(redirectUri), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const userKey = String(form.get("user") ?? "");
  const user = MOCK_USERS.find((u) => u.key === userKey);
  if (!redirectUri || !user) {
    return new Response("missing redirect_uri or unknown user", { status: 400 });
  }
  const code = issueMockCode(user.key);
  const sep = redirectUri.includes("?") ? "&" : "?";
  return Response.redirect(`${redirectUri}${sep}authorization_code=${code}`, 302);
}
