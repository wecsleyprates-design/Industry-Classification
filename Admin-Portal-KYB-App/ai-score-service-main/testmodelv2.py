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
    print('hello')
    loaded_model = pickle.load(open(os.environ.get("CONFIG_MODEL_FILE_PATH", './modelv2.0/pickles/model_2024-04-12.pkl'), 'rb'))
    target_encoder = pickle.load(open(os.environ.get("CONFIG_TARGET_ENCODER_FILE_PATH", './modelv2.0/pickles/target_encoder_2024-04-12.pkl'), 'rb'))
    tree_explainer = pickle.load(open(os.environ.get("CONFIG_MODEL_EXPLAINER_FILE_PATH", './modelv2.0/pickles/tree_explainer_2024-04-12.pkl'), 'rb'))

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
        'csentiment_chg_x',
        'csentiment_chg_y',
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
        'max_age'
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
    print(row["efx_company"].tolist()[0])
    
    d = {
        'legultstateall':  row["legultstateall"].tolist()[0],
        'corpamount_type':  row["corpamount_type"].tolist()[0],
        'corpamount_prec':  row["corpamount_prec"].tolist()[0],
        'failrate_avg':  row["failrate_avg"].tolist()[0],
        'primsic':  row["primsic"].tolist()[0],
        'secsic1':  row["secsic1"].tolist()[0],
        'secsic2':  row["secsic2"].tolist()[0],
        'secsic3':  row["secsic3"].tolist()[0],
        'secsic4':  row["secsic4"].tolist()[0],
        'primnaicscode':  row["primnaicscode"].tolist()[0],
        'secnaics1':  row["secnaics1"].tolist()[0],
        'secnaics2':  row["secnaics2"].tolist()[0],
        'secnaics3':  row["secnaics3"].tolist()[0],
        'secnaics4': row["secnaics4"].tolist()[0],
        'location_cnt':  row["location_cnt"].tolist()[0],
        'location_active_cnt':  row["location_active_cnt"].tolist()[0],
        'location_inactive_cnt':  row["location_inactive_cnt"].tolist()[0],
        'location_inactiveold_cnt':  row["location_inactiveold_cnt"].tolist()[0],
        'location_inactivedt_cnt':  row["location_inactivedt_cnt"].tolist()[0],
        'location_latitude_avg':  row["location_latitude_avg"].tolist()[0],
        'location_longitude_avg':  row["location_longitude_avg"].tolist()[0],
        'location_soho_cnt':  row["location_soho_cnt"].tolist()[0],
        'location_biz_cnt':  row["location_biz_cnt"].tolist()[0],
        'location_res_cnt':  row["location_res_cnt"].tolist()[0],
        'location_small_cnt':  row["location_small_cnt"].tolist()[0],
        'location_large_cnt':  row["location_large_cnt"].tolist()[0],
        'location_unknown_size_cnt':  row["location_unknown_size_cnt"].tolist()[0],
        'location_gov_cnt':  row["location_gov_cnt"].tolist()[0],
        'location_fedgov_cnt':  row["location_fedgov_cnt"].tolist()[0],
        'location_nonprofitind_cnt':  row["location_nonprofitind_cnt"].tolist()[0],
        'location_edu_cnt':  row["location_edu_cnt"].tolist()[0],
        'location_indsole_cnt':  row["location_indsole_cnt"].tolist()[0],
        'location_partner_cnt':  row["location_partner_cnt"].tolist()[0],
        'location_limpartner_cnt':  row["location_limpartner_cnt"].tolist()[0],
        'location_corp_cnt':  row["location_corp_cnt"].tolist()[0],
        'location_scorp_cnt':  row["location_scorp_cnt"].tolist()[0],
        'location_llc_cnt':  row["location_llc_cnt"].tolist()[0],
        'location_llp_cnt':  row["location_llp_cnt"].tolist()[0],
        'location_other_cnt':  row["location_other_cnt"].tolist()[0],
        'location_ccorp_cnt':  row["location_ccorp_cnt"].tolist()[0],
        'location_nonprofitstat_cnt':  row["location_nonprofitstat_cnt"].tolist()[0],
        'location_mutual_cnt':  row["location_mutual_cnt"].tolist()[0],
        'location_trust_cnt':  row["location_trust_cnt"].tolist()[0],
        'location_lllp_cnt':  row["location_lllp_cnt"].tolist()[0],
        'bankrupt_cnt_failrt':  row["bankrupt_cnt_failrt"].tolist()[0],
        'bankrupt_cnt_credcls':  row["bankrupt_cnt_credcls"].tolist()[0],
        'bankrupt_cnt_field':  row["bankrupt_cnt_field"].tolist()[0],
        'corpemployees':  row["corpemployees"].tolist()[0],
        'corpamount':  row["corpamount"].tolist()[0],
        'creditscore_avg':  row["creditscore_avg"].tolist()[0],
        'creditscore_max':  row["creditscore_max"].tolist()[0],
        'creditscore_min':  row["creditscore_min"].tolist()[0],
        'creditperc_avg':  row["creditperc_avg"].tolist()[0],
        'creditperc_max':  row["creditperc_max"].tolist()[0],
        'creditperc_min':  row["creditperc_min"].tolist()[0],
        'mkt_telscore_avg':  row["mkt_telscore_avg"].tolist()[0],
        'mkt_telscore_max':  row["mkt_telscore_max"].tolist()[0],
        'mkt_telscore_min':  row["mkt_telscore_min"].tolist()[0],
        'mkt_totalscore_avg':  row["mkt_totalscore_avg"].tolist()[0],
        'mkt_totalscore_max':  row["mkt_totalscore_max"].tolist()[0],
        'mkt_totalscore_min':  row["mkt_totalscore_min"].tolist()[0],
        'months_since_update':  row["months_since_update"].tolist()[0],
        'legname_occ':  row["legname_occ"].tolist()[0],
        'afflname_occ':  row["afflname_occ"].tolist()[0],
        'gdp_pch': numpy.nan,# row["gdp_pch"].tolist()[0],
        'gdp_pc1': numpy.nan, #  row["gdp_pc1"].tolist()[0],
        't10y2y':  numpy.nan, #row["t10y2y"].tolist()[0],
        't10y2y_chg':  numpy.nan, #row["t10y2y_chg"].tolist()[0],
        't10y2y_ch1':  numpy.nan, #row["t10y2y_ch1"].tolist()[0],
        't10y':  numpy.nan, #row["t10y"].tolist()[0],
        't10y_chg':  numpy.nan, #row["t10y_chg"].tolist()[0],
        't10y_ch1':  numpy.nan, #row["t10y_ch1"].tolist()[0],
        't2y':  numpy.nan, #row["t2y"].tolist()[0],
        't2y_chg':  numpy.nan, #row["t2y_chg"].tolist()[0],
        't2y_ch1':  numpy.nan, #row["t2y_ch1"].tolist()[0],
        'brent_pch':  numpy.nan, #row["brent_pch"].tolist()[0],
        'brent_pc1':  numpy.nan, #row["brent_pc1"].tolist()[0],
        'wtispot_pch':  numpy.nan, #row["wtispot_pch"].tolist()[0],
        'wtispot_pc1':  numpy.nan, #row["wtispot_pc1"].tolist()[0],
        'vix':  numpy.nan, #row["vix"].tolist()[0],
        'vix_chg':  numpy.nan, #row["vix_chg"].tolist()[0],
        'vix_ch1':  numpy.nan, #row["vix_ch1"].tolist()[0],
        'csentiment':  numpy.nan, #row["csentiment"].tolist()[0],
        'csentiment_chg_x':  numpy.nan, #row["csentiment_chg_x"].tolist()[0],
        'csentiment_chg_y':  numpy.nan, #row["csentiment_chg_y"].tolist()[0],
        'dolindx':  numpy.nan, #row["dolindx"].tolist()[0],
        'dolindx_chg':  numpy.nan, #row["dolindx_chg"].tolist()[0],
        'dolindx_ch1':  numpy.nan, #row["dolindx_ch1"].tolist()[0],
        'unemp':  numpy.nan, #row["unemp"].tolist()[0],
        'unemp_chg':  numpy.nan, #row["unemp_chg"].tolist()[0],
        'unemp_ch1':  numpy.nan, #row["unemp_ch1"].tolist()[0],
        'cpi':  numpy.nan, #row["cpi"].tolist()[0],
        'cpi_chg':  numpy.nan, #row["cpi_chg"].tolist()[0],
        'cpi_ch1':  numpy.nan, #row["cpi_ch1"].tolist()[0],
        'cpicore':  numpy.nan, #row["cpicore"].tolist()[0],
        'cpicore_chg':  numpy.nan, #row["cpicore_chg"].tolist()[0],
        'cpicore_ch1':  numpy.nan, #row["cpicore_ch1"].tolist()[0],
        'ccdelinq':  numpy.nan, #row["ccdelinq"].tolist()[0],
        'ccdelinq_chg':  numpy.nan, #row["ccdelinq_chg"].tolist()[0],
        'ccdelinq_ch1':  numpy.nan, #row["ccdelinq_ch1"].tolist()[0],
        'cloandelinq':  numpy.nan, #row["cloandelinq"].tolist()[0],
        'cloandelinq_chg':  numpy.nan, #row["cloandelinq_chg"].tolist()[0],
        'cloandelinq_ch1':  numpy.nan, #row["cloandelinq_ch1"].tolist()[0],
        'busloandelinq':  numpy.nan, #row["busloandelinq"].tolist()[0],
        'busloandelinq_chg':  numpy.nan, #row["busloandelinq_chg"].tolist()[0],
        'busloandelinq_ch1':  numpy.nan, #row["busloandelinq_ch1"].tolist()[0],
        'wagegrowth':  numpy.nan, #row["wagegrowth"].tolist()[0],
        'wagegrowth_chg':  numpy.nan, #row["wagegrowth_chg"].tolist()[0],
        'usdeur':  numpy.nan, #row["usdeur"].tolist()[0],
        'usdeur_chg':  numpy.nan, #row["usdeur_chg"].tolist()[0],
        'usdeur_ch1':  numpy.nan, #row["usdeur_ch1"].tolist()[0],
        'usdpeso':  numpy.nan, #row["usdpeso"].tolist()[0],
        'usdpeso_chg':  numpy.nan, #row["usdpeso_chg"].tolist()[0],
        'usdpeso_ch1':  numpy.nan, #row["usdpeso_ch1"].tolist()[0],
        'usdcan':  numpy.nan, #row["usdcan"].tolist()[0],
        'usdcan_chg':  numpy.nan, #row["usdcan_chg"].tolist()[0],
        'usdcan_ch1':  numpy.nan, #row["usdcan_ch1"].tolist()[0],
        'ppi_chg':  numpy.nan, #row["ppi_chg"].tolist()[0],
        'ppi_ch1':  numpy.nan, #row["ppi_ch1"].tolist()[0],
        'review_score':  numpy.nan, #row["review_score"].tolist()[0],
        'review_cnt':  numpy.nan, #row["review_cnt"].tolist()[0],
        'min_age':  numpy.nan, #row["min_age"].tolist()[0],
        'max_age':  numpy.nan, #row["max_age"].tolist()[0],
    }
    
    print(d)
    columns = loaded_model.get_booster().feature_names
    print(columns)
    data = pandas.DataFrame(d, index=[0])

    data[categorical_columns] = target_encoder.transform(data[categorical_columns])
    result = loaded_model.predict_proba(data)
    print(result)

    print(result[:,0][0])
    explanation_xgb_testraw = tree_explainer(data, check_additivity=False)            
    print(explanation_xgb_testraw)

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
    print(shap_base_points)

    # We can check that the Base Points and the sum of all SHAP Points from features
    # We can also check the conversion of the Sum of All SHAP Scores to Points
    # These should be equal
    print(shap_base_points + shap_df['shap_points'].sum())
    print( (shap_base + shap_df['shap_scores'].sum()) * (850 - 350) + 350 )

    # Create SHAP Points by Groups
    # In the same way we can sum the effects of individual features, we can sum the effects of groups
    columns_grp_df = pandas.read_csv('./modelv2.0/v2_field_grps.csv')
    shap_df = shap_df.merge(columns_grp_df, on='model_field')
    print(shap_df)
    shap_points_grps = shap_df.groupby('grp').sum()
    shap_points_grps_interm = shap_df.groupby('grp_interm').sum()

    print(shap_base_points + shap_points_grps['shap_points'].sum())
    print(shap_base_points + shap_points_grps_interm['shap_points'].sum())
    print(shap_points_grps)
    print(shap_points_grps_interm)
    
    columns_grp_df_only_groups = columns_grp_df.drop(columns=['model_field'])
    columns_grp_df_only_groups = columns_grp_df_only_groups.drop_duplicates(subset=['grp','grp_interm'])
    
    a = {}
    for grp in set(columns_grp_df_only_groups['grp']):
        #print(row)
        group_Score = shap_points_grps.filter(items=[grp], axis=0)
        #print(group_Score)
        #print(group_Score)
        a[grp] = {
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
            print(row_i)
            group_interim_Score = shap_points_grps_interm.filter(items=[row_i.grp_interm], axis=0)
            a[row_i.grp]['subcategory_score'][row_i.grp_interm] = {
                'shap_scores': group_interim_Score.shap_scores[row_i.grp_interm],
                'shap_points': group_interim_Score.shap_points[row_i.grp_interm],
            }

    print(a)
    # print(shap_points_grps_interm_1)
    

if __name__ == "__main__":
    main()
