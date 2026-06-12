import Anthropic from "@anthropic-ai/sdk";
import type { NewsArticle, CategoryDigest, BulletPoint, AiConfig } from "@/types";
import { DEFAULT_CONFIG } from "@/config/defaults";

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

const LANGUAGE_GUIDE: Record<string, string> = {
  zh:        "全部使用简体中文输出",
  en:        "Write all output in English",
  bilingual: "每条要点先写中文，再附一句英文简译",
};

const FORMAT_GUIDE: Record<string, string> = {
  bullets:    "要点式表达，信息密度高，直接陈述事实",
  executive:  "执行摘要风格：开门见山，突出对决策有用的信息",
  paragraphs: "叙述性语句，行文连贯自然",
};

function buildSystemPrompt(cfg: AiConfig): string {
  const lengthGuide = SUMMARY_LENGTH_GUIDE[cfg.summaryLength] ?? SUMMARY_LENGTH_GUIDE.standard;
  const overviewGuide = OVERVIEW_GUIDE[cfg.summaryLength] ?? OVERVIEW_GUIDE.standard;
  const perspectiveGuide = cfg.showPerspective
    ? `6. 每条要点的 perspective 字段：1-2句（50-80字），对该新闻的意义或影响作出主观判断`
    : '6. perspective 字段填写空字符串';

  return `你是一位资深财经科技新闻编辑。

规则：
1. 只基于用户提供的文章内容提炼，不添加原文没有的信息
2. ${lengthGuide}
3. ${overviewGuide}，语言流畅，有全局视野
4. 每个分类挑选最重要的新闻（每分类最多 ${cfg.maxBulletsPerCategory} 条），articleIndex 必须使用该分类列表中标注的数字索引
5. ${LANGUAGE_GUIDE[cfg.language] ?? LANGUAGE_GUIDE.zh}；${FORMAT_GUIDE[cfg.format] ?? FORMAT_GUIDE.bullets}
${perspectiveGuide}
7. categories 字段必须是 JSON 数组，每个元素含 category 和 bullets

请调用 submit_digest 函数提交结果。`;
}

function buildTool(cfg: AiConfig): Anthropic.Tool {
  // strict: true makes the API enforce this schema — categories can no longer
  // come back as an object or a JSON string
  return {
    name: "submit_digest",
    description: "提交今日新闻摘要结果",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        overview: {
          type: "string",
          description: "今日概览",
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              bullets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text:         { type: "string" },
                    source:       { type: "string" },
                    articleIndex: { type: "number" },
                    perspective:  { type: "string", description: "未启用时填空字符串" },
                  },
                  required: ["text", "source", "articleIndex", "perspective"],
                  additionalProperties: false,
                },
                // maxItems not supported in strict mode — cap enforced by
                // the prompt and the .slice() below
              },
            },
            required: ["category", "bullets"],
            additionalProperties: false,
          },
        },
      },
      required: ["overview", "categories"],
      additionalProperties: false,
    },
  };
}

function toArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  // The model occasionally returns a JSON-stringified array
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed as T[];
      if (parsed && typeof parsed === "object") return Object.values(parsed) as T[];
    } catch { /* fall through */ }
    return [];
  }
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

type ProgressCb = (event: Record<string, unknown>) => void;

// Extract the partial value of "overview" from an accumulating JSON string
function extractPartialOverview(json: string): string {
  const marker = json.indexOf('"overview":');
  if (marker === -1) return "";
  let pos = marker + 11;
  while (pos < json.length && (json[pos] === " " || json[pos] === "\t")) pos++;
  if (pos >= json.length || json[pos] !== '"') return "";
  pos++; // skip opening quote
  let result = "";
  while (pos < json.length) {
    if (json[pos] === "\\") {
      if (pos + 1 >= json.length) break; // partial escape at buffer end — wait for more
      const esc = json[pos + 1];
      if (esc === '"') { result += '"'; pos += 2; }
      else if (esc === "n") { result += "\n"; pos += 2; }
      else if (esc === "t") { result += "\t"; pos += 2; }
      else if (esc === "r") { result += "\r"; pos += 2; }
      else if (esc === "\\") { result += "\\"; pos += 2; }
      else if (esc === "u") {
        if (pos + 6 > json.length) break; // partial \uXXXX — wait for more
        result += String.fromCharCode(parseInt(json.slice(pos + 2, pos + 6), 16));
        pos += 6;
      } else { result += esc; pos += 2; }
    } else if (json[pos] === '"') {
      break;
    } else {
      result += json[pos];
      pos++;
    }
  }
  return result;
}

export async function generateDigest(
  articles: NewsArticle[],
  aiConfig?: AiConfig,
  onProgress?: ProgressCb,
): Promise<{ overview: string; categories: CategoryDigest[] }> {
  const cfg = aiConfig ?? DEFAULT_CONFIG.ai;

  // Create client inside function so env vars are guaranteed resolved
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Group by category, capping input per category — sending every fetched
  // article slows generation and exceeds the output token budget
  const capPerCat = Math.max(cfg.maxBulletsPerCategory * 2, 8);
  const grouped: Record<string, NewsArticle[]> = {};
  for (const a of articles) {
    (grouped[a.category] ??= []).push(a);
  }
  for (const cat of Object.keys(grouped)) {
    grouped[cat] = grouped[cat].slice(0, capPerCat);
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
  const model = cfg.model ?? "claude-haiku-4-5";

  // Expected output size drives both max_tokens and the progress estimate.
  // Chinese output runs ~1 token per character: bullet text + perspective +
  // JSON keys ≈ 300-650 tokens each. max_tokens is a ceiling, not a target —
  // a generous value costs nothing if the model finishes early.
  const expectedBullets = Object.values(grouped).reduce(
    (n, arr) => n + Math.min(arr.length, cfg.maxBulletsPerCategory), 0);
  const perBulletTokens =
    cfg.summaryLength === "brief" ? 300 : cfg.summaryLength === "detailed" ? 700 : 500;
  const maxTokens = Math.min(16384, 1000 + expectedBullets * perBulletTokens);
  const expectedChars = 400 + expectedBullets *
    (cfg.summaryLength === "brief" ? 200 : cfg.summaryLength === "detailed" ? 620 : 420);

  const inputCount = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);
  console.log("[summarizer:A] model:", model, "articles:", inputCount,
              "inputLen:", inputText.length, "maxTokens:", maxTokens);

  onProgress?.({ type: "step", text: `AI 开始分析 ${inputCount} 篇文章（模型：${model}）…` });

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_digest" },
    system: systemPrompt,
    messages: [{ role: "user", content: `以下是今日真实抓取的新闻，请提炼要点：\n\n${inputText}` }],
  });

  let accJson = "";
  let lastOverviewLen = 0;
  let lastPct = 30;

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "input_json_delta"
    ) {
      accJson += event.delta.partial_json;
      if (onProgress) {
        const overviewText = extractPartialOverview(accJson);
        if (overviewText.length > lastOverviewLen) {
          onProgress({ type: "overview_delta", text: overviewText.slice(lastOverviewLen) });
          lastOverviewLen = overviewText.length;
        }
        // Map accumulated JSON length onto the 30–90% range of the progress bar
        const pct = 30 + Math.min(60, Math.round((accJson.length / expectedChars) * 60));
        if (pct >= lastPct + 2) {
          onProgress({ type: "progress", value: pct });
          lastPct = pct;
        }
      }
    }
  }

  const message = await stream.finalMessage();

  console.log("[summarizer:B] response stop_reason:", message.stop_reason,
              "content blocks:", message.content.length,
              "output_tokens:", message.usage.output_tokens);

  if (message.stop_reason === "max_tokens") {
    console.error("[summarizer:B] output truncated at", maxTokens, "tokens");
    onProgress?.({ type: "step", text: `⚠ 输出在 ${maxTokens} tokens 处被截断，结果可能不完整`, isWarning: true });
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    console.error("[summarizer:B] no tool_use block, content:", JSON.stringify(message.content).slice(0, 300));
    throw new Error("Claude 未返回结构化结果");
  }

  const result = toolUse.input as RawResult;
  const isArr = Array.isArray(result?.categories);
  const catsType = typeof result?.categories;
  console.log("[summarizer:C] overview len:", result?.overview?.length ?? 0,
              "categories isArray:", isArr, "type:", catsType);

  // Build case-insensitive lookup
  const groupedLower: Record<string, NewsArticle[]> = {};
  for (const [k, v] of Object.entries(grouped)) {
    groupedLower[k.toLowerCase()] = v;
  }

  const rawCategories = toArray<RawCategory>(result?.categories);
  const categories: CategoryDigest[] = rawCategories.map((cat) => {
    const catName = cat?.category ?? "其他";
    const catArticles =
      grouped[catName] ??
      groupedLower[catName.toLowerCase()] ??
      [];

    const bullets: BulletPoint[] = toArray<RawBullet>(cat?.bullets)
      .slice(0, cfg.maxBulletsPerCategory)
      .map((b): BulletPoint => {
        const idx = typeof b?.articleIndex === "number" ? b.articleIndex : 0;
        // Index lookup first; fall back to same-source article so the
        // 查看原文 button never disappears
        const link =
          catArticles[idx]?.link ||
          catArticles.find((a) => a.source === b?.source)?.link ||
          articles.find((a) => a.source === b?.source)?.link ||
          "";
        return {
          text:        b?.text ?? "",
          source:      b?.source ?? "",
          link,
          perspective: b?.perspective || undefined,
        };
      });

    return { category: catName, bullets };
  });

  console.log("[summarizer:D] done, categories:", categories.length);

  // An overview-only digest is useless — fail loudly instead of saving it
  if (categories.length === 0 || categories.every((c) => c.bullets.length === 0)) {
    console.error("[summarizer:D] empty categories, raw input:",
                  JSON.stringify(toolUse.input).slice(0, 2000));
    throw new Error(
      message.stop_reason === "max_tokens"
        ? "AI 输出被截断导致分类内容丢失，请重试（已自动调大输出上限）"
        : "AI 未返回任何分类内容，请重试"
    );
  }

  return { overview: result?.overview ?? "", categories };
}
