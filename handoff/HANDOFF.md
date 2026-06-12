# Handoff: Everyday News — Daily AI News Digest

## 项目概述

用户想要一个每天自动抓取指定新闻网站、用 AI 生成要点摘要、并展示在网页上的应用。已完成构建并推送到 GitHub，正在 Vercel 部署调试阶段。

---

## 当前状态

**已完成：**
- Next.js 16 + Tailwind v4 + TypeScript 项目，构建通过
- 两个页面：`/`（报告页）和 `/config`（工作流配置页）
- 三个 API 路由：`/api/cron`、`/api/generate`、`/api/config`
- 已推送至 GitHub：`https://github.com/TRUSOGEN/everyday-news`
- 已在 Vercel 部署，URL：`https://everyday-news-xi.vercel.app`
- Vercel 已连接 Upstash Redis（变量名：`KV_REST_API_URL` / `KV_REST_API_TOKEN`）
- 已添加环境变量：`ANTHROPIC_API_KEY`、`CRON_SECRET=news2026`

**最新一次修复（尚未验证是否生效）：**
- 问题：`SyntaxError: Expected ',' or '}' after property value in JSON` — BBC 文章标题含引号导致 Claude 返回的 JSON 损坏
- 修复：`lib/summarizer.ts` 改用 **Tool Use**（函数调用）获取结构化输出，彻底避免 JSON 解析问题
- 模型：从 `claude-opus-4-7` 改为 `claude-haiku-4-5`（避免 Vercel Hobby 10 秒超时）
- 已推送，Vercel 应已重新部署

**下一步要验证的事：**
1. 去 `https://everyday-news-xi.vercel.app/config`
2. 点"保存并立即生成 ▶"
3. 等待约 15-30 秒，看是否生成成功
4. 成功后访问首页查看报告

---

## 项目结构

```
/Users/trusoegn/GitHub/everyday-news/
├── app/
│   ├── page.tsx              # 报告页（报纸风格，动态渲染）
│   ├── config/
│   │   ├── page.tsx          # 工作流配置页（Server Component）
│   │   └── ConfigEditor.tsx  # 可视化三节点编辑器（Client Component）
│   └── api/
│       ├── cron/route.ts     # GET — Vercel Cron，每天北京时间12:00触发
│       ├── generate/route.ts # POST — 手动触发生成（需 Authorization header）
│       └── config/route.ts   # GET/POST — 读写来源配置
├── config/defaults.ts        # 默认来源：BBC Business + BBC Technology
├── lib/
│   ├── fetcher.ts            # RSS 抓取（rss-parser）
│   ├── summarizer.ts         # Claude Tool Use 结构化摘要
│   └── storage.ts            # Upstash Redis 存储（兼容 KV_REST_API_* 变量）
├── types/index.ts
└── vercel.json               # Cron: "0 4 * * *" (UTC) = 北京 12:00
```

---

## 关键技术决策

| 决策 | 原因 |
|------|------|
| Tool Use 而非 text JSON | BBC 标题含引号导致 JSON.parse 失败 |
| `claude-haiku-4-5` | Vercel Hobby 10s 超时限制，Haiku 更快 |
| `@upstash/redis` | `@vercel/kv` 已废弃 |
| `KV_REST_API_URL` | Vercel Upstash 集成注入的变量名格式 |
| `export const dynamic = "force-dynamic"` | 构建时无 Redis，避免预渲染失败 |

---

## 环境变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `KV_REST_API_URL` | Vercel Upstash 自动注入 | Redis REST URL |
| `KV_REST_API_TOKEN` | Vercel Upstash 自动注入 | Redis Token |
| `ANTHROPIC_API_KEY` | 手动添加 | Anthropic API Key |
| `CRON_SECRET` | 手动添加，值：`news2026` | 保护 /api/generate 端点 |

---

## 添加新来源

在 `/config` 页面 UI 操作，或直接编辑 `config/defaults.ts`：
```typescript
{
  id: "reuters-business",
  name: "Reuters Business",
  category: "商业财经",
  rssUrl: "https://feeds.reuters.com/reuters/businessNews",
  enabled: true,
}
```

---

## 潜在后续问题

1. **Vercel Hobby 超时**：若 Haiku 仍超过 10 秒，考虑升级 Vercel Pro
2. **Cron 触发**：Vercel Cron 自动携带 `CRON_SECRET`，`/api/cron` 路由验证逻辑已就绪
3. **首次访问空状态**：未生成过报告时首页显示"今日报告尚未生成"是正常的

---

## 推荐下一步 Skills

- `verify` — 验证 Vercel 上功能是否正常
- `systematic-debugging` — 如果生成仍然失败
- `claude-api` — 如需调整模型或摘要质量
