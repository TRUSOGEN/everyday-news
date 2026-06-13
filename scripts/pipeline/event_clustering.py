"""语义事件聚类核心 Module。

本模块只处理已经向量化的文章，不负责 embedding 生成和数据库读写。这样的
interface 让调用方只需要提供文章及其向量，implementation 内部负责余弦相似度、
簇归并、代表文章选择和 centroid 更新。后续本地 sentence-transformers 或远程
embedding provider 都可以作为上游 adapter 接入。
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from math import sqrt


@dataclass(frozen=True)
class ArticleForClustering:
    """用于事件聚类的最小文章结构。"""

    article_id: str
    source: str
    title: str
    content_text: str
    embedding: list[float]


@dataclass(frozen=True)
class EventCluster:
    """语义事件簇。"""

    cluster_id: str
    representative_article_id: str
    article_ids: list[str]
    sources: list[str]
    centroid: list[float]


@dataclass
class _MutableCluster:
    """聚类过程中的内部可变状态。"""

    articles: list[ArticleForClustering]
    centroid: list[float]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """计算两个向量的余弦相似度。"""

    if len(left) != len(right):
        raise ValueError("embedding 维度不一致")
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    return dot / (left_norm * right_norm)


def _centroid(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dimension = len(vectors[0])
    for vector in vectors:
        if len(vector) != dimension:
            raise ValueError("embedding 维度不一致")
    return [sum(vector[i] for vector in vectors) / len(vectors) for i in range(dimension)]


def _representative(articles: list[ArticleForClustering]) -> ArticleForClustering:
    return max(articles, key=lambda article: (len(article.content_text), len(article.title), article.article_id))


def _cluster_id(article_ids: list[str]) -> str:
    joined = "|".join(sorted(article_ids))
    return f"evt_{sha256(joined.encode('utf-8')).hexdigest()[:16]}"


def _finalize(cluster: _MutableCluster) -> EventCluster:
    article_ids = sorted(article.article_id for article in cluster.articles)
    representative = _representative(cluster.articles)
    return EventCluster(
        cluster_id=_cluster_id(article_ids),
        representative_article_id=representative.article_id,
        article_ids=article_ids,
        sources=sorted({article.source for article in cluster.articles}),
        centroid=cluster.centroid,
    )


def cluster_articles(
    articles: list[ArticleForClustering],
    similarity_threshold: float = 0.9,
) -> list[EventCluster]:
    """把语义相似的文章归并为事件簇。

    聚类采用单遍贪心策略：每篇文章与现有簇 centroid 比较，超过阈值则加入最相似
    的簇，否则创建新簇。这个策略足够作为第一版 pipeline 的确定性基线，后续可以
    在不改变 interface 的情况下替换为层次聚类或 HDBSCAN。
    """

    if not 0 < similarity_threshold <= 1:
        raise ValueError("similarity_threshold 必须在 (0, 1] 范围内")

    clusters: list[_MutableCluster] = []
    for article in articles:
        if not article.embedding:
            continue

        best_index = -1
        best_score = -1.0
        for index, cluster in enumerate(clusters):
            score = cosine_similarity(article.embedding, cluster.centroid)
            if score > best_score:
                best_index = index
                best_score = score

        if best_index >= 0 and best_score >= similarity_threshold:
            cluster = clusters[best_index]
            cluster.articles.append(article)
            cluster.centroid = _centroid([item.embedding for item in cluster.articles])
        else:
            clusters.append(_MutableCluster(articles=[article], centroid=list(article.embedding)))

    return [_finalize(cluster) for cluster in clusters]
