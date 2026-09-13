// Redis 数据层（唯一数据层）：结果缓存 / 案件底表 / 每日榜单。
// 纪律：键名生成只收敛在本文件，业务代码禁止手拼键（README §4.6）。
// 开发机与线上共用同一 REDIS_URL——同一份缓存与榜单。
// 不做自管配额计数：知乎侧限频（30001）直接透传为 zhihu_rate_limited 报错，便于及时更换密钥。
// REDIS_URL 未配置时降级为进程内存储（仅限本地开发：缓存重启即清），并告警一次。

import Redis from "ioredis";
import { getRedisUrl } from "./env";

// ===== 键构建 =====

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localHour = (d = new Date()) => `${localDate(d)}T${pad(d.getHours())}`;

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

// ===== cache-aside：命中直出，未命中加载后回写（加载失败不落缓存，真实错误向上透传） =====

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
  const key = boardKey(caseId);
  const redis = getRedis();
  // GT：只在更高时更新——重玩同案拿低分不会把榜上最高分刷掉（与内存降级版 Math.max 语义一致）
  await redis.zadd(key, "GT", score, playerId);
  // 首次写入挂 7 天 TTL：与全系统按日自清理一致，覆盖次日回看，M3 历史战绩留余量
  if ((await redis.ttl(key)) === -1) {
    await redis.expire(key, 7 * 24 * 3600);
  }
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
