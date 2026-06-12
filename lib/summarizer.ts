import Anthropic from "@anthropic-ai/sdk";
import type { NewsArticle, CategoryDigest, BulletPoint } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `你是一个严格的新闻要点提炼助手。

规则：
1. 只能基于用户提供的文章内容提炼要点，不得添加原文没有的信息
2. 不得推断、预测或补充"常识性"内容
3. 每条要点一句话，20-50字，直接陈述事实
4. 今日概览2-3句话，只基于原文内容

请调用 submit_digest 函数提交结果。`;

// Tool definition forces structured output — SDK handles JSON serialization
const SUBMIT_TOOL: Anthropic.Tool = {
  name: "submit_digest",
  description: "提交今日新闻摘要",
  input_schema: {
    type: "object" as const,
    properties: {
      overview: {
        type: "string",
        description: "今日概览，2-3句话，只基于原文内容",
      },
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", description: "分类名称" },
            bullets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "一句话要点" },
                  source: { type: "string", description: "来源名称" },
                  articleIndex: { type: "number", description: "对应文章在该分类中的索引" },
                },
                required: ["text", "source", "articleIndex"],
              },
            },
          },
          required: ["category", "bullets"],
        },
      },
    },
    required: ["overview", "categories"],
  },
};

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

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4000,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "tool", name: "submit_digest" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `以下是今日真实抓取的新闻，请提炼要点：\n\n${inputText}`,
      },
    ],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude 未返回结构化结果");

  const result = toolUse.input as RawResult;

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
