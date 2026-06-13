# Everyday News

Everyday News 是一个部署在 Vercel 的每日 AI 新闻摘要应用。应用抓取配置中的 RSS 订阅，先用稳定 article id 做去重和新鲜度过滤，再把新文章交给 Claude 生成中文新闻摘要，最后把报告保存到 Upstash Redis 并展示在报告页。

线上地址：https://everyday-news-xi.vercel.app

## 核心流程

```mermaid
flowchart LR
  A[RSS sources] --> B[fetchAllNews]
  B --> C[article identity + dedupe]
  C --> D{fresh articles?}
  D -- no --> E[skip Claude]
  D -- yes --> F[fetch public article HTML]
  F --> G[extract content evidence + metrics]
  G --> H[generateDigest with Claude]
  H --> I[save digest]
  I --> J[mark fetched articles seen]
```

## 运行与验证

```bash
npm run dev
npm run build
npm run lint
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc -p temp/test_article_freshness/tsconfig.json && node temp/test_article_freshness/dist/temp/test_article_freshness/article_identity.test.js
python3 -m unittest temp.test_event_clustering.test_event_clustering temp.test_event_clustering.test_pipeline_rows -v
python3 -m scripts.pipeline.run_daily_pipeline --input temp/test_event_clustering/articles_fixture.json --similarity-threshold 0.9 --output temp/test_event_clustering/pipeline_output.json
```

## 关键环境变量

| 变量 | 用途 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key |
| `CRON_SECRET` | 保护 cron/generate API，并用于 session cookie 签名 |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `APP_PASSWORD` | 可选登录口令，默认 `TRUSO` |

## 关键模块

| 路径 | 职责 |
| --- | --- |
| `lib/fetcher.ts` | 抓取 RSS，裁剪摘要，生成 article id，做单轮去重 |
| `lib/articleIdentity.ts` | 规范化 URL、生成稳定 article id、过滤新文章 |
| `lib/articleContent.ts` | 抓取公开 HTML，清洗正文证据，提取数字指标候选 |
| `lib/summarizer.ts` | 调用 Claude stream + tool schema 生成结构化摘要 |
| `lib/storage.ts` | 读写配置、报告、历史日期和已见文章集合 |
| `app/api/generate/route.ts` | 手动 SSE 生成流程 |
| `app/api/cron/route.ts` | Vercel Cron 生成流程 |
| `scripts/pipeline/event_clustering.py` | Python 事件聚类核心逻辑 |
| `scripts/pipeline/pipeline_rows.py` | 构造 Supabase upsert rows |
| `scripts/pipeline/run_daily_pipeline.py` | 离线 pipeline CLI 入口 |
| `supabase/schema.sql` | Supabase/Postgres + pgvector schema |
| `.github/workflows/daily-pipeline.yml` | GitHub Actions 定时 pipeline |

## 去重策略

文章身份优先级是 `id`、`guid`、规范化后的 `link`、最后退回到 `source/title/pubDate` 哈希。URL 规范化会移除 `utm_*`、`fbclid`、`gclid` 等 tracking 参数。生成前会查询 Redis 的 `articles:seen` 集合和最近报告中的链接；没有新文章时跳过 Claude 调用，避免重复消耗 API 余额。

## 正文证据与数据候选

对新文章，系统会尝试下载公开 HTML，并从 `<article>`、`<main>` 或 `<body>` 中提取正文证据。该层不绕过登录、paywall 或反爬限制；抓取失败时会显式记录状态，并退回 RSS 摘要。报告页会展示原文证据摘录和数字指标候选，指标包括金额、百分比和带单位的数量；这些指标用于后续图表能力，但不会替代原文链接和证据片段。

## 事件聚类与长期事实库

下一阶段架构采用 Redis + Supabase 双层存储：Redis 继续承担短期缓存、session、已见文章和现有报告读取；Supabase/Postgres + pgvector 承担长期 articles、contents、embeddings、event clusters、metrics、watchlist 和全文搜索。`scripts/pipeline/` 下的 Python pipeline 是 Vercel 外部重任务入口，GitHub Actions 每天触发，避免 serverless 超时和冷启动影响。

```bash
python3 -m unittest temp.test_event_clustering.test_event_clustering temp.test_event_clustering.test_pipeline_rows -v
python3 -m scripts.pipeline.run_daily_pipeline \
  --input temp/test_event_clustering/articles_fixture.json \
  --similarity-threshold 0.9 \
  --output temp/test_event_clustering/pipeline_output.json
```

Supabase schema 位于 `supabase/schema.sql`。执行前需要在 Supabase 项目中启用 `pgvector`，并在 GitHub Actions secrets 中配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。默认 pipeline 使用无依赖 deterministic embedding adapter 做 dry run；生产环境安装 `requirements-pipeline.txt` 后可使用 `--embedding-adapter sentence-transformers`，确认输出后再加 `--write-supabase` 写入事实库。

### Pipeline CLI

| 参数 | 含义 |
| --- | --- |
| `--input` | 输入文章 JSON 文件，当前 fixture 位于 `temp/test_event_clustering/articles_fixture.json` |
| `--embedding-adapter` | `deterministic-hash` 或 `sentence-transformers`，默认 `deterministic-hash` |
| `--similarity-threshold` | 事件聚类余弦相似度阈值，当前建议 `0.9` |
| `--output` | 输出 summary、clusters 和 Supabase rows JSON |
| `--write-supabase` | 写入 Supabase；只有配置 secrets 后才应启用 |

当前 GitHub Actions 仍是 dry run：它会跑聚类测试、row 转换测试和 fixture pipeline，不会写 Supabase。接入真实入库时，先执行 `supabase/schema.sql`，再配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，最后在 workflow 中给 CLI 增加 `--write-supabase`。
