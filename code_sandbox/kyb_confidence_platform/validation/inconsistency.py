"""Portfolio inconsistency aggregates."""
from __future__ import annotations

import pandas as pd

from core.logger import get_logger
from data_access import fixtures
from data_access.redshift import query as rs_query
from data_access.queries import inconsistency

log = get_logger(__name__)


def get_inconsistency_counts() -> pd.DataFrame:
    # In production these come from a curated `datascience.inconsistency_events_daily` table.
    return fixtures.inconsistency_counts()


def get_red_flag_ranking() -> pd.DataFrame:
    return fixtures.red_flag_ranking()


def get_cross_reference_checks() -> pd.DataFrame:
    try:
        df_tin = rs_query(inconsistency.shared_tin_sql())
        df_addr = rs_query(inconsistency.shared_address_sql())
        return pd.concat([
            df_tin.assign(check="shared_tin"),
            df_addr.assign(check="shared_address"),
        ], ignore_index=True)
    except Exception as exc:
        log.info("xref fallback: %s", exc)
        return pd.DataFrame([
            dict(check="shared_tin",     key="XX-XXX4821",           n_businesses=2),
            dict(check="shared_address", key="123 Dock St, Trenton", n_businesses=6),
            dict(check="shared_ubo",     key="Rita Chen",             n_businesses=4),
        ])


def get_not_matching_review() -> pd.DataFrame:
    return pd.DataFrame([
        dict(case="bus_87f2…1234", score=0.83, evidence="UBO verified 1/3",             gap="High conf vs weak UBO evidence",         severity="high"),
        dict(case="bus_b94a…6612", score=0.77, evidence="TIN mismatch across sources",  gap="Score ignores Trulioo TIN=fail",          severity="high"),
        dict(case="bus_c1f9…aa01", score=0.28, evidence="All 3 UBOs verified",          gap="Low conf despite clean evidence",         severity="medium"),
        dict(case="bus_d03e…7712", score=0.71, evidence="Dissolved per OC",             gap="High conf despite OC dissolved status",   severity="high"),
        dict(case="bus_f221…8829", score=0.55, evidence="Address mismatch USPS/SOS",    gap="Conf unchanged despite address gap",       severity="medium"),
    ])
