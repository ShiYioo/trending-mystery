// 结案分享（POST /api/share）：把结案战报发布成知乎想法，进黑客松指定圈子。
// dryRun=true 只返回战报文案（无需登录，供未登录玩家复制后手动发布）。
// 发布鉴权：会话里的 OAuth token；签名密钥 ZHIHU_APP_SECRET（与 Access Secret / OAuth App Key 三码分离）。
// 平台限频 5 条/小时——服务端按会话同步限流；mock 模式模拟成功，凭证到位零改动。

import { getPinRingId, getZhihuAppSecret } from "@/lib/env";
import { getOAuthMode, getSessionToken, readSessionCookie } from "@/lib/oauth";
import { caseKey, kvGetJson } from "@/lib/redis";
import { publishPin } from "@/lib/zhihu";
import type { CaseBrief } from "@/lib/types";

const HOURLY_LIMIT = 5;
const GRADES = new Set(["S", "A", "B", "C"]);
const attempts = new Map<string, number[]>();

interface ShareRequest {
  caseId?: string;
  total?: number;
  grade?: string;
  /** 书记官金句（玩家挑的一句，服务端截断净化） */
  quote?: string;
  /** 只取战报文案不发布（未登录也可用：复制走人工发布） */
  dryRun?: boolean;
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= HOURLY_LIMIT) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

/** 战报文案：服务端组装——案件事实来自底表，玩家数据仅收数字/评级/金句并净化 */
function buildContent(brief: CaseBrief, total: number, grade: string, quote: string): string {
  const topStances = brief.issues
    .map(
      (issue) =>
        `${issue.title}：${[...issue.stances]
          .sort((a, b) => b.clusterWeight - a.clusterWeight)
          .slice(0, 2)
          .map((s) => `${s.label} ${Math.round(s.clusterWeight * 1000) / 10}%`)
          .join(" / ")}`,
    )
    .join("\n");
  const lines = [
    `【热搜疑云 · 结案战报】${brief.questionTitle}`,
    `侦探评级 ${grade} 级 · 总分 ${total}/100`,
    quote ? `书记官点评：${quote}` : "",
    `社区风向：\n${topStances}`,
    `原题：${brief.questionUrl}`,
    "—— 今日热榜即案卷，刘看山在审问室等你。#热搜疑云",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  let body: ShareRequest;
  try {
    body = (await request.json()) as ShareRequest;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.caseId) {
    return Response.json({ error: "caseId_required" }, { status: 400 });
  }

  const brief = await kvGetJson<CaseBrief>(caseKey(body.caseId));
  if (!brief) {
    return Response.json({ error: "case_not_found", hint: "案件已过期，重新领案后再分享" }, { status: 404 });
  }

  const total = Math.min(100, Math.max(0, Math.round(Number(body.total) || 0)));
  const grade = GRADES.has(String(body.grade)) ? String(body.grade) : "C";
  const quote = String(body.quote ?? "")
    .replace(/[\r\n]/g, " ")
    .slice(0, 60);

  // 只取文案不发布：无需登录、不计限流——复制后玩家可去原题或圈子手动发布
  if (body.dryRun) {
    return Response.json({ dryRun: true, content: buildContent(brief, total, grade, quote) });
  }

  const token = getSessionToken(readSessionCookie(request));
  if (!token) {
    return Response.json({ error: "login_required", hint: "先在顶栏绑定知乎身份" }, { status: 401 });
  }

  if (rateLimited(token)) {
    return Response.json(
      { error: "rate_limited", hint: `分享限频：每小时最多 ${HOURLY_LIMIT} 条` },
      { status: 429 },
    );
  }

  const ringId = getPinRingId();
  const content = buildContent(brief, total, grade, quote);

  // mock 模式（本地演示）：模拟成功，前端体验与真实发布一致
  if (getOAuthMode() === "mock") {
    return Response.json({
      mock: true,
      ringId,
      contentToken: `mock_pin_${crypto.randomUUID().slice(0, 8)}`,
      content,
    });
  }

  const appSecret = getZhihuAppSecret();
  if (!appSecret) {
    return Response.json(
      { error: "app_secret_missing", hint: "ZHIHU_APP_SECRET 未配置（社区开放能力的应用密钥）" },
      { status: 503 },
    );
  }

  try {
    const { contentToken } = await publishPin({
      userToken: token,
      appSecret,
      title: `热搜疑云结案 · ${brief.questionTitle.slice(0, 30)}`,
      content,
      ringId,
    });
    return Response.json({ ringId, contentToken, content });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "publish_failed", hint: message }, { status: 502 });
  }
}
