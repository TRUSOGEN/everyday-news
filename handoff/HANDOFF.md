# Handoff: Everyday News — Daily AI News Digest

## 项目概述

Next.js 16 应用，每天自动抓取 RSS 订阅，用 Anthropic Claude 生成中文新闻要点摘要，展示在报告页。部署在 Vercel + Upstash Redis。

- **线上 URL**: https://everyday-news-xi.vercel.app
- **GitHub**: https://github.com/TRUSOGEN/everyday-news
- **口令**: `TRUSO`（可用环境变量 `APP_PASSWORD` 覆盖）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 App Router，TypeScript |
| 样式 | Tailwind v4，`@theme` CSS 变量，Google Fonts（Playfair Display + Inter）|
| AI | Anthropic SDK `@anthropic-ai/sdk`，Claude Haiku/Sonnet/Opus |
| 存储 | Upstash Redis `@upstash/redis` |
| 长期事实库 | Supabase/Postgres + pgvector（schema 已在 `supabase/schema.sql`）|
| RSS | `rss-parser` |
| 部署 | Vercel（Serverless + Edge Middleware）|
| 离线 pipeline | GitHub Actions + Python `scripts/pipeline/` |

---

## 环境变量（Vercel 已配置）

| 变量 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API |
| `CRON_SECRET` | 保护 `/api/cron` 和 `/api/generate`；同时作为 session cookie 的 HMAC 签名密钥 |
| `UPSTASH_REDIS_REST_URL` | Redis 连接 |
| `UPSTASH_REDIS_REST_TOKEN` | Redis 认证 |
| `APP_PASSWORD` | 可选，前端登录口令（默认 `TRUSO`）|

---

## 文件结构

```
app/
  page.tsx              → redirect("/config")
  layout.tsx            → 字体注入（Playfair Display + Inter）
  globals.css           → CSS 动画（fadeInUp/fadeIn/slideInLeft）、accent-gradient
  login/page.tsx        → 登录口令页（深色风格）
  config/
    page.tsx            → Server Component，读配置 + 生成每日 token，传给 ConfigEditor
    ConfigEditor.tsx    → Client Component，tab 式配置 + SSE 流式生成 + 实时进度终端
  report/page.tsx       → 报告展示页，?date=YYYY-MM-DD 查历史
  history/page.tsx      → 历史日期列表
  components/
    ReportSaver.tsx     → 下载 .md / 复制 / 打印
  api/
    login/route.ts      → 口令验证，发 HttpOnly session cookie
    config/route.ts     → GET/POST 配置（Redis）
    generate/route.ts   → SSE 流式生成（保存配置 → 抓 RSS → AI 分析 → 保存报告）
    cron/route.ts       → Vercel Cron 定时触发，直接调用生成逻辑

lib/
  appAuth.ts            → Web Crypto HMAC，生成/验证 session cookie
  auth.ts               → 每日轮换 token（HMAC-SHA256），CRON_SECRET 不暴露给浏览器
  fetcher.ts            → RSS 抓取，URL 预验证，描述截断到 200 字
  articleIdentity.ts    → 稳定 article id、URL 规范化、去重、新鲜文章过滤
  articleContent.ts     → 公开 HTML 正文抓取、正文证据摘录、数字指标候选提取
  summarizer.ts         → 调用 Claude（stream），提取 overview delta，strict tool schema
  storage.ts            → Redis CRUD（配置、报告、已见文章、正文内容缓存）

config/
  defaults.ts           → DEFAULT_CONFIG（sources + ai + schedule）

scripts/
  pipeline/
    event_clustering.py → 语义事件聚类核心 Module，输入 embedding 后输出 EventCluster
    embedding_adapters.py → deterministic dry-run adapter + sentence-transformers lazy adapter
    pipeline_rows.py    → 把文章、embedding、事件簇转换为 Supabase upsert rows
    run_daily_pipeline.py → 离线 pipeline CLI，支持 --output 和 --write-supabase
    supabase_store.py   → Supabase PostgREST 写入 adapter

supabase/
  schema.sql            → Supabase/Postgres + pgvector 长期事实库 schema

.github/workflows/
  daily-pipeline.yml    → 每日 UTC 08:00 GitHub Actions dry-run pipeline

middleware.ts           → Edge 中间件，未登录跳 /login；/api/cron、/api/generate 自带 bearer 认证不拦截
types/index.ts          → 所有共享类型
```

---

## 核心流程

### 手动生成（浏览器）
1. 访问 `/config` → 口令门 → ConfigEditor
2. 点「保存并立即生成」→ POST `/api/config` 保存配置
3. 前端用 fetch SSE 连接 `/api/generate`（bearer = 每日 HMAC token）
4. 服务端先抓 RSS 并按 article id 去重，再过滤 Redis 中已见文章；没有新文章时直接 emit `done(skipped: true)`，不调用 Claude
5. 有新文章时先抓取公开 HTML，提取正文证据摘录和数字指标候选，并缓存到 Redis
6. ReadableStream 逐步 emit 事件：`step` / `progress` / `articles` / `overview_delta` / `done` / `error`
7. 前端实时显示：进度条（0→100%）+ 步骤日志 + AI 概览逐字流入 + 新文章原文链接
8. `done` 事件 → 跳转成功页 → 点「查看今日报告」到 `/report`

### 定时生成（Vercel Cron）
- `vercel.json` 配置每天 04:00 UTC（北京时间 12:00）触发 `/api/cron`
- Bearer token = `CRON_SECRET`，先做 article id 去重和已见文章过滤；无新文章时返回 `skipped: true`，有新文章时调用 `generateDigest(freshArticles, config.ai)` 无流式

### 文章去重与新鲜度过滤

- `lib/articleIdentity.ts` 是统一入口，RSS、新闻 API、未来正文爬虫都应复用这套规则。
- article id 优先级：已有 `id` → `guid` → 规范化 `link` → `source/title/pubDate` fallback 哈希。
- URL 规范化会移除 `utm_*`、`fbclid`、`gclid`、`mc_cid` 等 tracking 参数，并排序 query 参数。
- 生成前使用 `dedupeArticles()` 合并同一轮 RSS 重复项，再用 Redis `articles:seen` 和最近报告链接过滤旧文章。
- Claude 只总结 `freshArticles`；保存报告成功后，`markArticlesSeen(articles)` 会把本轮抓到的去重文章整体标记为已见。

### 正文证据与数据候选

- `lib/articleContent.ts` 只处理公开 HTML，不绕过登录、paywall 或反爬限制。
- 抽取优先级：`<article>` → `<main>` → `<body>`；会移除 script/style/nav/header/footer/aside/form 等非正文区域。
- 正文最多保留 8000 字符，报告证据摘录最多约 900 字符，Claude prompt 中单篇证据再截断，避免 token 爆炸。
- 指标候选由规则抽取，包括金额、百分比、percentage points、million/billion/trillion units/users 等数量表达，并保留原文上下文。
- 当前报告页展示轻量条形图式的数据候选；这是可审计指标预览，不是完整统计图表系统。
- 后续更强的图表能力应基于 `ArticleMetric` 继续扩展为 `ChartSpec`，并要求每个图表数据点都能回溯到 `metric.context`。

### 事件聚类与 Supabase 事实库

- 当前 Redis 仍是运行中短期缓存；Supabase 是下一阶段长期事实库，适合 articles、contents、embeddings、event clusters、metrics、watchlist、全文搜索。
- `supabase/schema.sql` 定义了 `articles`、`article_contents`、`article_embeddings`、`event_clusters`、`article_event_memberships`、`article_metrics`、`watchlist_terms`、`watchlist_matches`。
- `scripts/pipeline/event_clustering.py` 提供纯 Python `cluster_articles()` interface，输入已向量化文章，输出 `EventCluster[]`。
- 第一版聚类实现是单遍 centroid 贪心聚类，阈值默认建议 0.9；后续可在不改调用方 interface 的情况下替换为层次聚类或 HDBSCAN。
- `scripts/pipeline/embedding_adapters.py` 已提供 sentence-transformers adapter 的懒加载实现；生产环境安装 `requirements-pipeline.txt` 后可使用 `--embedding-adapter sentence-transformers`。
- `scripts/pipeline/run_daily_pipeline.py` 支持 `--output` 输出 Supabase rows JSON，支持 `--write-supabase` 写入事实库；默认不写库，避免 dry run 误写。
- `.github/workflows/daily-pipeline.yml` 已建立每日 UTC 08:00 cron 框架，目前执行聚类测试和 fixture dry run。
- `temp/test_event_clustering/test_pipeline_rows.py` 验证 Supabase rows 结构，并确保测试短向量会补齐成 `vector(384)` 兼容格式。

#### Pipeline CLI 快速参考

```bash
python3 -m unittest temp.test_event_clustering.test_event_clustering temp.test_event_clustering.test_pipeline_rows -v
python3 -m scripts.pipeline.run_daily_pipeline \
  --input temp/test_event_clustering/articles_fixture.json \
  --similarity-threshold 0.9 \
  --output temp/test_event_clustering/pipeline_output.json
```

生产入库前置条件：

- 在 Supabase SQL editor 执行 `supabase/schema.sql`，确保 `pgvector` 可用。
- 在 GitHub Actions secrets 配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。
- 安装 `requirements-pipeline.txt` 后使用 `--embedding-adapter sentence-transformers`。
- dry run 输出检查无误后再启用 `--write-supabase`。

### AI 生成逻辑（`lib/summarizer.ts`）
- `anthropic.messages.stream()` + `strict: true` tool schema（categories 类型由 API 强制）
- 流式 `input_json_delta` 累积，`extractPartialOverview()` 实时解析 overview 文字
- `max_tokens` 动态计算：`1000 + 预期条数 × 每条 token 估算`，上限 16384
- 每分类输入截流：`max(maxBullets × 2, 8)` 篇，避免输入过长拖慢速度
- RSS 描述截断 200 字符；RSS 超时 8 秒

---

## 安全机制

| 机制 | 实现 |
|---|---|
| 前端登录口令 | Edge Middleware 拦截，HttpOnly cookie（HMAC-SHA256 签名）|
| 生成 API 保护 | CRON_SECRET 不发给浏览器；浏览器拿每日轮换 token（`lib/auth.ts`）|
| 定时任务保护 | Bearer CRON_SECRET |
| Cookie 防伪 | HMAC-SHA256(CRON_SECRET, "everyday-news-session")，无需数据库 |

---

## Redis Key 设计

| Key | 类型 | 内容 |
|---|---|---|
| `config` | String (JSON) | AppConfig |
| `digest:latest` | String (JSON) | 最新 DailyDigest |
| `digest:YYYY-MM-DD` | String (JSON) | 历史报告 |
| `digest:dates` | List | 最近 30 天日期，lpush+lrem 去重 |
| `articles:seen` | Set | 已抓取过的稳定 article id，用于跳过重复 Claude 总结 |
| `article:content:<id>` | String (JSON, 30d TTL) | 正文证据、指标候选、抓取状态 |

## Supabase 表设计

| Table | 内容 |
|---|---|
| `news_sources` | 新闻来源配置 |
| `articles` | 文章元数据 |
| `article_contents` | 正文、摘录、FTS search vector |
| `article_embeddings` | pgvector embedding |
| `event_clusters` | 事件簇 |
| `article_event_memberships` | 文章到事件簇的归属关系 |
| `article_metrics` | 可审计数字指标 |
| `watchlist_terms` | 关键词告警配置 |
| `watchlist_matches` | 命中的文章-关键词关系 |

---

## 配置选项（ConfigEditor tabs）

- **新闻来源**：RSS URL、分类、启用/禁用、增删
- **AI 模型**：Haiku 4.5 / Sonnet 4.6 / Opus 4.8；摘要长度（简洁/标准/详细）；格式（要点/执行摘要/段落）；语言（中文/English/双语）；每分类最多条数（1-10）；显示 AI 视角开关
- **计划任务**：记录偏好时间（实际调度在 vercel.json，需在 Vercel 后台改）
- **高级**：自定义 System Prompt（填写后覆盖所有 AI 设置，必须以"请调用 submit_digest 函数提交结果"结尾）

---

## 已知 Bug 历史 & 修复记录

| 问题 | 根因 | 修复 |
|---|---|---|
| `m.categories.map is not a function` | Haiku 有时返回对象或 JSON 字符串而非数组 | `toArray()` 兜底 + `strict: true` tool schema 从 API 层强制 |
| `The string did not match the expected pattern.` | rss-parser 收到空 URL 触发 WHATWG URL API 报错 | `isValidUrl()` 预验证 |
| 只出来今日概览，无分类内容 | `max_tokens` 按英文估算太小，中文 1字≈1token，输出被截断 | 提高估算系数至 300-700/条，上限 16384 |
| `strict: true` + `maxItems` 400 报错 | API strict 模式不支持 `maxItems` 约束 | 移除 `maxItems`，条数由 prompt + `.slice()` 限制 |
| CRON_SECRET 泄漏到浏览器 | config page.tsx 直接把 env 传给 Client Component | 改为每日 HMAC token（`lib/auth.ts`） |
| 定时任务忽略模型配置 | cron 调 `generateDigest()` 没传 `config.ai` | 补传参数 |
| 报告格式/语言配置不生效 | prompt 里没有用这两个字段 | 加入 `LANGUAGE_GUIDE` / `FORMAT_GUIDE` |
| 流中断时前端卡死在"生成中" | 断流后 reader 结束但没有 done/error 事件 | 加 `finished` 守卫，断流时提示用户重试 |
| 每次生成都总结同一批 RSS 文章 | 每次固定取 feed 前 12 条，缺少 article-level 去重和 seen 状态 | 新增 `articleIdentity.ts`、Redis `articles:seen`，无新文章时跳过 Claude |
| RSS 摘要信息量不足，无法支撑可靠分析和图表 | 只把标题和短摘要交给 Claude | 新增正文证据层，报告保存原文摘录和指标候选 |

---

## 待办 / 可优化方向

- [ ] 报告页分类颜色只硬编码了 6 个，其余分类显示石色——可按分类名哈希自动分配
- [ ] 历史页只保留 30 天，可按需调整 `digest:dates` 的 ltrim 长度
- [ ] 口令只有全局一个，无多用户。如需，可换成 NextAuth 或 Clerk
- [ ] 图片/缩略图：rss-parser 能取 `item.enclosure`，报告卡片可加封面图
- [ ] 邮件推送：生成完成后用 Resend/SendGrid 发邮件
- [ ] 报告页搜索：按关键词在历史报告中检索
- [ ] 正文抓取：对少量新文章下载正文并清洗，作为 RSS 摘要不足时的增强输入；优先保持 RSS/API 确定性抓取，爬虫作为补充
