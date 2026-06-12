"use client";

import { useState } from "react";
import type { AppConfig, AiConfig, NewsSource, ModelId, SummaryLength, ReportFormat, ReportLanguage } from "@/types";

type Tab = "sources" | "ai" | "schedule" | "advanced";
type Status = "idle" | "saving" | "generating" | "done" | "error";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Model options ────────────────────────────────────────────────────────────

const MODELS: { id: ModelId; name: string; desc: string; speed: string; quality: string }[] = [
  {
    id: "claude-haiku-4-5",
    name: "Haiku 4.5",
    desc: "最快，适合频繁生成",
    speed: "⚡ 极快",
    quality: "★★★",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Sonnet 4.6",
    desc: "速度与质量的均衡",
    speed: "🚀 较快",
    quality: "★★★★",
  },
  {
    id: "claude-opus-4-8",
    name: "Opus 4.8",
    desc: "最高质量，分析最深入",
    speed: "🔍 较慢",
    quality: "★★★★★",
  },
];

// ── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 ${
        checked ? "bg-stone-900" : "bg-stone-200"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
        active
          ? "bg-stone-900 text-white shadow-sm"
          : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">{children}</p>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialConfig: AppConfig;
  cronSecret: string;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ConfigEditor({ initialConfig, cronSecret }: Props) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<Tab>("sources");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const enabledCount = config.sources.filter((s) => s.enabled).length;

  // ── AI config shorthand ──────────────────────────────────────────────────
  function setAi(patch: Partial<AiConfig>) {
    setConfig((c) => ({ ...c, ai: { ...c.ai, ...patch } }));
  }

  // ── Source helpers ───────────────────────────────────────────────────────
  function toggleSource(id: string) {
    setConfig((c) => ({
      ...c,
      sources: c.sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  }

  function updateSource(id: string, field: keyof NewsSource, value: string) {
    setConfig((c) => ({
      ...c,
      sources: c.sources.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  }

  function deleteSource(id: string) {
    setConfig((c) => ({ ...c, sources: c.sources.filter((s) => s.id !== id) }));
  }

  function addSource() {
    setConfig((c) => ({
      ...c,
      sources: [
        ...c.sources,
        { id: genId(), name: "新来源", category: "其他", rssUrl: "", enabled: true },
      ],
    }));
  }

  // ── API calls ────────────────────────────────────────────────────────────
  async function saveOnly() {
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("done");
      setMessage("配置已保存");
    } catch (e) {
      setStatus("error");
      setMessage(`保存失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function saveAndGenerate() {
    setStatus("saving");
    setMessage("正在保存配置…");
    try {
      const saveRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!saveRes.ok) throw new Error(await saveRes.text());

      setStatus("generating");
      setMessage("正在抓取新闻并生成摘要，预计需要 30–60 秒…");

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await genRes.json();
      if (!genRes.ok) throw new Error(data.error ?? "生成失败");

      setStatus("done");
      setMessage(`生成成功！共处理 ${data.articleCount} 篇文章`);
    } catch (e) {
      setStatus("error");
      setMessage(`失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const isWorking = status === "saving" || status === "generating";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1.5 mb-6 p-1.5 bg-stone-100 rounded-xl">
        <TabBtn
          active={activeTab === "sources"}
          onClick={() => setActiveTab("sources")}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          }
          label={`新闻来源 ${enabledCount > 0 ? `(${enabledCount})` : ""}`}
        />
        <TabBtn
          active={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          }
          label="AI 模型"
        />
        <TabBtn
          active={activeTab === "schedule"}
          onClick={() => setActiveTab("schedule")}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="计划任务"
        />
        <TabBtn
          active={activeTab === "advanced"}
          onClick={() => setActiveTab("advanced")}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          }
          label="高级设置"
        />
      </div>

      {/* Panel */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">

        {/* ── SOURCES ────────────────────────────────────────────────── */}
        {activeTab === "sources" && (
          <div className="p-6">
            <SectionLabel>新闻来源配置</SectionLabel>
            <p className="text-xs text-stone-400 mb-5">
              支持任何标准 RSS/Atom feed。启用的来源会在每次生成时被抓取。
            </p>

            <div className="space-y-3">
              {config.sources.map((source) => (
                <div
                  key={source.id}
                  className={`rounded-xl border p-4 transition-all duration-200 ${
                    source.enabled
                      ? "border-stone-200 bg-stone-50"
                      : "border-stone-100 bg-stone-50/50 opacity-55"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Toggle checked={source.enabled} onChange={() => toggleSource(source.id)} />
                    <input
                      value={source.name}
                      onChange={(e) => updateSource(source.id, "name", e.target.value)}
                      className="flex-1 font-semibold text-sm bg-transparent outline-none border-b border-transparent hover:border-stone-300 focus:border-stone-600 py-0.5 transition-colors"
                      placeholder="来源名称"
                    />
                    <input
                      value={source.category}
                      onChange={(e) => updateSource(source.id, "category", e.target.value)}
                      className="w-20 text-xs text-stone-500 bg-white outline-none border border-stone-200 rounded-lg px-2 py-1 text-center hover:border-stone-300 focus:border-stone-600 transition-colors"
                      placeholder="分类"
                    />
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="text-stone-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
                      title="删除"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-stone-400 flex-shrink-0">RSS</span>
                    <input
                      value={source.rssUrl}
                      onChange={(e) => updateSource(source.id, "rssUrl", e.target.value)}
                      placeholder="https://example.com/feed.xml"
                      className="flex-1 text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-1.5 outline-none hover:border-stone-300 focus:border-stone-600 font-mono transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addSource}
              className="mt-4 w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-xl py-3 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加新来源
            </button>
          </div>
        )}

        {/* ── AI SETTINGS ────────────────────────────────────────────── */}
        {activeTab === "ai" && (
          <div className="p-6 space-y-7">

            {/* Model selection */}
            <div>
              <SectionLabel>AI 模型</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODELS.map((m) => {
                  const active = config.ai.model === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setAi({ model: m.id as ModelId })}
                      className={`rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-sm ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white shadow-md"
                          : "border-stone-200 hover:border-stone-400 bg-white"
                      }`}
                    >
                      <p className={`font-bold text-sm mb-1 ${active ? "text-white" : "text-stone-800"}`}>
                        {m.name}
                      </p>
                      <p className={`text-xs leading-snug mb-2 ${active ? "text-stone-300" : "text-stone-400"}`}>
                        {m.desc}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] ${active ? "text-stone-400" : "text-stone-400"}`}>
                          {m.speed}
                        </span>
                        <span className={`text-[11px] ${active ? "text-amber-300" : "text-amber-500"}`}>
                          {m.quality}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary length */}
            <div>
              <SectionLabel>摘要详细程度</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "brief",    label: "简洁",   desc: "30-50字/条" },
                    { id: "standard", label: "标准",   desc: "80-120字/条" },
                    { id: "detailed", label: "详细",   desc: "130-180字/条" },
                  ] as const
                ).map(({ id, label, desc }) => {
                  const active = config.ai.summaryLength === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAi({ summaryLength: id as SummaryLength })}
                      className={`rounded-xl border-2 py-3 px-4 text-center transition-all duration-200 ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 hover:border-stone-400 bg-white text-stone-700"
                      }`}
                    >
                      <p className="font-semibold text-sm">{label}</p>
                      <p className={`text-[11px] mt-0.5 ${active ? "text-stone-400" : "text-stone-400"}`}>
                        {desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Report format */}
            <div>
              <SectionLabel>报告格式</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "bullets",   label: "要点列表", desc: "分类条目" },
                    { id: "executive", label: "执行摘要", desc: "简洁概述" },
                    { id: "paragraphs",label: "段落叙述", desc: "连续文段" },
                  ] as const
                ).map(({ id, label, desc }) => {
                  const active = config.ai.format === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAi({ format: id as ReportFormat })}
                      className={`rounded-xl border-2 py-3 px-4 text-center transition-all duration-200 ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 hover:border-stone-400 bg-white text-stone-700"
                      }`}
                    >
                      <p className="font-semibold text-sm">{label}</p>
                      <p className={`text-[11px] mt-0.5 ${active ? "text-stone-400" : "text-stone-400"}`}>
                        {desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language */}
            <div>
              <SectionLabel>输出语言</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "zh",        label: "中文" },
                    { id: "en",        label: "English" },
                    { id: "bilingual", label: "中英双语" },
                  ] as const
                ).map(({ id, label }) => {
                  const active = config.ai.language === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAi({ language: id as ReportLanguage })}
                      className={`rounded-xl border-2 py-3 text-center text-sm font-semibold transition-all duration-200 ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 hover:border-stone-400 bg-white text-stone-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Max bullets per category */}
            <div>
              <SectionLabel>每分类最多条数</SectionLabel>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={config.ai.maxBulletsPerCategory}
                  onChange={(e) => setAi({ maxBulletsPerCategory: Number(e.target.value) })}
                  className="flex-1 accent-stone-900 h-2 rounded-full cursor-pointer"
                />
                <span className="w-10 text-center font-bold text-stone-900 bg-stone-100 rounded-lg py-1 text-sm">
                  {config.ai.maxBulletsPerCategory}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-2">
                每个分类最多生成 {config.ai.maxBulletsPerCategory} 条要点
              </p>
            </div>

            {/* Show perspective */}
            <div className="flex items-center justify-between py-3 border-t border-stone-100">
              <div>
                <p className="text-sm font-semibold text-stone-700">显示 AI 视角</p>
                <p className="text-xs text-stone-400 mt-0.5">每条新闻附带 AI 的专业分析与判断</p>
              </div>
              <Toggle
                checked={config.ai.showPerspective}
                onChange={(v) => setAi({ showPerspective: v })}
              />
            </div>
          </div>
        )}

        {/* ── SCHEDULE ───────────────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="p-6 space-y-6">
            <SectionLabel>计划任务设置</SectionLabel>

            <div>
              <p className="text-sm font-semibold text-stone-700 mb-3">
                每日自动生成时间（北京时间）
              </p>
              <div className="flex items-center gap-4">
                <select
                  value={config.schedule.hour}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, schedule: { ...c.schedule, hour: Number(e.target.value) } }))
                  }
                  className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-800 bg-white outline-none focus:border-stone-600 hover:border-stone-400 transition-colors cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00{h === 0 ? " 午夜" : h === 6 ? " 早晨" : h === 12 ? " 正午" : h === 18 ? " 傍晚" : ""}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-stone-500">北京时间</div>
              </div>
              <p className="text-xs text-stone-400 mt-3 leading-relaxed">
                注意：Vercel Cron 的实际触发时间由 <code className="bg-stone-100 px-1 rounded">vercel.json</code> 控制。
                此处设置仅作为记录偏好，修改实际调度需在 Vercel 后台更新 Cron 表达式。
              </p>
            </div>

            <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">当前调度状态</p>
              {[
                { label: "Vercel Cron 表达式", value: "0 4 * * * (UTC)" },
                { label: "等效北京时间", value: "每天 12:00" },
                { label: "触发 endpoint", value: "/api/cron" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-stone-500">{label}</span>
                  <span className="font-mono text-xs bg-white border border-stone-200 rounded px-2 py-0.5 text-stone-700">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADVANCED ───────────────────────────────────────────────── */}
        {activeTab === "advanced" && (
          <div className="p-6 space-y-6">
            <SectionLabel>高级设置</SectionLabel>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-stone-700">自定义 System Prompt</p>
                {config.ai.customSystemPrompt && (
                  <button
                    onClick={() => setAi({ customSystemPrompt: "" })}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                  >
                    清除，恢复默认
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                填写后将完全替换默认的 AI 指令。留空则使用默认 prompt（推荐）。
              </p>
              <textarea
                value={config.ai.customSystemPrompt ?? ""}
                onChange={(e) => setAi({ customSystemPrompt: e.target.value })}
                placeholder="留空使用默认 prompt。填写后会覆盖摘要长度、格式等所有设置…"
                rows={10}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 font-mono bg-stone-50 outline-none focus:border-stone-600 focus:bg-white hover:border-stone-300 transition-colors resize-y"
              />
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">提示</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                自定义 Prompt 需以"请调用 submit_digest 函数提交结果"结尾，
                否则 AI 可能不返回结构化数据导致生成失败。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`mb-5 px-5 py-4 rounded-xl text-sm flex items-start gap-3 animate-fade-in ${
            status === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : status === "done"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {status === "generating" && (
            <span className="mt-0.5 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {status === "done" && (
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "error" && (
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="flex-1">
            {message}
            {status === "done" && (
              <a href="/" className="ml-3 underline font-semibold hover:no-underline">
                查看报告 →
              </a>
            )}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={saveOnly}
          disabled={isWorking}
          className="flex-1 border-2 border-stone-200 text-stone-700 py-3 rounded-xl text-sm font-semibold hover:border-stone-400 hover:text-stone-900 transition-all duration-200 disabled:opacity-40 hover:bg-stone-50"
        >
          保存配置
        </button>
        <button
          onClick={saveAndGenerate}
          disabled={isWorking}
          className="flex-[2] bg-stone-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2 hover:shadow-lg"
        >
          {isWorking ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {status === "saving" ? "保存中…" : "正在生成报告…"}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              保存并立即生成
            </>
          )}
        </button>
      </div>
    </div>
  );
}
