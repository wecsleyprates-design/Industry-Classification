"""Redshift connection using psycopg2."""
from __future__ import annotations

import os
import psycopg2
import psycopg2.extras
import streamlit as st
import pandas as pd


def establish_redshift_conn() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(
        dbname=os.getenv("REDSHIFT_DB", "dev"),
        user=os.getenv("REDSHIFT_USER", "readonly_all_access"),
        password=os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
        host=os.getenv(
            "REDSHIFT_HOST",
            "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com",
        ),
        port=int(os.getenv("REDSHIFT_PORT", "5439")),
        connect_timeout=15,
    )
    return conn


def run_query(sql: str, params: tuple | None = None) -> pd.DataFrame:
    """Execute SQL and return a DataFrame. Returns empty DataFrame on error."""
    try:
        conn = establish_redshift_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description] if cur.description else []
        conn.close()
        if not rows:
            return pd.DataFrame(columns=cols)
        return pd.DataFrame([dict(r) for r in rows], columns=cols)
    except Exception as exc:
        st.error(f"Redshift query error: {exc}")
        return pd.DataFrame()
