import { Redis } from "@upstash/redis";
import type { AppConfig, DailyDigest, NewsArticle } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";
import { createArticleIdentity } from "@/lib/articleIdentity";

const DIGEST_KEY = "digest:latest";
const CONFIG_KEY = "app:config";
const DATES_KEY = "digest:dates";
const SEEN_ARTICLES_KEY = "articles:seen";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (!url || !token) return null;
  try {
    new URL(url);
    return new Redis({ url, token });
  } catch {
    console.error("[storage] Redis URL 格式无效:", url);
    return null;
  }
}

export async function getConfig(): Promise<AppConfig> {
  const redis = getRedis();
  if (!redis) return DEFAULT_CONFIG;
  const stored = await redis.get<Partial<AppConfig>>(CONFIG_KEY);
  if (!stored) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    ai: { ...DEFAULT_CONFIG.ai, ...(stored.ai ?? {}) },
    schedule: { ...DEFAULT_CONFIG.schedule, ...(stored.schedule ?? {}) },
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis 未配置");
  await redis.set(CONFIG_KEY, config);
}

export async function saveDigest(digest: DailyDigest): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis 未配置");
  await redis.set(DIGEST_KEY, digest);
  await redis.set(`digest:${digest.date}`, digest, { ex: 60 * 60 * 24 * 30 });
  // Maintain a deduplicated newest-first list of up to 30 dates
  await redis.lrem(DATES_KEY, 0, digest.date);
  await redis.lpush(DATES_KEY, digest.date);
  await redis.ltrim(DATES_KEY, 0, 29);
}

export async function getSeenArticleIds(ids: string[]): Promise<Set<string>> {
  const redis = getRedis();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!redis || uniqueIds.length === 0) return new Set();

  const checks = await Promise.all(uniqueIds.map((id) => redis.sismember(SEEN_ARTICLES_KEY, id)));
  return new Set(uniqueIds.filter((id, index) => Boolean(checks[index])));
}

export async function markArticlesSeen(articles: NewsArticle[]): Promise<void> {
  const redis = getRedis();
  const ids = [...new Set(articles.map(createArticleIdentity).filter(Boolean))];
  if (!redis || ids.length === 0) return;
  const [firstId, ...restIds] = ids;
  await redis.sadd(SEEN_ARTICLES_KEY, firstId, ...restIds);
}

export async function getLatestDigest(): Promise<DailyDigest | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<DailyDigest>(DIGEST_KEY);
}

export async function getDigestByDate(date: string): Promise<DailyDigest | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<DailyDigest>(`digest:${date}`);
}

export async function getDigestDates(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const dates = await redis.lrange(DATES_KEY, 0, 29);
  return (dates as string[]).filter(Boolean);
}
