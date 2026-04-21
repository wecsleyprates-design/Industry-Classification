<!-- Source: https://docs.worthai.com/webhooks/payment-processor.md -->
# Payment Processor

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Payment Processor

> Sample payloads for Payment Processor webhook events

| Webhook Event                       | Description                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| `payment_processor.account_updated` | Triggered when a payment processor account is updated for a business. |

## payment\_processor.account\_updated

```json theme={null}
{
  "event_type": "payment_processor.account_updated",
  "payload": {
    "case_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "business_id": "c5bf2bc0-56d9-4e83-9451-556872793e48",
    "processor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "processor_name": "stripe",
    "id": "d4e5f6a7-b8c9-0123-4567-890abcdef123",
    "account_id": "acct_1234567890abcdef"
  }
}
```
