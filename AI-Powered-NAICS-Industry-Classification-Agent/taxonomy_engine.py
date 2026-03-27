"""
Taxonomy Engine — Unified Global Ontology (UGO)
================================================
Loads all six taxonomy files (NAICS 2022, US SIC 1987, UK SIC 2007,
NACE Rev2, ISIC Rev4, MCC) and builds a shared FAISS index so that
any industry code or label can be queried against the full cross-
ontology vector space (Cross-Ontology Embedding Alignment).

The UGO index is built once and cached to disk; subsequent runs load
from disk in <1 s.
"""

from __future__ import annotations

import os
import pickle
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

try:
    import faiss
    _FAISS_AVAILABLE = True
except ImportError:
    _FAISS_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False

from config import (
    DATA_DIR,
    TAXONOMY_FILES,
    FAISS_INDEX_PATH,
    FAISS_META_PATH,
    LOCAL_EMBED_MODEL,
    UGO_TOP_K,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@dataclass
class TaxonomyRecord:
    taxonomy: str          # e.g. "US_NAICS_2022"
    code: str
    description: str
    extra: dict = field(default_factory=dict)  # sector, division, category …


class TaxonomyEngine:
    """
    Loads all taxonomy tables and exposes a unified FAISS semantic search.

    Usage
    -----
    engine = TaxonomyEngine()
    results = engine.search("licensed restaurant", top_k=5)
    # returns list of TaxonomyRecord sorted by similarity
    """

    # ── Column name normalisation per file ───────────────────────────────────
    _COL_MAP: dict[str, tuple[str, str]] = {
        "US_NAICS_2022": ("code", "description"),
        "US_SIC_1987":   ("code", "description"),
        "UK_SIC_2007":   ("code", "description"),
        "NACE_REV2":     ("code", "description"),
        "ISIC_REV4":     ("code", "description"),
        "MCC":           ("code", "description"),
    }

    def __init__(self, rebuild: bool = False) -> None:
        if _ST_AVAILABLE:
            self._embed_model = SentenceTransformer(LOCAL_EMBED_MODEL)
        else:
            self._embed_model = None
            logger.warning("sentence-transformers not available — semantic search disabled, using keyword fallback.")

        self._records: list[TaxonomyRecord] = []
        self._index = None

        if not rebuild and os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_META_PATH):
            self._load_from_disk()
        elif _ST_AVAILABLE and _FAISS_AVAILABLE:
            self._build()
            self._save_to_disk()
        else:
            # No embeddings available — still load taxonomy records for keyword search
            self._build_records_only()

    # ── Public API ────────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        top_k: int = UGO_TOP_K,
        taxonomy_filter: Optional[list[str]] = None,
    ) -> list[tuple[TaxonomyRecord, float]]:
        """
        Semantic search across all taxonomies.

        Returns list of (TaxonomyRecord, cosine_similarity) sorted descending.
        Falls back to keyword substring matching when FAISS index is unavailable.
        taxonomy_filter: if given, restrict to those taxonomy names.
        """
        if self._index is None or self._embed_model is None:
            return self._keyword_search(query, top_k, taxonomy_filter)

        vec = self._embed(query)
        D, I = self._index.search(vec, min(top_k * 4, len(self._records)))

        results: list[tuple[TaxonomyRecord, float]] = []
        for dist, idx in zip(D[0], I[0]):
            if idx < 0 or idx >= len(self._records):
                continue
            rec = self._records[idx]
            if taxonomy_filter and rec.taxonomy not in taxonomy_filter:
                continue
            results.append((rec, float(dist)))
            if len(results) >= top_k:
                break

        return results

    def _keyword_search(
        self,
        query: str,
        top_k: int,
        taxonomy_filter: Optional[list[str]] = None,
    ) -> list[tuple[TaxonomyRecord, float]]:
        """Simple keyword substring fallback used when FAISS is unavailable."""
        q = query.lower()
        words = q.split()
        pool = self._records
        if taxonomy_filter:
            pool = [r for r in pool if r.taxonomy in taxonomy_filter]
        scored = []
        for rec in pool:
            desc = rec.description.lower()
            hits = sum(1 for w in words if w in desc)
            if hits:
                scored.append((rec, hits / max(len(words), 1)))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def get_all_for_taxonomy(self, taxonomy: str) -> list[TaxonomyRecord]:
        return [r for r in self._records if r.taxonomy == taxonomy]

    def lookup_code(self, code: str, taxonomy: Optional[str] = None) -> Optional[TaxonomyRecord]:
        for r in self._records:
            if r.code == str(code):
                if taxonomy is None or r.taxonomy == taxonomy:
                    return r
        return None

    def compute_semantic_distance(self, label_a: str, label_b: str) -> float:
        """Cosine distance (0=identical, 1=orthogonal) between two labels."""
        if self._embed_model is None:
            # Keyword fallback: Jaccard distance on word sets
            a = set(label_a.lower().split())
            b = set(label_b.lower().split())
            if not a and not b:
                return 0.0
            return round(1.0 - len(a & b) / max(len(a | b), 1), 4)
        vecs = self._embed_model.encode(
            [label_a, label_b], convert_to_numpy=True, normalize_embeddings=True
        )
        similarity = float(np.dot(vecs[0], vecs[1]))
        return round(1.0 - similarity, 4)

    def cross_taxonomy_agreement(
        self, label: str, taxonomies: Optional[list[str]] = None
    ) -> dict[str, list[TaxonomyRecord]]:
        """
        For a given free-text label, returns the top match per taxonomy,
        grouped by taxonomy name.
        """
        results = self.search(label, top_k=len(self._records), taxonomy_filter=taxonomies)
        by_tax: dict[str, list[TaxonomyRecord]] = {}
        for rec, _ in results:
            by_tax.setdefault(rec.taxonomy, []).append(rec)
        # Keep top-3 per taxonomy
        return {k: v[:3] for k, v in by_tax.items()}

    @property
    def record_count(self) -> int:
        return len(self._records)

    # ── Internal ─────────────────────────────────────────────────────────────

    def _load_records(self) -> list[str]:
        """Load TaxonomyRecords from CSV files. Returns list of description strings."""
        descriptions: list[str] = []
        for taxonomy, filename in TAXONOMY_FILES.items():
            path = os.path.join(DATA_DIR, filename)
            if not os.path.exists(path):
                logger.warning(f"Missing taxonomy file: {path}")
                continue
            df = pd.read_csv(path, dtype=str).fillna("")
            code_col, desc_col = self._COL_MAP.get(taxonomy, ("code", "description"))
            if code_col not in df.columns or desc_col not in df.columns:
                logger.warning(f"Unexpected columns in {filename}: {df.columns.tolist()}")
                continue
            for _, row in df.iterrows():
                extra = {k: v for k, v in row.items() if k not in (code_col, desc_col) and v}
                rec = TaxonomyRecord(
                    taxonomy=taxonomy,
                    code=row[code_col].strip(),
                    description=row[desc_col].strip(),
                    extra=extra,
                )
                self._records.append(rec)
                descriptions.append(f"{taxonomy}: {rec.description}")
            logger.info(f"Loaded {len(df)} records from {taxonomy}")
        return descriptions

    def _build_records_only(self) -> None:
        """Load records without building FAISS index (keyword-only fallback)."""
        logger.info("Building taxonomy record list (no FAISS — keyword search mode) …")
        self._load_records()
        logger.info(f"Loaded {len(self._records)} taxonomy records (no vector index)")

    def _build(self) -> None:
        logger.info("Building Unified Global Ontology FAISS index …")
        descriptions = self._load_records()

        if not descriptions:
            logger.warning("No taxonomy files loaded — running in keyword-only mode.")
            return

        logger.info(f"Encoding {len(descriptions)} descriptions …")
        embeddings = self._embed_model.encode(
            descriptions,
            batch_size=256,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).astype(np.float32)

        dim = embeddings.shape[1]
        self._index = faiss.IndexFlatIP(dim)
        self._index.add(embeddings)
        logger.info(f"UGO index built: {self._index.ntotal} vectors, dim={dim}")

    def _save_to_disk(self) -> None:
        if self._index is None or not _FAISS_AVAILABLE:
            return
        os.makedirs(DATA_DIR, exist_ok=True)
        faiss.write_index(self._index, FAISS_INDEX_PATH)
        with open(FAISS_META_PATH, "wb") as f:
            pickle.dump(self._records, f)
        logger.info(f"UGO index saved to {FAISS_INDEX_PATH}")

    def _load_from_disk(self) -> None:
        if not _FAISS_AVAILABLE:
            self._build_records_only()
            return
        self._index = faiss.read_index(FAISS_INDEX_PATH)
        with open(FAISS_META_PATH, "rb") as f:
            self._records = pickle.load(f)
        logger.info(f"UGO index loaded: {self._index.ntotal} vectors")

    def _embed(self, text: str) -> np.ndarray:
        vec = self._embed_model.encode(
            [text], convert_to_numpy=True, normalize_embeddings=True
        ).astype(np.float32)
        return vec
