"""
RAG retriever.

Gracefully degrades: if ChromaDB or the collection is missing, returns an
empty context list and lets callers fall back to deterministic behavior.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config.settings import SETTINGS
from core.logger import get_logger

log = get_logger(__name__)


@dataclass
class KnowledgeHit:
    text: str
    path: str
    source: str
    score: float


def _collection() -> Any | None:
    try:
        import chromadb
    except ImportError:
        return None
    try:
        client = chromadb.PersistentClient(path=SETTINGS.chroma_persist_dir)
        return client.get_or_create_collection("kyb_knowledge")
    except Exception as exc:
        log.warning("ChromaDB unavailable: %s", exc)
        return None


def retrieve(query: str, n: int = 5) -> list[KnowledgeHit]:
    col = _collection()
    if col is None:
        return []
    try:
        res = col.query(query_texts=[query], n_results=n)
    except Exception as exc:
        log.warning("Retrieval failed: %s", exc)
        return []

    hits: list[KnowledgeHit] = []
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    for doc, meta, dist in zip(docs, metas, dists):
        if not doc:
            continue
        hits.append(KnowledgeHit(
            text=doc,
            path=(meta or {}).get("path", ""),
            source=(meta or {}).get("source", ""),
            score=float(1.0 - float(dist)) if dist is not None else 0.0,
        ))
    return hits


def is_available() -> bool:
    return _collection() is not None
