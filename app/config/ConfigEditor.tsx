"use client";

import { useState } from "react";
import type { AppConfig, NewsSource } from "@/types";

type Step = "sources" | "ai" | "output";
type Status = "idle" | "saving" | "generating" | "done" | "error";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

interface NodeProps {
  step: number;
  icon: string;
  title: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}

function WorkflowNode({ step, icon, title, summary, active, onClick }: NodeProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
        active
          ? "border-stone-900 bg-stone-900 text-white shadow-lg"
          : "border-stone-200 bg-white hover:border-stone-400 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
            active ? "bg-white text-stone-900" : "bg-stone-900 text-white"
          }`}
        >
          {step}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`font-semibold text-sm ${active ? "text-white" : "text-stone-800"}`}>
        {title}
      </p>
      <p className={`text-xs mt-1 leading-snug ${active ? "text-stone-300" : "text-stone-400"}`}>
        {summary}
      </p>
    </button>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center w-8 flex-shrink-0 mt-6">
      <svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

interface Props {
  initialConfig: AppConfig;
  cronSecret: string;
}

export default function ConfigEditor({ initialConfig, cronSecret }: Props) {
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [activeStep, setActiveStep] = useState<Step>("sources");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const enabledCount = config.sources.filter((s) => s.enabled).length;

  // ── Source helpers ──────────────────────────────────────────
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
    const newSource: NewsSource = {
      id: genId(),
      name: "新来源",
      category: "其他",
      rssUrl: "",
      enabled: true,
    };
    setConfig((c) => ({ ...c, sources: [...c.sources, newSource] }));
  }

  // ── API calls ────────────────────────────────────────────────
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
      setMessage("正在抓取新闻并生成摘要，预计需要 30-60 秒…");

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

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      {/* Workflow nodes */}
      <div className="flex items-start gap-1 mb-6">
        <WorkflowNode
          step={1}
          icon="📡"
          title="新闻来源"
          summary={`${enabledCount} / ${config.sources.length} 个来源已启用`}
          active={activeStep === "sources"}
          onClick={() => setActiveStep("sources")}
        />
        <Arrow />
        <WorkflowNode
          step={2}
          icon="🤖"
          title="AI 摘要"
          summary="Claude Opus 4.7 · 要点格式"
          active={activeStep === "ai"}
          onClick={() => setActiveStep("ai")}
        />
        <Arrow />
        <WorkflowNode
          step={3}
          icon="📰"
          title="报告输出"
          summary="中文 · 每天 12:00 自动生成"
          active={activeStep === "output"}
          onClick={() => setActiveStep("output")}
        />
      </div>

      {/* Edit panel */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        {/* ── SOURCES ── */}
        {activeStep === "sources" && (
          <div>
            <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <span className="text-stone-400 text-sm">Step 1</span> 新闻来源配置
            </h3>

            <div className="space-y-3">
              {config.sources.map((source) => (
                <div
                  key={source.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    source.enabled ? "border-stone-200 bg-stone-50" : "border-stone-100 bg-stone-50 opacity-60"
                  }`}
                >
                  {/* Toggle + name row */}
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => toggleSource(source.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        source.enabled ? "bg-stone-900" : "bg-stone-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          source.enabled ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <input
                      value={source.name}
                      onChange={(e) => updateSource(source.id, "name", e.target.value)}
                      className="flex-1 font-medium text-sm bg-transparent outline-none border-b border-transparent hover:border-stone-300 focus:border-stone-500 py-0.5"
                    />
                    <input
                      value={source.category}
                      onChange={(e) => updateSource(source.id, "category", e.target.value)}
                      className="w-20 text-xs text-stone-500 bg-transparent outline-none border border-stone-200 rounded px-2 py-1 text-center hover:border-stone-300 focus:border-stone-500"
                      placeholder="分类"
                    />
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none ml-1"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                  {/* RSS URL row */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 flex-shrink-0">RSS</span>
                    <input
                      value={source.rssUrl}
                      onChange={(e) => updateSource(source.id, "rssUrl", e.target.value)}
                      placeholder="https://example.com/feed.xml"
                      className="flex-1 text-xs text-stone-500 bg-white border border-stone-200 rounded px-2 py-1.5 outline-none hover:border-stone-300 focus:border-stone-500 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addSource}
              className="mt-3 w-full border-2 border-dashed border-stone-200 rounded-lg py-2.5 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600 transition-colors"
            >
              + 添加新来源
            </button>
          </div>
        )}

        {/* ── AI SETTINGS ── */}
        {activeStep === "ai" && (
          <div>
            <h3 className="font-semibold text-stone-700 mb-4">
              <span className="text-stone-400 text-sm mr-2">Step 2</span>AI 摘要配置
            </h3>
            <div className="space-y-4">
              {[
                { label: "模型", value: "Claude Opus 4.7", note: "最高质量" },
                { label: "输出格式", value: "分类要点列表", note: "每条20-50字" },
                { label: "语言", value: "中文", note: "" },
                { label: "防幻觉", value: "已启用", note: "只基于真实抓取内容" },
              ].map(({ label, value, note }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-stone-100">
                  <span className="text-sm text-stone-500">{label}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-stone-800">{value}</span>
                    {note && <span className="text-xs text-stone-400 ml-2">{note}</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-4">AI 设置固定为最优配置，确保摘要质量。</p>
          </div>
        )}

        {/* ── OUTPUT SETTINGS ── */}
        {activeStep === "output" && (
          <div>
            <h3 className="font-semibold text-stone-700 mb-4">
              <span className="text-stone-400 text-sm mr-2">Step 3</span>报告输出配置
            </h3>
            <div className="space-y-4">
              {[
                { label: "自动生成时间", value: "每天 12:00（北京时间）" },
                { label: "报告页面", value: "/ （首页）" },
                { label: "数据保留", value: "最近 30 天" },
                { label: "调度方式", value: "Vercel Cron Job" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-stone-100">
                  <span className="text-sm text-stone-500">{label}</span>
                  <span className="text-sm font-medium text-stone-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            status === "error"
              ? "bg-red-50 text-red-600 border border-red-200"
              : status === "done"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-blue-50 text-blue-600 border border-blue-200"
          }`}
        >
          {status === "generating" && (
            <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          )}
          {message}
          {status === "done" && (
            <a href="/" className="ml-3 underline font-medium">
              查看报告 →
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={saveOnly}
          disabled={isWorking}
          className="flex-1 border-2 border-stone-900 text-stone-900 py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-100 transition-colors disabled:opacity-40"
        >
          保存配置
        </button>
        <button
          onClick={saveAndGenerate}
          disabled={isWorking}
          className="flex-1 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isWorking ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {status === "saving" ? "保存中…" : "生成中…"}
            </>
          ) : (
            "保存并立即生成 ▶"
          )}
        </button>
      </div>
    </div>
  );
}
