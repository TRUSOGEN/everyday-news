"""Supabase 写库行构造 Module。

本模块把 pipeline 内部文章对象、embedding 和事件聚类结果转换为 Supabase
PostgREST 可以 upsert 的 rows。数据库 adapter 只负责传输；所有数据形状规则集中
在这里，便于测试和后续 schema 演进。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256

from scripts.pipeline.embedding_adapters import EmbeddingAdapter
from scripts.pipeline.event_clustering import ArticleForClustering, cluster_articles, cosine_similarity


@dataclass(frozen=True)
class PipelineArticle:
    """pipeline 内部使用的文章事实。"""

    id: str
    source: str
    category: str
    title: str
    url: str
    content_text: str
    embedding: list[float]
    description: str = ""
    guid: str = ""
    published_at: str | None = None
    content_status: str = "ok"
    content_excerpt: str = ""


@dataclass(frozen=True)
class SupabaseRows:
    """一次 pipeline run 产生的 Supabase rows。"""

    articles: list[dict[str, object]]
    article_contents: list[dict[str, object]]
    article_embeddings: list[dict[str, object]]
    event_clusters: list[dict[str, object]]
    article_event_memberships: list[dict[str, object]]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _content_hash(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def _fit_vector(values: list[float], dimension: int) -> list[float]:
    if len(values) > dimension:
        raise ValueError(f"embedding 维度 {len(values)} 超过目标维度 {dimension}")
    return values + [0.0] * (dimension - len(values))


def _to_vector_literal(values: list[float], dimension: int) -> str:
    fitted = _fit_vector(values, dimension)
    return "[" + ",".join(f"{value:.8f}" for value in fitted) + "]"


def build_supabase_rows(
    articles: list[PipelineArticle],
    embedding_adapter: EmbeddingAdapter,
    similarity_threshold: float,
) -> SupabaseRows:
    """构建可写入 Supabase 的 rows。"""

    now = _now_iso()
    clustering_articles = [
        ArticleForClustering(
            article_id=article.id,
            source=article.source,
            title=article.title,
            content_text=article.content_text,
            embedding=article.embedding,
        )
        for article in articles
        if article.embedding
    ]
    clusters = cluster_articles(clustering_articles, similarity_threshold=similarity_threshold)
    article_by_id = {article.id: article for article in articles}
    cluster_by_article_id = {
        article_id: cluster
        for cluster in clusters
        for article_id in cluster.article_ids
    }

    article_rows: list[dict[str, object]] = []
    content_rows: list[dict[str, object]] = []
    embedding_rows: list[dict[str, object]] = []
    membership_rows: list[dict[str, object]] = []

    for article in articles:
        article_rows.append({
            "id": article.id,
            "source_name": article.source,
            "category": article.category,
            "title": article.title,
            "url": article.url,
            "guid": article.guid or None,
            "published_at": article.published_at,
            "fetched_at": now,
            "content_hash": _content_hash(article.content_text),
        })
        content_rows.append({
            "article_id": article.id,
            "status": article.content_status,
            "title": article.title,
            "excerpt": article.content_excerpt or article.description or article.content_text[:900],
            "content_text": article.content_text,
            "fetched_at": now,
        })
        if article.embedding:
            embedding_rows.append({
                "article_id": article.id,
                "provider": embedding_adapter.provider,
                "model": embedding_adapter.model,
                "dimension": embedding_adapter.dimension,
                "embedding": _to_vector_literal(article.embedding, embedding_adapter.dimension),
                "embedded_at": now,
            })

        cluster = cluster_by_article_id.get(article.id)
        if cluster:
            similarity = cosine_similarity(article.embedding, cluster.centroid)
            membership_rows.append({
                "article_id": article.id,
                "event_cluster_id": cluster.cluster_id,
                "similarity": similarity,
                "created_at": now,
            })

    event_rows = [
        {
            "id": cluster.cluster_id,
            "representative_article_id": cluster.representative_article_id,
            "centroid": _to_vector_literal(cluster.centroid, embedding_adapter.dimension),
            "sources": cluster.sources,
            "updated_at": now,
        }
        for cluster in clusters
        if cluster.representative_article_id in article_by_id
    ]

    return SupabaseRows(
        articles=article_rows,
        article_contents=content_rows,
        article_embeddings=embedding_rows,
        event_clusters=event_rows,
        article_event_memberships=membership_rows,
    )
