"""
ChromaDB indexer.

Walks configured source trees and persists a local embedding index that the
Copilot and AI View Generator use to ground answers.

Uses Chroma's default embedding (all-MiniLM-L6-v2) so no extra model install
is required. Swap to an OpenAI-embedding function if you prefer.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Iterable

from config.settings import SETTINGS
from core.logger import get_logger
from .sources import SourceSpec, make_source

log = get_logger(__name__)

_COLLECTION = "kyb_knowledge"
_CHUNK_CHARS = 1600
_CHUNK_OVERLAP = 200


def _client():
    import chromadb
    return chromadb.PersistentClient(path=SETTINGS.chroma_persist_dir)


def _get_or_create_collection():
    client = _client()
    return client.get_or_create_collection(_COLLECTION, metadata={"purpose": "kyb-knowledge"})


def _chunk(text: str) -> list[str]:
    if not text:
        return []
    chunks: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        end = min(i + _CHUNK_CHARS, n)
        chunks.append(text[i:end])
        if end == n:
            break
        i = max(end - _CHUNK_OVERLAP, i + 1)
    return chunks


def _hash_id(path: Path, idx: int) -> str:
    h = hashlib.sha1(f"{path}:{idx}".encode("utf-8")).hexdigest()
    return h[:16]


def _read_text(path: Path) -> str:
    try:
        if path.suffix == ".ipynb":
            data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            out = []
            for cell in data.get("cells", []):
                src = cell.get("source", "")
                if isinstance(src, list):
                    src = "".join(src)
                out.append(src)
            return "\n\n".join(out)
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        log.warning("cannot read %s: %s", path, exc)
        return ""


def iter_files(source: SourceSpec) -> Iterable[Path]:
    for pattern in source.include_globs:
        yield from source.root.glob(pattern)


def index_sources(sources: list[SourceSpec]) -> dict[str, int]:
    """Build/refresh the index. Returns stats."""
    col = _get_or_create_collection()
    ids: list[str] = []
    docs: list[str] = []
    metas: list[dict] = []

    files = 0
    for src in sources:
        log.info("Indexing source: %s -> %s", src.label, src.root)
        for path in iter_files(src):
            if not path.is_file():
                continue
            text = _read_text(path)
            if not text.strip():
                continue
            chunks = _chunk(text)
            for i, chunk in enumerate(chunks):
                ids.append(_hash_id(path, i))
                docs.append(chunk)
                metas.append({
                    "source": src.label,
                    "path": str(path),
                    "ext": path.suffix,
                    "chunk": i,
                })
            files += 1
            if len(docs) >= 256:
                col.upsert(ids=ids, documents=docs, metadatas=metas)
                ids.clear(); docs.clear(); metas.clear()

    if docs:
        col.upsert(ids=ids, documents=docs, metadatas=metas)

    return {"files_indexed": files, "collection": _COLLECTION}


def quick_index(source_paths: list[str]) -> dict[str, int]:
    return index_sources([make_source(p) for p in source_paths])
