"""Supabase REST adapter。

该 adapter 使用 Supabase PostgREST 接口写入事实库，避免第一版 pipeline 引入额外
Python SDK 依赖。缺少环境变量时会正确失败，避免静默写入错误位置。
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, is_dataclass
from typing import Any, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class SupabaseStore:
    """Supabase 事实库写入 adapter。"""

    def __init__(self, url: Optional[str] = None, service_role_key: Optional[str] = None) -> None:
        self.url = (url or os.environ.get("SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        if not self.url or not self.service_role_key:
            raise RuntimeError("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
        """向 Supabase table upsert 多行数据。"""

        if not rows:
            return
        endpoint = f"{self.url}/rest/v1/{table}?on_conflict={on_conflict}"
        body = json.dumps([self._jsonable(row) for row in rows]).encode("utf-8")
        request = Request(
            endpoint,
            data=body,
            method="POST",
            headers={
                "apikey": self.service_role_key,
                "authorization": f"Bearer {self.service_role_key}",
                "content-type": "application/json",
                "prefer": "resolution=merge-duplicates",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                if response.status >= 400:
                    raise RuntimeError(f"Supabase upsert failed: HTTP {response.status}")
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase upsert failed: HTTP {error.code} {detail}") from error

    def _jsonable(self, value: Any) -> Any:
        if is_dataclass(value):
            return self._jsonable(asdict(value))
        if isinstance(value, dict):
            return {key: self._jsonable(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._jsonable(item) for item in value]
        return value
