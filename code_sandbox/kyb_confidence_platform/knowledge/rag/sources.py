"""
Supported RAG sources.

The indexer walks each source path and chunks its files according to type.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SourceSpec:
    root: Path
    label: str
    include_globs: tuple[str, ...]


# Default glob set — a sensible start for KYB-style repos.
DEFAULT_GLOBS = (
    "**/*.sql",
    "**/*.yml", "**/*.yaml",
    "**/*.py", "**/*.ts", "**/*.js",
    "**/*.md", "**/*.ipynb",
    "**/*.json",
)


def make_source(root: str | Path, label: str | None = None, include: tuple[str, ...] = DEFAULT_GLOBS) -> SourceSpec:
    p = Path(root).expanduser().resolve()
    return SourceSpec(root=p, label=label or p.name, include_globs=include)
