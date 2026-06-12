import Link from "next/link";
import { getLatestDigest } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<string, string> = {
  商业财经: "border-amber-400",
  科技: "border-blue-400",
  政治: "border-red-400",
  健康: "border-green-400",
  体育: "border-purple-400",
  科学: "border-cyan-400",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "border-stone-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ReportPage() {
  const digest = await getLatestDigest();

  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="bg-stone-900 text-stone-100 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Everyday News</h1>
          <p className="text-stone-400 text-xs mt-0.5">每日新闻要点 · AI 提炼</p>
        </div>
        <div className="text-right">
          {digest && (
            <p className="text-sm text-stone-300">{formatDate(digest.generatedAt)}</p>
          )}
          <Link
            href="/config"
            className="text-xs text-stone-500 hover:text-stone-300 transition-colors mt-0.5 inline-block"
          >
            ⚙ 配置工作流
          </Link>
        </div>
      </header>

      {/* Thin accent bar */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-blue-400 to-stone-400" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {!digest ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📰</div>
            <h2 className="text-xl font-semibold text-stone-600 mb-2">今日报告尚未生成</h2>
            <p className="text-stone-400 text-sm mb-6">每天北京时间 12:00 自动更新</p>
            <Link
              href="/config"
              className="inline-block bg-stone-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-stone-700 transition-colors"
            >
              前往配置页立即生成 →
            </Link>
          </div>
        ) : (
          <>
            {/* Overview */}
            <section className="mb-8 border-l-4 border-stone-900 pl-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
                今日概览
              </h2>
              <p className="text-stone-700 leading-relaxed text-[15px]">{digest.overview}</p>
              <p className="text-xs text-stone-400 mt-2">
                * 基于 {digest.totalArticles} 篇真实文章 · AI 不补充额外信息
              </p>
            </section>

            <hr className="border-stone-200 mb-8" />

            {/* Categories */}
            {digest.categories.map((cat) => (
              <section key={cat.category} className="mb-10">
                <h2
                  className={`border-l-4 ${categoryColor(cat.category)} pl-3 text-sm font-bold uppercase tracking-widest text-stone-500 mb-4`}
                >
                  {cat.category}
                </h2>
                <ul className="space-y-4">
                  {cat.bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-3 group">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-stone-800 leading-snug text-[15px]">{bullet.text}</p>
                        {bullet.link ? (
                          <a
                            href={bullet.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-stone-400 hover:text-blue-500 transition-colors mt-1 inline-block"
                          >
                            {bullet.source} ↗
                          </a>
                        ) : (
                          <span className="text-xs text-stone-400 mt-1 inline-block">
                            {bullet.source}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </main>

      {/* Footer */}
      {digest && (
        <footer className="border-t border-stone-200 mt-4">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-stone-400">
            <span>
              {digest.sources.join(" · ")} · 生成于 {formatTime(digest.generatedAt)}
            </span>
            <Link href="/config" className="hover:text-stone-600 transition-colors">
              ⚙ 修改配置
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
