import { Redis } from "@upstash/redis";
import type { AppConfig, DailyDigest } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";

const DIGEST_KEY = "digest:latest";
const CONFIG_KEY = "app:config";

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

export async function getConfig(): Promise<AppConfig> {
  const redis = getRedis();
  if (!redis) return DEFAULT_CONFIG;
  const stored = await redis.get<AppConfig>(CONFIG_KEY);
  return stored ?? DEFAULT_CONFIG;
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
