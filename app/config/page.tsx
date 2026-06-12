import Link from "next/link";
import { getConfig } from "@/lib/storage";
import ConfigEditor from "./ConfigEditor";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const config = await getConfig();
  const cronSecret = process.env.CRON_SECRET ?? "";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-stone-900 text-stone-100 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">工作流配置</h1>
          <p className="text-stone-400 text-xs mt-0.5">Everyday News · 新闻来源 & 生成设置</p>
        </div>
        <Link
          href="/"
          className="text-sm text-stone-300 hover:text-white transition-colors border border-stone-600 px-3 py-1.5 rounded-lg"
        >
          查看今日报告 →
        </Link>
      </header>

      <div className="h-1 bg-gradient-to-r from-amber-400 via-blue-400 to-stone-400" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Workflow description */}
        <p className="text-sm text-stone-500 mb-6">
          点击每个节点查看和编辑配置，完成后点击"保存并立即生成"即可。
        </p>

        <ConfigEditor initialConfig={config} cronSecret={cronSecret} />
      </main>
    </div>
  );
}
