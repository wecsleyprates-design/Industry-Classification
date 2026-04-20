<!-- Source: https://docs.worthai.com/webhooks/case.md -->
# Case

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Case

> Sample payloads for Case webhook events

| Webhook Event         | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `case.created`        | Triggered when a case is created for a business.               |
| `case.status_updated` | Triggered when the status of a case is updated for a business. |

## case.created

```json theme={null}
{
    "event_type": "case.created",
    "payload": {
        "case_id": "0c732678-b38f-41cb-9488-449c43415252",
        "applicant_id": "f83f60a0-55fc-4c30-a93b-8613f99a55e1",
        "status": {
            "id": "ONBOARDING",
            "code": 3,
            "label": "ONBOARDING"
        },
        "created_at": "2025-11-20T06:26:26.980838",
        "created_by": "dc2bf5c0-8c39-41aa-b1f2-658991a0deb2",
        "updated_at": "2025-11-20T06:26:26.980838",
        "updated_by": "dc2bf5c0-8c39-41aa-b1f2-658991a0deb2",
        "assignee": {},
        "assigner": null,
        "business": {
            "id": "dea1d839-0a10-4d3f-8655-43acac989cbd",
            "name": "Business Name",
            "tin": null,
            "address_apartment": null,
            "address_line_1": "35 East 18th Street Manhattan",
            "address_line_2": null,
            "address_city": "New York",
            "address_state": "NY",
            "address_postal_code": "10003",
            "address_country": "US",
            "created_at": "2025-11-20T06:26:14.680757",
            "created_by": "dc2bf5c0-8c39-41aa-b1f2-658991a0deb2",
            "updated_at": "2025-11-20T06:26:26.988131",
            "updated_by": "dc2bf5c0-8c39-41aa-b1f2-658991a0deb2",
            "mobile": null,
            "official_website": "https://www.abckitchen.nyc/",
            "public_website": null,
            "social_account": null,
            "status": "UNVERIFIED",
            "industry": {
                "id": 18,
                "name": "Accommodation and Food Services",
                "code": "accommodation_and_food_services",
                "sector_code": "72",
                "created_at": "2024-04-24T17:56:46.034418",
                "updated_at": "2024-04-24T17:56:46.034418"
            },
            "mcc_id": 78,
            "naics_id": 936,
            "is_deleted": false,
            "naics_code": 722511,
            "naics_title": "Full-Service Restaurants",
            "mcc_code": 5812,
            "mcc_title": "Eating Places & Restaurants"
        },
        "applicant": {
            "first_name": "John",
            "last_name": "Doe",
            "created_at": "2024-03-01T11:35:29.048Z"
        },
        "owners": []
    }
}
```

## case.status\_updated

```json theme={null}
{
    "event_type": "case.status_updated",
    "payload": {
        "business_id": "1fb02f66-0740-4312-83e4-0f37283d9e90",
        "case_id": "ff27bb1f-4059-4735-aaed-908c62804863",
        "business_name": "Test Business",
        "status": "ONBOARDING",
        "assignee": null,
        "assigner": null,
        "updated_at": "2025-11-20T06:26:26.980Z",
        "updated_by": "dc2bf5c0-8c39-41aa-b1f2-658991a0deb2"
    }
}
```
