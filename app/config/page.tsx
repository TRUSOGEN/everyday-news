import Link from "next/link";
import { getConfig } from "@/lib/storage";
import { dailyGenerateToken } from "@/lib/auth";
import ConfigEditor from "./ConfigEditor";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const config = await getConfig();
  const genToken = dailyGenerateToken();

  return (
    <div className="min-h-screen" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 text-stone-100">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="animate-fade-in">
            <h1
              className="text-3xl font-bold tracking-tight text-white leading-none"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              工作流配置
            </h1>
            <p className="text-stone-400 text-sm mt-2">
              Everyday News · 新闻来源 &amp; AI 生成设置
            </p>
          </div>
          <Link
            href="/report"
            className="animate-fade-in inline-flex items-center gap-2 text-sm text-stone-300 hover:text-white transition-colors border border-stone-700 hover:border-stone-400 px-4 py-2 rounded-xl"
            style={{ animationDelay: "100ms" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            今日报告
          </Link>
        </div>
        <div className="h-[3px] accent-gradient" />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <ConfigEditor initialConfig={config} genToken={genToken} />
      </main>
    </div>
  );
}
