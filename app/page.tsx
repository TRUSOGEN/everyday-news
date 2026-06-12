import Link from "next/link";
import { getLatestDigest } from "@/lib/storage";
import ReportSaver from "./components/ReportSaver";

export const dynamic = "force-dynamic";

const CATEGORY_ACCENT: Record<string, { border: string; badge: string; dot: string }> = {
  商业财经: { border: "border-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  科技:     { border: "border-blue-400",  badge: "bg-blue-50  text-blue-700  border-blue-200",  dot: "bg-blue-400"  },
  政治:     { border: "border-red-400",   badge: "bg-red-50   text-red-700   border-red-200",   dot: "bg-red-400"   },
  健康:     { border: "border-green-400", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-400" },
  体育:     { border: "border-purple-400",badge: "bg-purple-50 text-purple-700 border-purple-200",dot: "bg-purple-400"},
  科学:     { border: "border-cyan-400",  badge: "bg-cyan-50  text-cyan-700  border-cyan-200",  dot: "bg-cyan-400"  },
};

function getAccent(cat: string) {
  return CATEGORY_ACCENT[cat] ?? {
    border: "border-stone-400",
    badge:  "bg-stone-100 text-stone-600 border-stone-200",
    dot:    "bg-stone-400",
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
    weekday: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export default async function ReportPage() {
  const digest = await getLatestDigest();

  return (
    <div className="min-h-screen" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 text-stone-100">
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />

        <div className="relative max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="animate-fade-in">
              <h1
                className="text-4xl font-bold tracking-tight text-white leading-none"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                Everyday News
              </h1>
              <p className="text-stone-400 text-sm mt-2 tracking-wide">
                每日新闻要点 &middot; AI 提炼 &middot; 不添加原文之外的信息
              </p>
            </div>

            <div className="text-right shrink-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
              {digest && (
                <p className="text-stone-200 text-sm font-medium">{formatDate(digest.generatedAt)}</p>
              )}
              <Link
                href="/config"
                className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors mt-2 border border-stone-700 hover:border-stone-500 rounded-lg px-3 py-1.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                配置工作流
              </Link>
            </div>
          </div>

          {/* Save actions */}
          {digest && (
            <div className="mt-5 pt-5 border-t border-stone-800 animate-fade-in" style={{ animationDelay: "200ms" }}>
              <ReportSaver digest={digest} />
            </div>
          )}
        </div>

        {/* Accent gradient bar */}
        <div className="h-[3px] accent-gradient" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">

        {!digest ? (
          /* ── Empty state ── */
          <div className="text-center py-24 animate-fade-in-up">
            <div
              className="text-7xl mb-6 select-none"
              style={{ filter: "grayscale(0.3)" }}
            >📰</div>
            <h2
              className="text-2xl font-bold text-stone-700 mb-3"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              今日报告尚未生成
            </h2>
            <p className="text-stone-400 text-sm mb-8 leading-relaxed">
              每天北京时间 12:00 自动生成<br />
              或前往配置页手动触发生成
            </p>
            <Link
              href="/config"
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              前往配置页立即生成
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Overview ── */}
            <section
              className="mb-10 bg-white rounded-2xl border border-stone-100 shadow-sm p-7 animate-fade-in-up"
              style={{ animationDelay: "50ms" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">今日概览</span>
                <div className="flex-1 h-px bg-stone-100" />
                <span className="text-xs text-stone-300">
                  {digest.totalArticles} 篇文章 · {digest.sources.length} 个来源
                </span>
              </div>
              <p
                className="text-stone-700 leading-relaxed text-[16px]"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                {digest.overview}
              </p>
            </section>

            {/* ── Categories ── */}
            {digest.categories.map((cat, catIdx) => {
              const accent = getAccent(cat.category);
              return (
                <section
                  key={cat.category}
                  className="mb-12 animate-fade-in-up"
                  style={{ animationDelay: `${(catIdx + 1) * 80 + 50}ms` }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${accent.dot}`} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500">
                      {cat.category}
                    </h2>
                    <div className="flex-1 h-px bg-stone-100" />
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${accent.badge}`}>
                      {cat.bullets.length} 条
                    </span>
                  </div>

                  {/* News cards */}
                  <div className="space-y-4">
                    {cat.bullets.map((bullet, i) => (
                      <article
                        key={i}
                        className={`bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group animate-fade-in-up`}
                        style={{ animationDelay: `${(catIdx + 1) * 80 + i * 60 + 100}ms` }}
                      >
                        {/* Top accent line */}
                        <div className={`h-[3px] ${accent.border.replace("border-", "bg-")}`} />

                        <div className="p-6">
                          {/* Main text */}
                          <p className="text-stone-900 text-[15px] leading-relaxed font-medium">
                            {bullet.text}
                          </p>

                          {/* AI Perspective */}
                          {bullet.perspective && (
                            <div className="mt-4 pt-4 border-t border-stone-100">
                              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
                                AI 视角
                              </p>
                              <p className="text-stone-500 text-[13px] leading-relaxed italic">
                                {bullet.perspective}
                              </p>
                            </div>
                          )}

                          {/* Source + original link */}
                          <div className="mt-4 flex items-center gap-2">
                            {bullet.link ? (
                              <a
                                href={bullet.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs bg-stone-50 hover:bg-stone-900 border border-stone-200 hover:border-stone-900 text-stone-500 hover:text-white rounded-full px-3 py-1.5 transition-all duration-200 group/link"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                原文 · {bullet.source}
                                <svg className="w-2.5 h-2.5 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-full px-3 py-1.5">
                                {bullet.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      {digest && (
        <footer className="border-t border-stone-200 bg-white animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
            <p className="text-xs text-stone-400">
              {digest.sources.join(" · ")}
              <span className="mx-2 text-stone-200">·</span>
              生成于 {formatTime(digest.generatedAt)}
            </p>
            <Link
              href="/config"
              className="text-xs text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              修改配置
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
