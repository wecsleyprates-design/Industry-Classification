<!-- Source: https://docs.worthai.com/onboarding-sdk/errors/add-business.md -->
# API Error Handling - Add Business Service

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# API Error Handling - Add Business Service

> Complete guide to handling errors for the POST /businesses/customers/:customerID endpoint

## Endpoint

```
POST /api/v1/businesses/customers/:customerID
```

## Overview

This document provides comprehensive error handling guidance for external developers integrating with the Add Business API endpoint. This endpoint allows you to add a new business to a customer's account. Each error scenario includes classification, sample responses, and actionable recommendations for handling the error in your application.

## Error Types

The endpoint can return errors classified into four main categories:

* **Validation Error**: Request format, schema, or data validation issues
* **Network Error**: HTTP method or connectivity issues
* **Authentication Error**: Authentication, authorization, or permission issues
* **Internal Server Error**: Server-side failures requiring retry logic

## Error Index

Quick navigation to specific error scenarios:

1. [Validation Error (Request Body Schema)](#1-validation-error-request-body-schema)
2. [Method Not Allowed Error](#2-method-not-allowed-error)
3. [Authentication Error (Missing or Invalid Token)](#3-authentication-error-missing-or-invalid-token)
4. [Authorization Error (Role Not Allowed)](#4-authorization-error-role-not-allowed)
5. [Feature Flag Not Enabled](#5-feature-flag-not-enabled)
6. [Onboarding Limit Exhausted](#6-onboarding-limit-exhausted)
7. [Onboarding Limit Will Be Exceeded](#7-onboarding-limit-will-be-exceeded)
8. [Data Permission Error](#8-data-permission-error)
9. [Business Processing Error (Mapper Error)](#9-business-processing-error-mapper-error)
10. [Business Not Found Error](#10-business-not-found-error)

***

## 1. Validation Error (Request Body Schema)

### Scenario

Request body does not match the required schema for adding a business.

### When It Happens

* Missing required fields (e.g., `name`)
* Invalid field types (e.g., `customerID` is not a valid UUID, `tin` format is invalid)
* Invalid field formats (e.g., `applicant_email` is not a valid email format, `mobile` is not a valid phone number)
* Invalid UUID format for `customerID` in URL path
* Invalid query parameters
* Extra fields that are not allowed

### Classification

**Validation Error**

### Error Details

* **Error Class**: `ValidationMiddlewareError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Validation error message from schema",
  "errorCode": "INVALID",
  "data": {
    "errorName": "ValidationMiddlewareError"
  }
}
```

### Example Scenarios

* Missing `name`: `{ "external_id": "ext-123" }`
* Invalid `customerID` UUID: `POST /api/v1/businesses/customers/invalid-uuid`
* Invalid `tin` format: `{ "external_id": "ext-123", "name": "Business", "tin": "invalid" }`
* Invalid email format: `{ "external_id": "ext-123", "name": "Business", "applicant_email": "not-an-email" }`

### How to Handle

1. **Validate input before sending the request**: Implement client-side validation to ensure all required fields are present and properly formatted before making the API call.

2. **Ensure proper request format**: Verify that your request body matches the expected schema:

   * `name`: Must be a non-empty string (required)
   * `external_id`: Must be a non-empty string
   * `customerID`: Must be a valid UUID in the URL path
   * `tin`: Must match valid TIN formats (9 digits, UK formats, etc.)
   * Optional fields must match their expected types

3. **Do not retry automatically**: This is a client-side error that requires user action. Wait for the user to correct the input before attempting the request again.

***

## 2. Method Not Allowed Error

### Scenario

Request uses an HTTP method other than POST (e.g., GET, PUT, DELETE, PATCH).

### When It Happens

* Client sends GET request to `/businesses/customers/:customerID`
* Client sends PUT/DELETE/PATCH request to this endpoint
* Any non-POST request to this endpoint

### Classification

**Network Error** (HTTP method mismatch)

### Error Details

* **Error Class**: `MethodNotAllowedError`
* **HTTP Status**: `405 Method Not Allowed`
* **Error Code**: `NOT_ALLOWED`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Method Not Allowed",
  "errorCode": "NOT_ALLOWED",
  "data": {
    "errorName": "MethodNotAllowedError"
  }
}
```

### How to Handle

1. **Verify HTTP method**: Ensure you are using the `POST` method for this endpoint. This is a configuration issue in your HTTP client code.

2. **Check your API client setup**: Review your HTTP client configuration (fetch, axios, etc.) to ensure the correct method is being used.

3. **No retry needed**: This is a permanent error that indicates incorrect API usage. Fix the HTTP method in your code and the request will succeed.

4. **Update your integration**: If you're using a generated API client or SDK, ensure it's up to date with the latest API specification.

***

## 3. Authentication Error (Missing or Invalid Token)

### Scenario

Request is missing the Authorization header or the token is invalid, expired, or malformed.

### When It Happens

* Missing `Authorization` header
* Authorization header does not start with "Bearer"
* Token is expired
* Token is invalid or malformed
* Token verification fails

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `AuthenticationMiddlewareError` or token verification error
* **HTTP Status**: `401 Unauthorized` or `400 Bad Request`
* **Error Code**: `UNAUTHENTICATED` or `INVALID`
* **Message**: Varies based on the specific error

### Sample API Response

**Missing Authorization Header:**

```json  theme={null}
{
  "status": "fail",
  "message": "Authorization header not present",
  "errorCode": "UNAUTHENTICATED",
  "data": {
    "errorName": "AuthenticationMiddlewareError"
  }
}
```

**Invalid Authorization Header Format:**

```json  theme={null}
{
  "status": "fail",
  "message": "Invalid Authorization header type",
  "errorCode": "INVALID",
  "data": {
    "errorName": "AuthenticationMiddlewareError"
  }
}
```

**Expired Token:**

```json  theme={null}
{
  "status": "fail",
  "message": "User Session Expired",
  "errorCode": "UNAUTHENTICATED",
  "data": {
    "errorName": "TokenExpiredError"
  }
}
```

### How to Handle

1. **Check Authorization header**: Ensure your request includes a valid `Authorization` header in the format: `Authorization: Bearer <token>`

2. **Handle token expiration**: If you receive a "User Session Expired" error, you need to:

   * Refresh the user's authentication token
   * Retry the request with the new token
   * If token refresh fails, redirect the user to re-authenticate

3. **Do not retry with the same token**: If the token is invalid or expired, do not automatically retry with the same token. You must obtain a new valid token first.

4. **Implement token refresh logic**: Implement automatic token refresh when you detect token expiration errors, then retry the original request.

5. **Handle gracefully**: If authentication fails, redirect the user to your login page or show an appropriate error message.

***

## 4. Authorization Error (Role Not Allowed)

### Scenario

The authenticated user does not have the required role (ADMIN or CUSTOMER) to access this endpoint.

### When It Happens

* User has APPLICANT role (not allowed)
* User has a role that is not ADMIN or CUSTOMER
* Role information is missing or invalid

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `RoleMiddlewareError`
* **HTTP Status**: `401 Unauthorized`
* **Error Code**: `UNAUTHORIZED`
* **Message**: `"Role Not Allowed"`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Role Not Allowed",
  "errorCode": "UNAUTHORIZED",
  "data": {
    "errorName": "RoleMiddlewareError"
  }
}
```

### How to Handle

1. **Verify user permissions**: Ensure the user making the request has ADMIN or CUSTOMER role. This endpoint is not available for APPLICANT role users.

2. **Do not retry**: This is a permanent authorization issue. The user's role cannot be changed by retrying the request.

3. **Show appropriate message**: Display a message to the user indicating they do not have permission to perform this action.

4. **Redirect if needed**: If your application has role-based UI, redirect the user to an appropriate page or show a "permission denied" message.

***

## 5. Feature Flag Not Enabled

### Scenario

The feature flag `PAT_120_ADD_BUSINESS` is not enabled for the user or environment.

### When It Happens

* Feature flag is disabled for the current user
* Feature flag is disabled for the environment
* Feature flag service is unavailable

### Classification

**Authentication Error** (Feature access restriction)

### Error Details

* **HTTP Status**: `405 Method Not Allowed`
* **Error Code**: `NOT_ALLOWED`
* **Message**: `"This feature has not been enabled."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "This feature has not been enabled.",
  "erroCode": "NOT_ALLOWED",
  "data": {}
}
```

### How to Handle

1. **Do not retry**: This error indicates the feature is not available. Retrying will not resolve the issue.

2. **Contact support**: If you believe this feature should be enabled, contact support to verify feature flag configuration.

3. **Check feature availability**: If your application checks feature availability before showing UI elements, ensure this check is performed before allowing users to attempt this action.

***

## 6. Onboarding Limit Exhausted

### Scenario

The customer has reached their monthly onboarding limit and cannot add more businesses.

### When It Happens

* Customer has already added the maximum number of businesses allowed for the current month
* Monthly onboarding limit has been exhausted
* Feature flag for monthly onboarding limit is enabled and limit is reached

### Classification

**Authentication Error** (Resource limit restriction)

### Error Details

* **Error Class**: `OnboardingLimitError`
* **HTTP Status**: `403 Forbidden`
* **Error Code**: `NOT_ALLOWED`
* **Message**: `"Monthly onboarding limit exhausted."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Monthly onboarding limit exhausted.",
  "errorCode": "NOT_ALLOWED",
  "data": {
    "errorName": "OnboardingLimitError"
  }
}
```

### How to Handle

1. **Display the error message**: Show the error message clearly to the user, explaining that they have reached their monthly limit.

2. **Do not retry**: This error will persist until the next billing cycle or until the limit is increased. Automatic retries are not useful.

3. **Provide next steps**: Inform the user about:

   * When the limit will reset (typically at the start of the next month)
   * How to contact support to increase their limit
   * Alternative options if available

4. **Prevent future attempts**: Consider disabling the "Add Business" functionality in your UI when this error is encountered, or show a clear message about the limit.

5. **Contact support**: Provide a way for users to contact support if they need to increase their limit.

***

## 7. Onboarding Limit Will Be Exceeded

### Scenario

Adding the requested number of businesses would exceed the customer's monthly onboarding limit.

### When It Happens

* Customer is attempting to add businesses that would exceed their remaining monthly limit
* The sum of existing businesses plus new businesses exceeds the limit

### Classification

**Validation Error** (Business logic validation)

### Error Details

* **Error Class**: `OnboardingLimitError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: `"Onboarding limit will be reached, check remaining limit count."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Onboarding limit will be reached, check remaining limit count.",
  "errorCode": "INVALID",
  "data": {
    "errorName": "OnboardingLimitError"
  }
}
```

### How to Handle

1. **Display the error message**: Show the error message to the user, indicating that adding this many businesses would exceed their limit.

2. **Calculate remaining capacity**: If possible, calculate and display how many businesses the user can still add this month.

3. **Suggest alternatives**: Offer the user options such as:

   * Adding fewer businesses now
   * Waiting until the next billing cycle
   * Contacting support to increase their limit

4. **Do not retry automatically**: This requires user action to either reduce the number of businesses or wait for limit reset.

***

## 8. Data Permission Error

### Scenario

The authenticated CUSTOMER user is attempting to access data (customerID) that does not belong to them.

### When It Happens

* CUSTOMER role user tries to add a business to a different customer's account
* The `customerID` in the URL path does not match the authenticated user's `customer_id`
* Data permission validation fails

### Classification

**Authentication Error** (Data access restriction)

### Error Details

* **Error Class**: `AccessMiddlewareError`
* **HTTP Status**: `403 Forbidden`
* **Error Code**: `UNAUTHORIZED`
* **Message**: `"You are not allowed to access the data."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "You are not allowed to access the data.",
  "errorCode": "UNAUTHORIZED",
  "data": {
    "errorName": "AccessMiddlewareError"
  }
}
```

### How to Handle

1. **Verify customer ID**: Ensure you are using the correct `customerID` in the URL path that matches the authenticated user's customer.

2. **Do not retry**: This is a permanent authorization issue. The user cannot access data that doesn't belong to them.

3. **Show appropriate message**: Display a message indicating the user does not have permission to access this data.

4. **Fix the request**: If this is a bug in your application, correct the `customerID` being sent in the request.

5. **Handle gracefully**: Redirect the user to their own data or show a "permission denied" message.

***

## 9. Business Processing Error (Mapper Error)

### Scenario

Business data validation fails during processing, such as invalid field values, missing required data, or business logic violations.

### When It Happens

* Invalid phone number format
* Invalid owner data (e.g., ownership percentages don't add up to 100%, missing control owner)
* Duplicate external ID for the customer
* Invalid business ID provided when it shouldn't be
* Missing required applicant information
* Invalid address data
* Other business-specific validation failures

### Classification

**Validation Error** (Business logic validation)

### Error Details

* **Error Class**: `MapperError` or `BusinessApiError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: Varies based on the specific validation failure

### Sample API Response

**Duplicate External ID:**

```json  theme={null}
{
  "status": "fail",
  "message": "Bulk process had errors",
  "errorCode": null,
  "data": {
    "runId": "e49f04e9-c82b-454b-b6b7-cde0325b825a",
    "failed_rows": {
      "0": {
        "message": "Validation failed. Error details:",
        "data": [
          {
            "column": "external_id",
            "providedKey": "external_id",
            "value": "test-external-id",
            "reason": "The business external ID already exists for this customer (business ID: 9d75fc32-6770-4586-8dd6-9a9a0b6596b2)",
            "existing_business_id": "9d75fc32-6770-4586-8dd6-9a9a0b6596b2"
          }
        ]
      }
    },
    "result": {}
  }
}
```

**Invalid Ownership:**

```json  theme={null}
{
  "status": "fail",
  "message": "Bulk process had errors",
  "errorCode": null,
  "data": {
    "runId": "fbd78c5b-1c79-4035-a63b-2d091142da78",
    "failed_rows": {
      "0": {
        "message": "Validation failed. Error details:",
        "data": [
          {
            "column": "owner1_ownership_percentage",
            "providedKey": "owner1_ownership_percentage",
            "value": 104,
            "reason": "Owner1 Ownership Percentage must be a number between 0 and 100."
          }
        ]
      }
    },
    "result": {}
  }
}
```

### How to Handle

1. **Parse error details**: The error response includes specific field information (`providedKey`, `column`, `value`, `description`) that you can use to highlight the problematic field in your UI.

2. **Display field-specific errors**: Show the error message next to or below the specific field that failed validation.

3. **Fix and retry**: After the user corrects the data, allow them to retry the request. Do not auto-retry without user action.

4. **Validate client-side**: Implement client-side validation for common issues (phone number format, ownership percentages, etc.) to catch errors before sending the request.

5. **Handle bulk errors**: If processing multiple businesses, the response may include a `failed_rows` object with errors for specific rows. Display these errors appropriately in your UI.

***

## 10. Business Not Found Error

### Scenario

A referenced business, applicant, or related entity cannot be found in the system.

### When It Happens

* Referenced `applicant_id` does not exist
* Referenced `businessID` in query parameters does not exist
* Business referenced in update operations does not exist

### Classification

**Validation Error** (Resource not found)

### Error Details

* **Error Class**: `BusinessApiError`
* **HTTP Status**: `404 Not Found`
* **Error Code**: `NOT_FOUND`
* **Message**: Varies (e.g., "Business not found", "Applicant details not found")

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Business not found",
  "errorCode": "NOT_FOUND",
  "data": {
    "errorName": "BusinessApiError"
  }
}
```

### How to Handle

1. **Verify referenced IDs**: Ensure all referenced IDs (applicant\_id, businessID, etc.) exist and are valid before making the request.

2. **Display error message**: Show the error message to the user, indicating which resource was not found.

3. **Allow user to correct**: Provide a way for the user to select a valid resource or enter the correct ID.

4. **Do not retry automatically**: This error requires user action to provide valid resource references.

***


Built with [Mintlify](https://mintlify.com).