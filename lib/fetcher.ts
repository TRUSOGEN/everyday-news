import Parser from "rss-parser";
import type { NewsSource, NewsArticle } from "@/types";

const parser = new Parser({ timeout: 12000, headers: { "User-Agent": "EverydayNews/1.0" } });

async function fetchSource(source: NewsSource): Promise<NewsArticle[]> {
  const feed = await parser.parseURL(source.rssUrl);
  return (feed.items ?? []).slice(0, 12).map((item) => ({
    title: item.title?.trim() ?? "",
    link: item.link ?? "",
    description: item.contentSnippet?.trim() ?? item.summary?.trim() ?? "",
    pubDate: item.pubDate ?? new Date().toISOString(),
    source: source.name,
    category: source.category,
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
      errors.push(`${name}: ${String(r.reason)}`);
      console.error(`[fetcher] ${name} 失败:`, r.reason);
    }
  });

  return { articles, errors };
}
