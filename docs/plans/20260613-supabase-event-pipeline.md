# Supabase Event Pipeline Implementation Plan

**Goal:** 把新闻系统从文章列表视角升级为事件簇视角，并为长期搜索、watchlist 和图表打基础。

**Architecture:** Vercel 继续负责展示和轻量 API，GitHub Actions/Python pipeline 负责重任务。Supabase/Postgres + pgvector 成为长期事实库，Redis 保留为短期缓存和现有前端兼容层。

**Tech Stack:** Python 3.11, Supabase Postgres, pgvector, GitHub Actions, existing Next.js frontend.

---

## 第一阶段已落地

- `scripts/pipeline/event_clustering.py`: 纯 Python 事件聚类核心 Module。
- `scripts/pipeline/embedding_adapters.py`: embedding adapter interface 和 deterministic 测试 adapter。
- `supabase/schema.sql`: Supabase 长期事实库 schema。
- `.github/workflows/daily-pipeline.yml`: GitHub Actions cron 框架。
- `temp/test_event_clustering/test_event_clustering.py`: 聚类行为测试。

## 下一阶段

- 接入真实 RSS 抓取和正文清洗输出。
- 增加 sentence-transformers adapter。
- 将 cluster 写入 Supabase `event_clusters` 与 `article_event_memberships`。
- 让 Vercel 报告页从事件簇读取，而不是从单篇文章读取。
