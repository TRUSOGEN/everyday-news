"""事件聚类核心行为测试。

这些测试只覆盖聚类 Module 的纯逻辑，不依赖 Supabase、Redis 或真实 embedding
provider。目标是保证同一新闻事件的多篇报道会合并成一个事件簇，不同事件保持
分离。
"""

import unittest

from scripts.pipeline.event_clustering import ArticleForClustering, cluster_articles


class EventClusteringTest(unittest.TestCase):
    """事件聚类行为测试。"""

    def test_semantically_similar_articles_are_clustered_by_cosine_similarity(self) -> None:
        articles = [
            ArticleForClustering(
                article_id="bbc-1",
                source="BBC",
                title="Joby reports progress on eVTOL certification",
                content_text="Joby Aviation said its eVTOL certification programme reached a new milestone.",
                embedding=[1.0, 0.0, 0.0],
            ),
            ArticleForClustering(
                article_id="reuters-1",
                source="Reuters",
                title="Joby advances air taxi certification work",
                content_text="Joby Aviation advanced certification work for its electric air taxi.",
                embedding=[0.98, 0.05, 0.0],
            ),
            ArticleForClustering(
                article_id="bbc-2",
                source="BBC",
                title="Chipmaker revenue rises",
                content_text="A chipmaker reported stronger revenue from AI accelerator demand.",
                embedding=[0.0, 1.0, 0.0],
            ),
        ]

        clusters = cluster_articles(articles, similarity_threshold=0.9)

        self.assertEqual(len(clusters), 2)
        clustered_ids = [set(cluster.article_ids) for cluster in clusters]
        self.assertIn({"bbc-1", "reuters-1"}, clustered_ids)
        self.assertIn({"bbc-2"}, clustered_ids)

    def test_representative_article_prefers_longer_content(self) -> None:
        articles = [
            ArticleForClustering(
                article_id="short",
                source="A",
                title="Short",
                content_text="Short text.",
                embedding=[1.0, 0.0],
            ),
            ArticleForClustering(
                article_id="long",
                source="B",
                title="Long",
                content_text="Longer article text with more evidence and details about the same event.",
                embedding=[0.99, 0.01],
            ),
        ]

        clusters = cluster_articles(articles, similarity_threshold=0.9)

        self.assertEqual(clusters[0].representative_article_id, "long")


if __name__ == "__main__":
    unittest.main()
