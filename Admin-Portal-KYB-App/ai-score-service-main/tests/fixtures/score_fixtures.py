import pytest
import numpy as np
import pandas as pd
from typing import Dict, Any


@pytest.fixture
def business_score_scenarios():
    """Provide various business scoring scenarios for comprehensive testing."""
    return {
        "high_performing_business": {
            "score_input": {
                "revenue": 500000,
                "state": "CA",
                "naics_code": "541511",
                "age_business": 8,
                "count_employees": 25,
                "bs_total_assets": 750000,
                "bs_total_liabilities": 200000,
                "bs_total_equity": 550000,
                "is_net_income": 80000,
                "cf_operating_cash_flow": 90000,
                "ratio_debt_to_equity": 0.36,
                "ratio_return_on_assets": 0.11,
                "city": "San Francisco",
                "bus_struct": "Corporation",
                "count_bankruptcy": 0,
                "count_judgment": 0,
                "count_lien": 0
            },
            "expected_score_range": (0.7, 1.0)
        },
        "struggling_business": {
            "score_input": {
                "revenue": 50000,
                "state": "TX",
                "naics_code": "722511",
                "age_business": 2,
                "count_employees": 3,
                "bs_total_assets": 75000,
                "bs_total_liabilities": 80000,
                "bs_total_equity": -5000,
                "is_net_income": -10000,
                "cf_operating_cash_flow": -5000,
                "ratio_debt_to_equity": -16.0,
                "ratio_return_on_assets": -0.13,
                "city": "Austin",
                "bus_struct": "LLC",
                "count_bankruptcy": 1,
                "count_judgment": 0,
                "count_lien": 1
            },
            "expected_score_range": (0.0, 0.3)
        },
        "medium_business": {
            "score_input": {
                "revenue": 250000,
                "state": "NY",
                "naics_code": "541110",
                "age_business": 5,
                "count_employees": 12,
                "bs_total_assets": 400000,
                "bs_total_liabilities": 200000,
                "bs_total_equity": 200000,
                "is_net_income": 35000,
                "cf_operating_cash_flow": 40000,
                "ratio_debt_to_equity": 1.0,
                "ratio_return_on_assets": 0.09,
                "city": "New York",
                "bus_struct": "Partnership",
                "count_bankruptcy": 0,
                "count_judgment": 0,
                "count_lien": 0
            },
            "expected_score_range": (0.4, 0.7)
        }
    }


@pytest.fixture
def expected_model_outputs():
    """Define expected model output formats and ranges."""
    return {
        "prediction_format": {
            "prediction": float,
            "inputs": dict,
            "encodings": dict
        },
        "explanation_format": {
            "prediction": float,
            "inputs": dict,
            "encodings": dict,
            "explanations": dict,
            "explainer_base_prediction": float
        },
        "score_range": (0.0, 1.0)
    }


@pytest.fixture
def edge_case_score_inputs():
    """Provide edge case inputs for robust scoring testing."""
    return {
        "empty_input": {},
        "minimal_input": {
            "score_input": {
                "revenue": 50000,
                "state": "CA"
            }
        },
        "extreme_values": {
            "score_input": {
                "revenue": 1e10,  # Very large revenue
                "age_business": 0,  # New business
                "bs_total_liabilities": -1000,  # Negative liabilities
                "ratio_debt_to_equity": float('inf')  # Infinite ratio
            }
        },
        "boundary_values": {
            "score_input": {
                "revenue": 0,
                "age_business": 100,
                "ratio_return_on_assets": 1.0,
                "count_employees": 1
            }
        }
    }