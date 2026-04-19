"""
Quick probe of Redshift connectivity.

Usage:
    python scripts/verify_redshift.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_access.redshift import ping, query


def main() -> None:
    ok, msg = ping()
    print(f"ping: ok={ok} msg={msg}")
    if not ok:
        return
    try:
        df = query("SELECT 1 AS probe LIMIT 1")
        print("probe result:")
        print(df)
    except Exception as exc:
        print(f"probe failed: {exc}")


if __name__ == "__main__":
    main()
