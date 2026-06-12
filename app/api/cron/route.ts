import { NextResponse } from "next/server";
import { getConfig, saveDigest } from "@/lib/storage";
import { fetchAllNews } from "@/lib/fetcher";
import { generateDigest } from "@/lib/summarizer";
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

  const { overview, categories } = await generateDigest(articles, config.ai);
  const now = new Date();

  const digest: DailyDigest = {
    date: now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-"),
    generatedAt: now.toISOString(),
    overview,
    categories,
    totalArticles: articles.length,
    sources: [...new Set(articles.map((a) => a.source))],
  };

  await saveDigest(digest);
  return NextResponse.json({ success: true, date: digest.date, articleCount: articles.length });
}
