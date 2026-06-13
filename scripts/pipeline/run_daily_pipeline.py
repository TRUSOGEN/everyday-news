"""每日离线新闻 pipeline 入口。

第一版重点建立重任务从 Vercel 外移的执行入口：读取已清洗文章 fixture 或后续抓取
结果，生成 embedding，执行事件聚类，并在提供 Supabase 凭据时写入事实库。真实 RSS
抓取和正文清洗会继续从现有 TypeScript 实现迁移或复用。
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from scripts.pipeline.embedding_adapters import EmbeddingAdapter, create_embedding_adapter
from scripts.pipeline.event_clustering import ArticleForClustering, cluster_articles
from scripts.pipeline.pipeline_rows import PipelineArticle, build_supabase_rows
from scripts.pipeline.supabase_store import SupabaseStore


def load_pipeline_articles(path: Path, embedding_adapter: EmbeddingAdapter) -> list[PipelineArticle]:
    """从 JSON 文件读取文章，并补齐 embedding。"""

    raw_articles = json.loads(path.read_text(encoding="utf-8"))
    articles: list[PipelineArticle] = []
    for item in raw_articles:
        content_text = item.get("content_text") or item.get("description") or item.get("title") or ""
        embedding = item.get("embedding") or embedding_adapter.embed(f"{item.get('title', '')}\n{content_text}")
        articles.append(
            PipelineArticle(
                id=item["id"],
                source=item.get("source", ""),
                category=item.get("category", "其他"),
                title=item.get("title", ""),
                url=item.get("url") or item.get("link") or "",
                content_text=content_text,
                embedding=embedding,
                description=item.get("description", ""),
                guid=item.get("guid", ""),
                published_at=item.get("published_at") or item.get("pubDate"),
                content_status=item.get("content_status", "ok"),
                content_excerpt=item.get("content_excerpt", ""),
            )
        )
    return articles


def _cluster_input(articles: list[PipelineArticle]) -> list[ArticleForClustering]:
    return [
        ArticleForClustering(
            article_id=article.id,
            source=article.source,
            title=article.title,
            content_text=article.content_text,
            embedding=article.embedding,
        )
        for article in articles
    ]


def _write_supabase(rows: object) -> None:
    store = SupabaseStore()
    row_map = asdict(rows)
    store.upsert("articles", row_map["articles"], on_conflict="id")
    store.upsert("article_contents", row_map["article_contents"], on_conflict="article_id")
    store.upsert("article_embeddings", row_map["article_embeddings"], on_conflict="article_id")
    store.upsert("event_clusters", row_map["event_clusters"], on_conflict="id")
    store.upsert(
        "article_event_memberships",
        row_map["article_event_memberships"],
        on_conflict="article_id",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Everyday News offline event clustering pipeline")
    parser.add_argument("--input", required=True, help="包含文章数组的 JSON 文件")
    parser.add_argument("--embedding-adapter", default="deterministic-hash")
    parser.add_argument("--similarity-threshold", type=float, default=0.9)
    parser.add_argument("--output", help="把 Supabase rows JSON 写入指定路径")
    parser.add_argument("--write-supabase", action="store_true", help="写入 Supabase；需要配置 secrets")
    args = parser.parse_args()

    adapter = create_embedding_adapter(args.embedding_adapter)
    articles = load_pipeline_articles(Path(args.input), adapter)
    clusters = cluster_articles(_cluster_input(articles), similarity_threshold=args.similarity_threshold)
    rows = build_supabase_rows(articles, embedding_adapter=adapter, similarity_threshold=args.similarity_threshold)

    payload = {
        "summary": {
            "article_count": len(articles),
            "event_cluster_count": len(clusters),
            "embedding_provider": adapter.provider,
            "embedding_model": adapter.model,
        },
        "clusters": [cluster.__dict__ for cluster in clusters],
        "supabase_rows": asdict(rows),
    }

    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.write_supabase:
        _write_supabase(rows)
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
