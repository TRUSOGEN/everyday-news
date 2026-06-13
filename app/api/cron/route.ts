import { NextResponse } from "next/server";
import {
  getArticleContent,
  getConfig,
  getLatestDigest,
  getSeenArticleIds,
  markArticlesSeen,
  saveArticleContent,
  saveDigest,
} from "@/lib/storage";
import { fetchAllNews } from "@/lib/fetcher";
import { generateDigest } from "@/lib/summarizer";
import { articleIdsFromDigest, createArticleIdentity, filterFreshArticles } from "@/lib/articleIdentity";
import { attachContentToArticle, fetchArticleContent } from "@/lib/articleContent";
import type { DailyDigest } from "@/types";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig();
  const { articles, errors } = await fetchAllNews(config.sources);

  if (articles.length === 0) {
    return NextResponse.json({ error: "所有来源抓取失败", details: errors }, { status: 500 });
  }

  const latestDigest = await getLatestDigest();
  const seenIds = await getSeenArticleIds(articles.map(createArticleIdentity));
  for (const id of articleIdsFromDigest(latestDigest)) {
    seenIds.add(id);
  }
  const freshArticles = filterFreshArticles(articles, seenIds);

  if (freshArticles.length === 0) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "没有发现新文章，已跳过 Claude 总结",
      fetchedArticleCount: articles.length,
      articleCount: 0,
    });
  }

  const enrichedArticles = await Promise.all(freshArticles.map(async (article) => {
    const cached = await getArticleContent(article.id);
    if (cached) return attachContentToArticle(article, cached);

    const content = await fetchArticleContent(article);
    await saveArticleContent(content);
    return attachContentToArticle(article, content);
  }));

  const { overview, categories } = await generateDigest(enrichedArticles, config.ai);
  const now = new Date();

  const digest: DailyDigest = {
    date: now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-"),
    generatedAt: now.toISOString(),
    overview,
    categories,
    totalArticles: enrichedArticles.length,
    sources: [...new Set(enrichedArticles.map((a) => a.source))],
  };

  await saveDigest(digest);
  await markArticlesSeen(articles);
  return NextResponse.json({
    success: true,
    date: digest.date,
    articleCount: enrichedArticles.length,
    fetchedArticleCount: articles.length,
    contentArticleCount: enrichedArticles.filter((a) => a.contentStatus === "ok").length,
  });
}
