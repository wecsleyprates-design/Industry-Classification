<!-- Source: https://docs.worthai.com/onboarding-sdk/api-step-by-step-breakdown.md -->
# Sample Implementation API - Step by step breakdown

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Sample Implementation API - Step by step breakdown

> Detailed breakdown of each step in the API onboarding flow

This page provides detailed information about each step in the business onboarding flow, including endpoint paths, key parameters, and links to the complete API reference documentation.

## Step 1: Customer Sign-In

Authenticate the customer using username (email) and password to obtain the customer token.

**Authentication**: None (public endpoint)

**Example Request**:

```
POST  /auth/api/v1/customer/sign-in
```

**Example Request Body**:

```json theme={null}
{
  "email": "customer@joinworth.com",
  "password": "12345"
}
```

**Response includes**:

* `id_token`: Token used for secure API communication (recommended for all API calls)
* `customer_details`: Object containing customer information
  * `id`: The unique identifier of the customer (customerID)

> **Important**: Always use the `id_token` (also referred to as `customer_token`) for secure API communication in subsequent steps.

> **API Reference**: [Customer Sign In](/api-reference/auth/sign-in/customer-sign-in)

## Step 2: Add Business

This service creates the business, the case and a applicant invite link and returns it on the api response if `generate_invite_link` is true.

**Example Request**:

```
POST  /case/api/v1/businesses/customers/:customerID
```

### Important fields

* `external_id`: This field is the parent site identifier for this business.
* `name`: Business name.
* `address_`: This ones are related to the business address.
* `tin`: Business Tax Identification Number.
* `owner_`: This fields are related to the business owner information, that will be autopopulated.
* `applicant_`: This fields are related to the applicant that will be linked to the invite.
* `applicant_subrole_code`: This field needs to be "owner" in lowercase for the platform to work.
* `generate_invite_link`: This field needs to be true so we receive the invite link as part of the API response.

### Example Request Body

```json theme={null}
{
  "external_id": "external-sdk-business",
  "name": "SDK Business One",
  "address_line_1": "601-7 Sansburys Way",
  "address_city": "West Palm Beach",
  "address_state": "FL",
  "address_postal_code": "33411",
  "tin": "942404110",
  "owner1_first_name": "Leslie",
  "owner1_last_name": "Knope",
  "owner1_email": "leslie.knope@joinworth.com",
  "owner1_mobile": "+12055551212",
  "owner1_ssn": "123456788",
  "owner1_dob": "1975-01-18",
  "owner1_address_line_1": "123 Main St.",
  "owner1_address_city": "Pawnee",
  "owner1_address_state": "IN",
  "owner1_address_postal": "46001",
  "owner1_address_country": "US",
  "owner1_title": "1% Shareholder",
  "owner1_owner_type": "CONTROL",
  "owner1_ownership_percentage": 100,
  "applicant_first_name": "Frank",
  "applicant_last_name": "Swarz",
  "applicant_email": "frank.swarz@joinworth.com",
  "applicant_subrole_code": "owner",
  "generate_invite_link": true
}
```

### Response

The response includes:

* `invitation_url`: The customer bearer token needed for the iframe initialization. This is part of the "applicant" object inside data\[0].

> **Note**: This documentation shows only the fields needed to onboard a user using the SDK.
> For the complete API reference with all available fields, see [Add Business](/api-reference/add-or-update-business/add-business).

## Related Documentation

* [Overview](/onboarding-sdk/overview) - Return to the flow overview
* [Detailed Sequence Diagram](/onboarding-sdk/api-sequence-diagram) - Visual representation of the flow
* [API Reference](/onboarding-sdk/api-reference) - Complete endpoint documentation
