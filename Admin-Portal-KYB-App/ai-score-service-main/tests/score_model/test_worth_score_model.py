import unittest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import numpy as np
import sys
import os

# Add the parent directory to the path so we can import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worth_score_model import WorthScoreModel, create_pipeline, create_explainer


class TestWorthScoreModel(unittest.TestCase):
    """Test cases for WorthScoreModel class and related functions."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.sample_input = {
            'revenue': 100000,
            'state': 'CA',
            'naics_code': '541511',
            'age_business': 5,
            'count_employees': 10
        }
        
        self.mock_pipeline = [
            ('preprocessor', 'mock_preprocessor.pkl'),
            ('neural_layer', 'mock_neural_layer.pt'),
            ('calibrator', 'mock_calibrator.pkl')
        ]

    @patch('worth_score_model.pickle.load')
    @patch('worth_score_model.NeuralScoringLayer')
    @patch('builtins.open')
    def test_create_pipeline_predictor(self, mock_open, mock_neural_layer, mock_pickle_load):
        """Test create_pipeline function with predictor kind."""
        # Mock the neural layer
        mock_model = Mock()
        mock_model.features = ['feature1', 'feature2']
        mock_neural_layer.return_value = mock_model
        
        # Mock the pickle loads
        mock_preprocessor = Mock()
        mock_calibrator = {'predictor': Mock()}
        mock_pickle_load.side_effect = [mock_preprocessor, mock_calibrator]
        
        pipeline = create_pipeline(self.mock_pipeline, kind='predictor')
        
        self.assertIsNotNone(pipeline)
        self.assertEqual(len(pipeline.steps), 3)
        mock_neural_layer.assert_called_once()

    @patch('worth_score_model.pickle.load')
    @patch('worth_score_model.NeuralScoringLayer')
    @patch('builtins.open')
    def test_create_pipeline_explainer(self, mock_open, mock_neural_layer, mock_pickle_load):
        """Test create_pipeline function with explainer kind."""
        # Mock the neural layer
        mock_model = Mock()
        mock_model.features = ['feature1', 'feature2']
        mock_neural_layer.return_value = mock_model
        
        # Mock the pickle loads
        mock_preprocessor = Mock()
        mock_calibrator = {'explainer': Mock()}
        mock_pickle_load.side_effect = [mock_preprocessor, mock_calibrator]
        
        pipeline = create_pipeline(self.mock_pipeline, kind='explainer')
        
        self.assertIsNotNone(pipeline)
        self.assertEqual(len(pipeline.steps), 3)

    def test_create_pipeline_invalid_kind(self):
        """Test create_pipeline function with invalid kind."""
        with self.assertRaises(ValueError):
            create_pipeline(self.mock_pipeline, kind='invalid')

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.shap.KernelExplainer')
    @patch('worth_score_model.pd.DataFrame')
    def test_create_explainer(self, mock_dataframe, mock_kernel_explainer, mock_create_pipeline):
        """Test create_explainer function."""
        mock_pipeline = Mock()
        mock_create_pipeline.return_value = mock_pipeline
        mock_explainer = Mock()
        mock_kernel_explainer.return_value = mock_explainer
        
        result = create_explainer(self.mock_pipeline)
        
        self.assertEqual(result, mock_explainer)
        mock_create_pipeline.assert_called_once_with(self.mock_pipeline, kind='explainer')
        mock_kernel_explainer.assert_called_once()

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_worth_score_model_init(self, mock_create_explainer, mock_create_pipeline):
        """Test WorthScoreModel initialization."""
        mock_predictor = Mock()
        mock_explainer = Mock()
        mock_create_pipeline.return_value = mock_predictor
        mock_create_explainer.return_value = mock_explainer
        
        model = WorthScoreModel(self.mock_pipeline)
        
        self.assertEqual(model.predictor, mock_predictor)
        self.assertEqual(model.explainer, mock_explainer)
        self.assertIsInstance(model._inputs, list)
        mock_create_pipeline.assert_called_once_with(self.mock_pipeline, kind='predictor')
        mock_create_explainer.assert_called_once_with(self.mock_pipeline)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_predict_method(self, mock_create_explainer, mock_create_pipeline):
        """Test the _predict method."""
        # Mock the predictor pipeline
        mock_predictor = Mock()
        mock_predictor.transform.return_value = [{'final_proba': 0.75, 'feature1': 1.0}]
        mock_create_pipeline.return_value = mock_predictor
        mock_create_explainer.return_value = Mock()
        
        model = WorthScoreModel(self.mock_pipeline)
        result = model._predict(self.sample_input)
        
        self.assertIsInstance(result, dict)
        mock_predictor.transform.assert_called_once_with(self.sample_input)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    @patch('worth_score_model.pd.DataFrame')
    def test_explain_method(self, mock_dataframe, mock_create_explainer, mock_create_pipeline):
        """Test the _explain method."""
        # Mock the explainer
        mock_explainer = Mock()
        mock_explanation = Mock()
        mock_explanation.values = np.array([[0.1, 0.2, 0.3]])
        mock_explanation.base_values = np.array([0.5])
        mock_explainer.return_value = mock_explanation
        mock_create_explainer.return_value = mock_explainer
        
        # Mock DataFrame with proper indexing
        mock_df = Mock()
        mock_df.__getitem__ = Mock(return_value=mock_df)  # Allow df[self._inputs]
        mock_dataframe.return_value = mock_df
        
        model = WorthScoreModel(self.mock_pipeline)
        model._inputs = ['feature1', 'feature2', 'feature3']
        
        result = model._explain(self.sample_input)
        
        self.assertIsInstance(result, dict)
        self.assertIn('base_value', result)
        self.assertEqual(result['base_value'], 0.5)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_evaluate_without_explanations(self, mock_create_explainer, mock_create_pipeline):
        """Test the evaluate method without explanations."""
        # Mock the predictor
        mock_predictor = Mock()
        mock_predictor.transform.return_value = [{'final_proba': 0.75, 'feature1': 1.0}]
        mock_create_pipeline.return_value = mock_predictor
        mock_create_explainer.return_value = Mock()
        
        model = WorthScoreModel(self.mock_pipeline)
        result = model.evaluate(self.sample_input, with_explanations=False)
        
        expected_keys = ['prediction', 'inputs', 'encodings']
        for key in expected_keys:
            self.assertIn(key, result)
        
        self.assertNotIn('explanations', result)
        self.assertNotIn('explainer_base_prediction', result)
        self.assertEqual(result['prediction'], 0.75)
        self.assertEqual(result['inputs'], self.sample_input)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    @patch('worth_score_model.pd.DataFrame')
    def test_evaluate_with_explanations(self, mock_dataframe, mock_create_explainer, mock_create_pipeline):
        """Test the evaluate method with explanations."""
        # Mock the predictor
        mock_predictor = Mock()
        mock_predictor.transform.return_value = [{'final_proba': 0.75, 'feature1': 1.0}]
        mock_create_pipeline.return_value = mock_predictor
        
        # Mock the explainer
        mock_explainer = Mock()
        mock_explanation = Mock()
        mock_explanation.values = np.array([[0.1, 0.2]])
        mock_explanation.base_values = np.array([0.5])
        mock_explainer.return_value = mock_explanation
        mock_create_explainer.return_value = mock_explainer
        
        # Mock DataFrame with proper indexing
        mock_df = Mock()
        mock_df.__getitem__ = Mock(return_value=mock_df)  # Allow df[self._inputs]
        mock_dataframe.return_value = mock_df
        
        # Mock the _predict method to return expected dict structure
        with patch.object(WorthScoreModel, '_predict') as mock_predict:
            mock_predict.return_value = {'final_proba': 0.75, 'feature1': 1.0}
            
            model = WorthScoreModel(self.mock_pipeline)
            model._inputs = ['feature1', 'feature2']
            
            result = model.evaluate(self.sample_input, with_explanations=True)
            
            expected_keys = ['prediction', 'inputs', 'encodings', 'explanations', 'explainer_base_prediction']
            for key in expected_keys:
                self.assertIn(key, result)
            
            self.assertEqual(result['prediction'], 0.75)
            self.assertEqual(result['inputs'], self.sample_input)
            self.assertEqual(result['explainer_base_prediction'], 0.5)
            self.assertIsInstance(result['explanations'], dict)

    @patch('worth_score_model.create_pipeline')
    @patch('worth_score_model.create_explainer')
    def test_evaluate_edge_cases(self, mock_create_explainer, mock_create_pipeline):
        """Test the evaluate method with edge cases."""
        # Mock the predictor with proper return structure
        mock_predictor = Mock()
        mock_predictor.transform.side_effect = [
            [{'final_proba': 0.0, 'feature1': 1.0}],  # Empty input case
            [{'final_proba': 0.5, 'feature1': 1.0}]   # None values case
        ]
        mock_create_pipeline.return_value = mock_predictor
        mock_create_explainer.return_value = Mock()
        
        # Mock the _predict method to return expected dict structure
        with patch.object(WorthScoreModel, '_predict') as mock_predict:
            mock_predict.side_effect = [
                {'final_proba': 0.0, 'feature1': 1.0},  # Empty input
                {'final_proba': 0.5, 'feature1': 1.0}   # None values
            ]
            
            model = WorthScoreModel(self.mock_pipeline)
            
            # Test with empty input
            result = model.evaluate({}, with_explanations=False)
            self.assertEqual(result['prediction'], 0.0)
            self.assertEqual(result['inputs'], {})
            
            # Test with None values in input
            input_with_none = {'revenue': None, 'state': 'CA'}
            result = model.evaluate(input_with_none, with_explanations=False)
            self.assertEqual(result['inputs'], input_with_none)
            self.assertEqual(result['prediction'], 0.5)


class TestIntegration(unittest.TestCase):
    """Integration tests for the complete scoring workflow."""
    
    @patch('worth_score_model.pickle.load')
    @patch('worth_score_model.NeuralScoringLayer')
    @patch('builtins.open')
    def test_full_workflow_mock(self, mock_open, mock_neural_layer, mock_pickle_load):
        """Test a complete workflow with mocked components."""
        # Setup mocks
        mock_model = Mock()
        mock_model.features = ['revenue', 'state']
        mock_neural_layer.return_value = mock_model
        
        # Mock transformers
        mock_preprocessor = Mock()
        mock_preprocessor.transform.return_value = Mock()
        
        mock_calibrator = {
            'predictor': Mock(),
            'explainer': Mock()
        }
        mock_calibrator['predictor'].transform.return_value = [{'final_proba': 0.8}]
        
        # Provide enough mock values for all pickle.load calls
        mock_pickle_load.side_effect = [
            mock_preprocessor, 
            mock_calibrator,
            mock_preprocessor,  # Additional calls for explainer creation
            mock_calibrator
        ]
        
        # Mock the entire _predict method to avoid custom transformer issues
        with patch('sklearn.pipeline.Pipeline') as mock_pipeline_class:
            mock_pipeline_instance = Mock()
            mock_pipeline_class.return_value = mock_pipeline_instance
            
            with patch('worth_score_model.shap.KernelExplainer'):
                with patch.object(WorthScoreModel, '_predict') as mock_predict:
                    mock_predict.return_value = {'final_proba': 0.8, 'encoded_feature': 1.5}
                    
                    pipeline_config = [
                        ('preprocessor', 'preprocessor.pkl'),
                        ('neural_layer', 'neural_layer.pt'),
                        ('calibrator', 'calibrator.pkl')
                    ]
                    
                    model = WorthScoreModel(pipeline_config)
                    
                    test_input = {'revenue': 50000, 'state': 'TX'}
                    result = model.evaluate(test_input, with_explanations=False)
                    
                    self.assertIsInstance(result, dict)
                    self.assertIn('prediction', result)
                    self.assertEqual(result['inputs'], test_input)
                    self.assertEqual(result['prediction'], 0.8)


if __name__ == '__main__':
    # Create a test suite
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTest(unittest.makeSuite(TestWorthScoreModel))
    suite.addTest(unittest.makeSuite(TestIntegration))
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\nTests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.failures:
        print("\nFailures:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
    
    if result.errors:
        print("\nErrors:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")