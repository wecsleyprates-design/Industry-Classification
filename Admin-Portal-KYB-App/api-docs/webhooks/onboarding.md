<!-- Source: https://docs.worthai.com/webhooks/onboarding.md -->
# Onboarding

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Onboarding

> Sample payloads for Onboarding webhook events

| Webhook Event                 | Description                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| `onboarding.invited`          | Triggered when an applicant is invited for onboarding to worth customer.  |
| `onboarding.invite_accepted`  | Triggered when an applicant accepts the invitation.                       |
| `onboarding.invite_completed` | Triggered when an integration completes the invitation flow / onboarding. |
| `onboarding.invite_expired`   | Triggered when an invitation is expired.                                  |

## onboarding.invited

```json  theme={null}
{
  "event_type": "onboarding.invited",
  "payload": {
    "business_applicants": [
      {
        "email": "xyz@email.com",
        "first_name": "XYZ",
        "last_name": "ABC"
      }
    ],
    "business_id": "2f2616ae-d695-42c8-ba94-da023abee546",
    "business_name": "XYZ LTD.",
    "create_business": true,
    "external_id": "30ab52b0-59e8-4dd7-a291-b1ccdc9eecbe",
    "status": "INVITED"
  }
}
```

## onboarding.invite\_accepted

```json  theme={null}
{
  "event_type": "onboarding.invite_accepted",
  "payload": {
    "business_id": "8f52e700-166a-49fb-ad2b-dc81476e53b2",
    "case_id": "62c295f6-edb2-4292-b746-184b8d59eea0",
    "status": "ACCEPTED"
  }
}
```

## onboarding.invite\_completed

```json  theme={null}
{
  "event_type": "onboarding.invite_completed",
  "payload": {
    "business_applicants": [
      {
        "email": "xyz@email.com",
        "first_name": "XYZ",
        "last_name": "ABC"
      }
    ],
    "business_id": "2f2616ae-d695-42c8-ba94-da023abee546",
    "business_name": "XYZ LTD.",
    "invitation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "case_id": "bbde8bb6-316f-4121-ac77-f17c35a0e8ea",
    "applicant_id": "d959db51-1001-42da-80ac-1d8002da5b65",
    "status": "COMPLETED"
  }
}
```

## onboarding.invite\_expired

```json  theme={null}
{
  "event_type": "onboarding.invite_expired",
  "payload": {
    "business_id": "4bbbcdd9-4f3b-4c29-8bd3-34066a447ff8",
    "business_name": "Acme Corporation",
    "case_id": "57128749-b476-4d6c-97cd-19494e303aea",
    "status": "EXPIRED"    
  }
}
```


Built with [Mintlify](https://mintlify.com).