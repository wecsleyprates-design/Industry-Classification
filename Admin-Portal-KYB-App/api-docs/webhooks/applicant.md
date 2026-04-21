<!-- Source: https://docs.worthai.com/webhooks/applicant.md -->
# Applicant

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Applicant

> Sample payloads for Applicant webhook events

| Webhook Event        | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `applicant.reminder` | Triggered when an application's age exceeds the defined thresholds. |

## applicant.reminder

<Note>
  On a Worth-set schedule once daily, each business is checked against pre-defined aging thresholds. Once an application's age passes a set
  threshold, the applicant reminder webhook event is dispatched.
</Note>

```json theme={null}
{
  "event_type": "applicant.reminder",
  "payload": {
    "applicant_email": "someguy@website.com",
    "applicant_id": "5682659e-cf9c-40af-acac-ab825b314f37",
    "business_id": "e37cf474-6073-4a00-8a96-523e86aace8f",
    "case_id": "c350160d-d62d-41a0-b13e-2ccfc0f94d33",
    "custom_message": "Your application is overdue and may be closed soon if no action is taken.",
    "days_since_invite_click": 93,
    "onboarding_url": "https://app.qa.joinworth.com/verify/invite?token=",
    "timestamp": "2025-11-27T05:02:27.883Z",
    "urgency": "high",
    "urgency_threshold_days": 90
  }
}
```
