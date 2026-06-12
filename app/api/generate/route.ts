import { NextResponse } from "next/server";
import { getConfig, saveDigest } from "@/lib/storage";
import { fetchAllNews } from "@/lib/fetcher";
import { generateDigest } from "@/lib/summarizer";
import type { DailyDigest } from "@/types";

export const maxDuration = 60; // Vercel Pro: 60s; Hobby: ignored but harmless

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[generate] 开始获取配置");
    const config = await getConfig();
    console.log("[generate] 来源数量:", config.sources.filter((s) => s.enabled).length);

    console.log("[generate] 开始抓取 RSS");
    const { articles, errors } = await fetchAllNews(config.sources);
    console.log("[generate] 抓取完成，文章数:", articles.length, "错误:", errors);

    if (articles.length === 0) {
      return NextResponse.json({ error: "所有来源抓取失败，请检查 RSS 地址", details: errors }, { status: 500 });
    }

    console.log("[generate] 开始调用 Claude");
    const { overview, categories } = await generateDigest(articles, config.ai);
    console.log("[generate] Claude 完成");

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
    console.log("[generate] 保存完成");

    return NextResponse.json({ success: true, date: digest.date, articleCount: articles.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] 失败:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
