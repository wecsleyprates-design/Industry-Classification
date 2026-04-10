import unittest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import numpy as np
import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worth_score_model import WorthScoreModel


class TestWorthScoreModelMethods(unittest.TestCase):
    """Unit tests for individual methods in WorthScoreModel."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_pipeline = [
            ('preprocessor', 'test_preprocessor.pkl'),
            ('neural_layer', 'test_neural.pt'),
            ('calibrator', 'test_calibrator.pkl')
        ]
        
        self.sample_data = {
            'revenue': 100000,
            'state': 'CA',
            'naics_code': '541511',
            'age_business': 5,
            'count_employees': 10,
            'bs_total_assets': 50000,
            'bs_total_liabilities': 30000
        }

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_predict_method_returns_dict(self, mock_explainer, mock_pipeline):
        """Test that _predict method returns a dictionary."""
        mock_predictor = Mock()
        mock_predictor.transform.return_value = [{'final_proba': 0.75, 'feature1': 1.0}]
        mock_pipeline.return_value = mock_predictor
        
        model = WorthScoreModel(self.test_pipeline)
        result = model._predict(self.sample_data)
        
        self.assertIsInstance(result, dict)
        # Verify the predictor was called with our sample data
        mock_predictor.transform.assert_called_once_with(self.sample_data)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    @patch('worth_score_model.pd.DataFrame')
    def test_explain_method_structure(self, mock_df, mock_explainer_func, mock_pipeline):
        """Test that _explain method returns proper structure."""
        # Mock the explainer
        mock_explainer = Mock()
        mock_explanation = Mock()
        mock_explanation.values = np.array([[0.1, 0.2, 0.3, 0.4]])
        mock_explanation.base_values = np.array([0.5])
        mock_explainer.return_value = mock_explanation
        mock_explainer_func.return_value = mock_explainer
        
        model = WorthScoreModel(self.test_pipeline)
        model._inputs = ['revenue', 'state', 'naics_code', 'age_business']
        
        result = model._explain(self.sample_data)
        
        self.assertIsInstance(result, dict)
        self.assertIn('base_value', result)
        self.assertEqual(len(result), 5)  # 4 features + base_value
        
        for input_name in model._inputs:
            self.assertIn(input_name, result)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_evaluate_prediction_extraction(self, mock_explainer, mock_pipeline):
        """Test that evaluate properly extracts prediction from final_proba."""
        mock_predictor = Mock()
        prediction_data = {'final_proba': 0.85, 'encoded_feature': 2.1, 'other_data': 'test'}
        mock_predictor.transform.return_value = [prediction_data.copy()]
        mock_pipeline.return_value = mock_predictor
        
        model = WorthScoreModel(self.test_pipeline)
        result = model.evaluate(self.sample_data, with_explanations=False)
        
        self.assertEqual(result['prediction'], 0.85)
        self.assertEqual(result['inputs'], self.sample_data)
        
        # Check that final_proba is removed from encodings
        expected_encodings = {'encoded_feature': 2.1, 'other_data': 'test'}
        self.assertEqual(result['encodings'], expected_encodings)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_evaluate_handles_missing_final_proba(self, mock_explainer, mock_pipeline):
        """Test evaluate handles case where final_proba is missing."""
        mock_predictor = Mock()
        mock_predictor.transform.return_value = [{'other_feature': 1.0}]
        mock_pipeline.return_value = mock_predictor
        
        model = WorthScoreModel(self.test_pipeline)
        
        with self.assertRaises(KeyError):
            model.evaluate(self.sample_data, with_explanations=False)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer') 
    def test_evaluate_boundary_values(self, mock_explainer, mock_pipeline):
        """Test evaluate with boundary prediction values."""
        mock_predictor = Mock()
        mock_pipeline.return_value = mock_predictor
        
        # Test with 0.0 prediction
        mock_predictor.transform.return_value = [{'final_proba': 0.0}]
        model = WorthScoreModel(self.test_pipeline)
        result = model.evaluate(self.sample_data, with_explanations=False)
        self.assertEqual(result['prediction'], 0.0)
        
        # Test with 1.0 prediction
        mock_predictor.transform.return_value = [{'final_proba': 1.0}]
        result = model.evaluate(self.sample_data, with_explanations=False)
        self.assertEqual(result['prediction'], 1.0)


class TestWorthScoreModelValidation(unittest.TestCase):
    """Tests for input validation and error handling."""

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_evaluate_with_invalid_input_types(self, mock_explainer, mock_pipeline):
        """Test evaluate with various invalid input types."""
        mock_predictor = Mock()
        # Make the mock transform method raise an error when called with invalid input
        def side_effect(x):
            if x is None or isinstance(x, str):
                raise TypeError("Invalid input type")
            return [{'final_proba': 0.5}]
        
        mock_predictor.transform.side_effect = side_effect
        mock_pipeline.return_value = mock_predictor
        
        model = WorthScoreModel([])
        
        # Test with None input - should raise TypeError
        with self.assertRaises(TypeError):
            model._predict(None)
        
        # Test with string input - should raise TypeError
        with self.assertRaises(TypeError):
            model._predict("invalid")

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_inputs_list_initialization(self, mock_explainer, mock_pipeline):
        """Test that _inputs list is properly initialized."""
        with patch('worth_score_model.INPUTS', {'input1': 'type1', 'input2': 'type2'}):
            model = WorthScoreModel([])
            self.assertEqual(model._inputs, ['input1', 'input2'])
            self.assertIsInstance(model._inputs, list)


if __name__ == '__main__':
    unittest.main()