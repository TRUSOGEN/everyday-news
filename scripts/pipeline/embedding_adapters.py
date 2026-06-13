"""Embedding adapter 定义。

第一版提供 deterministic adapter，便于 CI 和无依赖测试。生产环境应优先使用
sentence-transformers adapter；如果环境变量显式配置远程 provider，再接 OpenAI
或其他 embedding adapter。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from hashlib import sha256
from math import sqrt
from typing import Any


class EmbeddingAdapter(ABC):
    """embedding provider 的统一 interface。"""

    provider: str
    model: str
    dimension: int

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        """把文本转换成向量。"""


class DeterministicHashEmbeddingAdapter(EmbeddingAdapter):
    """无外部依赖的确定性 embedding adapter。

    这个 adapter 只用于测试和本地 dry run，不代表真实语义相似度。
    """

    provider = "local"
    model = "deterministic-hash"
    dimension = 384

    def embed(self, text: str) -> list[float]:
        buckets = [0.0] * self.dimension
        tokens = [token.lower() for token in text.split() if token.strip()]
        for token in tokens:
            digest = sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % self.dimension
            sign = 1.0 if digest[2] % 2 == 0 else -1.0
            buckets[index] += sign

        norm = sqrt(sum(value * value for value in buckets))
        if norm == 0:
            return buckets
        return [value / norm for value in buckets]


class SentenceTransformersEmbeddingAdapter(EmbeddingAdapter):
    """sentence-transformers embedding adapter。

    依赖按需 import，避免默认 CI dry run 必须安装大模型依赖。生产环境推荐模型是
    `sentence-transformers/all-MiniLM-L6-v2`，维度为 384，能与当前 Supabase schema
    的 `vector(384)` 对齐。
    """

    provider = "sentence-transformers"

    def __init__(self, model: str = "sentence-transformers/all-MiniLM-L6-v2") -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as error:
            raise RuntimeError(
                "缺少 sentence-transformers；请在 pipeline 环境安装 requirements-pipeline.txt"
            ) from error

        self.model = model
        self._model: Any = SentenceTransformer(model)
        dimension = getattr(self._model, "get_sentence_embedding_dimension", lambda: None)()
        self.dimension = int(dimension or 384)
        if self.dimension != 384:
            raise ValueError(f"Supabase schema 当前要求 384 维 embedding，实际模型维度为 {self.dimension}")

    def embed(self, text: str) -> list[float]:
        vector = self._model.encode(text, normalize_embeddings=True)
        return [float(value) for value in vector.tolist()]


def create_embedding_adapter(name: str = "deterministic-hash") -> EmbeddingAdapter:
    """根据名称创建 embedding adapter。"""

    if name == "deterministic-hash":
        return DeterministicHashEmbeddingAdapter()
    if name == "sentence-transformers":
        return SentenceTransformersEmbeddingAdapter()
    raise ValueError(f"未知 embedding adapter: {name}")
