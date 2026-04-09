<!-- Source: https://docs.worthai.com/webhooks/score.md -->
# Worth Score

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Worth Score

> Sample payloads for Worth Score webhook events

| Webhook Event     | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `score.generated` | Triggered when a Worth Score is generated for a business. |
| `score.refreshed` | Triggered when a Worth Score is refreshed for a business. |

## score.generated | score.refreshed

```json  theme={null}
{
  "event_type": "score.generated | score.refreshed",
  "payload": {
    "score_trigger_id": "bbde8bb6-316f-4121-ac77-f17c35a0e8ea",
    "business_id": "2f2616ae-d695-42c8-ba94-da023abee546",
    "score": "646.0662513971329",
    "risk": "HIGH | MEDIUM | LOW"
  }
}
```


Built with [Mintlify](https://mintlify.com).