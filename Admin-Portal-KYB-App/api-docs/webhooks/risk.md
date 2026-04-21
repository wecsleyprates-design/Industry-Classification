<!-- Source: https://docs.worthai.com/webhooks/risk.md -->
# Risk

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Risk

> Sample payloads for Risk webhook events

| Webhook Event | Description                                              |
| ------------- | -------------------------------------------------------- |
| `risk.alert`  | Triggered when a risk alert is generated for a business. |

## risk.alert

```json theme={null}
{
  "event_type": "risk.alert",
  "payload": {
    "business_id": "2f2616ae-d695-42c8-ba94-da023abee546",
    "risk_level": "LOW | MODERATE | HIGH",
    "risk_alert_subtype": "score_range | worth_score_change | score_risk_tier_transition | new_lien | new_judgement | new_bankruptcy | equifax_credit_score | integration_failure",
    "risk_alert_config_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "measurement_config": "{\"threshold\":300,\"min\":0,\"max\":499}",
    "score_trigger_id": "b7bbb775-4dd6-445b-8f31-d7a99ff91ff1"
  }
}
```
