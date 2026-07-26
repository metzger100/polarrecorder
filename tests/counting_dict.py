"""Shared test-only counting dict, used by the deterministic scaling contracts.

A plain `dict` subclass that increments a shared counter on every read/write, so a test
can measure how many dictionary/mapping operations a production call performs without
adding any instrumentation to production code. The counter is a caller-supplied
single-element list so multiple substituted containers (e.g. a model's bin dict and each
bin's histogram dict) can share one running total.
"""

from __future__ import annotations

from typing import Any


class CountingDict(dict[Any, Any]):
    """A dict that counts every `get`/`__setitem__` call against a shared counter."""

    def __init__(self, counter: list[int]) -> None:
        super().__init__()
        self._counter = counter

    def get(
        self, key: Any, default: Any = None
    ) -> Any:  # counting wrapper is intentionally generic
        self._counter[0] += 1
        return super().get(key, default)

    def __setitem__(
        self, key: Any, value: Any
    ) -> None:  # counting wrapper is intentionally generic
        self._counter[0] += 1
        super().__setitem__(key, value)
