/**
 * 文章身份识别工具。
 *
 * 本模块把不同来源的新闻条目规范化为稳定 article id，并提供本地去重与
 * 新鲜度过滤函数。RSS、新闻 API、未来的正文爬虫都应复用这里的身份规则，
 * 避免同一篇文章因为 tracking query、feed 重复项或标题轻微变化被反复总结。
 */

import { createHash } from "node:crypto";
import type { DailyDigest, NewsArticle } from "@/types";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "spm",
]);

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hashIdentity(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

export function canonicalizeArticleUrl(link: string | undefined): string {
  if (!link) return "";

  try {
    const url = new URL(link);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    const sorted = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    for (const [key, value] of sorted) {
      url.searchParams.append(key, value);
    }

    return url.toString();
  } catch {
    return link.trim();
  }
}

export function createArticleIdentity(article: Pick<NewsArticle, "source" | "title" | "link" | "pubDate"> & {
  guid?: string;
  id?: string;
}): string {
  if (article.id) return article.id;

  const guid = normalizeText(article.guid);
  if (guid) return hashIdentity(`guid:${normalizeText(article.source)}:${guid}`);

  const canonicalUrl = canonicalizeArticleUrl(article.link);
  if (canonicalUrl) return hashIdentity(`url:${canonicalUrl}`);

  return hashIdentity([
    "fallback",
    normalizeText(article.source),
    normalizeText(article.title),
    normalizeText(article.pubDate),
  ].join("|"));
}

export function withArticleIdentity(article: Omit<NewsArticle, "id"> & { id?: string }): NewsArticle {
  const normalized = {
    ...article,
    link: canonicalizeArticleUrl(article.link),
  };
  return {
    ...normalized,
    id: createArticleIdentity(normalized),
  };
}

export function dedupeArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const deduped: NewsArticle[] = [];

  for (const article of articles) {
    const id = createArticleIdentity(article);
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push({ ...article, id });
  }

  return deduped;
}

export function filterFreshArticles(articles: NewsArticle[], seenIds: Set<string>): NewsArticle[] {
  return articles.filter((article) => !seenIds.has(createArticleIdentity(article)));
}

export function articleIdsFromDigest(digest: DailyDigest | null): Set<string> {
  const ids = new Set<string>();
  if (!digest) return ids;

  for (const category of digest.categories) {
    for (const bullet of category.bullets) {
      if (!bullet.link) continue;
      ids.add(createArticleIdentity({
        title: bullet.text,
        link: bullet.link,
        pubDate: digest.generatedAt,
        source: bullet.source,
      }));
    }
  }

  return ids;
}
