import { getConfig, saveDigest } from "@/lib/storage";
import { fetchAllNews } from "@/lib/fetcher";
import { generateDigest } from "@/lib/summarizer";
import type { DailyDigest } from "@/types";

export const maxDuration = 60;

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: unknown) {
        controller.enqueue(enc.encode(sse(data)));
      }

      try {
        // ── Step 1: config ───────────────────────────────────────────────
        emit({ type: "step", text: "正在读取配置…" });
        const config = await getConfig();
        const enabledCount = config.sources.filter((s) => s.enabled).length;
        emit({ type: "step", text: `配置加载完成，启用来源 ${enabledCount} 个` });

        // ── Step 2: fetch RSS ─────────────────────────────────────────────
        emit({ type: "step", text: "正在抓取 RSS 订阅…" });
        const { articles, errors } = await fetchAllNews(config.sources);

        for (const err of errors) {
          emit({ type: "step", text: `⚠ ${err}`, isWarning: true });
        }

        if (articles.length === 0) {
          emit({ type: "error", message: "所有来源抓取失败，请检查 RSS 地址" });
          controller.close();
          return;
        }

        emit({ type: "step", text: `共抓取 ${articles.length} 篇文章，准备 AI 分析…` });

        // ── Step 3: AI summarize (streaming) ──────────────────────────────
        const { overview, categories } = await generateDigest(
          articles,
          config.ai,
          (event) => emit(event),
        );

        emit({ type: "step", text: `AI 分析完成，共生成 ${categories.length} 个分类` });

        // ── Step 4: save ─────────────────────────────────────────────────
        emit({ type: "step", text: "正在保存报告…" });
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

        emit({ type: "done", articleCount: articles.length, date: digest.date });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 4).join(" | ") : "";
        console.error("[generate] 失败:", message, "| stack:", stack);
        emit({ type: "error", message });
      } finally {
        controller.close();
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
