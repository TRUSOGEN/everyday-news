import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Everyday News",
  description: "每日新闻要点，由 AI 提炼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
