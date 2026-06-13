# Article Content Evidence Implementation Plan

**Goal:** 对新文章抓取正文、清洗证据摘录，并让报告基于正文证据而不是只基于 RSS 摘要生成。

**Architecture:** RSS 仍然负责发现文章；正文抓取层只处理新文章，并把清洗后的正文缓存到 Redis。摘要层读取增强后的 `NewsArticle.contentText/contentExcerpt/metrics`，报告页展示可审计证据摘录，图表能力在 metric 结构稳定后继续扩展。

**Tech Stack:** Next.js App Router, TypeScript, Upstash Redis, Anthropic SDK, `@mozilla/readability`, `jsdom`.

---

## Files

- Create `lib/articleContent.ts`: 下载 HTML、用 Readability 清洗正文、提取指标候选、构造增强文章。
- Modify `types/index.ts`: 扩展 `NewsArticle`、`BulletPoint`、新增 `ArticleMetric`。
- Modify `lib/storage.ts`: 增加正文缓存 Redis key。
- Modify `app/api/generate/route.ts` and `app/api/cron/route.ts`: 只对 fresh articles 抓正文，再交给 Claude。
- Modify `lib/summarizer.ts`: 输入正文摘录和指标候选；输出 bullet 绑定 `articleId`、`evidenceExcerpt`、`metrics`。
- Modify `app/report/page.tsx`: 展示证据摘录和指标候选。
- Test under `temp/test_article_content/`.

## Tasks

- [ ] 写 HTML 抽取与 metric 候选测试，先确认缺少模块时失败。
- [ ] 安装正文抽取依赖。
- [ ] 实现正文抽取、metric 候选提取和缓存接口。
- [ ] 把 generate/cron 流程改成 fresh article enrichment。
- [ ] 扩展 Claude tool schema 和报告页 UI。
- [ ] 运行 `npm run lint`、`tsc --noEmit`、样本测试和 `npm run build`。
