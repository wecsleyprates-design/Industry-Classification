"""
Best-effort export helpers.

In this prototype we produce download buttons in-place; a full implementation
would walk the current tab's dataframes and bundle them.
"""
from __future__ import annotations

import io
import json

import pandas as pd
import streamlit as st

from core.filters import current_filters


def export_current_view(fmt: str) -> None:
    fmt = fmt.lower()
    filters = current_filters().__dict__
    payload = {"filters": filters, "note": "Replace with the dataframes of the active tab."}
    if fmt == "csv":
        df = pd.DataFrame([payload])
        st.download_button("Download CSV", df.to_csv(index=False), "export.csv", "text/csv")
    elif fmt == "xlsx":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            pd.DataFrame([payload]).to_excel(w, index=False, sheet_name="snapshot")
        st.download_button("Download XLSX", buf.getvalue(), "export.xlsx",
                           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    elif fmt == "json":
        st.download_button("Download JSON", json.dumps(payload, default=str, indent=2),
                           "export.json", "application/json")
    elif fmt == "pdf":
        try:
            from .pdf_snapshot import render_pdf_snapshot
            data = render_pdf_snapshot(filters)
            st.download_button("Download PDF", data, "snapshot.pdf", "application/pdf")
        except Exception as exc:
            st.warning(f"PDF export unavailable: {exc}")
