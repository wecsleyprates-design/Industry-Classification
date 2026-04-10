import os
import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch, MagicMock

# Add the parent directory to the path so we can import the modules
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worth_score_model import WorthScoreModel

pytest_plugins = [
    "tests.fixtures.score_fixtures",
]


@pytest.fixture(autouse=True, scope="session")
def mock_external_dependencies():
    """Automatically mock external dependencies to prevent network connections in tests."""
    with patch("pickle.load") as mock_pickle_load:
        with patch("builtins.open") as mock_open:
            # Setup default mock returns for different model components
            mock_preprocessor = Mock()
            mock_neural_layer = Mock()
            mock_neural_layer.features = ['revenue', 'state', 'age_business']
            mock_calibrator = {'predictor': Mock(), 'explainer': Mock()}
            
            # Configure side effects based on file paths
            def pickle_side_effect(*args, **kwargs):
                filename = str(args[0]) if args else ""
                if "preprocessor" in filename.lower():
                    return mock_preprocessor
                elif "calibrator" in filename.lower():
                    return mock_calibrator
                else:
                    return Mock()
            
            mock_pickle_load.side_effect = pickle_side_effect
            yield mock_pickle_load


@pytest.fixture
def sample_score_input():
    """Provide a sample score input for testing."""
    return {
        "score_input": {
            "revenue": 100000,
            "state": "CA",
            "naics_code": "541511",
            "age_business": 5,
            "count_employees": 10,
            "bs_total_assets": 150000,
            "bs_total_liabilities": 75000,
            "bs_total_equity": 75000,
            "is_net_income": 25000,
            "cf_operating_cash_flow": 30000,
            "ratio_debt_to_equity": 1.0,
            "ratio_return_on_assets": 0.167,
            "city": "San Francisco",
            "bus_struct": "LLC",
            "count_bankruptcy": 0,
            "count_judgment": 0,
            "count_lien": 0
        }
    }


@pytest.fixture
def mock_pipeline_config():
    """Provide mock pipeline configuration for testing."""
    return [
        ('preprocessor', 'mock_preprocessor.pkl'),
        ('neural_layer', 'mock_neural_layer.pt'),
        ('calibrator', 'mock_calibrator.pkl')
    ]


@pytest.fixture
def mock_worth_score_model(mock_pipeline_config):
    """Create a mocked WorthScoreModel for testing."""
    with patch('worth_score_model.create_pipeline') as mock_create_pipeline:
        with patch('worth_score_model.create_explainer') as mock_create_explainer:
            mock_predictor = Mock()
            mock_predictor.transform.return_value = [{'final_proba': 0.75, 'feature1': 1.0}]
            mock_create_pipeline.return_value = mock_predictor
            
            mock_explainer = Mock()
            mock_explanation = Mock()
            mock_explanation.values = np.array([[0.1, 0.2, 0.3]])
            mock_explanation.base_values = np.array([0.5])
            mock_explainer.return_value = mock_explanation
            mock_create_explainer.return_value = mock_explainer
            
            model = WorthScoreModel(mock_pipeline_config)
            model._inputs = ['revenue', 'state', 'age_business']
            yield model