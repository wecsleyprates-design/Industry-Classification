#!/usr/bin/env python
import csv, json, pandas, xgboost
import pickle, numpy
import os
import json
from kafkaproducer import KafkaProducer
import shap
import simplejson as simplejson
from worth_score_model import WorthScoreModel

class AIScore:
    def __init__(self):
        try:

            self.pipeline = [
                ("preprocessor", os.environ.get("CONFIG_MODEL_PREPROCESSOR_PATH", "./modelv3.1/preprocessor.pkl")),
                ("missing", os.environ.get("CONFIG_MODEL_MISSING_FEATURE_PATH", "./modelv3.1/missing.pkl")),
                ("naics", os.environ.get("CONFIG_MODEL_NAICS_TRANSFORMER_PATH", "./modelv3.1/naics_transformer.pkl")),
                ("imputer", os.environ.get("CONFIG_MODEL_IMPUTER_PATH", "./modelv3.1/imputer.pkl")),
                ("encoder", os.environ.get("CONFIG_MODEL_ENCODER_PATH", "./modelv3.1/encoder.pkl")),
                ("initial_layer", os.environ.get("CONFIG_MODEL_INITIAL_LAYER_PATH", "./modelv3.1/firmographic_model.pkl")),
                ("scaler", os.environ.get("CONFIG_MODEL_SCALER_PATH", "./modelv3.1/scaler.pkl")),
                ("second_layer", os.environ.get("CONFIG_MODEL_SECOND_LAYER_PATH", "./modelv3.1/financial_model.pkl")),
                ("neural_layer", os.environ.get("CONFIG_MODEL_NEURAL_LAYER_PATH", "./modelv3.1/economic_model.pt")),
                ("quantiler", os.environ.get("CONFIG_MODEL_QUANTILER_PATH", "./modelv3.1/quantiler.pkl")),
                ("ensemble", os.environ.get("CONFIG_MODEL_ENSEMBLE_PATH", "./modelv3.1/ensemble_model.pkl")),
                ("calibrator", os.environ.get("CONFIG_MODEL_CALIBRATOR_PATH", "./modelv3.1/calibrator.pkl")),
            ]
            self.kafkaPublisherObj = KafkaProducer()
            #self.explainer_prep()
        except Exception as e:
            raise


    def getScore(self, inputForScore, mappedData):
        try:        
            model = WorthScoreModel(self.pipeline)
            data = model.evaluate(mappedData)
        
            message = {
                'score_trigger_id': inputForScore['score_trigger_id'],
                'business_id': inputForScore['business_id'],
                'probablity': str(data['prediction']),
                'score_300_850': str(data['prediction'] * (850 - 300) + 300),
                'score_0_100': str(data['prediction'] * 100),
                'score': str(data['prediction'] * (850 - 300) + 300),
                'categorical_scores': {},
                'model_metadata': {},
                'shap_base_points': 0                
            }

            shap_df = pandas.DataFrame({
                'model_field': data['explanations'].keys(),
                'shap_scores': data['explanations'].values()
            })

            # # Convert SHAP Scores to Points
            # # In this, there is no scaling, just converting using the 550 scale
            # # The 550 scale is the difference between the lowest score of 300 and the highest of 850
            shap_df['shap_points'] = shap_df['shap_scores'] * 550

            # # Convert Baseline to Points
            # # For this, we have to scale and add in the base score
            shap_base_points = data['explainer_base_prediction'] * (850 - 300) + 300
            
            # print("shap_base_points=shap_base_value * (850 - 300) + 300",shap_base_points)

            # We can check that the Base Points and the sum of all SHAP Points from features
            # We can also check the conversion of the Sum of All SHAP Scores to Points
            # These should be equal
            print("shap_scores + shap_df['shap_scores'].sum()", (data['explainer_base_prediction']+ shap_df['shap_scores'].sum())) 
            print("prediction", data['prediction'])
            print("shap_base_points + shap_df['shap_points'].sum()", shap_base_points + shap_df['shap_points'].sum())
            print("(shap_base_value + shap_df['shap_scores'].sum()) * (850 - 300) + 300",(data['explainer_base_prediction'] + shap_df['shap_scores'].sum()) * (850 - 300) + 300)

            # # Create SHAP Points by Groups
            # # In the same way we can sum the effects of individual features, we can sum the effects of groups
            columns_grp_df = pandas.read_csv(os.environ.get("CONFIG_MODEL_FEATURE_GROUP_MAPPING_CSV_PATH", './modelv3.1/v3_field_grps.csv'))
            shap_df = shap_df.merge(columns_grp_df, on='model_field')
            # shap_json = shap_df.to_json(orient='records', indent=4)
            # print(shap_json)
            shap_points_grps = shap_df.groupby('grp').sum(numeric_only=True)
            shap_points_grps_interm = shap_df.groupby('grp_interm').sum(numeric_only=True)
            print("shap_base_points + shap_points_grps['shap_points'].sum()", shap_base_points + shap_points_grps['shap_points'].sum())
            print("shap_base_points + shap_points_grps_interm['shap_points'].sum()", shap_base_points + shap_points_grps_interm['shap_points'].sum())
            print("shap_points_grps",shap_points_grps)
            print("shap_points_grps_interm", shap_points_grps_interm)
            
                        
            columns_grp_df_only_groups = columns_grp_df.drop(columns=['model_field'])
            columns_grp_df_only_groups = columns_grp_df_only_groups.drop_duplicates(subset=['grp','grp_interm'])
            
            print("columns_grp_df_only_groups", columns_grp_df_only_groups)
            
            category_score = {}
            for grp in set(columns_grp_df_only_groups['grp']):
                group_Score = shap_points_grps.filter(items=[grp], axis=0)
                category_score[self.__get_category_name(grp)] = {
                    'shap_scores': group_Score.shap_scores[grp],
                    'shap_points': group_Score.shap_points[grp],
                    'subcategory_score': {}
                }
                grps_interm_list =  columns_grp_df_only_groups[columns_grp_df_only_groups['grp'] == grp]
                for index_i, row_i in grps_interm_list.iterrows():
                    group_interim_Score = shap_points_grps_interm.filter(items=[row_i.grp_interm], axis=0)
                    category_score[self.__get_category_name(row_i.grp)]['subcategory_score'][self.__get_subcategory_name(row_i.grp_interm)] = {
                        'shap_scores': group_interim_Score.shap_scores[row_i.grp_interm],
                        'shap_points': group_interim_Score.shap_points[row_i.grp_interm],
                    }
                
            message['categorical_scores'] = category_score
            #category score ends

            message['model_metadata'] = {
                'shap_scores': data['explanations'],
                'shap_base_points': shap_base_points,
                'model_version': os.environ.get("CONFIG_MODEL_VERSION", '3.0'),
                'model_input_encoded': data['encodings'],
                'model_input_raw': mappedData,
            }
            message['shap_base_points'] = shap_base_points
            message['event'] = os.environ.get("CONFIG_KAFKA_AI_SCORE_GENERATED_EVENT", "ai_score_generated_event")
            print(message)
            return message
        except Exception:
            raise

    def __get_category_name(self, groupName):
        if groupName == "Public Records":
            return "public_records"
        elif groupName == "Company Profile":
            return "company_profile"
        elif groupName == "Financial Trends":
            return "financial_trends"
        elif groupName == "Business Operations":
            return "business_operations"
        elif groupName == "Performance Measures":
            return "performance_measures"
        else:
            return groupName
    def __get_subcategory_name(self, groupName):
        if groupName == "Social Reviews":
            return "social_reviews_ai_placeholder"
        elif groupName == "Credit Bureau":
            return "credit_bureau_ai_placeholder"
        elif groupName == "Bankruptcies":
            return "bankruptcies_ai_placeholder"
        elif groupName == "Economics":
            return "economics_ai_placeholder"
        elif groupName == "Judgments and Liens":
            return "judgements_and_liens_ai_placeholder"
        elif groupName == "Profitability Ratios":
            return "profitability_ratios_ai_placeholder"
        elif groupName == "Valuation Ratios":
            return "valuation_ratios_ai_placeholder"
        elif groupName == "Financial Risk":
            return "financial_risks_ai_placeholder"
        elif groupName == "Liquidity Ratios":
            return "liquidity_ratios_ai_placeholder"
        elif groupName == "Solvency Ratios":
            return "solvency_ratios_ai_placeholder"
        elif groupName == "Efficiency Ratios":
            return "efficiency_ratios_ai_placeholder"
        elif groupName == "Profit & Loss":
            return "profit_and_loss_ai_placeholder"
        elif groupName == "Cash Flow":
            return "cash_flow_ai_placeholder"
        elif groupName == "Balance Sheet":
            return "balance_sheet_ai_placeholder"
        else:
            return groupName

    def getProbabilityAndPublish(self, inputForScore, mappedData):
        try:
            scoreResponse = self.getScore(inputForScore, mappedData) # This is the message dict
            msg = simplejson.dumps(scoreResponse, ignore_nan=True)
            self.kafkaPublisherObj.publish(os.environ.get("CONFIG_KAFKA_AI_SCORE_TOPIC"), inputForScore['business_id'], msg )
            self.kafkaPublisherObj.publish(os.environ.get("CONFIG_KAFKA_AI_SCORE_DATAPLATFORM_TOPIC"), inputForScore['business_id'], msg)
        except Exception:
            raise