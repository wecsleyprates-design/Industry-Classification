"""
Portfolio-level analytics.

Each function falls back to the fixtures module if Redshift isn't available, so
all tabs remain demoable even without a warehouse connection.
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from core.filters import current_filters
from core.logger import get_logger
from data_access import fixtures
from data_access.redshift import query as rs_query
from data_access.queries import portfolio, decisions, features

log = get_logger(__name__)


def _window() -> tuple[date, date]:
    return current_filters().resolve_window()


def _try_query(sql: str) -> pd.DataFrame | None:
    try:
        return rs_query(sql)
    except Exception as exc:
        log.info("analytics: falling back to fixtures (%s)", exc)
        return None


def get_portfolio_summary() -> pd.DataFrame:
    s, e = _window()
    df = _try_query(portfolio.summary_sql(s, e))
    return df if df is not None and not df.empty else fixtures.portfolio_summary()


def get_confidence_bands() -> pd.DataFrame:
    s, e = _window()
    df = _try_query(portfolio.bands_sql(s, e))
    return df if df is not None and not df.empty else fixtures.confidence_bands()


def get_confidence_trend() -> pd.DataFrame:
    s, e = _window()
    df = _try_query(portfolio.trend_sql(s, e))
    return df if df is not None and not df.empty else fixtures.confidence_trend()


def get_volume_trend() -> pd.DataFrame:
    # Fixture-only for now; SQL would join scoring volume and manual review counts.
    return pd.DataFrame({
        "week":    [f"W{i}" for i in range(1, 13)],
        "scored":  [1820, 1910, 2050, 2160, 2230, 2190, 2340, 2410, 2380, 2450, 2520, 2616],
        "manual":  [310, 295, 320, 280, 260, 250, 245, 230, 220, 215, 205, 195],
    })


def get_psi_trend() -> pd.DataFrame:
    df = _try_query(features.psi_weekly_sql("confidence_score"))
    if df is not None and not df.empty:
        return df
    return pd.DataFrame({
        "week": [f"W{i}" for i in range(1, 13)],
        "psi":  [0.08, 0.09, 0.10, 0.12, 0.14, 0.18, 0.22, 0.21, 0.19, 0.16, 0.14, 0.13],
    })


def get_feature_importance() -> pd.DataFrame:
    return fixtures.feature_importance()


def get_decisions_by_band() -> pd.DataFrame:
    s, e = _window()
    df = _try_query(decisions.decision_by_band_sql(s, e))
    if df is not None and not df.empty:
        return df
    return pd.DataFrame({
        "band":      ["Very Low","Low","Medium","High","Very High"] * 3,
        "decision":  (["Approved"]*5) + (["Escalated"]*5) + (["Declined"]*5),
        "n":         [60,220,1400,7100,8050, 52,210,1068,1861,295, 750,1510,1850,240,50],
    })


def get_tat_by_band() -> pd.DataFrame:
    s, e = _window()
    df = _try_query(decisions.tat_by_band_sql(s, e))
    if df is not None and not df.empty:
        return df
    return pd.DataFrame({
        "band":       ["Very Low","Low","Medium","High","Very High"],
        "p50_hours":  [48, 24, 12, 3, 1],
        "p90_hours":  [72, 48, 28, 8, 4],
    })


def get_ops_exceptions() -> pd.DataFrame:
    return pd.DataFrame([
        dict(type="Stuck at Scoring",      count=27, age_h=18, severity="medium"),
        dict(type="Pipeline Failure",      count=6,  age_h=36, severity="high"),
        dict(type="Manual Review Overdue", count=42, age_h=72, severity="high"),
        dict(type="Stale Feature Usage",   count=88, age_h=96, severity="medium"),
    ])


def get_source_reliability() -> pd.DataFrame:
    return pd.DataFrame([
        dict(source="Middesk",       freshness="6h",  failure_pct=1.2, reliability="High"),
        dict(source="OpenCorporates",freshness="12h", failure_pct=3.4, reliability="High"),
        dict(source="Trulioo",       freshness="4h",  failure_pct=2.1, reliability="High"),
        dict(source="Equifax",       freshness="24h", failure_pct=5.8, reliability="Medium"),
        dict(source="ZoomInfo",      freshness="24h", failure_pct=4.1, reliability="Medium"),
        dict(source="Plaid IDV",     freshness="2h",  failure_pct=0.9, reliability="High"),
        dict(source="AI NAICS",      freshness="1h",  failure_pct=8.5, reliability="Low"),
    ])


def get_null_rates() -> pd.DataFrame:
    df = _try_query(features.null_rates_sql())
    if df is not None and not df.empty:
        return df
    return pd.DataFrame([
        dict(feature="ubo_verified",            rate=0.18, threshold=0.10, status="amber"),
        dict(feature="website_domain_age",      rate=0.22, threshold=0.15, status="amber"),
        dict(feature="address_contact_overlap", rate=0.09, threshold=0.10, status="green"),
        dict(feature="tin_validation_status",   rate=0.03, threshold=0.05, status="green"),
        dict(feature="naics_confidence",        rate=0.31, threshold=0.20, status="red"),
        dict(feature="entity_age_days",         rate=0.02, threshold=0.05, status="green"),
    ])
