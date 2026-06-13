import { getConfig, getLatestDigest, getSeenArticleIds, markArticlesSeen, saveDigest } from "@/lib/storage";
import { fetchAllNews } from "@/lib/fetcher";
import { generateDigest } from "@/lib/summarizer";
import { isValidGenerateToken } from "@/lib/auth";
import { articleIdsFromDigest, createArticleIdentity, filterFreshArticles } from "@/lib/articleIdentity";
import type { DailyDigest } from "@/types";

export const maxDuration = 90;

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "");
  // Accept the raw secret (server-to-server) or the daily page token (browser)
  if (token !== process.env.CRON_SECRET && !isValidGenerateToken(token)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function emit(data: unknown) {
        if (closed) return;
        controller.enqueue(enc.encode(sse(data)));
      }
      function close() {
        if (closed) return;
        closed = true;
        controller.close();
      }

      try {
        // ── Step 1: config ───────────────────────────────────────────────
        emit({ type: "progress", value: 3 });
        emit({ type: "step", text: "正在读取配置…" });
        const config = await getConfig();
        const enabledCount = config.sources.filter((s) => s.enabled).length;
        emit({ type: "progress", value: 8 });
        emit({ type: "step", text: `配置加载完成，启用来源 ${enabledCount} 个` });

        // ── Step 2: fetch RSS ─────────────────────────────────────────────
        emit({ type: "step", text: "正在抓取 RSS 订阅…" });
        const { articles, errors } = await fetchAllNews(config.sources);

        for (const err of errors) {
          emit({ type: "step", text: `⚠ ${err}`, isWarning: true });
        }

        if (articles.length === 0) {
          emit({ type: "error", message: "所有来源抓取失败，请检查 RSS 地址" });
          close();
          return;
        }

        const latestDigest = await getLatestDigest();
        const seenIds = await getSeenArticleIds(articles.map(createArticleIdentity));
        for (const id of articleIdsFromDigest(latestDigest)) {
          seenIds.add(id);
        }
        const freshArticles = filterFreshArticles(articles, seenIds);

        emit({ type: "progress", value: 25 });
        emit({
          type: "step",
          text: `共抓取 ${articles.length} 篇去重文章，其中 ${freshArticles.length} 篇为新文章`,
        });
        emit({
          type: "articles",
          items: freshArticles.slice(0, 40).map((a) => ({
            title: a.title, link: a.link, source: a.source,
          })),
        });

        if (freshArticles.length === 0) {
          emit({ type: "progress", value: 100 });
          emit({ type: "step", text: "没有发现新文章，已跳过 Claude 总结以节省 API 余额" });
          emit({ type: "done", articleCount: 0, fetchedArticleCount: articles.length, skipped: true });
          return;
        }

        // ── Step 3: AI summarize (streaming) ──────────────────────────────
        emit({ type: "progress", value: 30 });
        const { overview, categories } = await generateDigest(
          freshArticles,
          config.ai,
          (event) => emit(event),
        );

        emit({ type: "progress", value: 92 });
        emit({ type: "step", text: `AI 分析完成，共生成 ${categories.length} 个分类` });

        // ── Step 4: save ─────────────────────────────────────────────────
        emit({ type: "step", text: "正在保存报告…" });
        const now = new Date();
        const digest: DailyDigest = {
          date: now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }).replace(/\//g, "-"),
          generatedAt: now.toISOString(),
          overview,
          categories,
          totalArticles: freshArticles.length,
          sources: [...new Set(freshArticles.map((a) => a.source))],
        };
        await saveDigest(digest);
        await markArticlesSeen(articles);

        emit({ type: "progress", value: 100 });
        emit({ type: "done", articleCount: freshArticles.length, fetchedArticleCount: articles.length, date: digest.date });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 4).join(" | ") : "";
        console.error("[generate] 失败:", message, "| stack:", stack);
        emit({ type: "error", message });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
