<!-- Source: https://docs.worthai.com/api-reference/auth/sign-in/forgot-password-init.md -->
# Forgot Password Init

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Forgot Password Init

> Allows an admin to request a password reset link via email.



## OpenAPI

````yaml post /forgot-password
openapi: 3.1.0
info:
  title: Auth Service
  version: 1.0.0
  description: API documentation for Auth Service
servers:
  - url: https://api.joinworth.com/auth/api/v1
    description: Production server
security: []
paths:
  /forgot-password:
    post:
      tags:
        - Sign In
      summary: Forgot Password Init
      description: Allows an admin to request a password reset link via email.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  description: User's email address
              required:
                - email
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: success
                  message:
                    type: string
                    example: >-
                      A link to reset your password has been sent to the
                      registered email
              example:
                status: success
                message: >-
                  A link to reset your password has been sent to the registered
                  email
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
components:
  responses:
    BadRequest:
      description: Invalid Request
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Error occurred
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Unauthorized
              errorCode:
                type: string
                example: ERR_UNAUTHORIZED
    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Forbidden
              errorCode:
                type: string
                example: ERR_FORBIDDEN
    InternalServerError:
      description: Internal Server Error
      content:
        application/json:
          schema:
            type: object
            properties:
              message:
                type: string
                example: Internal Server Error
              errorCode:
                type: string
                example: ERR_INTERNAL_SERVER

````

Built with [Mintlify](https://mintlify.com).