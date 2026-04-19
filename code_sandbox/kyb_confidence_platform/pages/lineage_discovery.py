"""Tab 7 — Lineage & Data Discovery."""
from __future__ import annotations

import streamlit as st
import pandas as pd

from knowledge.metadata_catalog import TABLES, COLUMNS, FEATURES, GLOSSARY
from lineage import resolve_feature_lineage


def render() -> None:
    sub = st.radio(
        "Section",
        ["Table Catalog", "Column Catalog", "Feature Registry", "Field Lineage", "Repo Explorer", "Glossary"],
        horizontal=True, label_visibility="collapsed", key="t7_sub",
    )
    if sub == "Table Catalog":     _tables()
    elif sub == "Column Catalog":  _columns()
    elif sub == "Feature Registry":_features()
    elif sub == "Field Lineage":   _lineage()
    elif sub == "Repo Explorer":   _repo()
    else:                          _glossary()


def _tables() -> None:
    st.subheader("Tables")
    q = st.text_input("Search", "")
    rows = [t.__dict__ for t in TABLES]
    df = pd.DataFrame(rows)
    if q:
        m = df.apply(lambda r: q.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
        df = df[m]
    st.dataframe(df, use_container_width=True, hide_index=True)


def _columns() -> None:
    st.subheader("Columns")
    st.dataframe(pd.DataFrame([c.__dict__ for c in COLUMNS]), use_container_width=True, hide_index=True)


def _features() -> None:
    st.subheader("Features")
    st.dataframe(pd.DataFrame([f.__dict__ for f in FEATURES]), use_container_width=True, hide_index=True)


def _lineage() -> None:
    st.subheader("Field / feature lineage")
    names = [f.name for f in FEATURES]
    pick = st.selectbox("Feature", names)
    lin = resolve_feature_lineage(pick)
    if not lin:
        st.warning("No lineage entry.")
        return
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
        st.markdown("**Related code (from RAG index)**")
        for p in lin.related_code: st.markdown(f"- `{p}`")
    else:
        st.caption("RAG index not built. Run `python scripts/index_knowledge.py --source <repo>` to populate this section.")


def _repo() -> None:
    st.subheader("Repo explorer")
    rows = [
        ("integration-service/lib/facts/kyb/index.ts",            "fact definitions"),
        ("integration-service/lib/facts/businessDetails/index.ts","business-detail facts"),
        ("integration-service/lib/facts/rules.ts",                "winner/priority rules"),
        ("integration-service/lib/facts/sources.ts",              "source/platformId registry"),
        ("ai-score-service/aiscore.py",                           "confidence model scoring"),
        ("ai-score-service/worth_score_model.py",                 "model training"),
        ("warehouse-service/.../customer_table.sql",              "Pipeline B join"),
        ("api-docs/openapi-specs/get-kyb.json",                   "authoritative schema"),
    ]
    st.dataframe(pd.DataFrame(rows, columns=["path","role"]), use_container_width=True, hide_index=True)


def _glossary() -> None:
    st.subheader("Glossary")
    st.dataframe(pd.DataFrame(GLOSSARY, columns=["term","definition"]), use_container_width=True, hide_index=True)
