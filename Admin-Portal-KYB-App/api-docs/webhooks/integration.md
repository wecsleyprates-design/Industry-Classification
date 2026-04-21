<!-- Source: https://docs.worthai.com/webhooks/integration.md -->
# Integration

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Integration

> Sample payloads for Integration webhook events

| Webhook Event              | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| `integration.connected`    | Triggered when an integration is connected for a business.    |
| `integration.disconnected` | Triggered when an integration is disconnected for a business. |
| `integration.failed`       | Triggered when an integration fails for a business.           |

## integration.connected

```json theme={null}
{
  "event_type": "integration.connected",
  "payload": {
    "business_id": "4bbbcdd9-4f3b-4c29-8bd3-34066a447ff8",
    "case_id": "57128749-b476-4d6c-97cd-19494e303aea",
    "integration_category": "Taxation",
    "integration_platform": "Tax Status"
  }
}
```

## integration.disconnected

```json theme={null}
{
  "event_type": "integration.disconnected",
  "payload": {
    "business_id": "4bbbcdd9-4f3b-4c29-8bd3-34066a447ff8",
    "integration_category": "Banking",
    "integration_platform": "Plaid"
  }
}
```

## integration.failed

```json theme={null}
{
  "event_type": "integration.failed",
  "payload": {
    "case_id": "57128749-b476-4d6c-97cd-19494e303aea",
    "integration_category": "VERIFICATION",
    "status": "FAILED",
    "business_id": "4bbbcdd9-4f3b-4c29-8bd3-34066a447ff8",
    "business_name": "Acme Corporation"
  }
}
```
