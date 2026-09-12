// Redis 数据层（唯一数据层）：配额计数 / 结果缓存 / 每日榜单。
// 纪律：键名生成只收敛在本文件，业务代码禁止手拼键（README §4.6）。
// 开发机与线上共用同一 REDIS_URL——同一本配额账，谁烧都记在这里。

import Redis from "ioredis";
import { getRedisUrl } from "./env";

// ===== 键构建 =====

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localHour = (d = new Date()) => `${localDate(d)}T${pad(d.getHours())}`;

export const quotaKey = (kind: "search" | "hotlist", day = localDate()) =>
  `quota:${kind}:${day}`;
export const hotlistCacheKey = (hour = localHour()) => `cache:hotlist:${hour}`;
export const searchCacheKey = (caseId: string, normalizedKeyword: string) =>
  `cache:search:${caseId}:${normalizedKeyword}`;
export const boardKey = (caseId: string) => `board:case:${caseId}`;

// ===== 客户端（懒连接，next build 期不建连） =====

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client || client.status === "end") {
    client = new Redis(getRedisUrl(), { maxRetriesPerRequest: 2 });
  }
  return client;
}

// ===== 配额计数器：INCR + 首次 EXPIRE 48h，按日自动翻篇 =====

export interface QuotaUsage {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function consumeQuota(
  kind: "search" | "hotlist",
  limit: number,
): Promise<QuotaUsage> {
  const key = quotaKey(kind);
  const redis = getRedis();
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, 48 * 3600);
  return { allowed: used <= limit, used, limit };
}

// ===== cache-aside：命中直出，未命中加载后回写（配额按关键词计费的落点） =====

export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const hit = await redis.get(key);
  if (hit != null) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}

// ===== 今日神探榜：ZADD 记分 / ZREVRANGE 出榜 =====

export async function recordScore(caseId: string, playerId: string, score: number): Promise<void> {
  await getRedis().zadd(boardKey(caseId), score, playerId);
}

export async function topDetectives(
  caseId: string,
  count = 10,
): Promise<Array<{ playerId: string; score: number }>> {
  const rows = await getRedis().zrevrange(boardKey(caseId), 0, count - 1, "WITHSCORES");
  const out: Array<{ playerId: string; score: number }> = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push({ playerId: rows[i], score: Number(rows[i + 1]) });
  }
  return out;
}
