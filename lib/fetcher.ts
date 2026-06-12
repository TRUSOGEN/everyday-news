import Parser from "rss-parser";
import type { NewsSource, NewsArticle } from "@/types";

const parser = new Parser({ timeout: 8000, headers: { "User-Agent": "EverydayNews/1.0" } });

// RSS descriptions can be entire article bodies — cap them so the AI input
// stays small enough to summarize within the time budget
function clip(text: string, max = 200): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchSource(source: NewsSource): Promise<NewsArticle[]> {
  if (!isValidUrl(source.rssUrl)) {
    throw new Error(`无效 RSS URL: "${source.rssUrl}"`);
  }
  const feed = await parser.parseURL(source.rssUrl);
  return (feed.items ?? []).slice(0, 12).map((item) => ({
    title:       item.title?.trim() ?? "",
    link:        item.link ?? "",
    description: clip(item.contentSnippet?.trim() ?? item.summary?.trim() ?? ""),
    pubDate:     item.pubDate ?? new Date().toISOString(),
    source:      source.name,
    category:    source.category,
  }));
}

export async function fetchAllNews(
  sources: NewsSource[]
): Promise<{ articles: NewsArticle[]; errors: string[] }> {
  const enabled = sources.filter((s) => s.enabled);
  const results = await Promise.allSettled(enabled.map(fetchSource));

  const articles: NewsArticle[] = [];
  const errors: string[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      const name = enabled[i]?.name ?? "unknown";
      const reason = String(r.reason);
      errors.push(`${name}: ${reason}`);
      console.error(`[fetcher] ${name} 失败:`, r.reason);
    }
  });

  return { articles, errors };
}
