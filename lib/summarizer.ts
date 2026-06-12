import Anthropic from "@anthropic-ai/sdk";
import type { NewsArticle, CategoryDigest, BulletPoint } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `你是一个严格的新闻要点提炼助手。

## 绝对规则
1. 只能基于用户提供的文章标题和描述提炼要点
2. 不得添加任何原文中没有出现的信息、数据、人名或背景知识
3. 不得推断、预测或补充"常识性"内容
4. 如果原文信息有限，按实际情况呈现

## 输出格式
返回合法 JSON，结构如下：
{
  "overview": "2-3句话今日概览（只基于原文内容）",
  "categories": [
    {
      "category": "分类名",
      "bullets": [
        { "text": "一句话要点，20-50字，直接陈述事实", "source": "来源名", "articleIndex": 0 }
      ]
    }
  ]
}`;

interface RawResult {
  overview: string;
  categories: Array<{
    category: string;
    bullets: Array<{ text: string; source: string; articleIndex: number }>;
  }>;
}

export async function generateDigest(
  articles: NewsArticle[]
): Promise<{ overview: string; categories: CategoryDigest[] }> {
  const grouped = articles.reduce<Record<string, NewsArticle[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const inputText = Object.entries(grouped)
    .map(([cat, items]) => {
      const lines = items
        .map((a, i) => `[${i}] ${a.title}${a.description ? ` — ${a.description}` : ""} (${a.source})`)
        .join("\n");
      return `## ${cat}\n${lines}`;
    })
    .join("\n\n");

  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `今日真实抓取的新闻，请提炼要点并返回 JSON：\n\n${inputText}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.text ?? "{}";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude 未返回有效 JSON");

  const result: RawResult = JSON.parse(jsonMatch[0]);

  const categories: CategoryDigest[] = result.categories.map((cat) => ({
    category: cat.category,
    bullets: cat.bullets.map((b): BulletPoint => ({
      text: b.text,
      source: b.source,
      link: grouped[cat.category]?.[b.articleIndex]?.link ?? "",
    })),
  }));

  return { overview: result.overview, categories };
}
