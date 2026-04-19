"""
CLI to build the local ChromaDB knowledge index.

Usage:
    python scripts/index_knowledge.py --source /path/to/repo [--source /path/to/other]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure we can import the project package when run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from knowledge.rag.indexer import index_sources
from knowledge.rag.sources import make_source


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--source", action="append", required=True, help="Path to a source folder to index (can be passed multiple times).")
    args = p.parse_args()

    specs = [make_source(s) for s in args.source]
    stats = index_sources(specs)
    print(f"Indexed: {stats}")


if __name__ == "__main__":
    main()
