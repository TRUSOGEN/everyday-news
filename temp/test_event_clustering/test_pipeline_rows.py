"""pipeline 写库行转换测试。

这些测试保证离线 pipeline 生成的 Supabase rows 结构稳定。测试不连接真实
Supabase，只验证转换结果和外部写库 adapter 的 interface。
"""

import unittest

from scripts.pipeline.embedding_adapters import DeterministicHashEmbeddingAdapter
from scripts.pipeline.pipeline_rows import PipelineArticle, build_supabase_rows


class PipelineRowsTest(unittest.TestCase):
    """Supabase row 转换行为测试。"""

    def test_build_rows_contains_articles_embeddings_clusters_and_memberships(self) -> None:
        articles = [
            PipelineArticle(
                id="a1",
                source="BBC",
                category="科技",
                title="Joby advances certification",
                url="https://example.com/a1",
                content_text="Joby advanced certification for its eVTOL aircraft.",
                embedding=[1.0, 0.0, 0.0],
            ),
            PipelineArticle(
                id="a2",
                source="Reuters",
                category="科技",
                title="Joby air taxi certification progresses",
                url="https://example.com/a2",
                content_text="Joby progressed certification for electric air taxis.",
                embedding=[0.98, 0.05, 0.0],
            ),
        ]

        rows = build_supabase_rows(
            articles,
            embedding_adapter=DeterministicHashEmbeddingAdapter(),
            similarity_threshold=0.9,
        )

        self.assertEqual(len(rows.articles), 2)
        self.assertEqual(len(rows.article_contents), 2)
        self.assertEqual(len(rows.article_embeddings), 2)
        self.assertEqual(len(rows.event_clusters), 1)
        self.assertEqual(len(rows.article_event_memberships), 2)
        self.assertIn(rows.event_clusters[0]["representative_article_id"], {"a1", "a2"})
        self.assertEqual(rows.article_event_memberships[0]["event_cluster_id"], rows.event_clusters[0]["id"])
        embedding_literal = str(rows.article_embeddings[0]["embedding"])
        self.assertEqual(len(embedding_literal.strip("[]").split(",")), 384)
        centroid_literal = str(rows.event_clusters[0]["centroid"])
        self.assertEqual(len(centroid_literal.strip("[]").split(",")), 384)


if __name__ == "__main__":
    unittest.main()
