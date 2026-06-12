import Link from "next/link";
import { getDigestDates, getLatestDigest } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [dates, latest] = await Promise.all([getDigestDates(), getLatestDigest()]);

  // Deduplicate and mark today
  const todayDate = latest?.date;
  const uniqueDates = [...new Set(dates)];

  return (
    <div className="min-h-screen" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 text-stone-100">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold tracking-tight text-white leading-none"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
              历史回溯
            </h1>
            <p className="text-stone-400 text-sm mt-2">
              最近 30 天的每日新闻报告存档
            </p>
          </div>
          <div className="flex gap-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <Link href="/report"
              className="inline-flex items-center gap-1.5 text-sm text-stone-300 hover:text-white transition-colors border border-stone-700 hover:border-stone-400 px-4 py-2 rounded-xl">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              今日报告
            </Link>
            <Link href="/config"
              className="inline-flex items-center gap-1.5 text-sm text-stone-300 hover:text-white transition-colors border border-stone-700 hover:border-stone-400 px-4 py-2 rounded-xl">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              配置
            </Link>
          </div>
        </div>
        <div className="h-[3px] accent-gradient" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">

        {uniqueDates.length === 0 ? (
          <div className="text-center py-24 animate-fade-in-up">
            <div className="text-6xl mb-6">🗂️</div>
            <h2 className="text-xl font-bold text-stone-600 mb-3"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
              暂无历史记录
            </h2>
            <p className="text-stone-400 text-sm mb-8">
              生成第一篇报告后，历史记录将在这里显示
            </p>
            <Link href="/config"
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-all duration-200">
              立即生成报告
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in-up">
            <p className="text-xs text-stone-400 mb-6 uppercase tracking-widest font-bold">
              共 {uniqueDates.length} 份报告
            </p>
            {uniqueDates.map((date, i) => {
              const isToday = date === todayDate;
              const catCount = isToday && latest ? latest.categories.length : null;
              const articleCount = isToday && latest ? latest.totalArticles : null;

              return (
                <Link
                  key={date}
                  href={`/report?date=${date}`}
                  className="flex items-center justify-between bg-white border border-stone-100 rounded-2xl px-6 py-4 hover:border-stone-300 hover:shadow-md transition-all duration-200 group animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isToday ? "bg-green-400" : "bg-stone-300"}`} />
                    <div>
                      <p className="font-semibold text-stone-800 text-sm group-hover:text-stone-900">
                        {date}
                        {isToday && (
                          <span className="ml-2 text-[11px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                            最新
                          </span>
                        )}
                      </p>
                      {isToday && catCount !== null && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {catCount} 个分类 · {articleCount} 篇文章
                        </p>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-stone-300 group-hover:text-stone-600 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
