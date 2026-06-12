"use client";

import { useState } from "react";
import type { DailyDigest } from "@/types";

function digestToMarkdown(digest: DailyDigest): string {
  const dateStr = new Date(digest.generatedAt).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const lines: string[] = [
    `# Everyday News · ${dateStr}`,
    "",
    `> **今日概览**`,
    `> ${digest.overview.replace(/\n/g, "\n> ")}`,
    "",
    `---`,
    "",
  ];

  for (const cat of digest.categories) {
    lines.push(`## ${cat.category}`, "");
    for (const bullet of cat.bullets) {
      lines.push(`### ${bullet.text}`, "");
      if (bullet.perspective) {
        lines.push(`**AI 视角：** ${bullet.perspective}`, "");
      }
      if (bullet.link) {
        lines.push(`[原文 · ${bullet.source}](${bullet.link})`, "");
      } else {
        lines.push(`来源：${bullet.source}`, "");
      }
      lines.push("---", "");
    }
  }

  lines.push(
    `*由 Everyday News 生成 · 共 ${digest.totalArticles} 篇文章 · ${new Date(digest.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}*`
  );

  return lines.join("\n");
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  digest: DailyDigest;
}

export default function ReportSaver({ digest }: Props) {
  const [copied, setCopied] = useState(false);

  const slug = digest.date.replace(/\//g, "-");

  function saveMarkdown() {
    download(digestToMarkdown(digest), `everyday-news-${slug}.md`, "text/markdown");
  }

  async function copyText() {
    await navigator.clipboard.writeText(digestToMarkdown(digest));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={saveMarkdown}
        title="保存为 Markdown 文件"
        className="inline-flex items-center gap-1.5 text-xs bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-400 rounded-lg px-3 py-1.5 transition-all duration-200 hover:shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        保存 .md
      </button>

      <button
        onClick={copyText}
        title="复制为 Markdown 文本"
        className="inline-flex items-center gap-1.5 text-xs bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-400 rounded-lg px-3 py-1.5 transition-all duration-200 hover:shadow-sm"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            已复制
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            复制文本
          </>
        )}
      </button>

      <button
        onClick={printReport}
        title="打印 / 保存为 PDF"
        className="inline-flex items-center gap-1.5 text-xs bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-400 rounded-lg px-3 py-1.5 transition-all duration-200 hover:shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        打印 / PDF
      </button>
    </div>
  );
}
