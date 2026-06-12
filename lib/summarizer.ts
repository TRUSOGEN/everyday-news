import Anthropic from "@anthropic-ai/sdk";
import type { NewsArticle, CategoryDigest, BulletPoint, AiConfig } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUMMARY_LENGTH_GUIDE: Record<string, string> = {
  brief: "每条要点一句话，30-50字，简洁直接",
  standard: "每条要点1-2句话，80-120字，包含关键细节和数据",
  detailed: "每条要点2-3句话，130-180字，包含背景、数据、影响",
};

const OVERVIEW_GUIDE: Record<string, string> = {
  brief: "今日概览2-3句话",
  standard: "今日概览4-5句话，涵盖各分类重点",
  detailed: "今日概览5-7句话，全面分析当日重要事件及趋势",
};

function buildSystemPrompt(cfg: AiConfig): string {
  const lengthGuide = SUMMARY_LENGTH_GUIDE[cfg.summaryLength];
  const overviewGuide = OVERVIEW_GUIDE[cfg.summaryLength];
  const perspectiveGuide = cfg.showPerspective
    ? `5. 每条要点附 perspective 字段：1-2句（50-80字），对该新闻的意义、趋势或影响作出主观判断，语气专业自信`
    : '5. perspective 字段填写空字符串 ""';

  return `你是一位资深财经科技新闻编辑。

规则：
1. 只基于用户提供的文章内容提炼，不添加原文没有的信息
2. 不推断、预测或补充"常识性"内容
3. ${lengthGuide}
4. ${overviewGuide}，语言流畅，有全局视野
${perspectiveGuide}
6. 输出语言：中文

请调用 submit_digest 函数提交结果。`;
}

function buildTool(cfg: AiConfig): Anthropic.Tool {
  return {
    name: "submit_digest",
    description: "提交今日新闻摘要结果",
    input_schema: {
      type: "object" as const,
      properties: {
        overview: {
          type: "string",
          description: "今日概览，全面概括当日新闻重点",
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "分类名称" },
              bullets: {
                type: "array",
                description: `每个分类最多 ${cfg.maxBulletsPerCategory} 条`,
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "新闻要点正文" },
                    source: { type: "string", description: "来源名称" },
                    articleIndex: { type: "number", description: "该分类中文章的索引（从0开始）" },
                    perspective: { type: "string", description: "AI视角：对该新闻的专业分析" },
                  },
                  required: ["text", "source", "articleIndex", "perspective"],
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
}

interface RawResult {
  overview: string;
  categories: Array<{
    category: string;
    bullets: Array<{
      text: string;
      source: string;
      articleIndex: number;
      perspective: string;
    }>;
  }>;
}

export async function generateDigest(
  articles: NewsArticle[],
  aiConfig?: AiConfig
): Promise<{ overview: string; categories: CategoryDigest[] }> {
  const cfg = aiConfig ?? DEFAULT_CONFIG.ai;

  const grouped = articles.reduce<Record<string, NewsArticle[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const inputText = Object.entries(grouped)
    .map(([cat, items]) => {
      const lines = items
        .map(
          (a, i) =>
            `[${i}] ${a.title}${a.description ? ` — ${a.description}` : ""} (${a.source})`
        )
        .join("\n");
      return `## ${cat}\n${lines}`;
    })
    .join("\n\n");

  const systemPrompt = cfg.customSystemPrompt || buildSystemPrompt(cfg);
  const tool = buildTool(cfg);

  const message = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: 8000,
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_digest" },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `以下是今日真实抓取的新闻，请提炼要点：\n\n${inputText}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude 未返回结构化结果");

  const result = toolUse.input as RawResult;
  console.log("[summarizer] raw result keys:", Object.keys(result ?? {}));

  const rawCategories = Array.isArray(result?.categories) ? result.categories : [];

  const categories: CategoryDigest[] = rawCategories.map((cat) => {
    const rawBullets = Array.isArray(cat?.bullets) ? cat.bullets : [];
    return {
      category: cat?.category ?? "其他",
      bullets: rawBullets
        .slice(0, cfg.maxBulletsPerCategory)
        .map((b): BulletPoint => ({
          text: b.text ?? "",
          source: b.source ?? "",
          link: grouped[cat.category]?.[b.articleIndex]?.link ?? "",
          perspective: b.perspective || undefined,
        })),
    };
  });

  return { overview: result?.overview ?? "", categories };
}
