# %%
from typing import Literal

import numpy as np
import pandas as pd
import polars as pl
from lookups import FINANCIAL_FEATURES
from sklearn.base import BaseEstimator, TransformerMixin


# %%
class IntermediateClassifier(BaseEstimator, TransformerMixin):
    def __init__(
        self,
        model: BaseEstimator,
        features: list[str],
        output_name: str,
        dupe: bool = False,
        drop: list[str] | None = None,
        output_format: Literal["dataframe", "dict"] = "dataframe",
    ):
        self.model = model
        self.features = features
        self.output_name = output_name
        self.dupe = dupe
        self.output_format = output_format
        self.drop = drop

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, feature_dataframe: pl.DataFrame) -> pl.DataFrame | list[dict]:
        predictions = self.model.predict_proba(feature_dataframe[self.features])[:, 1]
        feature_dataframe = feature_dataframe.with_columns(pl.Series(predictions).cast(float).alias(self.output_name))
        if self.drop is not None:
            feature_dataframe = feature_dataframe.drop(self.drop)
        if self.dupe:
            feature_dataframe = feature_dataframe.with_columns(pl.Series(predictions).cast(float).alias(self.output_name + "_dupe"))
        if self.output_format == "dict":
            feature_dataframe = feature_dataframe.to_dicts()
        return feature_dataframe


class PassthroughTransformer(BaseEstimator, TransformerMixin):
    def __init__(
        self,
        steps: list[tuple],
        output_format: Literal["dataframe", "dict"] = "dataframe",
    ):
        self.all_columns = [item for lst in steps for item in lst[2] if len(lst) > 2]
        self.steps = steps
        self.output_format = output_format

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, input_dataframe: pl.DataFrame):
        passthrough_columns = [col for col in input_dataframe.columns if col not in self.all_columns]
        final_dataframe = input_dataframe[passthrough_columns]
        for step in self.steps:
            _, transformer, feature_columns = step
            step_data = input_dataframe[feature_columns]
            transformed_step_data = transformer.transform(step_data)
            final_dataframe = pl.concat([final_dataframe, transformed_step_data], how="horizontal")
        if self.output_format == "dict":
            final_dataframe = final_dataframe.to_dicts()
        return final_dataframe


class MissingFeature(BaseEstimator, TransformerMixin):
    def __init__(self, features: list[str]):
        self.features = features

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, feature_dataframe: pl.DataFrame) -> pl.DataFrame:
        null_values_count = feature_dataframe.to_pandas()[self.features].isna().sum(axis=1)
        zero_values_count = feature_dataframe.to_pandas()[(FINANCIAL_FEATURES.keys())].eq(0).sum(axis=1)
        missing_fields_share = (null_values_count + zero_values_count) / (len(self.features) - 1)
        feature_dataframe = feature_dataframe.with_columns(
            pl.Series(missing_fields_share).cast(float).alias("missing_fields_share")
        )
        return feature_dataframe


class PreProcessor(BaseEstimator, TransformerMixin):
    def __init__(self, types: dict[str:type]):
        self.types = types

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, raw_input_data) -> pl.DataFrame:
        schema = dict()
        is_list = False
        if isinstance(raw_input_data, list):
            to_match = raw_input_data[0]
            is_list = True
        else:
            to_match = raw_input_data
            is_list = False
        match to_match:
            case dict():
                for key, val in to_match.items():
                    if key not in self.types:
                        schema[key] = type(val)
                    else:
                        schema[key] = self.types[key]
                if is_list:
                    processed_data = pl.from_dicts(data=raw_input_data, schema=schema)
                else:
                    processed_data = pl.from_dict(data=raw_input_data, schema=list(schema.keys()))
                    for col, typ in self.types.items():
                        processed_data = processed_data.with_columns(pl.col(col).cast(typ))
            case np.ndarray():
                processed_data = pl.from_pandas(pd.DataFrame(raw_input_data, columns=list(self.types.keys())))
                for col, typ in self.types.items():
                    processed_data = processed_data.with_columns(pl.col(col).cast(typ))
            case pl.DataFrame():
                processed_data: pl.DataFrame = raw_input_data
                for col, typ in self.types.items():
                    processed_data = processed_data.with_columns(pl.col(col).cast(typ))
            case pd.DataFrame():
                processed_data: pl.DataFrame = pl.from_pandas(raw_input_data)
                for col, typ in self.types.items():
                    processed_data = processed_data.with_columns(pl.col(col).cast(typ))
        return processed_data


class CustomImputer(BaseEstimator, TransformerMixin):
    def __init__(self, imputation_values: dict, types: dict[str:type]):
        self.imputation_values = imputation_values
        self.types = types

    def fit(self, training_dataframe: pl.DataFrame, target_labels=None):
        return self

    def transform(self, sparse_dataframe: pl.DataFrame) -> pl.DataFrame:
        for col, typ in self.types.items():
            if typ is str:
                sparse_dataframe = sparse_dataframe.with_columns(
                    pl.col(col).fill_null(self.imputation_values[col]).str.to_uppercase()
                )
            else:
                sparse_dataframe = sparse_dataframe.with_columns(pl.col(col).fill_null(np.nan))
                sparse_dataframe = sparse_dataframe.with_columns(pl.col(col).fill_nan(self.imputation_values[col]))
        return sparse_dataframe


class ExplainerExtract(BaseEstimator, TransformerMixin):
    def __init__(self, transformer, feature):
        self.feature = feature
        self.transformer = transformer

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, prediction_data):
        transformed = self.transformer.transform(prediction_data)
        results = [[0, val[self.feature]] for val in transformed]
        return np.array(results)[:, 1]


class NAICSTransformer(BaseEstimator, TransformerMixin):
    def __init__(self, valid_naics: set[int], naics_column: str = "primnaics"):
        self.column = naics_column
        self.valid_naics = valid_naics

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, business_dataframe: pl.DataFrame, target_labels=None):
        naics6 = []
        naics5 = []
        naics4 = []
        naics3 = []
        naics2 = []
        for naics in business_dataframe[self.column]:
            # Handle None, NaN, and invalid values
            if naics is None or (isinstance(naics, float) and np.isnan(naics)):
                for naics_list in [naics6, naics5, naics4, naics3, naics2]:
                    naics_list.append(np.nan)
                continue
            
            # Convert to string and validate
            try:
                naics = str(int(naics))
            except (ValueError, TypeError):
                for naics_list in [naics6, naics5, naics4, naics3, naics2]:
                    naics_list.append(np.nan)
                continue
            
            # Check if valid NAICS code
            if len(naics) != 6 or int(naics) not in self.valid_naics:
                naics6.append(np.nan)
                naics5.append(np.nan)
                naics4.append(np.nan)
                naics3.append(np.nan)
                naics2.append(np.nan)
            else:
                naics6.append(float(naics))
                naics5.append(float(naics[:5]))
                naics4.append(float(naics[:4]))
                naics3.append(float(naics[:3]))
                naics2.append(float(naics[:2]))
        business_dataframe = business_dataframe.with_columns(
            pl.Series(naics6).alias("naics6"),
            pl.Series(naics5).alias("naics5"),
            pl.Series(naics4).alias("naics4"),
            pl.Series(naics3).alias("naics3"),
            pl.Series(naics2).alias("naics2"),
        )
        return business_dataframe


class PenaltyLayer(BaseEstimator, TransformerMixin):
    def __init__(self, penalty_features, score_col: str = "final_proba"):
        self.features = penalty_features
        self.score_col = score_col

    def fit(self, training_data, target_labels=None):
        return self

    def transform(self, scored_dataframe: pl.DataFrame):
        return self


# %%
