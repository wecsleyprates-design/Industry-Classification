<!-- Source: https://docs.worthai.com/api-reference/auth/customers/customer-user-resend-invitation.md -->
# Customer User Resend Invitation

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Customer User Resend Invitation

> Allows customer with proper permissions to resend an invite to a specific user associated with a customer.



## OpenAPI

````yaml post /customers/{customerID}/users/{userID}/resend-invite
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
  /customers/{customerID}/users/{userID}/resend-invite:
    post:
      tags:
        - Customers
      summary: Customer User Resend Invitation
      description: >-
        Allows customer with proper permissions to resend an invite to a
        specific user associated with a customer.
      parameters:
        - name: customerID
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: userID
          in: path
          required: true
          schema:
            type: string
            format: uuid
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
                    example: Invite mail sent successfully
              example:
                status: success
                message: Invite mail sent successfully
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: fail
                  message:
                    type: string
                    example: Customer has already onboarded the platform
                  errorCode:
                    type: string
                    example: INVALID
                  data:
                    type: object
                    properties:
                      errorName:
                        type: string
                        example: CustomersApiError
                    required:
                      - errorName
                required:
                  - status
                  - message
                  - errorCode
                  - data
              example:
                status: fail
                message: Customer has already onboarded the platform
                errorCode: INVALID
                data:
                  errorName: CustomersApiError
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '500':
          $ref: '#/components/responses/InternalServerError'
      security:
        - bearerAuth: []
components:
  responses:
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
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

````