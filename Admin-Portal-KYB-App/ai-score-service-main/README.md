
# 👋 AI Score Service

AI Score serice does following sequentially
- Receives trigger from Kafka Topic / Consumer / Subscribe
- Pulls data from S3
- Maps data from S3 to the Dataframe needs by AI Model
- Generates probability from AI model
- Pushed the score to yet another Kafka topic / Producer 

## ⚡Model

- -model- folder contains the champion.pkl
- Explanations will be soon produced
- For now docker build bundles the model.
- Model should be part of volume mount.


## ⚡Local environment
- docker compose build
- docker compose up -d
- docker compose logs
- docker compose logs aiscore


## ⚡Input and Output - To be discussed and decided
### Input: 
```json
{
  "score_trigger_id": "c5b5543a-ffbd-4386-92d6-bd5d7f3d147d",
  "business_id": "1d05b807-8aaa-42c5-89c8-ddb717626545",
  "score_input": {
        "state": "NJ",
        "city": "Montclair",
        "bus_struct": "corporation",
        "formation_date": "2020-02-24T00:00:00.000Z",
        "naics_code": "722511",
        "primsic": null,
        "count_employees": null,
        "revenue": -6,
        "is_net_income": -7.415850000000001,
        "indicator_public": 0,
        "count_reviews": 83,
        "score_reviews": 4.3,
        "count_bankruptcy": null,
        "count_judgment": null,
        "count_lien": null,
        "indicator_government": null,
        "indicator_federal_government": null,
        "indicator_education": null,
        "is_cost_of_goods_sold": 0,
        "is_operating_expense": 1.41585,
        "is_gross_profit": -7.415850000000001,
        "bs_accounts_receivable": null,
        "bs_accounts_payable": null,
        "bs_total_assets": 0.055,
        "bs_total_debt": 0,
        "bs_total_equity": null,
        "bs_total_liabilities_and_equity": null,
        "bs_total_liabilities": 0,
        "cf_capex": 0,
        "cf_cash_at_end_of_period": -0.3825400000000001,
        "cf_operating_cash_flow": -4.584149999999999,
        "flag_equity_negative": null,
        "flag_total_liabilities_over_assets": 0,
        "flag_net_income_negative": 1,
        "ratio_accounts_payable_cash": null,
        "ratio_total_liabilities_cash": 0,
        "ratio_total_liabilities_assets": 0,
        "ratio_return_on_equity": null,
        "ratio_return_on_assets": -134.83363636363637,
        "ratio_net_income_ratio": 1.235975,
        "ratio_income_quality_ratio": 0.6181557070329091,
        "ratio_gross_margin": 1.235975,
        "ratio_equity_multiplier": null,
        "ratio_debt_to_equity": null,
        "ratio_operating_margin": 1.235975,
        "ratio_cash_ratio": null,
        "ratio_accounts_receivable_cash": null,
        "age_business": 5,
        "age_bankruptcy": 4,
        "age_lien": 67,
        "age_judgment": 7
    }
}
```
### Output: 
```json
{
  "score_trigger_id": "c5b5543a-ffbd-4386-92d6-bd5d7f3d147d",
  "business_id": "1d05b807-8aaa-42c5-89c8-ddb717626545",
  "probablity": "0.7042781",
  "score_300_850": "687.3529613018036",
  "score_0_100": "70.42781114578247",
  "score": "687.3529613018036",
  "categorical_scores": {
    "business_operations": {
      "probability": 0.0499937191385898,
      "min": -0.0971882637544768,
      "max": 0.238952272855025,
      "percent": 43.78584754389488
    },
    "company_profile": {
      "probability": 0.05532264338982596,
      "min": -0.0849648300877785,
      "max": 0.146143603806081,
      "percent": 60.70201381834204
    },
    "financial_trends": {
      "probability": -0.14053003766231295,
      "min": -0.313192936830061,
      "max": 0.202073404703692,
      "percent": 33.509446523092485
    },
    "liquidity": {
      "probability": -0.01991537377885301,
      "min": -0.176009642982403,
      "max": 0.231922369998685,
      "percent": 38.264775559741764
    }
  }
}
```


## ⚡.env file
```
CONFIG_KAFKA_BROKERS=kafka1:19092
CONFIG_KAFKA_SCORE_TRIGGER_TOPIC=score-trigger
CONFIG_KAFKA_SCORE_GENERATED_TOPIC=score-generated
CONFIG_MODEL_FILE_PATH=./model/champion.pkl
```
[Refer .env.example](.env.example)