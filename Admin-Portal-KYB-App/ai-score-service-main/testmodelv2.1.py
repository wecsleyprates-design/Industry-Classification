#!/usr/bin/env python
import csv, json, pandas, xgboost
import pickle, numpy
import os
import json
from kafkaproducer import KafkaProducer
import shap
# from shap import TreeExplainer
# from category_encoders import TargetEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer


def main():  
    loaded_model = pickle.load(open(os.environ.get("CONFIG_MODEL_FILE_PATH", './modelv2.1/model_v2-1_2024-05-07.pkl'), 'rb'))
    target_encoder = pickle.load(open(os.environ.get("CONFIG_TARGET_ENCODER_FILE_PATH", './modelv2.1/target_encoder_v2-1_2024-05-07.pkl'), 'rb'))
    tree_explainer = pickle.load(open(os.environ.get("CONFIG_MODEL_EXPLAINER_FILE_PATH", './modelv2.1/tree_explainer_v2-1_2024-05-07.pkl'), 'rb'))

    #explainer_xgb = pickle.load(open(os.environ.get("CONFIG_MODEL_EXPLAINER_FILE_PATH", './model/explainer_xgb_new.local.pkl'), 'rb'))
    numerical_columns = [
    'location_cnt',
    'location_active_cnt',
    'location_inactive_cnt',
    'location_inactiveold_cnt',
    'location_inactivedt_cnt',
    'location_latitude_avg',
    'location_longitude_avg',
    'location_soho_cnt',
    'location_biz_cnt',
    'location_res_cnt',
    'location_small_cnt',
    'location_large_cnt',
    'location_unknown_size_cnt',
    'location_gov_cnt',
    'location_fedgov_cnt',
    'location_nonprofitind_cnt',
    'location_edu_cnt',
    'location_indsole_cnt',
    'location_partner_cnt',
    'location_limpartner_cnt',
    'location_corp_cnt',
    'location_scorp_cnt',
    'location_llc_cnt',
    'location_llp_cnt',
    'location_other_cnt',
    'location_ccorp_cnt',
    'location_nonprofitstat_cnt',
    'location_mutual_cnt',
    'location_trust_cnt',
    'location_lllp_cnt',
    'bankrupt_cnt_failrt',
    'bankrupt_cnt_credcls',
    'bankrupt_cnt_field',
    'corpemployees',
    'corpamount',
    'creditscore_avg',
    'creditscore_max',
    'creditscore_min',
    'creditperc_avg',
    'creditperc_max',
    'creditperc_min',
    'mkt_telscore_avg',
    'mkt_telscore_max',
    'mkt_telscore_min',
    'mkt_totalscore_avg',
    'mkt_totalscore_max',
    'mkt_totalscore_min',
    'months_since_update',
    'legname_occ',
    'afflname_occ',
    'gdp_pch',
    'gdp_pc1',
    't10y2y',
    't10y2y_chg',
    't10y2y_ch1',
    't10y',
    't10y_chg',
    't10y_ch1',
    't2y',
    't2y_chg',
    't2y_ch1',
    'brent_pch',
    'brent_pc1',
    'wtispot_pch',
    'wtispot_pc1',
    'vix',
    'vix_chg',
    'vix_ch1',
    'csentiment',
    'csentiment_chg',
    'csentiment_ch1',
    'dolindx',
    'dolindx_chg',
    'dolindx_ch1',
    'unemp',
    'unemp_chg',
    'unemp_ch1',
    'cpi',
    'cpi_chg',
    'cpi_ch1',
    'cpicore',
    'cpicore_chg',
    'cpicore_ch1',
    'ccdelinq',
    'ccdelinq_chg',
    'ccdelinq_ch1',
    'cloandelinq',
    'cloandelinq_chg',
    'cloandelinq_ch1',
    'busloandelinq',
    'busloandelinq_chg',
    'busloandelinq_ch1',
    'wagegrowth',
    'wagegrowth_chg',
    'usdeur',
    'usdeur_chg',
    'usdeur_ch1',
    'usdpeso',
    'usdpeso_chg',
    'usdpeso_ch1',
    'usdcan',
    'usdcan_chg',
    'usdcan_ch1',
    'ppi_chg',
    'ppi_ch1',
    'review_score',
    'review_cnt',
    'min_age',
    'max_age',
    'lien_count',
    'lien_most_recent_age',
    'bankruptcy_count',
    'bankruptcy_most_recent_age',
    'judgement_count',
    'judgement_most_recent_age',
    ]
    categorical_columns = [
        'legultstateall',
        'corpamount_type',
        'corpamount_prec',
        'failrate_avg',
        'primsic',
        'secsic1',
        'secsic2',
        'secsic3',
        'secsic4',
        'primnaicscode',
        'secnaics1',
        'secnaics2',
        'secnaics3',
        'secnaics4',
        'primnaics_sector',
        'primnaics_subsector',
        'primnaics_industry_group',
        'primnaics_industry',
        'secnaics1_sector',
        'secnaics1_subsector',
        'secnaics1_industry_group',
        'secnaics1_industry',
        'secnaics2_sector',
        'secnaics2_subsector',
        'secnaics2_industry_group',
        'secnaics2_industry',
        'secnaics3_sector',
        'secnaics3_subsector',
        'secnaics3_industry_group',
        'secnaics3_industry',
        'secnaics4_sector',
        'secnaics4_subsector',
        'secnaics4_industry_group',
        'secnaics4_industry',
    ]
    # # Define preprocessing steps
    # cat_preprocessor = Pipeline([
    #     ('target_encoder', target_encoder)  # Using TargetEncoder for categorical features
    # ])

    # num_preprocessor = Pipeline([
    #     # You can add more preprocessing steps for numerical features if needed
    # ])
    
    # preprocessor = ColumnTransformer([
    #     ('cat', cat_preprocessor, categorical_columns),
    #     ('num', num_preprocessor, numerical_columns)
    # ])
    
    # pipeline = Pipeline([
    #     ('preprocessor', preprocessor),
    #     ('model', loaded_model)
    # ])
    row = pandas.read_csv('./modelv2.0/sample_rows.csv').sample(n=1)
    # print(row["efx_company"].tolist()[0])
    
    # d = {
    #     'legultstateall':  row["legultstateall"].tolist()[0],
    #     'corpamount_type':  row["corpamount_type"].tolist()[0],
    #     'corpamount_prec':  row["corpamount_prec"].tolist()[0],
    #     'failrate_avg':  row["failrate_avg"].tolist()[0],
    #     'primsic':  row["primsic"].tolist()[0],
    #     'secsic1':  row["secsic1"].tolist()[0],
    #     'secsic2':  row["secsic2"].tolist()[0],
    #     'secsic3':  row["secsic3"].tolist()[0],
    #     'secsic4':  row["secsic4"].tolist()[0],
    #     'primnaicscode':  row["primnaicscode"].tolist()[0],
    #     'secnaics1':  row["secnaics1"].tolist()[0],
    #     'secnaics2':  row["secnaics2"].tolist()[0],
    #     'secnaics3':  row["secnaics3"].tolist()[0],
    #     'secnaics4': row["secnaics4"].tolist()[0],
    #     'location_cnt':  row["location_cnt"].tolist()[0],
    #     'location_active_cnt':  row["location_active_cnt"].tolist()[0],
    #     'location_inactive_cnt':  row["location_inactive_cnt"].tolist()[0],
    #     'location_inactiveold_cnt':  row["location_inactiveold_cnt"].tolist()[0],
    #     'location_inactivedt_cnt':  row["location_inactivedt_cnt"].tolist()[0],
    #     'location_latitude_avg':  row["location_latitude_avg"].tolist()[0],
    #     'location_longitude_avg':  row["location_longitude_avg"].tolist()[0],
    #     'location_soho_cnt':  row["location_soho_cnt"].tolist()[0],
    #     'location_biz_cnt':  row["location_biz_cnt"].tolist()[0],
    #     'location_res_cnt':  row["location_res_cnt"].tolist()[0],
    #     'location_small_cnt':  row["location_small_cnt"].tolist()[0],
    #     'location_large_cnt':  row["location_large_cnt"].tolist()[0],
    #     'location_unknown_size_cnt':  row["location_unknown_size_cnt"].tolist()[0],
    #     'location_gov_cnt':  row["location_gov_cnt"].tolist()[0],
    #     'location_fedgov_cnt':  row["location_fedgov_cnt"].tolist()[0],
    #     'location_nonprofitind_cnt':  row["location_nonprofitind_cnt"].tolist()[0],
    #     'location_edu_cnt':  row["location_edu_cnt"].tolist()[0],
    #     'location_indsole_cnt':  row["location_indsole_cnt"].tolist()[0],
    #     'location_partner_cnt':  row["location_partner_cnt"].tolist()[0],
    #     'location_limpartner_cnt':  row["location_limpartner_cnt"].tolist()[0],
    #     'location_corp_cnt':  row["location_corp_cnt"].tolist()[0],
    #     'location_scorp_cnt':  row["location_scorp_cnt"].tolist()[0],
    #     'location_llc_cnt':  row["location_llc_cnt"].tolist()[0],
    #     'location_llp_cnt':  row["location_llp_cnt"].tolist()[0],
    #     'location_other_cnt':  row["location_other_cnt"].tolist()[0],
    #     'location_ccorp_cnt':  row["location_ccorp_cnt"].tolist()[0],
    #     'location_nonprofitstat_cnt':  row["location_nonprofitstat_cnt"].tolist()[0],
    #     'location_mutual_cnt':  row["location_mutual_cnt"].tolist()[0],
    #     'location_trust_cnt':  row["location_trust_cnt"].tolist()[0],
    #     'location_lllp_cnt':  row["location_lllp_cnt"].tolist()[0],
    #     'bankrupt_cnt_failrt':  row["bankrupt_cnt_failrt"].tolist()[0],
    #     'bankrupt_cnt_credcls':  row["bankrupt_cnt_credcls"].tolist()[0],
    #     'bankrupt_cnt_field':  row["bankrupt_cnt_field"].tolist()[0],
    #     'corpemployees':  row["corpemployees"].tolist()[0],
    #     'corpamount':  row["corpamount"].tolist()[0],
    #     'creditscore_avg':  row["creditscore_avg"].tolist()[0],
    #     'creditscore_max':  row["creditscore_max"].tolist()[0],
    #     'creditscore_min':  row["creditscore_min"].tolist()[0],
    #     'creditperc_avg':  row["creditperc_avg"].tolist()[0],
    #     'creditperc_max':  row["creditperc_max"].tolist()[0],
    #     'creditperc_min':  row["creditperc_min"].tolist()[0],
    #     'mkt_telscore_avg':  row["mkt_telscore_avg"].tolist()[0],
    #     'mkt_telscore_max':  row["mkt_telscore_max"].tolist()[0],
    #     'mkt_telscore_min':  row["mkt_telscore_min"].tolist()[0],
    #     'mkt_totalscore_avg':  row["mkt_totalscore_avg"].tolist()[0],
    #     'mkt_totalscore_max':  row["mkt_totalscore_max"].tolist()[0],
    #     'mkt_totalscore_min':  row["mkt_totalscore_min"].tolist()[0],
    #     'legname_occ':  row["legname_occ"].tolist()[0],
    #     'afflname_occ':  row["afflname_occ"].tolist()[0],
    #     'gdp_pch': row["row_num"].tolist()[0],
    #     'gdp_pc1': row["row_num"].tolist()[0],
    #     't10y2y': row["row_num"].tolist()[0],
    #     't10y2y_chg':  row["row_num"].tolist()[0],
    #     't10y2y_ch1':  row["row_num"].tolist()[0],
    #     't10y':  row["row_num"].tolist()[0],
    #     't10y_chg':  row["row_num"].tolist()[0],
    #     't10y_ch1':  row["row_num"].tolist()[0],
    #     't2y':  row["row_num"].tolist()[0],
    #     't2y_chg': row["row_num"].tolist()[0],
    #     't2y_ch1': row["row_num"].tolist()[0],
    #     'brent_pch': row["row_num"].tolist()[0],
    #     'brent_pc1':  row["row_num"].tolist()[0],
    #     'wtispot_pch':  row["row_num"].tolist()[0],
    #     'wtispot_pc1':  row["row_num"].tolist()[0],
    #     'vix':  row["row_num"].tolist()[0],
    #     'vix_chg':  row["row_num"].tolist()[0],
    #     'vix_ch1':  row["row_num"].tolist()[0],
    #     'csentiment':  row["row_num"].tolist()[0],
    #     'csentiment_chg': row["row_num"].tolist()[0],
    #     'csentiment_ch1':  row["row_num"].tolist()[0],
    #     'dolindx':  row["row_num"].tolist()[0],
    #     'dolindx_chg':  row["row_num"].tolist()[0],
    #     'dolindx_ch1':  row["row_num"].tolist()[0],
    #     'unemp':  row["row_num"].tolist()[0],
    #     'unemp_chg':  row["row_num"].tolist()[0],
    #     'unemp_ch1':  row["row_num"].tolist()[0],
    #     'cpi':  row["row_num"].tolist()[0],
    #     'cpi_chg':  row["row_num"].tolist()[0],
    #     'cpi_ch1':  row["row_num"].tolist()[0],
    #     'cpicore':  row["row_num"].tolist()[0],
    #     'cpicore_chg':  row["row_num"].tolist()[0],
    #     'cpicore_ch1':  row["row_num"].tolist()[0],
    #     'ccdelinq': row["row_num"].tolist()[0],
    #     'ccdelinq_chg':  row["row_num"].tolist()[0],
    #     'ccdelinq_ch1': row["row_num"].tolist()[0],
    #     'cloandelinq': row["row_num"].tolist()[0],
    #     'cloandelinq_chg':  row["row_num"].tolist()[0],
    #     'cloandelinq_ch1':  row["row_num"].tolist()[0],
    #     'busloandelinq':  row["row_num"].tolist()[0],
    #     'busloandelinq_chg':  row["row_num"].tolist()[0],
    #     'busloandelinq_ch1':  row["row_num"].tolist()[0],
    #     'wagegrowth':  row["row_num"].tolist()[0],
    #     'wagegrowth_chg': row["row_num"].tolist()[0],
    #     'usdeur':  row["row_num"].tolist()[0],
    #     'usdeur_chg':  row["row_num"].tolist()[0],
    #     'usdeur_ch1':  row["row_num"].tolist()[0],
    #     'usdpeso':  row["row_num"].tolist()[0],
    #     'usdpeso_chg': row["row_num"].tolist()[0],
    #     'usdpeso_ch1':  row["row_num"].tolist()[0],
    #     'usdcan':  row["row_num"].tolist()[0],
    #     'usdcan_chg':  row["row_num"].tolist()[0],
    #     'usdcan_ch1': row["row_num"].tolist()[0],
    #     'ppi_chg':  row["row_num"].tolist()[0],
    #     'ppi_ch1':  row["row_num"].tolist()[0],
    #     'review_score':  row["row_num"].tolist()[0],
    #     'review_cnt':  row["row_num"].tolist()[0],
    #     'min_age':  row["row_num"].tolist()[0],
    #     'max_age':  row["row_num"].tolist()[0],
    #     'lien_count':  row["row_num"].tolist()[0],
    #     'lien_most_recent_age':  row["row_num"].tolist()[0],
    #     'bankruptcy_count':  row["row_num"].tolist()[0],
    #     'bankruptcy_most_recent_age':  row["row_num"].tolist()[0],
    #     'judgement_count':  row["row_num"].tolist()[0],
    #     'judgement_most_recent_age':  row["row_num"].tolist()[0],
    #     'primnaics_sector':  row["row_num"].tolist()[0],
    #     'primnaics_subsector':  row["row_num"].tolist()[0],
    #     'primnaics_industry_group':  row["row_num"].tolist()[0],
    #     'primnaics_industry':  row["row_num"].tolist()[0],
    #     'secnaics1_sector':  row["row_num"].tolist()[0],
    #     'secnaics1_subsector':  row["row_num"].tolist()[0],
    #     'secnaics1_industry_group':  row["row_num"].tolist()[0],
    #     'secnaics1_industry':  row["row_num"].tolist()[0],
    #     'secnaics2_sector':  row["row_num"].tolist()[0],
    #     'secnaics2_subsector':  row["row_num"].tolist()[0],
    #     'secnaics2_industry_group':  row["row_num"].tolist()[0],
    #     'secnaics2_industry':  row["row_num"].tolist()[0],
    #     'secnaics3_sector':  row["row_num"].tolist()[0],
    #     'secnaics3_subsector':  row["row_num"].tolist()[0],
    #     'secnaics3_industry_group':  row["row_num"].tolist()[0],
    #     'secnaics3_industry':  row["row_num"].tolist()[0],
    #     'secnaics4_sector':  row["row_num"].tolist()[0],
    #     'secnaics4_subsector':  row["row_num"].tolist()[0],
    #     'secnaics4_industry_group':  row["row_num"].tolist()[0],
    #     'secnaics4_industry':  row["row_num"].tolist()[0],
    #     'months_since_update': row["row_num"].tolist()[0]
    # }
    
    d = {
    'legultstateall': 0,
    'corpamount_type': 0,
    'corpamount_prec': 0,
    'failrate_avg': 0,
    'primsic': 0,
    'secsic1': 0,
    'secsic2': 0,
    'secsic3': 0,
    'secsic4': 0,
    'primnaicscode': 0,
    'secnaics1': 0,
    'secnaics2': 0,
    'secnaics3': 0,
    'secnaics4': 0,
    'primnaics_sector': 0,
    'primnaics_subsector': 0,
    'primnaics_industry_group': 0,
    'primnaics_industry': 0,
    'secnaics1_sector': 0,
    'secnaics1_subsector': 0,
    'secnaics1_industry_group': 0,
    'secnaics1_industry': 0,
    'secnaics2_sector': 0,
    'secnaics2_subsector': 0,
    'secnaics2_industry_group': 0,
    'secnaics2_industry': 0,
    'secnaics3_sector': 0,
    'secnaics3_subsector': 0,
    'secnaics3_industry_group': 0,
    'secnaics3_industry': 0,
    'secnaics4_sector': 0,
    'secnaics4_subsector': 0,
    'secnaics4_industry_group': 0,
    'secnaics4_industry': 0,
    'location_cnt': 0,
    'location_active_cnt': 0,
    'location_inactive_cnt': 0,
    'location_inactiveold_cnt': 0,
    'location_inactivedt_cnt': 0,
    'location_latitude_avg': 0,
    'location_longitude_avg': 0,
    'location_soho_cnt': 0,
    'location_biz_cnt': 0,
    'location_res_cnt': 0,
    'location_small_cnt': 0,
    'location_large_cnt': 0,
    'location_unknown_size_cnt': 0,
    'location_gov_cnt': 0,
    'location_fedgov_cnt': 0,
    'location_nonprofitind_cnt': 0,
    'location_edu_cnt': 0,
    'location_indsole_cnt': 0,
    'location_partner_cnt': 0,
    'location_limpartner_cnt': 0,
    'location_corp_cnt': 0,
    'location_scorp_cnt': 0,
    'location_llc_cnt': 0,
    'location_llp_cnt': 0,
    'location_other_cnt': 0,
    'location_ccorp_cnt': 0,
    'location_nonprofitstat_cnt': 0,
    'location_mutual_cnt': 0,
    'location_trust_cnt': 0,
    'location_lllp_cnt': 0,
    'bankrupt_cnt_failrt': 0,
    'bankrupt_cnt_credcls': 0,
    'bankrupt_cnt_field': 0,
    'corpemployees': 0,
    'corpamount': 0,
    'creditscore_avg': 0,
    'creditscore_max': 0,
    'creditscore_min': 0,
    'creditperc_avg': 0,
    'creditperc_max': 0,
    'creditperc_min': 0,
    'mkt_telscore_avg': 0,
    'mkt_telscore_max': 0,
    'mkt_telscore_min': 0,
    'mkt_totalscore_avg': 0,
    'mkt_totalscore_max': 0,
    'mkt_totalscore_min': 0,
    'months_since_update': 0,
    'legname_occ': 0,
    'afflname_occ': 0,
    'gdp_pch': 0,
    'gdp_pc1': 0,
    't10y2y': 0,
    't10y2y_chg': 0,
    't10y2y_ch1': 0,
    't10y': 0,
    't10y_chg': 0,
    't10y_ch1': 0,
    't2y': 0,
    't2y_chg': 0,
    't2y_ch1': 0,
    'brent_pch': 0,
    'brent_pc1': 0,
    'wtispot_pch': 0,
    'wtispot_pc1': 0,
    'vix': 0,
    'vix_chg': 0,
    'vix_ch1': 0,
    'csentiment': 0,
    'csentiment_chg': 0,
    'csentiment_ch1': 0,
    'dolindx': 0,
    'dolindx_chg': 0,
    'dolindx_ch1': 0,
    'unemp': 0,
    'unemp_chg': 0,
    'unemp_ch1': 0,
    'cpi': 0,
    'cpi_chg': 0,
    'cpi_ch1': 0,
    'cpicore': 0,
    'cpicore_chg': 0,
    'cpicore_ch1': 0,
    'ccdelinq': 0,
    'ccdelinq_chg': 0,
    'ccdelinq_ch1': 0,
    'cloandelinq': 0,
    'cloandelinq_chg': 0,
    'cloandelinq_ch1': 0,
    'busloandelinq': 0,
    'busloandelinq_chg': 0,
    'busloandelinq_ch1': 0,
    'wagegrowth': 0,
    'wagegrowth_chg': 0,
    'usdeur': 0,
    'usdeur_chg': 0,
    'usdeur_ch1': 0,
    'usdpeso': 0,
    'usdpeso_chg': 0,
    'usdpeso_ch1': 0,
    'usdcan': 0,
    'usdcan_chg': 0,
    'usdcan_ch1': 0,
    'ppi_chg': 0,
    'ppi_ch1': 0,
    'review_score': 0,
    'review_cnt': 0,
    'min_age': 0,
    'max_age': 0,
    'lien_count': 0,
    'lien_most_recent_age': 0,
    'bankruptcy_count': 0,
    'bankruptcy_most_recent_age': 0,
    'judgement_count': 0,
    'judgement_most_recent_age': 0,
    }
    
    columns = loaded_model.get_booster().feature_names
    print(columns)
    
    data = pandas.DataFrame(d, index=[0])

    data[categorical_columns] = str(data[categorical_columns])
    print(data)

    data[categorical_columns] = target_encoder.transform(data[categorical_columns])
    result = loaded_model.predict_proba(data)
    # print(result)

    print(result[:,0][0])
    explanation_xgb_testraw = tree_explainer(data, check_additivity=False)            
    # print(explanation_xgb_testraw)

    shap_scores = explanation_xgb_testraw.values[0]
    shap_base = explanation_xgb_testraw.base_values[0]
    
    #shap_scores_array = numpy.array(shap_scores)

    # Create a SHAP DataFrame
    shap_df = pandas.DataFrame({
        'model_field': columns
        , 'shap_scores': shap_scores
    })

    # Convert SHAP Scores to Points
    # In this, there is no scaling, just converting using the 500 scale
    # The 500 scale is the difference between the lowest score of 350 and the highest of 850
    shap_df['shap_points'] = shap_df['shap_scores'] * 500

    # Convert Baseline to Points
    # For this, we have to scale and add in the base score
    shap_base_points = shap_base * (850 - 350) + 350
    # print(shap_base_points)

    # We can check that the Base Points and the sum of all SHAP Points from features
    # We can also check the conversion of the Sum of All SHAP Scores to Points
    # These should be equal
    # print(shap_base_points + shap_df['shap_points'].sum())
    # print( (shap_base + shap_df['shap_scores'].sum()) * (850 - 350) + 350 )

    # Create SHAP Points by Groups
    # In the same way we can sum the effects of individual features, we can sum the effects of groups
    columns_grp_df = pandas.read_csv('./modelv2.0/v2_field_grps.csv')
    shap_df = shap_df.merge(columns_grp_df, on='model_field')
    # print(shap_df)
    shap_points_grps = shap_df.groupby('grp').sum()
    shap_points_grps_interm = shap_df.groupby('grp_interm').sum()

    print(shap_base_points + shap_points_grps['shap_points'].sum())
    print(shap_base_points + shap_points_grps_interm['shap_points'].sum())
    print(shap_points_grps)
    print(shap_points_grps_interm)
    
    columns_grp_df_only_groups = columns_grp_df.drop(columns=['model_field'])
    columns_grp_df_only_groups = columns_grp_df_only_groups.drop_duplicates(subset=['grp','grp_interm'])
    
    category_score = {}
    for grp in set(columns_grp_df_only_groups['grp']):
        #print(row)
        group_Score = shap_points_grps.filter(items=[grp], axis=0)
        #print(group_Score)
        #print(group_Score)
        category_score[grp] = {
            'shap_scores': group_Score.shap_scores[grp],
            'shap_points': group_Score.shap_points[grp],
            'probability': 0,
            'min': 0,
            'max': 0,
            'percent': 0,
            'subcategory_score': {}
        }
        grps_interm_list =  columns_grp_df_only_groups[columns_grp_df_only_groups['grp'] == grp]
        for index_i, row_i in grps_interm_list.iterrows():
            # print(row_i)
            group_interim_Score = shap_points_grps_interm.filter(items=[row_i.grp_interm], axis=0)
            category_score[row_i.grp]['subcategory_score'][row_i.grp_interm] = {
                'shap_scores': group_interim_Score.shap_scores[row_i.grp_interm],
                'shap_points': group_interim_Score.shap_points[row_i.grp_interm],
            }
        
    # print(category_score)
    # print(shap_points_grps_interm_1)
    

if __name__ == "__main__":
    main()
