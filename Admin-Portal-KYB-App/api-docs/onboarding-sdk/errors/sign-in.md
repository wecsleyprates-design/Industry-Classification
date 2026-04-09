<!-- Source: https://docs.worthai.com/onboarding-sdk/errors/sign-in.md -->
# API Error Handling - Sign In Service

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# API Error Handling - Sign In Service

```
POST /api/v1/customer/sign-in
```

## Overview

This document provides comprehensive error handling guidance for external developers integrating with the Customer Sign-In API endpoint. Each error scenario includes classification, sample responses, and actionable recommendations for handling the error in your application.

<RequestExample>
  ```bash  theme={null}
  curl -X POST https://api.dev.joinworth.com/customer/sign-in \
    -H "Content-Type: application/json" \
    -d '{
      "email": "user@example.com",
      "password": "userpassword123"
    }'
  ```
</RequestExample>

## Error Types

The endpoint can return errors classified into four main categories:

* **Validation Error**: Request format or schema issues
* **Network Error**: HTTP method or connectivity issues
* **Authentication Error**: User account or credential issues
* **Internal Server Error**: Server-side failures requiring retry logic

***

## Error Index

Quick navigation to specific error scenarios:

1. [Validation Error (Request Body Schema)](#1-validation-error-request-body-schema)
2. [Method Not Allowed Error](#2-method-not-allowed-error)
3. [User not found / Incorrect credentials](#3-user-not-found-/-incorrect-credentials)
4. [Account Disabled / Inactive](#4-account-disabled-/-inactive)
5. [Invalid User Status (Not Active/Inactive)](#5-invalid-user-status-not-active/inactive)
6. [Incomplete Account Setup](#6-incomplete-account-setup)

***

## 1. Validation Error (Request Body Schema)

### Scenario

Request body does not match the required schema (`Auth.SignIn.SignInWithPasswordRequestSchema`).

### When It Happens

* Missing required fields (e.g., `email` or `password`)
* Invalid field types (e.g., `email` is not a string, `password` is not a string)
* Invalid field formats (e.g., `email` is not a valid email format)
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

* Missing email: `{ "password": "password123" }`
* Missing password: `{ "email": "user@example.com" }`
* Invalid email format: `{ "email": "not-an-email", "password": "password123" }`
* Empty body: `{}`

### How to Handle

1. **Validate input before sending the request**: Implement client-side validation to ensure all required fields (`email` and `password`) are present and properly formatted before making the API call.

2. **Ensure proper request format**: Verify that your request body matches the expected schema:
   * `email`: Must be a valid email address string
   * `password`: Must be a non-empty string
   * Remove any extra fields that are not part of the schema

***

## 2. Method Not Allowed Error

### Scenario

Request uses an HTTP method other than POST (e.g., GET, PUT, DELETE, PATCH).

### When It Happens

* Client sends GET request to `/customer/sign-in`
* Client sends PUT/DELETE/PATCH request to `/customer/sign-in`
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

## 3. User Not Found / Incorrect Credentials

### Scenario

User with the provided email does not exist in the database, OR email exists but password is incorrect.

### When It Happens

* Email does not exist for CUSTOMER role
* Email exists but password is incorrect
* User exists but does not have CUSTOMER role assigned

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `SignInApiError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: `"Incorrect username or password."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Incorrect username or password.",
  "errorCode": "INVALID",
  "data": {
    "errorName": "SignInApiError"
  }
}
```

### How to Handle

1. **Do not auto-retry**: This error requires user action (correcting credentials), so do not automatically retry the request.

2. **Implement rate limiting on your side**: To prevent brute force attacks, consider limiting the number of failed sign-in attempts from your application before requiring additional verification.

3. **Handle gracefully**: Since this is a common user error, ensure your UI handles it gracefully without causing frustration. Consider showing helpful hints like "Check your email and password" or "Make sure Caps Lock is off".

4. **Do not store credentials**: Never log or store the user's password in any form, even in error logs.

***

## 4. Account Disabled / Inactive

### Scenario

User account exists but has been disabled (status is INACTIVE).

### When It Happens

* User's status is `INACTIVE`
* Account has been manually disabled by an administrator

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `SignInApiError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: `"Your account has been disabled, Contact Support."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Your account has been disabled, Contact Support.",
  "errorCode": "INVALID",
  "data": {
    "errorName": "SignInApiError"
  }
}
```

### How to Handle

1. **Display the error message clearly**: Fail gracefully, show the exact error message "Your account has been disabled, Contact Support." to the user.

2. **Provide support contact information**: Display contact information for support (email, phone, or support portal) so the user knows how to get help.

3. **Log for monitoring**: Consider logging this error (without sensitive information) for your monitoring systems to track account issues.

4. **Do not auto-retry**: This error will persist until the account is reactivated by an administrator, so automatic retries are not useful.

***

## 5. Invalid User Status (Not Active/Inactive)

### Scenario

User exists but has a status that is not ACTIVE or INACTIVE (e.g., SIGNUP\_PENDING, etc.).

### When It Happens

* User status is `SIGNUP_PENDING` or any other status not in `[ACTIVE, INACTIVE]`
* User has not completed onboarding process

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `SignInApiError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: `"Onboard the platform via Invitation Link sent to your email or Contact Support."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Onboard the platform via Invitation Link sent to your email or Contact Support.",
  "errorCode": "INVALID",
  "data": {
    "errorName": "SignInApiError"
  }
}
```

### How to Handle

1. **Provide support contact**: Include support contact information in case the user needs help accessing their invitation or has questions about the onboarding process.

2. **Do not allow immediate retry**: This error indicates the user needs to take action outside of your application (checking email, completing onboarding). Do not allow immediate retry.

3. **Helpful messaging**: Consider adding context like "This account is pending setup. Please check your email for the invitation link to complete your registration."

***

## 6. Incomplete Account Setup

### Scenario

User account exists but setup is incomplete (first login or email not verified).

### When It Happens

* First login has not been completed
* Email has not been verified
* User has not completed initial account setup

### Classification

**Authentication Error**

### Error Details

* **Error Class**: `SignInApiError`
* **HTTP Status**: `400 Bad Request`
* **Error Code**: `INVALID`
* **Message**: `"Your account setup is incomplete. Please contact support for assistance."`

### Sample API Response

```json  theme={null}
{
  "status": "fail",
  "message": "Your account setup is incomplete. Please contact support for assistance.",
  "errorCode": "INVALID",
  "data": {
    "errorName": "SignInApiError"
  }
}
```

### How to Handle

1. **Display the error message**: Show the error message clearly to the user, as it explains that their account setup is incomplete.

2. **Provide support contact**: Include support contact information prominently, as the user needs to contact support to resolve this issue.

3. **Do not allow retry**: This error indicates the account requires administrative action or additional setup steps that cannot be completed through the sign-in process. Do not allow immediate retry.

***


Built with [Mintlify](https://mintlify.com).