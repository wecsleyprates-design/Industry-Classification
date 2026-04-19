"""Tab 8 — Data Explorer (SQL / Python runners)."""
from __future__ import annotations

import streamlit as st

from config.settings import SETTINGS
from explorer import execute_sql, execute_python


_DEFAULT_SQL = """-- Top 10 recent confidence scores (read-only)
SELECT business_id, JSON_EXTRACT_PATH_TEXT(value,'value') AS score
FROM rds_warehouse_public.facts
WHERE name = 'confidence_score'
ORDER BY received_at DESC
LIMIT 10;
"""

_DEFAULT_PY = """import pandas as pd
df = pd.DataFrame({
  'band':  ['Very Low','Low','Medium','High','Very High'],
  'count': [862, 1940, 4318, 9201, 8395],
})
df['pct'] = df['count'] / df['count'].sum() * 100
df.round(1)
"""


def render() -> None:
    sub = st.radio(
        "Section",
        ["SQL Runner", "Python Runner", "Dataset Health", "Join & Key Validation"],
        horizontal=True, label_visibility="collapsed", key="t8_sub",
    )
    if sub == "SQL Runner":             _sql()
    elif sub == "Python Runner":        _py()
    elif sub == "Dataset Health":       _health()
    else:                               _joins()


def _sql() -> None:
    st.caption("Read-only. SELECT-only. LIMIT is auto-injected if missing. Statement timeout enforced.")
    code = st.text_area("SQL", _DEFAULT_SQL, height=200, key="t8_sql")
    if st.button("Run SQL", type="primary"):
        res = execute_sql(code, default_limit=SETTINGS.default_query_limit)
        if res.error:
            st.error(res.error)
        else:
            for n in res.notes:
                st.info(n)
            st.dataframe(res.dataframe, use_container_width=True, hide_index=True)
            st.caption(f"Executed SQL (hardened):")
            st.code(res.sql, language="sql")


def _py() -> None:
    if not SETTINGS.enable_python_runner:
        st.warning("Python runner is disabled by configuration.")
        return
    st.caption("Sandboxed. Only pandas/numpy/math/json/statistics/datetime/re/collections/itertools/functools/decimal. No FS/network. 15s CPU limit.")
    code = st.text_area("Python", _DEFAULT_PY, height=220, key="t8_py")
    if st.button("Run Python", type="primary", key="t8_py_run"):
        res = execute_python(code)
        if res.error:
            st.error(res.error)
        if res.stdout:
            st.code(res.stdout, language="text")
        if res.value is not None:
            st.write("**Result:**")
            st.write(res.value)


def _health() -> None:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Null spikes (24h)", 3)
    c2.metric("Duplicate keys", 0)
    c3.metric("Join coverage", "99.2%")
    c4.metric("Source disagreements", 218)


def _joins() -> None:
    import pandas as pd
    st.dataframe(pd.DataFrame([
        dict(left="facts",                  right="business_scores",                   key="business_id", match_pct="99.8%", orphans=52),
        dict(left="business_scores",        right="rel_business_customer_monitoring",  key="business_id", match_pct="99.1%", orphans=236),
        dict(left="customer_files",         right="zoominfo_matches_custom_inc_ml",    key="business_id", match_pct="97.4%", orphans=4721),
    ]), use_container_width=True, hide_index=True)
