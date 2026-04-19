"""Tab 7 — Lineage & Data Discovery."""
from __future__ import annotations

import streamlit as st
import pandas as pd

from knowledge.metadata_catalog import TABLES, COLUMNS, FEATURES, GLOSSARY
from lineage import resolve_feature_lineage
from ui.components.kpi_card import panel, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Table Catalog", "Column Catalog", "Feature Registry", "Field Lineage", "Repo Explorer", "Glossary"],
        horizontal=True, label_visibility="collapsed", key="t7_sub",
    )
    if sub == "Table Catalog":      _tables()
    elif sub == "Column Catalog":   _columns()
    elif sub == "Feature Registry": _features()
    elif sub == "Field Lineage":    _lineage()
    elif sub == "Repo Explorer":    _repo()
    else:                           _glossary()


def _tables() -> None:
    st.markdown(panel("Table Catalog", "fa-database", object_key="catalog.tables"), unsafe_allow_html=True)
    q = st.text_input("Search schemas / tables…", "")
    rows = [t.__dict__ for t in TABLES]
    df = pd.DataFrame(rows)
    if q:
        mask = df.apply(lambda r: q.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
        df = df[mask]
    st.dataframe(df, use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _columns() -> None:
    st.markdown(panel("Column / Field Catalog", "fa-table-columns", object_key="catalog.columns"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([c.__dict__ for c in COLUMNS]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _features() -> None:
    st.markdown(panel("Feature Registry", "fa-boxes-stacked", object_key="feature.registry"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([f.__dict__ for f in FEATURES]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _lineage() -> None:
    st.markdown(panel("Field Lineage Explorer", "fa-diagram-project", object_key="lineage.explorer"), unsafe_allow_html=True)
    names = [f.name for f in FEATURES]
    pick = st.selectbox("Feature", names)
    lin = resolve_feature_lineage(pick)
    if not lin:
        st.warning("No lineage entry.")
    else:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown("**Upstream**")
            for t in lin.upstream_tables: st.markdown(f"- `{t}`")
        with c2:
            st.markdown(f"**Feature: `{lin.name}`**")
            st.markdown(f"Owner: {lin.owner}")
        with c3:
            st.markdown("**Downstream**")
            for d in lin.downstream: st.markdown(f"- `{d}`")
        if lin.related_code:
            st.markdown("**Related code (RAG index)**")
            for p in lin.related_code: st.markdown(f"- `{p}`")
        else:
            st.caption("RAG index not built — run `python scripts/index_knowledge.py` to populate.")
    st.markdown(panel_close(), unsafe_allow_html=True)


def _repo() -> None:
    st.markdown(panel("Repo Explorer", "fa-folder-tree", object_key="repo.explorer"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([
        {"path":"integration-service/lib/facts/kyb/index.ts",            "role":"fact definitions"},
        {"path":"integration-service/lib/facts/businessDetails/index.ts", "role":"business-detail facts"},
        {"path":"integration-service/lib/facts/rules.ts",                 "role":"winner/priority rules"},
        {"path":"integration-service/lib/facts/sources.ts",               "role":"source/platformId registry"},
        {"path":"ai-score-service/aiscore.py",                            "role":"confidence model scoring"},
        {"path":"ai-score-service/worth_score_model.py",                  "role":"model training"},
        {"path":"warehouse-service/.../customer_table.sql",               "role":"Pipeline B join"},
        {"path":"api-docs/openapi-specs/get-kyb.json",                    "role":"authoritative schema"},
    ]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _glossary() -> None:
    st.markdown(panel("Glossary & Definitions", "fa-book", object_key="copilot.glossary"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame(GLOSSARY, columns=["term","definition"]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)
