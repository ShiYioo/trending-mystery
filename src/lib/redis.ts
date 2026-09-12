// Redis 数据层（唯一数据层）：配额计数 / 结果缓存 / 案件底表 / 每日榜单。
// 纪律：键名生成只收敛在本文件，业务代码禁止手拼键（README §4.6）。
// 开发机与线上共用同一 REDIS_URL——同一本配额账，谁烧都记在这里。
// REDIS_URL 未配置时降级为进程内存储（仅限本地开发：配额账不跨进程、重启即清），并告警一次。

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
export const caseKey = (caseId: string) => `case:${caseId}`;
export const boardKey = (caseId: string) => `board:case:${caseId}`;

// ===== 存储适配：Redis（有 REDIS_URL）或进程内（本地开发降级） =====

const memory = new Map<string, { v: string; exp?: number }>();
let warnedFallback = false;

const usingRedis = () => !!process.env.REDIS_URL;

function fallbackWarn(): void {
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      "[redis] REDIS_URL 未配置——降级为进程内存储：配额账不共享、缓存重启即清，仅限本地开发",
    );
  }
}

async function kvGet(key: string): Promise<string | null> {
  if (!usingRedis()) {
    fallbackWarn();
    const hit = memory.get(key);
    if (!hit) return null;
    if (hit.exp && hit.exp < Date.now()) {
      memory.delete(key);
      return null;
    }
    return hit.v;
  }
  return getRedis().get(key);
}

async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!usingRedis()) {
    fallbackWarn();
    memory.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
    return;
  }
  await getRedis().set(key, value, "EX", ttlSeconds);
}

async function kvIncr(key: string): Promise<number> {
  if (!usingRedis()) {
    fallbackWarn();
    const next = Number(memory.get(key)?.v ?? 0) + 1;
    memory.set(key, { v: String(next) });
    return next;
  }
  return getRedis().incr(key);
}

async function kvExpire(key: string, ttlSeconds: number): Promise<void> {
  if (!usingRedis()) {
    const hit = memory.get(key);
    if (hit && !hit.exp) memory.set(key, { ...hit, exp: Date.now() + ttlSeconds * 1000 });
    return;
  }
  await getRedis().expire(key, ttlSeconds);
}

let client: Redis | null = null;

/** 仅在配置了 REDIS_URL 时可调用；进程内降级路径不会触达这里 */
export function getRedis(): Redis {
  if (!client || client.status === "end") {
    client = new Redis(getRedisUrl(), { maxRetriesPerRequest: 2 });
  }
  return client;
}

// ===== 通用读写（JSON 序列化） =====

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const hit = await kvGet(key);
  if (hit == null) return null;
  try {
    return JSON.parse(hit) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await kvSet(key, JSON.stringify(value), ttlSeconds);
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
  const used = await kvIncr(key);
  if (used === 1) await kvExpire(key, 48 * 3600);
  return { allowed: used <= limit, used, limit };
}

// ===== cache-aside：命中直出，未命中加载后回写（配额按关键词计费的落点） =====

export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await kvGetJson<T>(key);
  if (hit != null) return hit;
  const value = await load();
  await kvSetJson(key, value, ttlSeconds);
  return value;
}

// ===== 今日神探榜：ZADD 记分 / ZREVRANGE 出榜（降级时为内存版，重启即清） =====

const boardMem = new Map<string, Map<string, number>>();

export async function recordScore(caseId: string, playerId: string, score: number): Promise<void> {
  if (!usingRedis()) {
    fallbackWarn();
    const board = boardMem.get(caseId) ?? new Map();
    board.set(playerId, Math.max(score, board.get(playerId) ?? 0));
    boardMem.set(caseId, board);
    return;
  }
  await getRedis().zadd(boardKey(caseId), score, playerId);
}

export async function topDetectives(
  caseId: string,
  count = 10,
): Promise<Array<{ playerId: string; score: number }>> {
  if (!usingRedis()) {
    fallbackWarn();
    return [...(boardMem.get(caseId) ?? new Map<string, number>())]
      .map(([playerId, score]) => ({ playerId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }
  const rows = await getRedis().zrevrange(boardKey(caseId), 0, count - 1, "WITHSCORES");
  const out: Array<{ playerId: string; score: number }> = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push({ playerId: rows[i], score: Number(rows[i + 1]) });
  }
  return out;
}
