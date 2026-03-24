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
import faiss
from sentence_transformers import SentenceTransformer

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
        self._embed_model = SentenceTransformer(LOCAL_EMBED_MODEL)
        self._records: list[TaxonomyRecord] = []
        self._index: Optional[faiss.Index] = None

        if not rebuild and os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_META_PATH):
            self._load_from_disk()
        else:
            self._build()
            self._save_to_disk()

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
        taxonomy_filter: if given, restrict to those taxonomy names.
        """
        vec = self._embed(query)
        D, I = self._index.search(vec, min(top_k * 4, len(self._records)))

        results: list[tuple[TaxonomyRecord, float]] = []
        for dist, idx in zip(D[0], I[0]):
            if idx < 0 or idx >= len(self._records):
                continue
            rec = self._records[idx]
            if taxonomy_filter and rec.taxonomy not in taxonomy_filter:
                continue
            # FAISS IndexFlatIP returns inner product (cosine for L2-normalised)
            results.append((rec, float(dist)))
            if len(results) >= top_k:
                break

        return results

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

    def _build(self) -> None:
        logger.info("Building Unified Global Ontology FAISS index …")
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
                extra = {
                    k: v for k, v in row.items()
                    if k not in (code_col, desc_col) and v
                }
                rec = TaxonomyRecord(
                    taxonomy=taxonomy,
                    code=row[code_col].strip(),
                    description=row[desc_col].strip(),
                    extra=extra,
                )
                self._records.append(rec)
                descriptions.append(f"{taxonomy}: {rec.description}")

            logger.info(f"Loaded {len(df)} records from {taxonomy}")

        if not descriptions:
            raise RuntimeError("No taxonomy files loaded.")

        logger.info(f"Encoding {len(descriptions)} descriptions …")
        embeddings = self._embed_model.encode(
            descriptions,
            batch_size=256,
            convert_to_numpy=True,
            normalize_embeddings=True,   # needed for cosine via inner product
            show_progress_bar=True,
        ).astype(np.float32)

        dim = embeddings.shape[1]
        self._index = faiss.IndexFlatIP(dim)   # Inner Product = cosine on L2-norm
        self._index.add(embeddings)
        logger.info(f"UGO index built: {self._index.ntotal} vectors, dim={dim}")

    def _save_to_disk(self) -> None:
        os.makedirs(DATA_DIR, exist_ok=True)
        faiss.write_index(self._index, FAISS_INDEX_PATH)
        with open(FAISS_META_PATH, "wb") as f:
            pickle.dump(self._records, f)
        logger.info(f"UGO index saved to {FAISS_INDEX_PATH}")

    def _load_from_disk(self) -> None:
        self._index = faiss.read_index(FAISS_INDEX_PATH)
        with open(FAISS_META_PATH, "rb") as f:
            self._records = pickle.load(f)
        logger.info(f"UGO index loaded: {self._index.ntotal} vectors")

    def _embed(self, text: str) -> np.ndarray:
        vec = self._embed_model.encode(
            [text], convert_to_numpy=True, normalize_embeddings=True
        ).astype(np.float32)
        return vec
