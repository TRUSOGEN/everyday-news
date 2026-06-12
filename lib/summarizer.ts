import Anthropic from "@anthropic-ai/sdk";
import type { NewsArticle, CategoryDigest, BulletPoint, AiConfig } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUMMARY_LENGTH_GUIDE: Record<string, string> = {
  brief:    "每条要点一句话，30-50字，简洁直接",
  standard: "每条要点1-2句话，80-120字，包含关键细节和数据",
  detailed: "每条要点2-3句话，130-180字，包含背景、数据、影响",
};

const OVERVIEW_GUIDE: Record<string, string> = {
  brief:    "今日概览2-3句话",
  standard: "今日概览3-4句话，涵盖各分类重点",
  detailed: "今日概览5-6句话，全面分析当日重要事件及趋势",
};

function buildSystemPrompt(cfg: AiConfig): string {
  const lengthGuide = SUMMARY_LENGTH_GUIDE[cfg.summaryLength] ?? SUMMARY_LENGTH_GUIDE.standard;
  const overviewGuide = OVERVIEW_GUIDE[cfg.summaryLength] ?? OVERVIEW_GUIDE.standard;
  const perspectiveGuide = cfg.showPerspective
    ? `5. 每条要点的 perspective 字段：1-2句（50-80字），对该新闻的意义或影响作出主观判断`
    : '5. perspective 字段填写空字符串 ""';

  return `你是一位资深财经科技新闻编辑。

规则：
1. 只基于用户提供的文章内容提炼，不添加原文没有的信息
2. ${lengthGuide}
3. ${overviewGuide}，语言流畅，有全局视野
4. 必须为每篇文章生成一条 bullet，articleIndex 使用原始列表中的数字索引
${perspectiveGuide}
6. categories 字段必须是 JSON 数组（不是对象），每个元素含 category 和 bullets

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
          description: "分类数组，每个分类含 category 名称和 bullets 列表",
          items: {
            type: "object",
            properties: {
              category: { type: "string", description: "分类名称，与输入中的分类一致" },
              bullets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text:         { type: "string", description: "新闻要点正文" },
                    source:       { type: "string", description: "来源名称" },
                    articleIndex: { type: "number", description: "该分类中文章的索引（从0开始）" },
                    perspective:  { type: "string", description: "AI视角分析" },
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
}

/** Tolerates the model returning an object instead of an array */
function toArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val && typeof val === "object") return Object.values(val) as T[];
  return [];
}

interface RawBullet {
  text?: string;
  source?: string;
  articleIndex?: number;
  perspective?: string;
}

interface RawCategory {
  category?: string;
  bullets?: unknown;
}

interface RawResult {
  overview?: string;
  categories?: unknown;
}

export async function generateDigest(
  articles: NewsArticle[],
  aiConfig?: AiConfig
): Promise<{ overview: string; categories: CategoryDigest[] }> {
  const cfg = aiConfig ?? DEFAULT_CONFIG.ai;

  // Group by category; preserve insertion order
  const grouped: Record<string, NewsArticle[]> = {};
  for (const a of articles) {
    (grouped[a.category] ??= []).push(a);
  }

  const inputText = Object.entries(grouped)
    .map(([cat, items]) => {
      const lines = items
        .map((a, i) => `[${i}] ${a.title}${a.description ? ` — ${a.description}` : ""} (${a.source})`)
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
    messages: [{ role: "user", content: `以下是今日真实抓取的新闻，请提炼要点：\n\n${inputText}` }],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude 未返回结构化结果");

  const result = toolUse.input as RawResult;
  console.log("[summarizer] overview length:", result?.overview?.length ?? 0,
              "categories type:", typeof result?.categories,
              "is array:", Array.isArray(result?.categories));

  // Build a case-insensitive lookup for grouped articles
  const groupedLower: Record<string, NewsArticle[]> = {};
  for (const [k, v] of Object.entries(grouped)) {
    groupedLower[k.toLowerCase()] = v;
  }

  const rawCategories = toArray<RawCategory>(result?.categories);

  const categories: CategoryDigest[] = rawCategories.map((cat) => {
    const catName = cat?.category ?? "其他";
    // Match category name case-insensitively
    const catArticles =
      grouped[catName] ??
      groupedLower[catName.toLowerCase()] ??
      [];

    const rawBullets = toArray<RawBullet>(cat?.bullets);
    const bullets: BulletPoint[] = rawBullets
      .slice(0, cfg.maxBulletsPerCategory)
      .map((b): BulletPoint => {
        const idx = typeof b.articleIndex === "number" ? b.articleIndex : 0;
        return {
          text:        b.text ?? "",
          source:      b.source ?? "",
          link:        catArticles[idx]?.link ?? "",
          perspective: b.perspective || undefined,
        };
      });

    return { category: catName, bullets };
  });

  return { overview: result?.overview ?? "", categories };
}
