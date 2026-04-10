import pickle
from typing import Literal, Union

import pandas as pd
import shap
from custom_transformers import (
    ExplainerExtract,
    IntermediateClassifier,
    MissingFeature,
    NAICSTransformer,
    PassthroughTransformer,
    PreProcessor,
)
from lookups import ALL_MISSING, INPUTS
from monotonic_network import NeuralScoringLayer
from sklearn.pipeline import Pipeline


def create_pipeline(
    pipeline: list[tuple[str, str]],
    kind: Literal["predictor", "explainer"] = "explainer",
) -> Pipeline:
    if kind not in ("predictor", "explainer"):
        raise ValueError("kind must be 'predictor' or 'explainer'.")
    steps = []
    for step in pipeline:
        if step[0].lower() == "neural_layer":
            model = NeuralScoringLayer(state_dict=step[1], device="cpu")
            break
    for step in pipeline:
        name, path = step
        match name.lower():
            case "neural_layer":
                model = model
                transformer = IntermediateClassifier(model, model.features, "economic_proba")
            case "calibrator":
                transformer: Union[IntermediateClassifier, ExplainerExtract] = pickle.load(
                    open(path, "rb")
                )[kind]
            case _:
                transformer: Union[
                    PassthroughTransformer,
                    IntermediateClassifier,
                    NAICSTransformer,
                    MissingFeature,
                    PreProcessor,
                ] = pickle.load(open(path, "rb"))
        steps.append((name, transformer))

    pipe = Pipeline(steps)
    return pipe


def create_explainer(pipeline):
    pipeline = create_pipeline(pipeline, kind="explainer")
    explainer = shap.KernelExplainer(
        pipeline.transform,
        data=pd.DataFrame(ALL_MISSING, index=[0]),
        link="identity",
        seed=42,
        algorithm="permutation",
    )
    return explainer


class WorthScoreModel:
    """Creates pipelines for generating a probability for a worth score, and explaining that
    probability. Takes a list of tuples representing the steps of a pipeline, where the first
    element is the name of the step, and the second is the path to that transformer.

    Most names are arbitrary, though 'neural_layer' and 'calibrator' have specific usecases and
    are neccesary. 'calibrator' must be the last step.
    """

    def __init__(self, pipeline):
        self.predictor = create_pipeline(pipeline, kind="predictor")
        self.explainer = create_explainer(pipeline)
        self._inputs = list(INPUTS.keys())

    def _predict(self, input_data):
        data = self.predictor.transform(input_data)
        return data[0]

    def _explain(self, input_data):
        input_data = pd.DataFrame(input_data, index=[0])[self._inputs]
        explanations = self.explainer(input_data)
        expl = {key: val for key, val in zip(self._inputs, explanations.values[0].tolist())}
        
        # Handle null/None base values safely
        base_value = explanations.base_values[0]
        if base_value is None:
            expl["base_value"] = 0.0  # Default to 0.0 for None
        else:
            base_val = base_value.item() if hasattr(base_value, 'item') else base_value
            # Handle NaN values
            expl["base_value"] = 0.0 if pd.isna(base_val) else base_val
        
        return expl

    def evaluate(self, business_input: dict, with_explanations: bool = True):
        """
        Takes a dict of input, and returns the resulting probability, the original inputs,
        the encodings, the base value from the explainer, and the explanations. Any inputs
        not in the list of inputs the model expects will be passed through and returned as is.
        """
        data: dict = self._predict(business_input)
        results = {
            "prediction": data.pop("final_proba"),
            "inputs": business_input,
            "encodings": data,
        }
        if with_explanations:
            df = pd.DataFrame(business_input, index=[0])
            explanations = self._explain(df[self._inputs])
            results["explainer_base_prediction"] = explanations.pop("base_value")
            results["explanations"] = explanations
        return results
