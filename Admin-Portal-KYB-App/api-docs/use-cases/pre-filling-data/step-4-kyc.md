<!-- Source: https://docs.worthai.com/use-cases/pre-filling-data/step-4-kyc.md -->
# Step 4 - KYC

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Step 4 - KYC

### GET KYC – Individual Identity Verification Fields

Similar to KYB, KYC results are tied to a specific business record. To review ownership information, make the following GET KYC call once the recommended KYB information has been captured in the Add Business pre-requisite route:

```http theme={null}
GET /verification/businesses/{businessId}/owners
```

> **Note:** This call must include all required business-level details (see KYB table) **before** KYC fields can be evaluated.
