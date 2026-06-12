import { Redis } from "@upstash/redis";
import type { AppConfig, DailyDigest } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";

const DIGEST_KEY = "digest:latest";
const CONFIG_KEY = "app:config";

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
  // Deep-merge so old configs without ai/schedule fields still work
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
}

export async function getLatestDigest(): Promise<DailyDigest | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<DailyDigest>(DIGEST_KEY);
}
