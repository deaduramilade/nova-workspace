"""Lightweight TTL cache for hot read endpoints."""

from __future__ import annotations

import time
from threading import Lock
from typing import Any, Callable


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = Lock()

    def get_or_set(self, key: str, ttl: float, factory: Callable[[], Any]) -> Any:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry and (now - entry[0]) < ttl:
                return entry[1]
            value = factory()
            self._store[key] = (now, value)
            return value

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


health_cache = TTLCache()