"""Unit tests for PII masking."""
from __future__ import annotations

import pandas as pd

from data_access.pii import mask_dataframe, mask_value


def test_mask_tin():
    assert mask_value("12-3456789", "tin").endswith("6789")


def test_mask_email():
    assert "***" in mask_value("john.smith@example.com", "email")


def test_mask_phone():
    v = mask_value("+1 (415) 555-2671", "phone")
    assert v.endswith("2671")
    assert "***" in v


def test_mask_dataframe_picks_sensitive_cols():
    df = pd.DataFrame({
        "business_id": ["bus_1", "bus_2"],
        "tin":          ["12-3456789", "98-7654321"],
        "email":        ["a@b.com", "c@d.com"],
    })
    m = mask_dataframe(df)
    for v in m["tin"]:
        assert "XX-XXX" in v
    for v in m["email"]:
        assert "***" in v
